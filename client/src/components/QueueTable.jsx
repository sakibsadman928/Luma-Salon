import StatusBadge from './StatusBadge.jsx';
import { fmtTime, typeLabel } from '../utils/format.js';

function Actions({ e, busy, onCheckIn, onCancel }) {
  const canCheckIn = e.bookingType === 'APPOINTMENT' && e.status === 'WAITING' && !e.isPresent && !e.isOverdue;
  const canCancel = e.status === 'WAITING' || e.status === 'CALLED';
  if (!canCheckIn && !canCancel) return <span className="muted">—</span>;
  return (
    <div className="row gap-s">
      {canCheckIn && <button className="btn btn-sm btn-outline" disabled={busy} onClick={() => onCheckIn(e)}>Check in</button>}
      {canCancel && <button className="btn btn-sm btn-quiet-danger" disabled={busy} onClick={() => onCancel(e)}>Cancel</button>}
    </div>
  );
}

const posText = (e) => (e.displayStatus === 'NOW_SERVING' ? 'Now' : e.position ?? '—');

export default function QueueTable({ entries, tz, busy, onCheckIn, onCancel }) {
  if (!entries.length) {
    return <div className="empty"><p>The queue is empty.</p><p className="muted">Register a walk-in or appointment to get started.</p></div>;
  }
  return (
    <>
      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr><th>Token</th><th>Customer</th><th>Type</th><th>Scheduled</th><th>Position</th><th>Est. wait</th><th>Status</th><th>Actions</th></tr>
          </thead>
          <tbody>
            {entries.map((e) => (
              <tr key={e.id} className={e.isOverdue ? 'row-warn' : e.displayStatus === 'NOW_SERVING' ? 'row-active' : ''}>
                <td className="tok">{e.tokenNumber}</td>
                <td>{e.customerName}{e.bookingType === 'APPOINTMENT' && e.isPresent && <span className="present" title="Checked in"> ● here</span>}</td>
                <td>{typeLabel(e.bookingType)}</td>
                <td>{e.scheduledAt ? fmtTime(e.scheduledAt, tz) : '—'}</td>
                <td>{posText(e)}</td>
                <td>{e.etaLabel}</td>
                <td><StatusBadge status={e.displayStatus} /></td>
                <td><Actions e={e} busy={busy} onCheckIn={onCheckIn} onCancel={onCancel} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ul className="cards">
        {entries.map((e) => (
          <li key={e.id} className={`qcard ${e.isOverdue ? 'row-warn' : e.displayStatus === 'NOW_SERVING' ? 'row-active' : ''}`}>
            <div className="qcard-top">
              <span className="tok">{e.tokenNumber}</span>
              <StatusBadge status={e.displayStatus} />
            </div>
            <div className="qcard-name">{e.customerName}</div>
            <dl className="qcard-meta">
              <div><dt>Type</dt><dd>{typeLabel(e.bookingType)}</dd></div>
              <div><dt>Scheduled</dt><dd>{e.scheduledAt ? fmtTime(e.scheduledAt, tz) : '—'}</dd></div>
              <div><dt>Position</dt><dd>{posText(e)}</dd></div>
              <div><dt>Est. wait</dt><dd>{e.etaLabel}</dd></div>
            </dl>
            <Actions e={e} busy={busy} onCheckIn={onCheckIn} onCancel={onCancel} />
          </li>
        ))}
      </ul>
    </>
  );
}
