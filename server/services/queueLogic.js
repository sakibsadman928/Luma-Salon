// PURE queue rules: no database, no clock. Everything takes `now` as an argument,
// so it is easy to test and the backend remains the single source of truth.

const t = (d) => (d ? new Date(d).getTime() : 0);

const byFifo = (a, b) =>
  t(a.checkedInAt) - t(b.checkedInAt) || t(a.createdAt) - t(b.createdAt) || a.tokenNumber.localeCompare(b.tokenNumber);

// Appointment order: scheduled time, then check-in time, then creation time.
const byAppointment = (a, b) =>
  t(a.scheduledAt) - t(b.scheduledAt) ||
  t(a.arrivedAt || a.checkedInAt) - t(b.arrivedAt || b.checkedInAt) ||
  t(a.createdAt) - t(b.createdAt) ||
  a.tokenNumber.localeCompare(b.tokenNumber);

export const isActiveStatus = (s) => s === 'CALLED' || s === 'IN_SERVICE';

/** Scheduled time has arrived, appointment is still waiting and the customer is NOT present. */
export const isOverdueAbsent = (e, now) =>
  e.bookingType === 'APPOINTMENT' && e.status === 'WAITING' && !e.isPresent && t(e.scheduledAt) <= t(now);

/** Scheduled time has arrived, customer present, still waiting -> has appointment priority. */
export const isDuePresent = (e, now) =>
  e.bookingType === 'APPOINTMENT' && e.status === 'WAITING' && e.isPresent && t(e.scheduledAt) <= t(now);

/**
 * "Call next" selection (spec 4.4):
 *  1. earliest due + present appointment (tie-breakers: check-in time, creation time)
 *  2. otherwise earliest waiting walk-in (FIFO)
 *  3. future appointments, overdue/absent appointments and non-WAITING entries are never selected.
 */
export function pickNext(entries, now) {
  const waiting = entries.filter((e) => e.status === 'WAITING');
  const due = waiting.filter((e) => isDuePresent(e, now)).sort(byAppointment);
  if (due.length) return due[0];
  const walkIns = waiting.filter((e) => e.bookingType === 'WALK_IN').sort(byFifo);
  return walkIns[0] || null;
}

/**
 * Lightweight scheduling simulation (spec section 5).
 * Returns the predicted service order with estimated start times.
 * Future appointments are assumed to arrive on time; overdue-absent ones are excluded.
 */
export function simulateQueue(entries, now, avgMinutes = 10) {
  const avg = avgMinutes * 60000;
  const active = entries.find((e) => isActiveStatus(e.status)) || null;
  let clock = t(now);
  if (active) {
    const started = t(active.serviceStartedAt) || t(active.calledAt) || t(now);
    clock = Math.max(clock, started + avg); // estimated remaining time of the active service
  }
  const waiting = entries.filter((e) => e.status === 'WAITING' && !isOverdueAbsent(e, now));
  const appts = waiting.filter((e) => e.bookingType === 'APPOINTMENT').sort(byAppointment);
  const walkIns = waiting.filter((e) => e.bookingType === 'WALK_IN').sort(byFifo);

  const order = [];
  while (appts.length || walkIns.length) {
    let next;
    let start = clock;
    if (appts.length && t(appts[0].scheduledAt) <= clock) next = appts.shift(); // due appointment first
    else if (walkIns.length) next = walkIns.shift(); // otherwise walk-in FIFO
    else {
      next = appts.shift(); // idle until the appointment time
      start = t(next.scheduledAt);
    }
    order.push({ entry: next, start: new Date(start) });
    clock = start + avg;
  }
  return { active, order };
}

export function displayStatus(e, now) {
  if (isActiveStatus(e.status)) return 'NOW_SERVING';
  if (e.status !== 'WAITING') return e.status;
  if (e.bookingType === 'WALK_IN') return 'WAITING';
  if (isOverdueAbsent(e, now)) return 'APPOINTMENT_OVERDUE';
  if (t(e.scheduledAt) > t(now)) return 'AWAITING_SCHEDULED_TIME';
  return 'DUE';
}

export function etaLabel(view) {
  if (view.displayStatus === 'NOW_SERVING') return 'Now serving';
  if (view.displayStatus === 'APPOINTMENT_OVERDUE') return 'Appointment overdue';
  if (view.etaMinutes === null) return '—';
  if (view.etaMinutes <= 0) return 'Up next';
  return `~${view.etaMinutes} min`;
}

/** Build the enriched, ordered list used by both the staff and public APIs. */
export function buildSnapshot(entries, now, avgMinutes = 10) {
  const { order } = simulateQueue(entries, now, avgMinutes);
  const nowMs = t(now);
  const meta = new Map();
  order.forEach(({ entry, start }, i) => {
    meta.set(String(entry._id), {
      position: i + 1,
      estimatedStartAt: start,
      etaMinutes: Math.max(0, Math.ceil((start.getTime() - nowMs) / 60000)),
    });
  });

  const views = entries.map((e) => {
    const m = meta.get(String(e._id)) || { position: null, estimatedStartAt: null, etaMinutes: null };
    const view = {
      id: String(e._id),
      tokenNumber: e.tokenNumber,
      customerName: e.customerName,
      bookingType: e.bookingType,
      scheduledAt: e.scheduledAt,
      checkedInAt: e.checkedInAt,
      arrivedAt: e.arrivedAt,
      isPresent: e.isPresent,
      status: e.status,
      calledAt: e.calledAt,
      serviceStartedAt: e.serviceStartedAt,
      completedAt: e.completedAt,
      cancelledAt: e.cancelledAt,
      ...m,
    };
    view.displayStatus = displayStatus(e, now);
    view.isOverdue = view.displayStatus === 'APPOINTMENT_OVERDUE';
    view.isDue = isDuePresent(e, now) || view.isOverdue;
    view.etaLabel = etaLabel(view);
    return view;
  });

  const rank = (v) => {
    if (isActiveStatus(v.status)) return [0, 0];
    if (v.status === 'WAITING' && v.position) return [1, v.position];
    if (v.isOverdue) return [2, t(v.scheduledAt)];
    return [3, -t(v.completedAt || v.cancelledAt || v.checkedInAt)];
  };
  views.sort((a, b) => {
    const [ra, sa] = rank(a);
    const [rb, sb] = rank(b);
    return ra - rb || sa - sb;
  });
  return views;
}
