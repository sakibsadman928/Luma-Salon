import mongoose from 'mongoose';
import QueueEntry from '../models/QueueEntry.js';
import DailyCounter from '../models/DailyCounter.js';
import ActiveService from '../models/ActiveService.js';
import { getConfig } from '../config/env.js';
import { now } from '../utils/clock.js';
import { AppError } from '../utils/errors.js';
import { getOperatingDate, zonedToUtc, TIME_RE, floorToMinute } from '../utils/time.js';
import { pickNext, buildSnapshot, isActiveStatus } from './queueLogic.js';

const ctx = () => {
  const cfg = getConfig();
  const at = now();
  return { cfg, at, date: getOperatingDate(at, cfg.timezone) };
};
const lockKey = (date) => `active:${date}`;

function assertId(id) {
  if (!mongoose.isValidObjectId(id)) throw new AppError(400, 'Invalid record id.', 'INVALID_ID');
}

export function validateName(raw) {
  if (typeof raw !== 'string') throw new AppError(400, 'Customer name is required.', 'VALIDATION');
  const name = raw.trim().replace(/\s+/g, ' ');
  if (!name) throw new AppError(400, 'Customer name cannot be empty.', 'VALIDATION');
  if (name.length > 60) throw new AppError(400, 'Customer name must be 60 characters or fewer.', 'VALIDATION');
  return name;
}

/** Atomic, database-backed daily token sequence (L001, L002, ...). */
async function nextToken(date) {
  for (let i = 0; i < 5; i++) {
    try {
      const c = await DailyCounter.findOneAndUpdate(
        { operatingDate: date },
        { $inc: { lastTokenNumber: 1 } },
        { upsert: true, returnDocument: 'after' }
      );
      return `L${String(c.lastTokenNumber).padStart(3, '0')}`;
    } catch (e) {
      if (e.code === 11000) continue; // two first-of-day upserts raced; retry
      throw e;
    }
  }
  throw new AppError(503, 'Could not allocate a token. Please retry.', 'TOKEN_RETRY');
}

async function createEntry(fields, date) {
  for (let i = 0; i < 3; i++) {
    const tokenNumber = await nextToken(date);
    try {
      return await QueueEntry.create({ ...fields, tokenNumber, operatingDate: date });
    } catch (e) {
      if (e.code !== 11000) throw e;
    }
  }
  throw new AppError(503, 'Could not register. Please retry.', 'REGISTER_RETRY');
}

export async function registerWalkIn({ customerName }) {
  const { at, date } = ctx();
  const name = validateName(customerName);
  const entry = await createEntry(
    { customerName: name, bookingType: 'WALK_IN', checkedInAt: at, isPresent: true, arrivedAt: at, scheduledAt: null },
    date
  );
  return toView(entry);
}

function resolveScheduledAt({ scheduledAt, scheduledTime }, { cfg, at, date }) {
  let when;
  if (scheduledAt !== undefined && scheduledAt !== null && scheduledAt !== '') {
    when = new Date(scheduledAt);
    if (Number.isNaN(when.getTime())) throw new AppError(400, 'Appointment date/time is invalid.', 'VALIDATION');
  } else if (typeof scheduledTime === 'string' && TIME_RE.test(scheduledTime)) {
    when = zonedToUtc(date, scheduledTime, cfg.timezone);
  } else {
    throw new AppError(400, 'Appointment time is required (HH:mm).', 'VALIDATION');
  }
  if (getOperatingDate(when, cfg.timezone) !== date)
    throw new AppError(400, "Appointments can only be booked for today's operating day.", 'VALIDATION');
  if (when < floorToMinute(at)) throw new AppError(400, 'Appointment time cannot be in the past.', 'VALIDATION');
  return when;
}

export async function registerAppointment(body) {
  const c = ctx();
  const name = validateName(body.customerName);
  const scheduledAt = resolveScheduledAt(body, c);
  const present = body.isPresent === true;
  const entry = await createEntry(
    {
      customerName: name, bookingType: 'APPOINTMENT', scheduledAt, checkedInAt: c.at,
      isPresent: present, arrivedAt: present ? c.at : null,
    },
    c.date
  );
  return toView(entry);
}

/** Mark an appointment customer as present. Rejected once the scheduled time has arrived (no grace period). */
export async function checkIn(id) {
  assertId(id);
  const { at } = ctx();
  const updated = await QueueEntry.findOneAndUpdate(
    { _id: id, bookingType: 'APPOINTMENT', status: 'WAITING', isPresent: false, scheduledAt: { $gt: at } },
    { isPresent: true, arrivedAt: at },
    { returnDocument: 'after' }
  );
  if (updated) return toView(updated);
  const e = await QueueEntry.findById(id);
  if (!e) throw new AppError(404, 'Queue entry not found.', 'NOT_FOUND');
  if (e.bookingType !== 'APPOINTMENT') throw new AppError(409, 'Only appointments need check-in.', 'INVALID_TRANSITION');
  if (e.status !== 'WAITING') throw new AppError(409, `Cannot check in an entry that is ${e.status}.`, 'INVALID_TRANSITION');
  if (e.isPresent) throw new AppError(409, 'Customer is already checked in.', 'INVALID_TRANSITION');
  throw new AppError(
    409,
    'Appointment time has passed without check-in. Cancel this booking and register the customer as a new walk-in.',
    'APPOINTMENT_OVERDUE'
  );
}

async function getActiveEntry(date) {
  const lock = await ActiveService.findById(lockKey(date));
  if (!lock) return null;
  const entry = await QueueEntry.findById(lock.entryId);
  if (entry && isActiveStatus(entry.status)) return entry;
  await ActiveService.deleteOne({ _id: lockKey(date), entryId: lock.entryId }); // heal stale lock
  return null;
}

