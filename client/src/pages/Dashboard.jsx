import { useCallback, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../services/api.js';
import { useAuth } from '../hooks/useAuth.jsx';
import { usePolling } from '../hooks/usePolling.js';
import { fmtDate } from '../utils/format.js';
import Logo from '../components/Logo.jsx';
import Notice from '../components/Notice.jsx';
import SummaryCards from '../components/SummaryCards.jsx';
import OverdueAlerts from '../components/OverdueAlerts.jsx';
import RegisterForm from '../components/RegisterForm.jsx';
import ActiveServiceCard from '../components/ActiveServiceCard.jsx';
import QueueTable from '../components/QueueTable.jsx';
import StatusBadge from '../components/StatusBadge.jsx';
import ConfirmDialog from '../components/ConfirmDialog.jsx';

export default function Dashboard() {
  const { logout } = useAuth();
  const { data, error, loading, refresh } = usePolling(api.today, 10000);
  const [notice, setNotice] = useState(null);
  const [busy, setBusy] = useState(false);
  const [toCancel, setToCancel] = useState(null);
  const closeNotice = useCallback(() => setNotice(null), []);

  async function run(action, success) {
    setBusy(true);
    try {
      await action();
      if (success) setNotice({ type: 'success', text: success });
    } catch (e) {
      setNotice({ type: 'error', text: e.message });
    } finally {
      await refresh();
      setBusy(false);
    }
  }

  const entries = data?.entries ?? [];
  const tz = data?.timezone;
  const live = entries.filter((e) => ['WAITING', 'CALLED', 'IN_SERVICE'].includes(e.status));
  const history = entries.filter((e) => ['COMPLETED', 'CANCELLED', 'NO_SHOW'].includes(e.status));
  const overdue = entries.filter((e) => e.isOverdue);
  const canCall = Boolean(data) && !data.activeService && entries.some((e) => e.status === 'WAITING' && e.position === 1 && !e.isOverdue && (e.bookingType === 'WALK_IN' || e.isDue));

  const confirmCancel = () => run(async () => { await api.cancel(toCancel.id); setToCancel(null); }, `Booking ${toCancel.tokenNumber} cancelled.`);

  return (
    <div className="page">
      <header className="topbar">
        <Logo />
        <nav className="row gap-s">
          <Link to="/queue" className="btn btn-ghost btn-sm" target="_blank" rel="noreferrer">Public board ↗</Link>
          <button className="btn btn-outline btn-sm" onClick={logout}>Sign out</button>
        </nav>
      </header>

      <main className="container">
        <div className="page-title">
          <div>
            <h1>Today’s queue</h1>
            <p className="muted">{data ? fmtDate(data.operatingDate) : 'Loading…'}</p>
          </div>
        </div>

        <Notice notice={notice} onClose={closeNotice} />
        {error && <p className="form-error" role="alert">{error}</p>}

        {loading && !data ? (
          <p className="muted" role="status">Loading queue…</p>
        ) : data && (
          <>
            <SummaryCards summary={data.summary} activeService={data.activeService} />
            <OverdueAlerts entries={overdue} tz={tz} busy={busy} onCancel={setToCancel} />

            <div className="layout">
              <aside className="side">
                <ActiveServiceCard
                  active={data.activeService} tz={tz} busy={busy} canCall={canCall}
                  onCallNext={() => run(async () => { const e = await api.callNext(); setNotice({ type: 'success', text: `Calling ${e.tokenNumber} — ${e.customerName}.` }); })}
                  onStart={(e) => run(() => api.start(e.id), `Service started for ${e.tokenNumber}.`)}
                  onComplete={(e) => run(() => api.complete(e.id), `Service completed for ${e.tokenNumber}.`)}
                />
                <RegisterForm onDone={async (msg) => { setNotice({ type: 'success', text: msg }); await refresh(); }} />
              </aside>

              <section className="card main-card" aria-label="Current queue">
                <div className="card-head">
                  <h2>Current queue</h2>
                  <span className="muted small">Estimates assume ~{data.avgServiceMinutes} min per customer</span>
                </div>
                <QueueTable
                  entries={live} tz={tz} busy={busy}
                  onCheckIn={(e) => run(() => api.checkIn(e.id), `${e.tokenNumber} checked in.`)}
                  onCancel={setToCancel}
                />
                {history.length > 0 && (
                  <details className="history">
                    <summary>Completed &amp; cancelled today ({history.length})</summary>
                    <ul className="history-list">
                      {history.map((e) => (
                        <li key={e.id}><span className="tok">{e.tokenNumber}</span><span>{e.customerName}</span><StatusBadge status={e.displayStatus} /></li>
                      ))}
                    </ul>
                  </details>
                )}
              </section>
            </div>
          </>
        )}
      </main>

      <ConfirmDialog
        open={Boolean(toCancel)} busy={busy} title={`Cancel booking ${toCancel?.tokenNumber}?`}
        confirmLabel="Yes, cancel booking" onConfirm={confirmCancel} onCancel={() => !busy && setToCancel(null)}
      >
        <p><b>{toCancel?.customerName}</b> will be removed from the queue. This cannot be undone.</p>
        <p className="muted">If the customer arrives later, register them as a new walk-in — they will receive a new token and join the end of the walk-in queue.</p>
      </ConfirmDialog>
    </div>
  );
}
