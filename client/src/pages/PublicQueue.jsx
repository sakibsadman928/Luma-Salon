import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../services/api.js';
import { usePolling } from '../hooks/usePolling.js';
import { fmtDate, fmtTime, typeLabel } from '../utils/format.js';
import Logo from '../components/Logo.jsx';
import StatusBadge from '../components/StatusBadge.jsx';

function TokenLookup() {
  const [value, setValue] = useState('');
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');

  async function find(e) {
    e.preventDefault();
    setError(''); setResult(null);
    if (!value.trim()) return;
    try {
      setResult(await api.publicToken(value.trim()));
    } catch (err) {
      setError(err.message);
    }
  }
  const t = result?.ticket;
  return (
    <section className="card" aria-label="Check your token">
      <div className="card-head"><h2>Check your token</h2></div>
      <form className="row gap-s" onSubmit={find}>
        <input className="input" aria-label="Token number" placeholder="e.g. L004" value={value} onChange={(e) => setValue(e.target.value)} maxLength={8} />
        <button className="btn btn-primary">Check</button>
      </form>
      {error && <p className="form-error" role="alert">{error}</p>}
      {t && (
        <p className="lookup" role="status">
          <b>{t.tokenNumber}</b> · <StatusBadge status={t.displayStatus} /> · {t.position ? `position ${t.position} · ` : ''}{t.etaLabel}
        </p>
      )}
    </section>
  );
}

export default function PublicQueue() {
  const { data, error, loading, updatedAt } = usePolling(api.publicQueue, 10000);
  const tz = data?.timezone;
  const serving = data?.nowServing;

  return (
    <div className="page">
      <header className="topbar">
        <Logo />
        <Link to="/login" className="btn btn-ghost btn-sm">Staff sign in</Link>
      </header>

      <main className="container">
        <div className="page-title">
          <div>
            <h1>Queue board</h1>
            <p className="muted">{data ? fmtDate(data.operatingDate) : 'Loading…'}</p>
          </div>
          {updatedAt && <p className="muted small">Updated {new Intl.DateTimeFormat('en-US', { timeZone: tz, timeStyle: 'medium' }).format(updatedAt)} · refreshes every 10s</p>}
        </div>

        {error && <p className="form-error" role="alert">{error}</p>}
        {loading && !data && <p className="muted" role="status">Loading queue…</p>}

        {data && (
          <>
            <section className="hero" aria-live="polite">
              <div className="hero-label">Now serving</div>
              <div className="hero-token">{serving ? serving.tokenNumber : '—'}</div>
              <div className="hero-sub">{serving ? `${typeLabel(serving.bookingType)}` : 'No one is being served right now'}</div>
              <div className="hero-stats">
                <div><b>{data.summary.waiting}</b><span>waiting</span></div>
                <div><b>{data.summary.completed}</b><span>served today</span></div>
              </div>
            </section>

            <div className="layout public-layout">
              <section className="card main-card" aria-label="Waiting tokens">
                <div className="card-head"><h2>Waiting</h2></div>
                {data.queue.length === 0 ? (
                  <div className="empty"><p>No one is waiting.</p><p className="muted">Walk in any time — we’ll issue you a token.</p></div>
                ) : (
                  <>
                    <div className="table-wrap">
                      <table className="table">
                        <thead><tr><th>Token</th><th>Type</th><th>Scheduled</th><th>Position</th><th>Est. wait</th><th>Status</th></tr></thead>
                        <tbody>
                          {data.queue.map((q) => (
                            <tr key={q.tokenNumber} className={q.isOverdue ? 'row-warn' : ''}>
                              <td className="tok">{q.tokenNumber}</td>
                              <td>{typeLabel(q.bookingType)}</td>
                              <td>{q.scheduledAt ? fmtTime(q.scheduledAt, tz) : '—'}</td>
                              <td>{q.position ?? '—'}</td>
                              <td>{q.etaLabel}</td>
                              <td><StatusBadge status={q.displayStatus} /></td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <ul className="cards">
                      {data.queue.map((q) => (
                        <li key={q.tokenNumber} className={`qcard ${q.isOverdue ? 'row-warn' : ''}`}>
                          <div className="qcard-top"><span className="tok">{q.tokenNumber}</span><StatusBadge status={q.displayStatus} /></div>
                          <dl className="qcard-meta">
                            <div><dt>Type</dt><dd>{typeLabel(q.bookingType)}</dd></div>
                            <div><dt>Scheduled</dt><dd>{q.scheduledAt ? fmtTime(q.scheduledAt, tz) : '—'}</dd></div>
                            <div><dt>Position</dt><dd>{q.position ?? '—'}</dd></div>
                            <div><dt>Est. wait</dt><dd>{q.etaLabel}</dd></div>
                          </dl>
                        </li>
                      ))}
                    </ul>
                  </>
                )}
              </section>
              <aside className="side"><TokenLookup /></aside>
            </div>
            <p className="muted small center">{data.disclaimer}</p>
          </>
        )}
      </main>
    </div>
  );
}
