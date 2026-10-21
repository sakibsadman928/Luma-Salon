import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth.jsx';
import Logo from '../components/Logo.jsx';

export default function Login() {
  const { login, expired } = useAuth();
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    if (!pin) return setError('Enter the staff PIN.');
    setBusy(true);
    setError('');
    try {
      await login(pin);
    } catch (err) {
      setError(err.message);
      setPin('');
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="login">
      <form className="login-card" onSubmit={submit}>
        <Logo size={34} />
        <h1>Staff sign in</h1>
        <p className="muted">Enter the staff PIN to manage today’s queue.</p>
        {expired && !error && <p className="form-warn" role="status">Your session expired. Please sign in again.</p>}
        <label className="field">
          <span>PIN</span>
          <input type="password" inputMode="numeric" autoComplete="current-password" autoFocus value={pin} onChange={(e) => setPin(e.target.value)} />
        </label>
        {error && <p className="form-error" role="alert">{error}</p>}
        <button className="btn btn-primary btn-wide" disabled={busy}>{busy ? 'Checking…' : 'Sign in'}</button>
        <Link to="/queue" className="link-center">View the public queue board</Link>
      </form>
    </main>
  );
}
