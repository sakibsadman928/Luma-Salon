import { fmtTime } from '../utils/format.js';

export default function ActiveServiceCard({ active, tz, busy, onCallNext, onStart, onComplete, canCall }) {
  return (
    <section className="card active-card" aria-label="Active service">
      <div className="card-head"><h2>Active service</h2></div>
      {active ? (
        <>
          <div className="active-token">{active.tokenNumber}</div>
          <div className="active-name">{active.customerName}</div>
          <div className="muted small">
            {active.status === 'CALLED' ? `Called ${fmtTime(active.calledAt, tz)} · waiting to start` : `In service since ${fmtTime(active.serviceStartedAt, tz)}`}
          </div>
          <div className="row gap">
            {active.status === 'CALLED' && <button className="btn btn-outline" disabled={busy} onClick={() => onStart(active)}>Start service</button>}
            <button className="btn btn-primary" disabled={busy} onClick={() => onComplete(active)}>Complete service</button>
          </div>
        </>
      ) : (
        <>
          <p className="muted">No one is in service.</p>
          <button className="btn btn-primary btn-wide" disabled={busy || !canCall} onClick={onCallNext}>Call next customer</button>
          {!canCall && <p className="muted small">Nobody is eligible to be called yet.</p>}
        </>
      )}
    </section>
  );
}
