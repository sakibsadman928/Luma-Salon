import { useCallback, useEffect, useRef, useState } from 'react';

/** Calls `fn` immediately and then every `interval` ms. The timer is cleaned up on unmount. */
export function usePolling(fn, interval = 10000) {
  const [state, setState] = useState({ data: null, error: null, loading: true, updatedAt: null });
  const fnRef = useRef(fn);
  fnRef.current = fn;
  const alive = useRef(true);

  const refresh = useCallback(async () => {
    try {
      const data = await fnRef.current();
      if (alive.current) setState({ data, error: null, loading: false, updatedAt: new Date() });
      return data;
    } catch (e) {
      if (alive.current) setState((s) => ({ ...s, error: e.message, loading: false }));
      return null;
    }
  }, []);

  useEffect(() => {
    alive.current = true;
    refresh();
    const id = setInterval(() => { if (!document.hidden) refresh(); }, interval);
    return () => { alive.current = false; clearInterval(id); };
  }, [refresh, interval]);

  return { ...state, refresh };
}
