import { useEffect } from 'react';
export default function Notice({ notice, onClose }) {
  useEffect(() => {
    if (!notice) return undefined;
    const id = setTimeout(onClose, notice.type === 'error' ? 7000 : 4000);
    return () => clearTimeout(id);
  }, [notice, onClose]);
  if (!notice) return null;
  return (
    <div className={`notice notice-${notice.type}`} role={notice.type === 'error' ? 'alert' : 'status'}>
      <span>{notice.text}</span>
      <button className="notice-x" onClick={onClose} aria-label="Dismiss message">×</button>
    </div>
  );
}
