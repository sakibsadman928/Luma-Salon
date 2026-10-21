import { fmtTime } from '../utils/format.js';

export default function OverdueAlerts({ entries, tz, onCancel, busy }) {
  if (!entries.length) return null;
  return (
    <section className="alerts" aria-label="Overdue appointments">
      {entries.map((e) => (
        <div className="alert" role="alert" key={e.id}>
          <div>
            <strong>Appointment overdue — customer not present. Cancel booking if absent.</strong>
            <div className="alert-meta">
              Token <b>{e.tokenNumber}</b> · {e.customerName} · scheduled {fmtTime(e.scheduledAt, tz)}
            </div>
          </div>
          <button className="btn btn-danger" disabled={busy} onClick={() => onCancel(e)}>Cancel booking</button>
        </div>
      ))}
    </section>
  );
}
