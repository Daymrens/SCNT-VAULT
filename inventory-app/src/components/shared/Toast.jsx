import React, { useState, useCallback, useEffect, createContext, useContext } from 'react';
import { FaCheck, FaExclamationTriangle, FaInfoCircle, FaTimes } from 'react-icons/fa';

const ToastContext = createContext(null);

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const showToast = useCallback((message, type = 'error') => {
    const id = Date.now() + Math.random();
    setToasts(prev => [...prev, { id, message, type }]);
  }, []);

  const removeToast = useCallback((id) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </ToastContext.Provider>
  );
}

function ToastContainer({ toasts, onRemove }) {
  return (
    <div style={{ position:'fixed', top:80, right:24, zIndex:9999, display:'flex', flexDirection:'column', gap:8 }}>
      {toasts.map(toast => (
        <ToastItem key={toast.id} {...toast} onDone={() => onRemove(toast.id)} />
      ))}
    </div>
  );
}

const TOAST_VARIANTS = {
  success: { bg: 'var(--success-bg)', color: 'var(--accent)', border: 'var(--accent)', icon: <FaCheck /> },
  error:   { bg: 'var(--danger-bg)',  color: 'var(--danger)',  border: 'var(--danger)',  icon: <FaExclamationTriangle /> },
  info:    { bg: 'var(--info-bg)',    color: 'var(--info)',    border: 'var(--info)',    icon: <FaInfoCircle /> },
  warning: { bg: 'var(--warning-bg)', color: 'var(--warning)', border: 'var(--warning)', icon: <FaExclamationTriangle /> },
};

function ToastItem({ id, message, type, onDone }) {
  useEffect(() => {
    const t = setTimeout(onDone, 3000);
    return () => clearTimeout(t);
  }, [onDone]);

  const variant = TOAST_VARIANTS[type] || TOAST_VARIANTS.error;
  const { bg, color, border, icon } = variant;

  return (
    <div onClick={onDone}
      style={{ background:bg, color, borderLeft:`4px solid ${border}`, borderRadius:10,
        padding:'12px 18px', display:'flex', alignItems:'center', gap:10, fontSize:13, fontWeight:600,
        boxShadow:'0 8px 32px rgba(0,0,0,0.35)', cursor:'pointer', minWidth:200,
        animation:'toastSlideIn 0.25s ease' }}>
      {icon} <span style={{ flex:1 }}>{message}</span> <FaTimes style={{ fontSize:10, opacity:0.5 }} />
    </div>
  );
}