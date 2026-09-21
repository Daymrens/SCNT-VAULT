import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { collection, getDocs, updateDoc, doc } from 'firebase/firestore';
import { db } from '../firebase/firebase';
import {
  FaSearch, FaTimes, FaChevronLeft, FaChevronRight,
  FaExclamationTriangle, FaEnvelope, FaEye, FaCheck, FaReply
} from 'react-icons/fa';

const ITEMS_PER_PAGE = 25;

const STATUS_OPTIONS = ['All', 'unread', 'read', 'replied'];

const STATUS_LABELS = { unread: 'Unread', read: 'Read', replied: 'Replied' };

const STATUS_COLORS = {
  unread: { bg: 'rgba(239,68,68,0.15)', color: '#ef4444', dot: '#ef4444' },
  read: { bg: 'rgba(148,163,184,0.15)', color: '#94a3b8', dot: '#94a3b8' },
  replied: { bg: 'rgba(34,197,94,0.15)', color: '#22c55e', dot: '#22c55e' },
};

const inputStyle = {
  width: '100%', padding: '10px 12px', borderRadius: 8,
  border: '1px solid #334155', background: '#0f172a', color: '#f1f5f9',
  fontSize: 13, outline: 'none', transition: 'border-color 0.2s',
};

const btnPrimary = {
  display: 'inline-flex', alignItems: 'center', gap: 6,
  background: 'rgba(45,212,191,0.15)', color: '#2dd4bf',
  border: '1px solid rgba(45,212,191,0.3)', borderRadius: 8,
  padding: '8px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer',
  transition: 'all 0.2s',
};

const btnGhost = {
  background: 'transparent', border: '1px solid #334155', borderRadius: 8,
  padding: '6px 10px', color: '#94a3b8', cursor: 'pointer',
  display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12,
  fontWeight: 600, transition: 'all 0.2s',
};

const btnGhostActive = {
  ...btnGhost, background: 'rgba(45,212,191,0.15)',
  color: '#2dd4bf', border: '1px solid rgba(45,212,191,0.3)',
};

const modalOverlay = {
  position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  zIndex: 1000, backdropFilter: 'blur(4px)',
};

const modalBox = {
  background: '#1e293b', border: '1px solid #334155', borderRadius: 16,
  width: '90%', maxWidth: 720, maxHeight: '85vh', overflow: 'auto',
  boxShadow: '0 24px 48px rgba(0,0,0,0.4)',
};

