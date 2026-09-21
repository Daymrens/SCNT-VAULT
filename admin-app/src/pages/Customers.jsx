import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../firebase/firebase';
import {
  FaSearch, FaTimes, FaChevronLeft, FaChevronRight,
  FaExclamationTriangle, FaUsers, FaEye
} from 'react-icons/fa';

const ITEMS_PER_PAGE = 25;

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
  width: '90%', maxWidth: 780, maxHeight: '85vh', overflow: 'auto',
  boxShadow: '0 24px 48px rgba(0,0,0,0.4)',
};

const ORDER_STATUS_COLORS = {
  pending: { bg: 'rgba(245,158,11,0.15)', color: '#f59e0b' },
  confirmed: { bg: 'rgba(59,130,246,0.15)', color: '#3b82f6' },
  processing: { bg: 'rgba(148,163,184,0.15)', color: '#94a3b8' },
  shipped: { bg: 'rgba(59,130,246,0.15)', color: '#3b82f6' },
  delivered: { bg: 'rgba(34,197,94,0.15)', color: '#22c55e' },
  cancelled: { bg: 'rgba(239,68,68,0.15)', color: '#ef4444' },
};

const ORDER_STATUS_LABELS = {
  pending: 'Pending',
  confirmed: 'Confirmed',
  processing: 'Processing',
  shipped: 'Shipped',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
};

