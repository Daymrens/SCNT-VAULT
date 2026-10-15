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
  border: '1px solid #e6e8ec', background: '#f6f7f9', color: '#14181f',
  fontSize: 13, outline: 'none', transition: 'border-color 0.2s',
};

const btnPrimary = {
  display: 'inline-flex', alignItems: 'center', gap: 6,
  background: 'rgba(13,148,136,0.15)', color: '#0d9488',
  border: '1px solid rgba(13,148,136,0.3)', borderRadius: 8,
  padding: '8px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer',
  transition: 'all 0.2s',
};

const btnGhost = {
  background: 'transparent', border: '1px solid #e6e8ec', borderRadius: 8,
  padding: '6px 10px', color: '#6b7280', cursor: 'pointer',
  display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12,
  fontWeight: 600, transition: 'all 0.2s',
};

const btnGhostActive = {
  ...btnGhost, background: 'rgba(13,148,136,0.15)',
  color: '#0d9488', border: '1px solid rgba(13,148,136,0.3)',
};

const modalOverlay = {
  position: 'fixed', inset: 0, background: 'rgba(16,24,40,0.35)',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  zIndex: 1000, backdropFilter: 'blur(4px)',
};

const modalBox = {
  background: '#ffffff', border: '1px solid #e6e8ec', borderRadius: 16,
  width: '90%', maxWidth: 780, maxHeight: '85vh', overflow: 'auto',
  boxShadow: '0 24px 48px rgba(16,24,40,0.12)',
};

