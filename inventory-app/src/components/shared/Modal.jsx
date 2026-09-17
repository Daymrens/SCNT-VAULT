import React, { useEffect } from 'react';
import { FaTimes } from 'react-icons/fa';

export default function Modal({ isOpen, onClose, title, icon, children, maxWidth = 600 }) {
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handler);
      document.body.style.overflow = '';
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.7)',
      display:'flex', alignItems:'center', justifyContent:'center', zIndex:1000, padding:20 }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{ background:'var(--bg-card)', borderRadius:20, width:'100%', maxWidth,
        maxHeight:'90vh', display:'flex', flexDirection:'column', color:'var(--text-primary)',
        border:'1px solid var(--border)',
        boxShadow:'0 20px 60px rgba(0,0,0,0.5)', overflow:'hidden' }}>
        {/* Header */}
        <div style={{ padding:'20px 24px', background:'var(--bg-sidebar)',
          borderBottom:'1px solid var(--border)',
          display:'flex', justifyContent:'space-between', alignItems:'center', flexShrink:0 }}>
          <div style={{ display:'flex', alignItems:'center', gap:10 }}>
            {icon && <span style={{ color:'var(--accent)', fontSize:16 }}>{icon}</span>}
            <span style={{ color:'var(--text-primary)', fontWeight:700, fontSize:16 }}>{title}</span>
          </div>
          <button onClick={onClose} style={{ background:'rgba(255,255,255,0.12)', border:'none',
            borderRadius:8, color:'#fff', cursor:'pointer', width:32, height:32,
            display:'flex', alignItems:'center', justifyContent:'center', fontSize:16,
            transition:'background 0.15s' }}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.2)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.12)'; }}>
            <FaTimes />
          </button>
        </div>
        {/* Body */}
        <div style={{ overflowY:'auto', flex:1, color:'var(--text-primary)' }}>
          {children}
        </div>
      </div>
    </div>
  );
}

Modal.Body = function ModalBody({ children, padding = 24 }) {
  return <div style={{ padding }}>{children}</div>;
};

Modal.Footer = function ModalFooter({ children, borderTop = true }) {
  return (
    <div style={{ padding:'16px 24px', borderTop: borderTop ? '1px solid var(--border)' : 'none',
      display:'flex', justifyContent:'flex-end', gap:10, flexShrink:0 }}>
      {children}
    </div>
  );
};

export function CancelButton({ onClick, label = 'Cancel' }) {
  return (
    <button onClick={onClick} style={{ padding:'9px 18px', background:'var(--bg-secondary)',
      color:'var(--text-primary)', border:'1px solid var(--border)', borderRadius:8,
      fontSize:13, fontWeight:600, cursor:'pointer', transition:'background 0.15s' }}>
      {label}
    </button>
  );
}

export function PrimaryButton({ onClick, disabled, loading, children, fullWidth }) {
  return (
    <button onClick={onClick} disabled={disabled || loading} style={{
      padding:'9px 20px',
      background: disabled ? 'rgba(255,255,255,0.06)' : 'var(--accent)',
      color: disabled ? 'var(--text-muted)' : '#0f172a',
      border:'none', borderRadius:8, fontSize:13, fontWeight:700,
      cursor: disabled ? 'not-allowed' : 'pointer',
      opacity: loading ? 0.7 : 1,
      width: fullWidth ? '100%' : undefined,
    }}>
      {loading ? 'Saving...' : children}
    </button>
  );
}

export function DangerButton({ onClick, disabled, loading, children }) {
  return (
    <button onClick={onClick} disabled={disabled || loading} style={{
      padding:'9px 20px',
      background:'var(--danger)', color:'white',
      border:'none', borderRadius:8, fontSize:13, fontWeight:700,
      cursor: disabled ? 'not-allowed' : 'pointer',
      opacity: loading ? 0.7 : 1,
    }}>
      {loading ? 'Deleting...' : children}
    </button>
  );
}