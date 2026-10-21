import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { connectTestDb, clearDb, disconnectTestDb, setNow, at } from './helpers.js';
import * as q from '../services/queueService.js';
import QueueEntry from '../models/QueueEntry.js';
import ActiveService from '../models/ActiveService.js';
import { pickNext } from '../services/queueLogic.js';

beforeAll(connectTestDb);
afterAll(disconnectTestDb);
beforeEach(async () => { await clearDb(); setNow('10:00'); });

const find = (snap, token) => snap.entries.find((e) => e.tokenNumber === token);
const reject = async (p, code) => {
  const err = await p.then(() => null, (e) => e);
  expect(err, 'expected a rejection').not.toBeNull();
  if (code) expect(err.code).toBe(code);
  return err;
};

describe('Registration & validation', () => {
  it('1. registers walk-ins with unique sequential tokens', async () => {
    const a = await q.registerWalkIn({ customerName: '  Aria   Chowdhury ' });
    const b = await q.registerWalkIn({ customerName: 'Rafi' });
    expect([a.tokenNumber, b.tokenNumber]).toEqual(['L001', 'L002']);
    expect(a.customerName).toBe('Aria Chowdhury');
    expect(a.bookingType).toBe('WALK_IN');
  });

  it('2. registers a valid same-day appointment', async () => {
    const a = await q.registerAppointment({ customerName: 'Nusrat', scheduledTime: '11:30' });
    expect(a.bookingType).toBe('APPOINTMENT');
    expect(a.scheduledAt.toISOString()).toBe(at('11:30').toISOString());
    expect(a.isPresent).toBe(false);
    expect(a.checkedInAt).toEqual(at('10:00')); // registration time is separate from scheduled time
  });

  it('3. rejects empty names, invalid times and invalid dates', async () => {
    await reject(q.registerWalkIn({ customerName: '   ' }), 'VALIDATION');
    await reject(q.registerWalkIn({}), 'VALIDATION');
    await reject(q.registerAppointment({ customerName: 'X', scheduledTime: '25:99' }), 'VALIDATION');
    await reject(q.registerAppointment({ customerName: 'X', scheduledTime: '09:00' }), 'VALIDATION'); // past
    await reject(q.registerAppointment({ customerName: 'X', scheduledAt: 'not-a-date' }), 'VALIDATION');
    await reject(q.registerAppointment({ customerName: 'X', scheduledAt: at('11:00', '2026-03-11').toISOString() }), 'VALIDATION'); // tomorrow
    expect(await QueueEntry.countDocuments()).toBe(0);
  });

  it('22. concurrent registrations never produce duplicate tokens', async () => {
    const res = await Promise.all(Array.from({ length: 15 }, (_, i) => q.registerWalkIn({ customerName: `C${i}` })));
    const tokens = res.map((r) => r.tokenNumber);
    expect(new Set(tokens).size).toBe(15);
    expect([...tokens].sort()[14]).toBe('L015');
  });

  it('23. a new operating day restarts tokens and leaves history untouched', async () => {
    await q.registerWalkIn({ customerName: 'Day one A' });
    await q.registerWalkIn({ customerName: 'Day one B' });
    setNow('09:30', '2026-03-11');
    const next = await q.registerWalkIn({ customerName: 'Day two' });
    expect(next.tokenNumber).toBe('L001');
    expect(await QueueEntry.countDocuments({ operatingDate: '2026-03-10' })).toBe(2);
    const today = await q.getTodayQueue();
    expect(today.operatingDate).toBe('2026-03-11');
    expect(today.entries).toHaveLength(1);
  });
});

