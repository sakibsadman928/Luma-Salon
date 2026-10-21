import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api, tokenStore } from '../services/api.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [isAuthed, setAuthed] = useState(() => Boolean(tokenStore.get()));
  const [expired, setExpired] = useState(false);

  useEffect(() => {
    const onUnauthorized = () => { setAuthed(false); setExpired(true); };
    window.addEventListener('luma:unauthorized', onUnauthorized);
    return () => window.removeEventListener('luma:unauthorized', onUnauthorized);
  }, []);

  const login = useCallback(async (pin) => {
    const { token } = await api.login(pin);
    tokenStore.set(token);
    setExpired(false);
    setAuthed(true);
  }, []);

  const logout = useCallback(async () => {
    try { await api.logout(); } catch { /* token may already be invalid */ }
    tokenStore.clear();
    setAuthed(false);
  }, []);

  const value = useMemo(() => ({ isAuthed, expired, login, logout }), [isAuthed, expired, login, logout]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