function formatDate(v) {
  if (!v) return '\u2014';
  const d = v?.toDate ? v.toDate() : new Date(v);
  return isNaN(d) ? '\u2014' : d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

function formatPrice(v) {
  const n = Number(v);
  return isNaN(n) ? '$0.00' : `$${n.toFixed(2)}`;
}

function getOrderTotal(o) {
  if (o.total || o.Total) return Number(o.total || o.Total);
  const items = o.items || o.Items || [];
  return items.reduce((s, it) => s + (Number(it.price || it.Price || 0) * Number(it.quantity || it.Quantity || 0)), 0);
}

function getCustomerName(o) {
  return o.customerName || o.CustomerName || o.customer?.name || '';
}

function getCustomerEmail(o) {
  return o.customerEmail || o.CustomerEmail || o.customer?.email || '';
}

function getCustomerPhone(o) {
  return o.customerPhone || o.CustomerPhone || o.customer?.phone || '';
}

function groupCustomers(orders) {
  const map = {};
  orders.forEach(o => {
    const name = getCustomerName(o);
    const email = getCustomerEmail(o);
    const key = (email || name || '').toLowerCase();
    if (!key) return;
    if (!map[key]) {
      map[key] = {
        key,
        name: name || '\u2014',
        email: email || '\u2014',
        phone: getCustomerPhone(o),
        orders: [],
        totalSpent: 0,
        lastOrder: null,
      };
    }
    const total = getOrderTotal(o);
    map[key].orders.push(o);
    map[key].totalSpent += total;
    const orderDate = o.createdAt?.toDate ? o.createdAt.toDate() : new Date(o.createdAt || o.date || o.Date || 0);
    if (!isNaN(orderDate) && (!map[key].lastOrder || orderDate > map[key].lastOrder)) {
      map[key].lastOrder = orderDate;
    }
    if (getCustomerPhone(o) && !map[key].phone) {
      map[key].phone = getCustomerPhone(o);
    }
  });
  return Object.values(map).sort((a, b) => b.totalSpent - a.totalSpent);
}

function CustomerDetail({ customer, onClose }) {
  const orders = customer.orders.sort((a, b) => {
    const da = a.createdAt?.toDate ? a.createdAt.toDate() : new Date(a.createdAt || a.date || a.Date || 0);
    const db = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(b.createdAt || b.date || b.Date || 0);
    return db - da;
  });

  return (
    <div style={modalOverlay} onClick={onClose}>
      <div style={{ ...modalBox, maxWidth: 780 }} onClick={e => e.stopPropagation()}>
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          padding: '16px 20px', borderBottom: '1px solid #334155',
        }}>
          <div>
            <h2 style={{ color: '#f1f5f9', fontSize: 16, fontWeight: 700 }}>
              {customer.name}
            </h2>
            <p style={{ color: '#94a3b8', fontSize: 12, marginTop: 2 }}>
              {customer.email}
            </p>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: 18 }}>
            <FaTimes />
          </button>
        </div>

        <div style={{ padding: 20 }}>
          {/* Customer Info + Stats */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>
            <div style={{ background: '#0f172a', border: '1px solid #334155', borderRadius: 10, padding: 16 }}>
              <h3 style={{ color: '#94a3b8', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 12 }}>
                Customer Information
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#94a3b8', fontSize: 12 }}>Name</span>
                  <span style={{ color: '#f1f5f9', fontSize: 12, fontWeight: 600 }}>{customer.name}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#94a3b8', fontSize: 12 }}>Email</span>
                  <span style={{ color: '#f1f5f9', fontSize: 12 }}>{customer.email}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#94a3b8', fontSize: 12 }}>Phone</span>
                  <span style={{ color: '#f1f5f9', fontSize: 12 }}>{customer.phone || '\u2014'}</span>
                </div>
              </div>
            </div>

            <div style={{ background: '#0f172a', border: '1px solid #334155', borderRadius: 10, padding: 16 }}>
              <h3 style={{ color: '#94a3b8', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 12 }}>
                Purchase Summary
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#94a3b8', fontSize: 12 }}>Total Orders</span>
                  <span style={{ color: '#f1f5f9', fontSize: 12, fontWeight: 600 }}>{customer.orders.length}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#94a3b8', fontSize: 12 }}>Total Spent</span>
                  <span style={{ color: '#2dd4bf', fontSize: 14, fontWeight: 800 }}>{formatPrice(customer.totalSpent)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#94a3b8', fontSize: 12 }}>Last Order</span>
                  <span style={{ color: '#f1f5f9', fontSize: 12 }}>{formatDate(customer.lastOrder)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Order History */}
          <div style={{ marginBottom: 20 }}>
            <h3 style={{ color: '#94a3b8', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 12 }}>
              Order History
            </h3>
            <div style={{
              background: '#0f172a', border: '1px solid #334155', borderRadius: 10,
              overflow: 'hidden',
            }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid #334155' }}>
                    {['Order No', 'Date', 'Total', 'Status'].map(h => (
                      <th key={h} style={{
                        color: '#94a3b8', fontSize: 11, fontWeight: 600, textTransform: 'uppercase',
                        padding: '10px 14px', textAlign: 'left', letterSpacing: 0.5,
                      }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {orders.map((o, idx) => {
                    const status = o.status || 'pending';
                    const c = ORDER_STATUS_COLORS[status] || ORDER_STATUS_COLORS.pending;
                    return (
                      <tr key={o.id || idx} style={{
                        borderBottom: idx < orders.length - 1 ? '1px solid rgba(51,65,85,0.5)' : 'none',
                      }}>
                        <td style={{ padding: '10px 14px', fontSize: 13, color: '#f1f5f9', fontWeight: 600, fontFamily: 'monospace' }}>
                          {o.orderNumber || o.OrderNumber || o.id?.slice(0, 8) || '\u2014'}
                        </td>
                        <td style={{ padding: '10px 14px', fontSize: 12, color: '#94a3b8' }}>
                          {formatDate(o.createdAt || o.date || o.Date)}
                        </td>
                        <td style={{ padding: '10px 14px', fontSize: 13, color: '#f1f5f9', fontWeight: 700 }}>
                          {formatPrice(getOrderTotal(o))}
                        </td>
                        <td style={{ padding: '10px 14px' }}>
                          <span style={{
                            display: 'inline-block', padding: '4px 10px', borderRadius: 20,
                            fontSize: 11, fontWeight: 700, whiteSpace: 'nowrap',
                            background: c.bg, color: c.color,
                          }}>
                            {ORDER_STATUS_LABELS[status] || status}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button onClick={onClose} style={btnGhost}>Close</button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Customers() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [selectedCustomer, setSelectedCustomer] = useState(null);

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const snap = await getDocs(collection(db, 'orders'));
      const items = [];
      snap.forEach(d => items.push({ id: d.id, ...d.data() }));
      setOrders(items);
    } catch (err) {
      console.error('Orders load error (for customers):', err);
      setError('Failed to load customer data. Check Firestore permissions.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchOrders(); }, [fetchOrders]);

  const customers = useMemo(() => groupCustomers(orders), [orders]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    if (!q) return customers;
    return customers.filter(c =>
      c.name.toLowerCase().includes(q) ||
      c.email.toLowerCase().includes(q)
    );
  }, [customers, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / ITEMS_PER_PAGE));
  const safePage = Math.min(page, totalPages);
  const paged = filtered.slice((safePage - 1) * ITEMS_PER_PAGE, safePage * ITEMS_PER_PAGE);

  useEffect(() => { setPage(1); }, [search]);

  if (loading) {
    return (
      <>
        <style>{`
          @keyframes shimmer {
            0% { background-position: 200% 0; }
            100% { background-position: -200% 0; }
          }
        `}</style>
        <h1 style={{ color: '#f1f5f9', fontWeight: 800, fontSize: 24, marginBottom: 20 }}>Customers</h1>
        <div style={{
          background: '#1e293b', border: '1px solid #334155', borderRadius: 12,
          padding: 20, overflow: 'hidden',
        }}>
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} style={{
              display: 'flex', gap: 16, padding: '12px 0',
              borderBottom: i < 4 ? '1px solid #334155' : 'none',
            }}>
              {['120px', '140px', '80px', '60px', '100px', '80px', '60px'].map((w, j) => (
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
        <h1 style={{ color: '#f1f5f9', fontWeight: 800, fontSize: 24, marginBottom: 20 }}>Customers</h1>
        <div style={{
          background: '#1e293b', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 12,
          padding: 32, textAlign: 'center',
        }}>
          <FaExclamationTriangle style={{ fontSize: 32, color: '#ef4444', marginBottom: 12 }} />
          <p style={{ color: '#f1f5f9', fontSize: 14, fontWeight: 600, marginBottom: 8 }}>{error}</p>
          <button onClick={fetchOrders} style={btnPrimary}>Retry</button>
        </div>
      </>
    );
  }

  return (
    <>
      <style>{`
        .cust-row:hover { background: rgba(45,212,191,0.04) !important; }
        .cust-btn:hover { opacity: 0.8; }
        .cust-input:focus { border-color: #2dd4bf !important; }
      `}</style>

      <h1 style={{ color: '#f1f5f9', fontWeight: 800, fontSize: 24, marginBottom: 20 }}>Customers</h1>

      <div style={{
        display: 'flex', flexWrap: 'wrap', gap: 12, marginBottom: 16, alignItems: 'center',
      }}>
        <div style={{ flex: 1, minWidth: 200, position: 'relative' }}>
          <FaSearch style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8', fontSize: 13 }} />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by name, email..."
            className="cust-input"
            style={{ ...inputStyle, paddingLeft: 36 }}
          />
        </div>
      </div>

      <p style={{ color: '#94a3b8', fontSize: 12, marginBottom: 12 }}>
        {filtered.length} customer{filtered.length !== 1 ? 's' : ''} found
        {filtered.length > ITEMS_PER_PAGE && ` \u2014 Page ${safePage} of ${totalPages}`}
      </p>

      {filtered.length === 0 ? (
        <div style={{
          background: '#1e293b', border: '1px solid #334155', borderRadius: 12,
          padding: 48, textAlign: 'center',
        }}>
          <FaUsers style={{ fontSize: 40, color: '#334155', marginBottom: 12 }} />
          <p style={{ color: '#94a3b8', fontSize: 14 }}>No customers found</p>
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
                  {['Name', 'Email', 'Phone', 'Orders', 'Total Spent', 'Last Order', 'Actions'].map(h => (
                    <th key={h} style={{
                      color: '#94a3b8', fontSize: 11, fontWeight: 600, textTransform: 'uppercase',
                      padding: '12px', textAlign: 'left', whiteSpace: 'nowrap', letterSpacing: 0.5,
                    }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {paged.map(c => (
                  <tr key={c.key} className="cust-row" style={{
                    borderBottom: '1px solid rgba(51,65,85,0.5)',
                    transition: 'background 0.15s',
                  }}>
                    <td style={{ padding: '12px', fontSize: 13, fontWeight: 600, color: '#f1f5f9' }}>
                      {c.name}
                    </td>
                    <td style={{ padding: '12px', fontSize: 12, color: '#94a3b8' }}>
                      {c.email}
                    </td>
                    <td style={{ padding: '12px', fontSize: 12, color: '#94a3b8' }}>
                      {c.phone || '\u2014'}
                    </td>
                    <td style={{ padding: '12px', fontSize: 13, color: '#f1f5f9', fontWeight: 700, textAlign: 'center' }}>
                      {c.orders.length}
                    </td>
                    <td style={{ padding: '12px', fontSize: 13, color: '#2dd4bf', fontWeight: 800 }}>
                      {formatPrice(c.totalSpent)}
                    </td>
                    <td style={{ padding: '12px', fontSize: 12, color: '#94a3b8', whiteSpace: 'nowrap' }}>
                      {formatDate(c.lastOrder)}
                    </td>
                    <td style={{ padding: '12px' }}>
                      <button onClick={() => setSelectedCustomer(c)} className="cust-btn" style={{
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
      {selectedCustomer && (
        <CustomerDetail
          customer={selectedCustomer}
          onClose={() => setSelectedCustomer(null)}
        />
      )}
    </>
  );
}