describe('Call-next selection', () => {
  it('4. serves walk-ins in FIFO order', async () => {
    await q.registerWalkIn({ customerName: 'A' });
    setNow('10:01'); await q.registerWalkIn({ customerName: 'B' });
    setNow('10:02'); await q.registerWalkIn({ customerName: 'C' });
    const first = await q.callNext();
    expect(first.tokenNumber).toBe('L001');
    await q.completeService(first.id);
    expect((await q.callNext()).tokenNumber).toBe('L002');
  });

  it('5 & 14. a future appointment is not called early and does not block walk-ins', async () => {
    await q.registerAppointment({ customerName: 'Future', scheduledTime: '10:30', isPresent: true });
    await q.registerWalkIn({ customerName: 'Walker' });
    const called = await q.callNext();
    expect(called.tokenNumber).toBe('L002');
    expect(called.bookingType).toBe('WALK_IN');
  });

  it('6. a present, due appointment beats waiting walk-ins (tokens unchanged)', async () => {
    await q.registerWalkIn({ customerName: 'W1' });
    await q.registerAppointment({ customerName: 'Appt', scheduledTime: '10:10', isPresent: true }); // L002
    setNow('10:05'); await q.registerWalkIn({ customerName: 'W2' });
    setNow('10:10');
    const called = await q.callNext();
    expect(called.tokenNumber).toBe('L002');
  });

  it('7. among due appointments the earliest scheduled time wins', async () => {
    await q.registerAppointment({ customerName: 'Late slot', scheduledTime: '10:20', isPresent: true }); // L001
    await q.registerAppointment({ customerName: 'Early slot', scheduledTime: '10:10', isPresent: true }); // L002
    setNow('10:25');
    expect((await q.callNext()).tokenNumber).toBe('L002');
  });

  it('15. completed, cancelled and no-show entries are never selected', () => {
    const base = { bookingType: 'WALK_IN', checkedInAt: at('10:00'), createdAt: at('10:00'), isPresent: true };
    const entries = [
      { ...base, _id: 1, tokenNumber: 'L001', status: 'COMPLETED' },
      { ...base, _id: 2, tokenNumber: 'L002', status: 'CANCELLED' },
      { ...base, _id: 3, tokenNumber: 'L003', status: 'NO_SHOW' },
      { ...base, _id: 4, tokenNumber: 'L004', status: 'WAITING', checkedInAt: at('10:05') },
    ];
    expect(pickNext(entries, at('10:10')).tokenNumber).toBe('L004');
    expect(pickNext(entries.slice(0, 3), at('10:10'))).toBeNull();
  });
});

describe('Late-arrival policy', () => {
  async function overdueSetup() {
    await q.registerWalkIn({ customerName: 'W1' }); // L001
    const appt = await q.registerAppointment({ customerName: 'Absent Amy', scheduledTime: '10:10' }); // L002, not present
    setNow('10:15');
    return appt;
  }

  it('8. an absent appointment becomes overdue but is NOT auto-cancelled', async () => {
    const appt = await overdueSetup();
    const snap = await q.getTodayQueue();
    const e = find(snap, 'L002');
    expect(e.isOverdue).toBe(true);
    expect(e.displayStatus).toBe('APPOINTMENT_OVERDUE');
    expect(e.status).toBe('WAITING');
    expect(snap.summary.overdueAppointments).toBe(1);
    expect((await QueueEntry.findById(appt.id)).status).toBe('WAITING');
    expect((await q.callNext()).tokenNumber).toBe('L001'); // overdue one is skipped, walk-in is served
  });

  it('9, 10, 13. staff manually cancel; cancelled booking is never called and stays in history', async () => {
    const appt = await overdueSetup();
    const cancelled = await q.cancelBooking(appt.id);
    expect(cancelled.status).toBe('CANCELLED');
    await q.callNext(); // L001
    const saved = await QueueEntry.findById(appt.id);
    expect(saved.status).toBe('CANCELLED');
    expect(await QueueEntry.countDocuments({ tokenNumber: 'L002' })).toBe(1);
    await reject(q.cancelBooking(appt.id), 'INVALID_TRANSITION'); // cannot be re-cancelled
    await reject(q.checkIn(appt.id), 'INVALID_TRANSITION'); // cannot be reactivated
    const [w1] = await QueueEntry.find({ tokenNumber: 'L001' });
    await q.completeService(String(w1._id));
    await reject(q.callNext(), 'NO_ELIGIBLE_CUSTOMER'); // cancelled appointment never selected
  });

  it('late check-in after the scheduled time is rejected (no grace period)', async () => {
    const appt = await overdueSetup();
    await reject(q.checkIn(appt.id), 'APPOINTMENT_OVERDUE');
  });

  it('11 & 12. the late customer is registered as a NEW walk-in at the END of the walk-in queue', async () => {
    const appt = await overdueSetup(); // L001 walk-in, L002 absent appointment
    await q.registerWalkIn({ customerName: 'W2' }); // L003
    await q.cancelBooking(appt.id);
    const late = await q.registerWalkIn({ customerName: 'Absent Amy' });
    expect(late.tokenNumber).toBe('L004');
    expect(late.id).not.toBe(appt.id);
    expect(late.bookingType).toBe('WALK_IN');
    const snap = await q.getTodayQueue();
    const order = snap.entries.filter((e) => e.status === 'WAITING').map((e) => e.tokenNumber);
    expect(order).toEqual(['L001', 'L003', 'L004']);
  });

  it('checking in before the scheduled time works', async () => {
    const appt = await q.registerAppointment({ customerName: 'Early Bird', scheduledTime: '10:30' });
    const r = await q.checkIn(appt.id);
    expect(r.isPresent).toBe(true);
    expect(r.arrivedAt).toEqual(at('10:00'));
  });
});

