import React from 'react';

const STATUS_MAP = {
  active: 'success', available: 'success', completed: 'success',
  'in stock': 'success', received: 'success', paid: 'success',
  done: 'success', success: 'success',
  pending: 'warning', processing: 'warning', 'low stock': 'warning',
  shipped: 'warning', 'for delivery': 'warning', partial: 'warning',
  warning: 'warning',
  'out of stock': 'danger', overdue: 'danger', damaged: 'danger',
  void: 'danger', cancelled: 'danger', failed: 'danger', danger: 'danger',
  'in transit': 'info', info: 'info', reseller: 'info', retail: 'info',
};

const VARIANT_STYLES = {
  success: { background: 'var(--success-bg)', color: 'var(--accent)' },
  warning: { background: 'var(--warning-bg)', color: 'var(--warning)' },
  danger:  { background: 'var(--danger-bg)',  color: 'var(--danger)' },
  info:    { background: 'var(--info-bg)',    color: 'var(--info)' },
  default: { background: 'rgba(255,255,255,0.06)', color: 'var(--text-secondary)' },
};

export default function StatusBadge({ status, label }) {
  const key = String(status || '').trim().toLowerCase();
  const variant = STATUS_MAP[key] || 'default';
  const display = label !== undefined ? label : status;
  return (
    <span className="badge" style={VARIANT_STYLES[variant]}>{display}</span>
  );
}