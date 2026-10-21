import { useState } from 'react';
import { api } from '../services/api.js';

export default function RegisterForm({ onDone }) {
  const [type, setType] = useState('WALK_IN');
  const [name, setName] = useState('');
  const [time, setTime] = useState('');
  const [present, setPresent] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setError('');
    if (!name.trim()) return setError('Please enter the customer name.');
    if (type === 'APPOINTMENT' && !time) return setError('Please choose the appointment time.');
    setBusy(true);
    try {
      const entry = type === 'WALK_IN'
        ? await api.addWalkIn(name)
        : await api.addAppointment({ customerName: name, scheduledTime: time, isPresent: present });
      setName(''); setTime(''); setPresent(false);
      await onDone(`Token ${entry.tokenNumber} issued to ${entry.customerName}.`);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="card" aria-label="Register customer">
      <div className="card-head"><h2>Register customer</h2></div>
      <form onSubmit={submit} noValidate>
        <div className="segmented" role="radiogroup" aria-label="Booking type">
          {[['WALK_IN', 'Walk-in'], ['APPOINTMENT', 'Appointment']].map(([v, l]) => (
            <button type="button" key={v} role="radio" aria-checked={type === v} className={type === v ? 'seg on' : 'seg'} onClick={() => { setType(v); setError(''); }}>{l}</button>
          ))}
        </div>

        <label className="field">
          <span>Customer name</span>
          <input value={name} onChange={(e) => setName(e.target.value)} maxLength={60} placeholder="e.g. Aria Chowdhury" autoComplete="off" />
        </label>

        {type === 'APPOINTMENT' && (
          <>
            <label className="field">
              <span>Appointment time (today)</span>
              <input type="time" value={time} onChange={(e) => setTime(e.target.value)} />
            </label>
            <label className="check">
              <input type="checkbox" checked={present} onChange={(e) => setPresent(e.target.checked)} />
              <span>Customer is here now (checked in)</span>
            </label>
            <p className="hint">Customers must be present at their scheduled time. If absent, staff cancel the booking and register them again as a walk-in.</p>
          </>
        )}

        {error && <p className="form-error" role="alert">{error}</p>}
        <button className="btn btn-primary btn-wide" disabled={busy}>{busy ? 'Registering…' : type === 'WALK_IN' ? 'Add walk-in' : 'Book appointment'}</button>
      </form>
    </section>
  );
}