function formatDate(v) {
  if (!v) return '\u2014';
  const d = v?.toDate ? v.toDate() : new Date(v);
  return isNaN(d) ? '\u2014' : d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

function formatDateTime(v) {
  if (!v) return '\u2014';
  const d = v?.toDate ? v.toDate() : new Date(v);
  return isNaN(d) ? '\u2014' : d.toLocaleDateString('en-US', {
    year: 'numeric', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function ContactDetail({ contact, onClose, onMarkRead, onMarkReplied }) {
  return (
    <div style={modalOverlay} onClick={onClose}>
      <div style={{ ...modalBox, maxWidth: 640 }} onClick={e => e.stopPropagation()}>
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          padding: '16px 20px', borderBottom: '1px solid #334155',
        }}>
          <div>
            <h2 style={{ color: '#f1f5f9', fontSize: 16, fontWeight: 700 }}>
              {contact.subject || 'Contact Message'}
            </h2>
            <p style={{ color: '#94a3b8', fontSize: 12, marginTop: 2 }}>
              From {contact.name || contact.Name || '\u2014'}
            </p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <StatusBadge status={contact.status || 'unread'} />
            <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: 18 }}>
              <FaTimes />
            </button>
          </div>
        </div>

        <div style={{ padding: 20 }}>
          {/* Contact Info */}
          <div style={{
            background: '#0f172a', border: '1px solid #334155', borderRadius: 10,
            padding: 16, marginBottom: 20,
          }}>
            <h3 style={{ color: '#94a3b8', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 12 }}>
              Contact Information
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#94a3b8', fontSize: 12 }}>Name</span>
                <span style={{ color: '#f1f5f9', fontSize: 12, fontWeight: 600 }}>{contact.name || contact.Name || '\u2014'}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#94a3b8', fontSize: 12 }}>Email</span>
                <span style={{ color: '#f1f5f9', fontSize: 12 }}>{contact.email || contact.Email || '\u2014'}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#94a3b8', fontSize: 12 }}>Phone</span>
                <span style={{ color: '#f1f5f9', fontSize: 12 }}>{contact.phone || contact.Phone || '\u2014'}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#94a3b8', fontSize: 12 }}>Date</span>
                <span style={{ color: '#f1f5f9', fontSize: 12 }}>{formatDateTime(contact.createdAt || contact.date || contact.Date)}</span>
              </div>
            </div>
          </div>

          {/* Message */}
          <div style={{
            background: '#0f172a', border: '1px solid #334155', borderRadius: 10,
            padding: 16, marginBottom: 20,
          }}>
            <h3 style={{ color: '#94a3b8', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 12 }}>
              Message
            </h3>
            <p style={{ color: '#f1f5f9', fontSize: 13, lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
              {contact.message || contact.Message || '\u2014'}
            </p>
          </div>

          {/* Actions */}
          <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
            <button onClick={onClose} style={btnGhost}>Close</button>
            {(contact.status || 'unread') !== 'read' && (
              <button onClick={() => onMarkRead(contact.id)} style={btnPrimary}>
                <FaCheck /> Mark as Read
              </button>
            )}
            {(contact.status || 'unread') !== 'replied' && (
              <button onClick={() => onMarkReplied(contact.id)} style={{
                ...btnPrimary, background: 'rgba(34,197,94,0.15)',
                color: '#22c55e', border: '1px solid rgba(34,197,94,0.3)',
              }}>
                <FaReply /> Mark as Replied
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function StatusBadge({ status }) {
  const s = status || 'unread';
  const c = STATUS_COLORS[s] || STATUS_COLORS.unread;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 6,
      padding: '4px 10px', borderRadius: 20,
      fontSize: 11, fontWeight: 700, whiteSpace: 'nowrap',
      background: c.bg, color: c.color,
    }}>
      <span style={{
        width: 7, height: 7, borderRadius: '50%', background: c.dot,
        display: 'inline-block', flexShrink: 0,
      }} />
      {STATUS_LABELS[s] || s}
    </span>
  );
}

export default function Contacts() {
  const [contacts, setContacts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [page, setPage] = useState(1);
  const [selectedContact, setSelectedContact] = useState(null);
  const [updating, setUpdating] = useState(false);

  const fetchContacts = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const snap = await getDocs(collection(db, 'contacts'));
      const items = [];
      snap.forEach(d => items.push({ id: d.id, ...d.data() }));
      items.sort((a, b) => {
        const da = a.createdAt?.toDate ? a.createdAt.toDate() : new Date(a.createdAt || a.date || a.Date || 0);
        const db = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(b.createdAt || b.date || b.Date || 0);
        return db - da;
      });
      setContacts(items);
    } catch (err) {
      console.error('Contacts load error:', err);
      setError('Failed to load contacts. Check Firestore permissions.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchContacts(); }, [fetchContacts]);

  const filtered = useMemo(() => {
    let result = contacts;
    const q = search.toLowerCase();
    if (q) {
      result = result.filter(c =>
        (c.name || c.Name || '').toLowerCase().includes(q) ||
        (c.email || c.Email || '').toLowerCase().includes(q) ||
        (c.subject || c.Subject || '').toLowerCase().includes(q)
      );
    }
    if (statusFilter !== 'All') {
      result = result.filter(c => (c.status || 'unread') === statusFilter);
    }
    return result;
  }, [contacts, search, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / ITEMS_PER_PAGE));
  const safePage = Math.min(page, totalPages);
  const paged = filtered.slice((safePage - 1) * ITEMS_PER_PAGE, safePage * ITEMS_PER_PAGE);

  useEffect(() => { setPage(1); }, [search, statusFilter]);

  const handleMarkRead = async (id) => {
    setUpdating(true);
    try {
      await updateDoc(doc(db, 'contacts', id), { status: 'read' });
      setContacts(prev => prev.map(c => c.id === id ? { ...c, status: 'read' } : c));
      setSelectedContact(prev => prev && prev.id === id ? { ...prev, status: 'read' } : prev);
    } catch (err) {
      console.error('Mark read error:', err);
      alert('Failed to update contact.');
    } finally {
      setUpdating(false);
    }
  };

  const handleMarkReplied = async (id) => {
    setUpdating(true);
    try {
      await updateDoc(doc(db, 'contacts', id), { status: 'replied' });
      setContacts(prev => prev.map(c => c.id === id ? { ...c, status: 'replied' } : c));
      setSelectedContact(prev => prev && prev.id === id ? { ...prev, status: 'replied' } : prev);
    } catch (err) {
      console.error('Mark replied error:', err);
      alert('Failed to update contact.');
    } finally {
      setUpdating(false);
    }
  };

  const truncate = (str, len = 60) => {
    if (!str) return '\u2014';
    return str.length > len ? str.slice(0, len) + '\u2026' : str;
  };

  if (loading) {
    return (
      <>
        <style>{`
          @keyframes shimmer {
            0% { background-position: 200% 0; }
            100% { background-position: -200% 0; }
          }
        `}</style>
        <h1 style={{ color: '#f1f5f9', fontWeight: 800, fontSize: 24, marginBottom: 20 }}>Contacts</h1>
        <div style={{
          background: '#1e293b', border: '1px solid #334155', borderRadius: 12,
          padding: 20, overflow: 'hidden',
        }}>
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} style={{
              display: 'flex', gap: 16, padding: '12px 0',
              borderBottom: i < 4 ? '1px solid #334155' : 'none',
            }}>
              {['120px', '140px', '100px', '180px', '60px', '80px', '60px'].map((w, j) => (
                <div key={j} style={{
                  width: w, height: 14, borderRadius: 4,
                  background: 'linear-gradient(90deg, #1e293b 25%, #334155 50%, #1e293b 75%)',
                  backgroundSize: '200% 100%', animation: 'shimmer 1.5s infinite',
                }} />
              ))}
            </div>
          ))}
        </div>
      </>
    );
  }

  if (error) {
    return (
      <>
        <h1 style={{ color: '#f1f5f9', fontWeight: 800, fontSize: 24, marginBottom: 20 }}>Contacts</h1>
        <div style={{
          background: '#1e293b', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 12,
          padding: 32, textAlign: 'center',
        }}>
          <FaExclamationTriangle style={{ fontSize: 32, color: '#ef4444', marginBottom: 12 }} />
          <p style={{ color: '#f1f5f9', fontSize: 14, fontWeight: 600, marginBottom: 8 }}>{error}</p>
          <button onClick={fetchContacts} style={btnPrimary}>Retry</button>
        </div>
      </>
    );
  }

  return (
    <>
      <style>{`
        .contact-row:hover { background: rgba(45,212,191,0.04) !important; }
        .contact-btn:hover { opacity: 0.8; }
        .contact-input:focus { border-color: #2dd4bf !important; }
        .contact-tab:hover { background: rgba(45,212,191,0.08) !important; }
      `}</style>

      <h1 style={{ color: '#f1f5f9', fontWeight: 800, fontSize: 24, marginBottom: 20 }}>Contacts</h1>

      <div style={{
        display: 'flex', flexWrap: 'wrap', gap: 12, marginBottom: 16, alignItems: 'center',
      }}>
        <div style={{ flex: 1, minWidth: 200, position: 'relative' }}>
          <FaSearch style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8', fontSize: 13 }} />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by name, email, subject..."
            className="contact-input"
            style={{ ...inputStyle, paddingLeft: 36 }}
          />
        </div>
      </div>

      {/* Status Tabs */}
      <div style={{
        display: 'flex', gap: 6, marginBottom: 16, flexWrap: 'wrap',
      }}>
        {STATUS_OPTIONS.map(s => {
          const isActive = statusFilter === s;
          const label = s === 'All' ? 'All' : STATUS_LABELS[s];
          const count = s === 'All' ? contacts.length : contacts.filter(c => (c.status || 'unread') === s).length;
          return (
            <button key={s} onClick={() => setStatusFilter(s)} className="contact-tab" style={{
              ...btnGhost,
              ...(isActive ? btnGhostActive : {}),
              gap: 6,
            }}>
              {label}
              <span style={{
                background: isActive ? 'rgba(45,212,191,0.2)' : 'rgba(148,163,184,0.15)',
                color: isActive ? '#2dd4bf' : '#64748b',
                padding: '2px 7px', borderRadius: 10, fontSize: 10, fontWeight: 700,
              }}>
                {count}
              </span>
            </button>
          );
        })}
      </div>

      <p style={{ color: '#94a3b8', fontSize: 12, marginBottom: 12 }}>
        {filtered.length} contact{filtered.length !== 1 ? 's' : ''} found
        {filtered.length > ITEMS_PER_PAGE && ` \u2014 Page ${safePage} of ${totalPages}`}
      </p>

      {filtered.length === 0 ? (
        <div style={{
          background: '#1e293b', border: '1px solid #334155', borderRadius: 12,
          padding: 48, textAlign: 'center',
        }}>
          <FaEnvelope style={{ fontSize: 40, color: '#334155', marginBottom: 12 }} />
          <p style={{ color: '#94a3b8', fontSize: 14 }}>No contacts found</p>
        </div>
      ) : (
        <div style={{
          background: '#1e293b', border: '1px solid #334155', borderRadius: 12,
          overflow: 'hidden', marginBottom: 20,
        }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 900 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #334155' }}>
                  {['Name', 'Email', 'Subject', 'Message', 'Status', 'Date', 'Actions'].map(h => (
                    <th key={h} style={{
                      color: '#94a3b8', fontSize: 11, fontWeight: 600, textTransform: 'uppercase',
                      padding: '12px', textAlign: 'left', whiteSpace: 'nowrap', letterSpacing: 0.5,
                    }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {paged.map(c => (
                  <tr key={c.id} className="contact-row" style={{
                    borderBottom: '1px solid rgba(51,65,85,0.5)',
                    transition: 'background 0.15s',
                  }}>
                    <td style={{ padding: '12px', fontSize: 13, fontWeight: 600, color: '#f1f5f9' }}>
                      {c.name || c.Name || '\u2014'}
                    </td>
                    <td style={{ padding: '12px', fontSize: 12, color: '#94a3b8' }}>
                      {c.email || c.Email || '\u2014'}
                    </td>
                    <td style={{ padding: '12px', fontSize: 13, color: '#f1f5f9', fontWeight: 500 }}>
                      {truncate(c.subject || c.Subject || '\u2014', 30)}
                    </td>
                    <td style={{ padding: '12px', fontSize: 12, color: '#94a3b8', maxWidth: 200 }}>
                      {truncate(c.message || c.Message, 40)}
                    </td>
                    <td style={{ padding: '12px' }}>
                      <StatusBadge status={c.status || 'unread'} />
                    </td>
                    <td style={{ padding: '12px', fontSize: 12, color: '#94a3b8', whiteSpace: 'nowrap' }}>
                      {formatDate(c.createdAt || c.date || c.Date)}
                    </td>
                    <td style={{ padding: '12px' }}>
                      <button onClick={() => setSelectedContact(c)} className="contact-btn" style={{
                        background: 'rgba(45,212,191,0.1)', color: '#2dd4bf',
                        border: 'none', borderRadius: 6, padding: '5px 10px', cursor: 'pointer',
                        fontSize: 12, transition: 'opacity 0.2s', display: 'inline-flex', alignItems: 'center', gap: 4,
                      }} title="View Details">
                        <FaEye /> View
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 8, marginTop: 8 }}>
          <button
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={safePage <= 1}
            style={{ ...btnGhost, opacity: safePage <= 1 ? 0.4 : 1, cursor: safePage <= 1 ? 'default' : 'pointer' }}
          >
            <FaChevronLeft />
          </button>
          {Array.from({ length: totalPages }, (_, i) => i + 1)
            .filter(n => n === 1 || n === totalPages || Math.abs(n - safePage) <= 2)
            .reduce((acc, n, i, arr) => {
              if (i > 0 && n - arr[i - 1] > 1) acc.push('...');
              acc.push(n);
              return acc;
            }, [])
            .map((n, i) => (
              n === '...' ? (
                <span key={'e' + i} style={{ color: '#94a3b8', fontSize: 13, padding: '0 4px' }}>{'\u2026'}</span>
              ) : (
                <button
                  key={n}
                  onClick={() => setPage(n)}
                  style={{
                    ...btnGhost,
                    ...(n === safePage ? btnGhostActive : {}),
                    minWidth: 36, justifyContent: 'center',
                  }}
                >
                  {n}
                </button>
              )
            ))
          }
          <button
            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
            disabled={safePage >= totalPages}
            style={{ ...btnGhost, opacity: safePage >= totalPages ? 0.4 : 1, cursor: safePage >= totalPages ? 'default' : 'pointer' }}
          >
            <FaChevronRight />
          </button>
        </div>
      )}

      {/* Modal */}
      {selectedContact && (
        <ContactDetail
          contact={selectedContact}
          onClose={() => setSelectedContact(null)}
          onMarkRead={handleMarkRead}
          onMarkReplied={handleMarkReplied}
        />
      )}
    </>
  );
}