export async function callNext() {
  const { at, date } = ctx();
  for (let attempt = 0; attempt < 5; attempt++) {
    if (await getActiveEntry(date))
      throw new AppError(409, 'A customer is already being served. Complete the active service first.', 'ACTIVE_SERVICE_EXISTS');
    const entries = await QueueEntry.find({ operatingDate: date, status: 'WAITING' }).lean();
    const candidate = pickNext(entries, at);
    if (!candidate) throw new AppError(404, 'No eligible customer to call right now.', 'NO_ELIGIBLE_CUSTOMER');

    try {
      await ActiveService.create({ _id: lockKey(date), operatingDate: date, entryId: candidate._id });
    } catch (e) {
      if (e.code === 11000)
        throw new AppError(409, 'A customer is already being served. Complete the active service first.', 'ACTIVE_SERVICE_EXISTS');
      throw e;
    }
    const claimed = await QueueEntry.findOneAndUpdate(
      { _id: candidate._id, status: 'WAITING' },
      { status: 'CALLED', calledAt: at },
      { returnDocument: 'after' }
    );
    if (claimed) return toView(claimed);
    await ActiveService.deleteOne({ _id: lockKey(date) }); // entry changed under us; try again
  }
  throw new AppError(409, 'Queue changed while calling. Please try again.', 'RETRY');
}

export async function startService(id) {
  assertId(id);
  const { at } = ctx();
  const u = await QueueEntry.findOneAndUpdate(
    { _id: id, status: 'CALLED' },
    { status: 'IN_SERVICE', serviceStartedAt: at },
    { returnDocument: 'after' }
  );
  if (u) return toView(u);
  throw await transitionError(id, 'start service for');
}

export async function completeService(id) {
  assertId(id);
  const { at, date } = ctx();
  const u = await QueueEntry.findOneAndUpdate(
    { _id: id, status: { $in: ['CALLED', 'IN_SERVICE'] } },
    { status: 'COMPLETED', completedAt: at },
    { returnDocument: 'after' }
  );
  if (!u) throw await transitionError(id, 'complete', 'Only the customer currently being served can be completed.');
  await ActiveService.deleteOne({ _id: lockKey(u.operatingDate || date), entryId: u._id });
  return toView(u);
}

export async function cancelBooking(id) {
  assertId(id);
  const { at } = ctx();
  const u = await QueueEntry.findOneAndUpdate(
    { _id: id, status: { $in: ['WAITING', 'CALLED'] } },
    { status: 'CANCELLED', cancelledAt: at },
    { returnDocument: 'after' }
  );
  if (!u) throw await transitionError(id, 'cancel');
  await ActiveService.deleteOne({ _id: lockKey(u.operatingDate), entryId: u._id }); // releases lock if it was CALLED
  return toView(u);
}

async function transitionError(id, verb, hint) {
  const e = await QueueEntry.findById(id);
  if (!e) return new AppError(404, 'Queue entry not found.', 'NOT_FOUND');
  return new AppError(409, hint ? `${hint} (current status: ${e.status}).` : `Cannot ${verb} an entry that is ${e.status}.`, 'INVALID_TRANSITION');
}

async function loadSnapshot() {
  const { cfg, at, date } = ctx();
  const entries = await QueueEntry.find({ operatingDate: date }).lean();
  const views = buildSnapshot(entries, at, cfg.avgServiceMinutes);
  return { cfg, at, date, views };
}

const baseMeta = ({ cfg, at, date }) => ({
  salonName: cfg.salonName, operatingDate: date, timezone: cfg.timezone, serverTime: at, avgServiceMinutes: cfg.avgServiceMinutes,
});

function summarize(views) {
  return {
    waiting: views.filter((v) => v.status === 'WAITING' && !v.isOverdue).length,
    dueAppointments: views.filter((v) => v.bookingType === 'APPOINTMENT' && v.status === 'WAITING' && v.isDue).length,
    overdueAppointments: views.filter((v) => v.isOverdue).length,
    completed: views.filter((v) => v.status === 'COMPLETED').length,
  };
}

/** Staff view: includes customer names. */
export async function getTodayQueue() {
  const s = await loadSnapshot();
  return {
    ...baseMeta(s),
    summary: summarize(s.views),
    activeService: s.views.find((v) => isActiveStatus(v.status)) || null,
    entries: s.views,
  };
}

const publicView = (v) => ({
  tokenNumber: v.tokenNumber, bookingType: v.bookingType, scheduledAt: v.scheduledAt, status: v.status,
  displayStatus: v.displayStatus, position: v.position, etaMinutes: v.etaMinutes, etaLabel: v.etaLabel,
  estimatedStartAt: v.estimatedStartAt, isOverdue: v.isOverdue,
});

/** Public view: NEVER includes customer names or internal fields. */
export async function getPublicQueue() {
  const s = await loadSnapshot();
  const nowServing = s.views.find((v) => isActiveStatus(v.status));
  return {
    ...baseMeta(s),
    nowServing: nowServing ? publicView(nowServing) : null,
    summary: summarize(s.views),
    queue: s.views.filter((v) => v.status === 'WAITING').map(publicView),
    disclaimer: 'Waiting times are estimates based on an average service time and may change.',
  };
}

export async function getPublicToken(tokenNumber) {
  const s = await loadSnapshot();
  const v = s.views.find((x) => x.tokenNumber === String(tokenNumber).toUpperCase());
  if (!v) throw new AppError(404, 'Token not found for today.', 'NOT_FOUND');
  return { ...baseMeta(s), ticket: publicView(v) };
}

function toView(doc) {
  const o = doc.toObject ? doc.toObject() : doc;
  return { ...o, id: String(o._id), _id: undefined, __v: undefined };
}
