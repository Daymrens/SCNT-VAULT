import React, { useState, useEffect, useCallback } from 'react';
import {
  doc, getDoc, setDoc, collection, getDocs, updateDoc, orderBy, query
} from 'firebase/firestore';
import { db } from '../firebase/firebase';
import { useAuth } from '../contexts/AuthContext';
import {
  FaSave, FaUndo, FaDownload, FaUsers, FaCog, FaClipboardList,
  FaExclamationTriangle, FaTimes, FaCheck, FaShieldAlt, FaUserCog,
  FaSearch, FaFilter, FaArrowUp, FaArrowDown
} from 'react-icons/fa';

const DEFAULT_SETTINGS = {
  storeName: 'SCNT Vault',
  costPrice: '',
  sellingPrice: '',
  resellerPrice: '',
  price60ml: '',
  cost60ml: '',
  lowStockThreshold: 5,
  testerKitPcs: '',
  testerKitPrice: '',
  paymentMethods: '',
  loyaltyTiers: {
    vipThreshold: 1000,
    goldThreshold: 500,
    silverThreshold: 200,
  },
};

const inputStyle = {
  width: '100%', padding: '10px 12px', borderRadius: 8,
  border: '1px solid #e6e8ec', background: '#f6f7f9', color: '#14181f',
  fontSize: 13, outline: 'none', transition: 'border-color 0.2s',
};

const labelStyle = {
  display: 'block', fontSize: 12, fontWeight: 600, color: '#6b7280',
  marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.5,
};

const btnPrimary = {
  display: 'inline-flex', alignItems: 'center', gap: 6,
  background: 'rgba(13,148,136,0.15)', color: '#0d9488',
  border: '1px solid rgba(13,148,136,0.3)', borderRadius: 8,
  padding: '8px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer',
  transition: 'all 0.2s',
};

const btnDanger = {
  ...btnPrimary, background: '#fdf2f2',
  color: '#dc2626', border: '1px solid #f3d6d6',
};

const btnGhost = {
  background: 'transparent', border: '1px solid #e6e8ec', borderRadius: 8,
  padding: '6px 10px', color: '#6b7280', cursor: 'pointer',
  display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12,
  fontWeight: 600, transition: 'all 0.2s',
};

const modalOverlay = {
  position: 'fixed', inset: 0, background: 'rgba(16,24,40,0.35)',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  zIndex: 1000, backdropFilter: 'blur(4px)',
};

const ROLE_STYLES = {
  owner: { bg: '#fff7e6', color: '#b45309', border: '1px solid #f5e3bf' },
  manager: { bg: '#eef4ff', color: '#2563eb', border: '1px solid #d3e2fd' },
  employee: { bg: 'rgba(148,163,184,0.15)', color: '#6b7280', border: '1px solid rgba(148,163,184,0.3)' },
};

function Section({ title, icon, children }) {
  return (
    <div style={{
      background: '#ffffff', border: '1px solid #e6e8ec', borderRadius: 12,
      marginBottom: 20, overflow: 'hidden',
    }}>
      <div style={{
        padding: '14px 20px', borderBottom: '1px solid #e6e8ec',
        display: 'flex', alignItems: 'center', gap: 8,
      }}>
        <span style={{ color: '#0d9488', fontSize: 14 }}>{icon}</span>
        <span style={{ color: '#14181f', fontWeight: 700, fontSize: 14 }}>{title}</span>
      </div>
      <div style={{ padding: 20 }}>{children}</div>
    </div>
  );
}

function FieldGroup({ label, children }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <label style={labelStyle}>{label}</label>
      {children}
    </div>
  );
}