describe('Single active service', () => {
  it('16. completing clears the active-service state', async () => {
    await q.registerWalkIn({ customerName: 'A' });
    await q.registerWalkIn({ customerName: 'B' });
    const a = await q.callNext();
    expect(await ActiveService.countDocuments()).toBe(1);
    await reject(q.callNext(), 'ACTIVE_SERVICE_EXISTS');
    await q.startService(a.id);
    await q.completeService(a.id);
    expect(await ActiveService.countDocuments()).toBe(0);
    expect((await q.callNext()).tokenNumber).toBe('L002');
    await reject(q.completeService(a.id), 'INVALID_TRANSITION'); // only the active customer can be completed
  });

  it('17. concurrent call-next requests cannot create two active services', async () => {
    await q.registerWalkIn({ customerName: 'A' });
    await q.registerWalkIn({ customerName: 'B' });
    await q.registerWalkIn({ customerName: 'C' });
    const results = await Promise.allSettled([q.callNext(), q.callNext(), q.callNext(), q.callNext()]);
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    expect(await ActiveService.countDocuments()).toBe(1);
    expect(await QueueEntry.countDocuments({ status: { $in: ['CALLED', 'IN_SERVICE'] } })).toBe(1);
  });
});

describe('Positions, ETAs and permanent tokens', () => {
  it('18 & 19. ETAs/positions recalculate on every event while tokens never change', async () => {
    // L001 starts service at 10:00
    await q.registerWalkIn({ customerName: 'W1' });
    const l1 = await q.callNext();
    await q.startService(l1.id);

    // 10:05 walk-in L002 registers; baseline ETA is when L001 finishes (10:10)
    setNow('10:05');
    await q.registerWalkIn({ customerName: 'W2' });
    let snap = await q.getTodayQueue();
    expect(find(snap, 'L001').etaLabel).toBe('Now serving');
    expect(find(snap, 'L002')).toMatchObject({ position: 1, etaMinutes: 5 });

    // present appointment at 10:10 (L003) jumps ahead of L002 without renumbering
    const appt = await q.registerAppointment({ customerName: 'Appt', scheduledTime: '10:10', isPresent: true });
    expect(appt.tokenNumber).toBe('L003');
    snap = await q.getTodayQueue();
    expect(find(snap, 'L003')).toMatchObject({ position: 1, etaMinutes: 5 });
    expect(find(snap, 'L002')).toMatchObject({ position: 2, etaMinutes: 15, tokenNumber: 'L002' });
    expect(find(snap, 'L002').estimatedStartAt).toEqual(at('10:20'));

    // new walk-in joins behind L002 at ~10:30
    await q.registerWalkIn({ customerName: 'W3' });
    snap = await q.getTodayQueue();
    expect(find(snap, 'L004')).toMatchObject({ position: 3, etaMinutes: 25 });

    // cancelling the appointment moves everyone up; tokens identical
    await q.cancelBooking(appt.id);
    snap = await q.getTodayQueue();
    expect(find(snap, 'L002')).toMatchObject({ position: 1, etaMinutes: 5 });
    expect(find(snap, 'L004')).toMatchObject({ position: 2, etaMinutes: 15 });

    // completing L001 early at 10:08 -> next customer is "up next"
    setNow('10:08');
    await q.completeService(l1.id);
    snap = await q.getTodayQueue();
    expect(find(snap, 'L002')).toMatchObject({ position: 1, etaMinutes: 0, etaLabel: 'Up next' });
    expect(snap.activeService).toBeNull();
  });

  it('a future appointment is simulated at its scheduled time (not earlier)', async () => {
    await q.registerAppointment({ customerName: 'Later', scheduledTime: '10:45', isPresent: true });
    const snap = await q.getTodayQueue();
    expect(find(snap, 'L001')).toMatchObject({ position: 1, etaMinutes: 45, displayStatus: 'AWAITING_SCHEDULED_TIME' });
  });
});
