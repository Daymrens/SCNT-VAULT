import React from 'react';

export default function StatCard({ label, value, color, icon, sub }) {
  const isChange = !!sub && /^[+-]/.test(sub);
  const subColor = isChange
    ? (sub.startsWith('-') ? 'var(--danger)' : 'var(--accent)')
    : 'var(--text-muted)';
  return (
    <div style={{
      background: 'var(--bg-card)',
      border: '1px solid var(--border)',
      borderLeft: color ? `4px solid ${color}` : '1px solid var(--border)',
      borderRadius: 12,
      padding: '18px 22px',
      boxShadow: '0 2px 12px rgba(0,0,0,0.2)',
      position: 'relative',
      overflow: 'hidden',
    }}>
      <div style={{ fontSize:12, fontWeight:600,
        color:'var(--text-muted)',
        textTransform:'uppercase', letterSpacing:'0.5px', marginBottom:8 }}>{label}</div>
      <div style={{ display:'flex', alignItems:'center', gap:8 }}>
        {icon && <span style={{ fontSize:14, color: color || 'var(--accent)' }}>{icon}</span>}
        <div style={{ fontSize:28, fontWeight:800, lineHeight:1,
          color:'var(--text-primary)' }}>{value}</div>
      </div>
      {sub && <div style={{ fontSize:11, marginTop:6,
        color: subColor }}>{sub}</div>}
    </div>
  );
}