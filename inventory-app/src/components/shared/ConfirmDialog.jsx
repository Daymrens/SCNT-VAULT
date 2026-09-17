import React from 'react';
import { FaExclamationTriangle } from 'react-icons/fa';
import Modal, { CancelButton, DangerButton } from './Modal';

export default function ConfirmDialog({ isOpen, onClose, onConfirm, title = 'Are you sure?', message, confirmLabel = 'Yes, Delete', loading }) {
  if (!isOpen) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="" maxWidth={400}>
      <div style={{ padding:28, textAlign:'center' }}>
        <div style={{ width:56, height:56, borderRadius:'50%', background:'var(--danger-bg)',
          display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 16px' }}>
          <FaExclamationTriangle style={{ fontSize:24, color:'var(--danger)' }} />
        </div>
        <div style={{ fontSize:16, fontWeight:700, color:'var(--text-primary)', marginBottom:8 }}>{title}</div>
        <div style={{ fontSize:13, color:'var(--text-secondary)', marginBottom:24, lineHeight:1.5 }}>{message}</div>
        <div style={{ display:'flex', gap:10, justifyContent:'center' }}>
          <CancelButton onClick={onClose} />
          <DangerButton onClick={onConfirm} loading={loading}>{confirmLabel}</DangerButton>
        </div>
      </div>
    </Modal>
  );
}