const ORDER_STATUS_COLORS = {
  pending: { bg: '#fff7e6', color: '#b45309' },
  confirmed: { bg: '#eef4ff', color: '#2563eb' },
  processing: { bg: 'rgba(148,163,184,0.15)', color: '#6b7280' },
  shipped: { bg: '#eef4ff', color: '#2563eb' },
  delivered: { bg: '#e9f9ef', color: '#15803d' },
  cancelled: { bg: '#fdf2f2', color: '#dc2626' },
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
          padding: '16px 20px', borderBottom: '1px solid #e6e8ec',
        }}>
          <div>
            <h2 style={{ color: '#14181f', fontSize: 16, fontWeight: 700 }}>
              {customer.name}
            </h2>
            <p style={{ color: '#6b7280', fontSize: 12, marginTop: 2 }}>
              {customer.email}
            </p>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#6b7280', cursor: 'pointer', fontSize: 18 }}>
            <FaTimes />
          </button>
        </div>

        <div style={{ padding: 20 }}>
          {/* Customer Info + Stats */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>
            <div style={{ background: '#f6f7f9', border: '1px solid #e6e8ec', borderRadius: 10, padding: 16 }}>
              <h3 style={{ color: '#6b7280', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 12 }}>
                Customer Information
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#6b7280', fontSize: 12 }}>Name</span>
                  <span style={{ color: '#14181f', fontSize: 12, fontWeight: 600 }}>{customer.name}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#6b7280', fontSize: 12 }}>Email</span>
                  <span style={{ color: '#14181f', fontSize: 12 }}>{customer.email}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#6b7280', fontSize: 12 }}>Phone</span>
                  <span style={{ color: '#14181f', fontSize: 12 }}>{customer.phone || '\u2014'}</span>
                </div>
              </div>
            </div>

            <div style={{ background: '#f6f7f9', border: '1px solid #e6e8ec', borderRadius: 10, padding: 16 }}>
              <h3 style={{ color: '#6b7280', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 12 }}>
                Purchase Summary
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#6b7280', fontSize: 12 }}>Total Orders</span>
                  <span style={{ color: '#14181f', fontSize: 12, fontWeight: 600 }}>{customer.orders.length}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#6b7280', fontSize: 12 }}>Total Spent</span>
                  <span style={{ color: '#0d9488', fontSize: 14, fontWeight: 800 }}>{formatPrice(customer.totalSpent)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#6b7280', fontSize: 12 }}>Last Order</span>
                  <span style={{ color: '#14181f', fontSize: 12 }}>{formatDate(customer.lastOrder)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Order History */}
          <div style={{ marginBottom: 20 }}>
            <h3 style={{ color: '#6b7280', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 12 }}>
              Order History
            </h3>
            <div style={{
              background: '#f6f7f9', border: '1px solid #e6e8ec', borderRadius: 10,
              overflow: 'hidden',
            }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid #e6e8ec' }}>
                    {['Order No', 'Date', 'Total', 'Status'].map(h => (
                      <th key={h} style={{
                        color: '#6b7280', fontSize: 11, fontWeight: 600, textTransform: 'uppercase',
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
                        borderBottom: idx < orders.length - 1 ? '1px solid #eff1f4' : 'none',
                      }}>
                        <td style={{ padding: '10px 14px', fontSize: 13, color: '#14181f', fontWeight: 600, fontFamily: 'monospace' }}>
                          {o.orderNumber || o.OrderNumber || o.id?.slice(0, 8) || '\u2014'}
                        </td>
                        <td style={{ padding: '10px 14px', fontSize: 12, color: '#6b7280' }}>
                          {formatDate(o.createdAt || o.date || o.Date)}
                        </td>
                        <td style={{ padding: '10px 14px', fontSize: 13, color: '#14181f', fontWeight: 700 }}>
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
        <h1 style={{ color: '#14181f', fontWeight: 800, fontSize: 24, marginBottom: 20 }}>Customers</h1>
        <div style={{
          background: '#ffffff', border: '1px solid #e6e8ec', borderRadius: 12,
          padding: 20, overflow: 'hidden',
        }}>
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} style={{
              display: 'flex', gap: 16, padding: '12px 0',
              borderBottom: i < 4 ? '1px solid #e6e8ec' : 'none',
            }}>
              {['120px', '140px', '80px', '60px', '100px', '80px', '60px'].map((w, j) => (
                <div key={j} style={{
                  width: w, height: 14, borderRadius: 4,
                  background: 'linear-gradient(90deg, #eceff2 25%, #f4f6f8 50%, #eceff2 75%)',
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
        <h1 style={{ color: '#14181f', fontWeight: 800, fontSize: 24, marginBottom: 20 }}>Customers</h1>
        <div style={{
          background: '#ffffff', border: '1px solid #f3d6d6', borderRadius: 12,
          padding: 32, textAlign: 'center',
        }}>
          <FaExclamationTriangle style={{ fontSize: 32, color: '#dc2626', marginBottom: 12 }} />
          <p style={{ color: '#14181f', fontSize: 14, fontWeight: 600, marginBottom: 8 }}>{error}</p>
          <button onClick={fetchOrders} style={btnPrimary}>Retry</button>
        </div>
      </>
    );
  }

  return (
    <>
      <style>{`
        .cust-row:hover { background: rgba(13,148,136,0.04) !important; }
        .cust-btn:hover { opacity: 0.8; }
        .cust-input:focus { border-color: #0d9488 !important; }
      `}</style>

      <h1 style={{ color: '#14181f', fontWeight: 800, fontSize: 24, marginBottom: 20 }}>Customers</h1>

      <div style={{
        display: 'flex', flexWrap: 'wrap', gap: 12, marginBottom: 16, alignItems: 'center',
      }}>
        <div style={{ flex: 1, minWidth: 200, position: 'relative' }}>
          <FaSearch style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#6b7280', fontSize: 13 }} />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by name, email..."
            className="cust-input"
            style={{ ...inputStyle, paddingLeft: 36 }}
          />
        </div>
      </div>

      <p style={{ color: '#6b7280', fontSize: 12, marginBottom: 12 }}>
        {filtered.length} customer{filtered.length !== 1 ? 's' : ''} found
        {filtered.length > ITEMS_PER_PAGE && ` \u2014 Page ${safePage} of ${totalPages}`}
      </p>

      {filtered.length === 0 ? (
        <div style={{
          background: '#ffffff', border: '1px solid #e6e8ec', borderRadius: 12,
          padding: 48, textAlign: 'center',
        }}>
          <FaUsers style={{ fontSize: 40, color: '#e6e8ec', marginBottom: 12 }} />
          <p style={{ color: '#6b7280', fontSize: 14 }}>No customers found</p>
        </div>
      ) : (
        <div style={{
          background: '#ffffff', border: '1px solid #e6e8ec', borderRadius: 12,
          overflow: 'hidden', marginBottom: 20,
        }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 900 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #e6e8ec' }}>
                  {['Name', 'Email', 'Phone', 'Orders', 'Total Spent', 'Last Order', 'Actions'].map(h => (
                    <th key={h} style={{
                      color: '#6b7280', fontSize: 11, fontWeight: 600, textTransform: 'uppercase',
                      padding: '12px', textAlign: 'left', whiteSpace: 'nowrap', letterSpacing: 0.5,
                    }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {paged.map(c => (
                  <tr key={c.key} className="cust-row" style={{
                    borderBottom: '1px solid #eff1f4',
                    transition: 'background 0.15s',
                  }}>
                    <td style={{ padding: '12px', fontSize: 13, fontWeight: 600, color: '#14181f' }}>
                      {c.name}
                    </td>
                    <td style={{ padding: '12px', fontSize: 12, color: '#6b7280' }}>
                      {c.email}
                    </td>
                    <td style={{ padding: '12px', fontSize: 12, color: '#6b7280' }}>
                      {c.phone || '\u2014'}
                    </td>
                    <td style={{ padding: '12px', fontSize: 13, color: '#14181f', fontWeight: 700, textAlign: 'center' }}>
                      {c.orders.length}
                    </td>
                    <td style={{ padding: '12px', fontSize: 13, color: '#0d9488', fontWeight: 800 }}>
                      {formatPrice(c.totalSpent)}
                    </td>
                    <td style={{ padding: '12px', fontSize: 12, color: '#6b7280', whiteSpace: 'nowrap' }}>
                      {formatDate(c.lastOrder)}
                    </td>
                    <td style={{ padding: '12px' }}>
                      <button onClick={() => setSelectedCustomer(c)} className="cust-btn" style={{
                        background: 'rgba(13,148,136,0.1)', color: '#0d9488',
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
                <span key={'e' + i} style={{ color: '#6b7280', fontSize: 13, padding: '0 4px' }}>{'\u2026'}</span>
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