function Toast({ message, type, onClose }) {
  const bg = type === 'success' ? '#e9f9ef' : type === 'error' ? '#fdf2f2' : '#eef4ff';
  const border = type === 'success' ? '#c8ecd8' : type === 'error' ? '#f3d6d6' : '#d3e2fd';
  const color = type === 'success' ? '#15803d' : type === 'error' ? '#dc2626' : '#2563eb';
  return (
    <div style={{
      position: 'fixed', top: 20, right: 20, zIndex: 2000,
      background: bg, border: `1px solid ${border}`, borderRadius: 10,
      padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 10,
      color, fontWeight: 600, fontSize: 13, boxShadow: '0 8px 24px rgba(16,24,40,0.10)',
    }}>
      {type === 'success' ? <FaCheck /> : type === 'error' ? <FaExclamationTriangle /> : <FaShieldAlt />}
      <span>{message}</span>
      <button onClick={onClose} style={{ background: 'none', border: 'none', color, cursor: 'pointer', marginLeft: 4 }}>
        <FaTimes />
      </button>
    </div>
  );
}

/* â”€â”€â”€ Business Settings Tab â”€â”€â”€ */
function BusinessSettings({ userRole }) {
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState(null);

  useEffect(() => {
    async function load() {
      try {
        const snap = await getDoc(doc(db, 'settings', 'business'));
        if (snap.exists()) setSettings({ ...DEFAULT_SETTINGS, ...snap.data() });
      } catch (e) { console.error(e); }
      setLoading(false);
    }
    load();
  }, []);

  const handleChange = (field, value) => setSettings(prev => ({ ...prev, [field]: value }));

  const handleLoyaltyChange = (field, value) => setSettings(prev => ({
    ...prev,
    loyaltyTiers: { ...prev.loyaltyTiers, [field]: value },
  }));

  const handleSave = async () => {
    setSaving(true);
    try {
      await setDoc(doc(db, 'settings', 'business'), settings, { merge: true });
      setToast({ message: 'Settings saved successfully', type: 'success' });
    } catch (e) {
      setToast({ message: 'Failed to save settings', type: 'error' });
    }
    setSaving(false);
    setTimeout(() => setToast(null), 3000);
  };

  const handleReset = async () => {
    if (!window.confirm('Reset all settings to defaults? This cannot be undone.')) return;
    setSaving(true);
    try {
      await setDoc(doc(db, 'settings', 'business'), DEFAULT_SETTINGS);
      setSettings(DEFAULT_SETTINGS);
      setToast({ message: 'Settings reset to defaults', type: 'success' });
    } catch (e) {
      setToast({ message: 'Failed to reset settings', type: 'error' });
    }
    setSaving(false);
    setTimeout(() => setToast(null), 3000);
  };

  const handleExport = async () => {
    try {
      const collections = ['products', 'orders', 'contacts', 'customers', 'users'];
      const exportData = { settings, exportedAt: new Date().toISOString() };
      for (const col of collections) {
        const snap = await getDocs(collection(db, col));
        exportData[col] = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      }
      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `scnt-vault-export-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      setToast({ message: 'Data exported successfully', type: 'success' });
    } catch (e) {
      setToast({ message: 'Failed to export data', type: 'error' });
    }
    setTimeout(() => setToast(null), 3000);
  };

  if (loading) return <p style={{ color: '#6b7280', fontSize: 13 }}>Loading settings...</p>;

  const isOwnerOrManager = userRole === 'owner' || userRole === 'manager';

  return (
    <div>
      {toast && <Toast {...toast} onClose={() => setToast(null)} />}

      <Section title="Store Information" icon={<FaCog />}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 16 }}>
          <FieldGroup label="Store Name">
            <input style={inputStyle} value={settings.storeName}
              onChange={e => handleChange('storeName', e.target.value)}
              disabled={!isOwnerOrManager} placeholder="SCNT Vault" />
          </FieldGroup>
        </div>
      </Section>

      <Section title="Default Prices" icon={<FaCog />}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>
          {[
            { key: 'costPrice', label: 'Cost Price' },
            { key: 'sellingPrice', label: 'Selling Price' },
            { key: 'resellerPrice', label: 'Reseller Price' },
            { key: 'price60ml', label: 'Price 60ml' },
            { key: 'cost60ml', label: 'Cost 60ml' },
          ].map(({ key, label }) => (
            <FieldGroup key={key} label={label}>
              <input style={inputStyle} type="number" value={settings[key]}
                onChange={e => handleChange(key, e.target.value)}
                disabled={!isOwnerOrManager} placeholder="0.00" />
            </FieldGroup>
          ))}
        </div>
      </Section>

      <Section title="Stock & Tester Kit" icon={<FaCog />}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>
          <FieldGroup label="Low Stock Threshold">
            <input style={inputStyle} type="number" value={settings.lowStockThreshold}
              onChange={e => handleChange('lowStockThreshold', parseInt(e.target.value) || 0)}
              disabled={!isOwnerOrManager} />
          </FieldGroup>
          <FieldGroup label="Tester Kit Pieces">
            <input style={inputStyle} type="number" value={settings.testerKitPcs}
              onChange={e => handleChange('testerKitPcs', e.target.value)}
              disabled={!isOwnerOrManager} placeholder="0" />
          </FieldGroup>
          <FieldGroup label="Tester Kit Price">
            <input style={inputStyle} type="number" value={settings.testerKitPrice}
              onChange={e => handleChange('testerKitPrice', e.target.value)}
              disabled={!isOwnerOrManager} placeholder="0.00" />
          </FieldGroup>
        </div>
      </Section>

      <Section title="Payment Methods" icon={<FaCog />}>
        <FieldGroup label="Payment Methods (comma-separated)">
          <input style={inputStyle} value={settings.paymentMethods}
            onChange={e => handleChange('paymentMethods', e.target.value)}
            disabled={!isOwnerOrManager} placeholder="Cash, Card, Bank Transfer" />
        </FieldGroup>
      </Section>

      <Section title="Loyalty Tiers" icon={<FaCog />}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>
          {[
            { key: 'silverThreshold', label: 'Silver Threshold (spend $)' },
            { key: 'goldThreshold', label: 'Gold Threshold (spend $)' },
            { key: 'vipThreshold', label: 'VIP Threshold (spend $)' },
          ].map(({ key, label }) => (
            <FieldGroup key={key} label={label}>
              <input style={inputStyle} type="number" value={settings.loyaltyTiers[key]}
                onChange={e => handleLoyaltyChange(key, parseInt(e.target.value) || 0)}
                disabled={!isOwnerOrManager} />
            </FieldGroup>
          ))}
        </div>
      </Section>

      {isOwnerOrManager && (
        <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
          <button style={btnPrimary} onClick={handleSave} disabled={saving}>
            <FaSave /> {saving ? 'Saving...' : 'Save Settings'}
          </button>
        </div>
      )}

      {/* Danger Zone */}
      <div style={{
        background: '#ffffff', border: '1px solid #f3d6d6', borderRadius: 12,
        marginTop: 24, overflow: 'hidden',
      }}>
        <div style={{
          padding: '14px 20px', borderBottom: '1px solid #f9e3e3',
          display: 'flex', alignItems: 'center', gap: 8,
        }}>
          <span style={{ color: '#dc2626', fontSize: 14 }}><FaExclamationTriangle /></span>
          <span style={{ color: '#dc2626', fontWeight: 700, fontSize: 14 }}>Danger Zone</span>
        </div>
        <div style={{ padding: 20, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <button style={btnDanger} onClick={handleReset}>
            <FaUndo /> Reset to Defaults
          </button>
          <button style={{
            ...btnPrimary, background: '#eef4ff',
            color: '#2563eb', border: '1px solid #d3e2fd',
          }} onClick={handleExport}>
            <FaDownload /> Export All Data as JSON
          </button>
        </div>
      </div>
    </div>
  );
}

/* â”€â”€â”€ User Management Tab â”€â”€â”€ */
function UserManagement({ currentUserUid, userRole }) {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);
  const [roleModal, setRoleModal] = useState(null);

  const loadUsers = useCallback(async () => {
    try {
      const snap = await getDocs(collection(db, 'users'));
      setUsers(snap.docs.map(d => ({ uid: d.id, ...d.data() })));
    } catch (e) { console.error(e); }
    setLoading(false);
  }, []);

  useEffect(() => { loadUsers(); }, [loadUsers]);

  const handleRoleChange = async (uid, newRole) => {
    if (uid === currentUserUid) {
      setToast({ message: "You cannot change your own role", type: 'error' });
      setTimeout(() => setToast(null), 3000);
      return;
    }
    try {
      await updateDoc(doc(db, 'users', uid), { role: newRole });
      setUsers(prev => prev.map(u => u.uid === uid ? { ...u, role: newRole } : u));
      setRoleModal(null);
      setToast({ message: `Role updated to ${newRole}`, type: 'success' });
    } catch (e) {
      setToast({ message: 'Failed to update role', type: 'error' });
    }
    setTimeout(() => setToast(null), 3000);
  };

  if (loading) return <p style={{ color: '#6b7280', fontSize: 13 }}>Loading users...</p>;

  const isOwner = userRole === 'owner';

  return (
    <div>
      {toast && <Toast {...toast} onClose={() => setToast(null)} />}

      <div style={{
        background: '#ffffff', border: '1px solid #e6e8ec', borderRadius: 12,
        overflow: 'hidden',
      }}>
        <div style={{
          padding: '14px 20px', borderBottom: '1px solid #e6e8ec',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ color: '#0d9488', fontSize: 14 }}><FaUsers /></span>
            <span style={{ color: '#14181f', fontWeight: 700, fontSize: 14 }}>Team Members</span>
          </div>
          <span style={{ color: '#6b7280', fontSize: 12 }}>{users.length} users</span>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #e6e8ec' }}>
                {['Name', 'Email', 'Role', 'Status', ...(isOwner ? ['Actions'] : [])].map(h => (
                  <th key={h} style={{
                    padding: '12px 16px', textAlign: 'left', color: '#6b7280',
                    fontWeight: 600, fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5,
                  }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {users.map(user => {
                const role = ROLE_STYLES[user.role] || ROLE_STYLES.employee;
                return (
                  <tr key={user.uid} style={{ borderBottom: '1px solid #eff1f4' }}
                    onMouseEnter={e => e.currentTarget.style.background = '#f6f7f9'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                    <td style={{ padding: '12px 16px', color: '#14181f', fontWeight: 600 }}>
                      {user.name || user.displayName || 'â€”'}
                    </td>
                    <td style={{ padding: '12px 16px', color: '#6b7280' }}>{user.email}</td>
                    <td style={{ padding: '12px 16px' }}>
                      <span style={{
                        display: 'inline-block', padding: '3px 10px', borderRadius: 20,
                        fontSize: 11, fontWeight: 700, textTransform: 'uppercase',
                        background: role.bg, color: role.color, border: role.border,
                      }}>
                        {user.role === 'owner' && <FaShieldAlt style={{ marginRight: 4, fontSize: 10 }} />}
                        {user.role || 'employee'}
                      </span>
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <span style={{
                        display: 'inline-block', width: 8, height: 8, borderRadius: '50%',
                        background: user.status === 'active' ? '#15803d' : '#dc2626',
                        marginRight: 6,
                      }} />
                      <span style={{ color: '#6b7280', fontSize: 12 }}>
                        {user.status || 'active'}
                      </span>
                    </td>
                    {isOwner && (
                      <td style={{ padding: '12px 16px' }}>
                        <button style={btnGhost} onClick={() => setRoleModal(user)}
                          disabled={user.role === 'owner'}>
                          <FaUserCog /> {user.role === 'owner' ? 'Owner' : 'Change Role'}
                        </button>
                      </td>
                    )}
                  </tr>
                );
              })}
              {users.length === 0 && (
                <tr><td colSpan={5} style={{ padding: 32, textAlign: 'center', color: '#6b7280' }}>No users found</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Role Picker Modal */}
      {roleModal && (
        <div style={modalOverlay} onClick={() => setRoleModal(null)}>
          <div style={{
            background: '#ffffff', border: '1px solid #e6e8ec', borderRadius: 12,
            padding: 24, width: 380, maxWidth: '90vw',
          }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h3 style={{ color: '#14181f', fontWeight: 700, fontSize: 16, margin: 0 }}>Change Role</h3>
              <button onClick={() => setRoleModal(null)} style={{ background: 'none', border: 'none', color: '#6b7280', cursor: 'pointer' }}>
                <FaTimes />
              </button>
            </div>
            <p style={{ color: '#6b7280', fontSize: 13, marginBottom: 16 }}>
              Assigning role to <strong style={{ color: '#14181f' }}>{roleModal.name || roleModal.email}</strong>
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {['manager', 'employee'].map(r => {
                const rs = ROLE_STYLES[r];
                const isActive = roleModal.role === r;
                return (
                  <button key={r} onClick={() => handleRoleChange(roleModal.uid, r)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px',
                      borderRadius: 8, border: isActive ? rs.border : '1px solid #e6e8ec',
                      background: isActive ? rs.bg : 'transparent', cursor: 'pointer',
                      transition: 'all 0.2s',
                    }}>
                    <span style={{
                      padding: '2px 8px', borderRadius: 12, fontSize: 10, fontWeight: 700,
                      textTransform: 'uppercase', background: rs.bg, color: rs.color,
                    }}>{r}</span>
                    {isActive && <FaCheck style={{ marginLeft: 'auto', color: '#15803d' }} />}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* â”€â”€â”€ Audit Log Tab â”€â”€â”€ */
function AuditLog() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('All');
  const [sortDir, setSortDir] = useState('desc');

  useEffect(() => {
    async function load() {
      try {
        const q = query(collection(db, 'auditLog'), orderBy('timestamp', 'desc'));
        const snap = await getDocs(q);
        setLogs(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      } catch (e) { console.error(e); }
      setLoading(false);
    }
    load();
  }, []);

  const actionTypes = ['All', ...new Set(logs.map(l => l.action).filter(Boolean))];

  const filtered = logs
    .filter(l => filter === 'All' || l.action === filter)
    .sort((a, b) => {
      const ta = a.timestamp?.seconds || 0;
      const tb = b.timestamp?.seconds || 0;
      return sortDir === 'desc' ? tb - ta : ta - tb;
    });

  const formatTime = (ts) => {
    if (!ts?.seconds) return 'â€”';
    return new Date(ts.seconds * 1000).toLocaleString();
  };

  if (loading) return <p style={{ color: '#6b7280', fontSize: 13 }}>Loading audit log...</p>;

  return (
    <div style={{
      background: '#ffffff', border: '1px solid #e6e8ec', borderRadius: 12,
      overflow: 'hidden',
    }}>
      <div style={{
        padding: '14px 20px', borderBottom: '1px solid #e6e8ec',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ color: '#0d9488', fontSize: 14 }}><FaClipboardList /></span>
          <span style={{ color: '#14181f', fontWeight: 700, fontSize: 14 }}>Audit Log</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <select value={filter} onChange={e => setFilter(e.target.value)}
            style={{
              ...inputStyle, width: 'auto', padding: '6px 10px', fontSize: 12,
            }}>
            {actionTypes.map(a => <option key={a} value={a}>{a}</option>)}
          </select>
          <button style={btnGhost} onClick={() => setSortDir(d => d === 'desc' ? 'asc' : 'desc')}>
            {sortDir === 'desc' ? <FaArrowDown /> : <FaArrowUp />}
            {sortDir === 'desc' ? 'Newest' : 'Oldest'}
          </button>
        </div>
      </div>

      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ borderBottom: '1px solid #e6e8ec' }}>
              {['Action', 'Details', 'Timestamp'].map(h => (
                <th key={h} style={{
                  padding: '12px 16px', textAlign: 'left', color: '#6b7280',
                  fontWeight: 600, fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5,
                }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map(log => (
              <tr key={log.id} style={{ borderBottom: '1px solid #eff1f4' }}
                onMouseEnter={e => e.currentTarget.style.background = '#f6f7f9'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                <td style={{ padding: '12px 16px' }}>
                  <span style={{
                    display: 'inline-block', padding: '3px 10px', borderRadius: 20,
                    fontSize: 11, fontWeight: 700, textTransform: 'uppercase',
                    background: 'rgba(13,148,136,0.1)', color: '#0d9488',
                    border: '1px solid rgba(13,148,136,0.3)',
                  }}>{log.action}</span>
                </td>
                <td style={{ padding: '12px 16px', color: '#6b7280', maxWidth: 400, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {typeof log.details === 'object' ? JSON.stringify(log.details) : log.details || 'â€”'}
                </td>
                <td style={{ padding: '12px 16px', color: '#6b7280', fontSize: 12, whiteSpace: 'nowrap' }}>
                  {formatTime(log.timestamp)}
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr><td colSpan={3} style={{ padding: 32, textAlign: 'center', color: '#6b7280' }}>No audit logs found</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* â”€â”€â”€ Main Settings Page â”€â”€â”€ */
export default function Settings() {
  const { currentUser, userRole } = useAuth();
  const [activeTab, setActiveTab] = useState('business');

  const canAccess = userRole === 'owner' || userRole === 'manager';
  const canManageUsers = userRole === 'owner';

  if (!canAccess) {
    return (
      <div style={{ textAlign: 'center', padding: 60 }}>
        <FaShieldAlt style={{ fontSize: 48, color: '#e6e8ec', marginBottom: 16 }} />
        <h2 style={{ color: '#14181f', fontWeight: 700, marginBottom: 8 }}>Access Denied</h2>
        <p style={{ color: '#6b7280', fontSize: 14 }}>Only owners and managers can access settings.</p>
      </div>
    );
  }

  const tabs = [
    { id: 'business', label: 'Business Settings', icon: <FaCog /> },
    ...(canManageUsers ? [{ id: 'users', label: 'User Management', icon: <FaUsers /> }] : []),
    { id: 'audit', label: 'Audit Log', icon: <FaClipboardList /> },
  ];

  return (
    <div>
      <h1 style={{ color: '#14181f', fontWeight: 800, fontSize: 24, marginBottom: 16 }}>Settings</h1>

      {/* Tabs */}
      <div style={{
        display: 'flex', gap: 4, marginBottom: 24,
        background: '#ffffff', borderRadius: 10, padding: 4,
        border: '1px solid #e6e8ec', overflowX: 'auto',
      }}>
        {tabs.map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '8px 16px', borderRadius: 8, border: 'none',
              background: activeTab === tab.id ? 'rgba(13,148,136,0.15)' : 'transparent',
              color: activeTab === tab.id ? '#0d9488' : '#6b7280',
              fontWeight: activeTab === tab.id ? 700 : 500, fontSize: 13,
              cursor: 'pointer', transition: 'all 0.2s', whiteSpace: 'nowrap',
            }}>
            {tab.icon} {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === 'business' && <BusinessSettings userRole={userRole} />}
      {activeTab === 'users' && canManageUsers && (
        <UserManagement currentUserUid={currentUser?.uid} userRole={userRole} />
      )}
      {activeTab === 'audit' && <AuditLog />}
    </div>
  );
}
