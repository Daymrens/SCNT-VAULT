import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { collection, getDocs, updateDoc, doc } from 'firebase/firestore';
import { db } from '../firebase/firebase';
import {
  FaSearch, FaTimes, FaChevronLeft, FaChevronRight,
  FaExclamationTriangle, FaShoppingCart, FaEye, FaSync
} from 'react-icons/fa';

const ITEMS_PER_PAGE = 25;

const STATUSES = ['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled'];

const STATUS_LABELS = {
  pending: 'Pending',
  confirmed: 'Confirmed',
  processing: 'Processing',
  shipped: 'Shipped',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
};

const STATUS_COLORS = {
  pending: { bg: 'rgba(245,158,11,0.15)', color: '#f59e0b' },
  confirmed: { bg: 'rgba(59,130,246,0.15)', color: '#3b82f6' },
  processing: { bg: 'rgba(148,163,184,0.15)', color: '#94a3b8' },
  shipped: { bg: 'rgba(59,130,246,0.15)', color: '#3b82f6' },
  delivered: { bg: 'rgba(34,197,94,0.15)', color: '#22c55e' },
  cancelled: { bg: 'rgba(239,68,68,0.15)', color: '#ef4444' },
};

const TIMELINE_STEPS = ['pending', 'confirmed', 'processing', 'shipped', 'delivered'];

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

const btnDanger = {
  ...btnPrimary, background: 'rgba(239,68,68,0.15)',
  color: '#ef4444', border: '1px solid rgba(239,68,68,0.3)',
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

function formatPrice(v) {
  const n = Number(v);
  return isNaN(n) ? '$0.00' : `$${n.toFixed(2)}`;
}

function getStatus(s) {
  return s || 'pending';
}

function StatusBadge({ status }) {
  const c = STATUS_COLORS[status] || STATUS_COLORS.pending;
  return (
    <span style={{
      display: 'inline-block', padding: '4px 10px', borderRadius: 20,
      fontSize: 11, fontWeight: 700, whiteSpace: 'nowrap',
      background: c.bg, color: c.color,
    }}>
      {STATUS_LABELS[status] || status}
    </span>
  );
}

function StatusTimeline({ currentStatus }) {
  if (currentStatus === 'cancelled') {
    return (
      <div style={{ textAlign: 'center', padding: '16px 0' }}>
        <span style={{ color: '#ef4444', fontSize: 13, fontWeight: 700 }}>
          Order Cancelled
        </span>
      </div>
    );
  }
  const currentIdx = TIMELINE_STEPS.indexOf(currentStatus);
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 0, padding: '16px 0' }}>
      {TIMELINE_STEPS.map((step, i) => {
        const isCompleted = i <= currentIdx;
        const isCurrent = i === currentIdx;
        return (
          <React.Fragment key={step}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1 }}>
              <div style={{
                width: 32, height: 32, borderRadius: '50%',
                background: isCompleted ? 'rgba(45,212,191,0.2)' : '#0f172a',
                border: '2px solid ' + (isCompleted ? '#2dd4bf' : '#334155'),
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 12, fontWeight: 700,
                color: isCompleted ? '#2dd4bf' : '#64748b',
                transition: 'all 0.3s',
              }}>
                {i + 1}
              </div>
              <span style={{
                fontSize: 10, color: isCompleted ? '#f1f5f9' : '#64748b',
                marginTop: 6, fontWeight: isCurrent ? 700 : 500, textAlign: 'center',
              }}>
                {STATUS_LABELS[step]}
              </span>
            </div>
            {i < TIMELINE_STEPS.length - 1 && (
              <div style={{
                height: 2, flex: 0.6, marginTop: -20,
                background: i < currentIdx ? '#2dd4bf' : '#334155',
                transition: 'background 0.3s',
              }} />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}

function OrderDetail({ order, onClose, onUpdateStatus }) {
  const [newStatus, setNewStatus] = useState(order.status || 'pending');
  const [confirming, setConfirming] = useState(false);

  const handleUpdate = () => {
    if (!confirming) {
      setConfirming(true);
      return;
    }
    onUpdateStatus(order.id, newStatus);
    setConfirming(false);
  };

  const items = order.items || order.Items || [];
  const total = order.total || order.Total || items.reduce((s, it) => s + (Number(it.price || it.Price || 0) * Number(it.quantity || it.Quantity || 0)), 0);

  const customerName = order.customerName || order.CustomerName || order.customer?.name || '\u2014';
  const customerEmail = order.customerEmail || order.CustomerEmail || order.customer?.email || '\u2014';
  const customerPhone = order.customerPhone || order.CustomerPhone || order.customer?.phone || '\u2014';
  const customerAddress = order.customerAddress || order.CustomerAddress || order.customer?.address || '\u2014';

  return (
    <div style={modalOverlay} onClick={onClose}>
      <div style={{ ...modalBox, maxWidth: 780 }} onClick={e => e.stopPropagation()}>
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          padding: '16px 20px', borderBottom: '1px solid #334155',
        }}>
          <div>
            <h2 style={{ color: '#f1f5f9', fontSize: 16, fontWeight: 700 }}>
              Order {(order.orderNumber || order.OrderNumber || order.id)}
            </h2>
            <p style={{ color: '#94a3b8', fontSize: 12, marginTop: 2 }}>
              Placed {formatDateTime(order.createdAt || order.date || order.Date)}
            </p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <StatusBadge status={order.status} />
            <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: 18 }}>
              <FaTimes />
            </button>
          </div>
        </div>

        <div style={{ padding: 20 }}>
          <div style={{
            background: '#0f172a', border: '1px solid #334155', borderRadius: 10,
            padding: '16px 20px', marginBottom: 20,
          }}>
            <h3 style={{ color: '#f1f5f9', fontSize: 13, fontWeight: 700, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 }}>
              Order Progress
            </h3>
            <StatusTimeline currentStatus={order.status} />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>
            <div style={{ background: '#0f172a', border: '1px solid #334155', borderRadius: 10, padding: 16 }}>
              <h3 style={{ color: '#94a3b8', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 12 }}>
                Order Details
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#94a3b8', fontSize: 12 }}>Order No</span>
                  <span style={{ color: '#f1f5f9', fontSize: 12, fontWeight: 600, fontFamily: 'monospace' }}>
                    {order.orderNumber || order.OrderNumber || '\u2014'}
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#94a3b8', fontSize: 12 }}>Date</span>
                  <span style={{ color: '#f1f5f9', fontSize: 12 }}>{formatDate(order.createdAt || order.date || order.Date)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#94a3b8', fontSize: 12 }}>Items</span>
                  <span style={{ color: '#f1f5f9', fontSize: 12, fontWeight: 600 }}>{items.length}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: 8, borderTop: '1px solid #334155' }}>
                  <span style={{ color: '#94a3b8', fontSize: 12, fontWeight: 700 }}>Total</span>
                  <span style={{ color: '#2dd4bf', fontSize: 16, fontWeight: 800 }}>{formatPrice(total)}</span>
                </div>
              </div>
            </div>

            <div style={{ background: '#0f172a', border: '1px solid #334155', borderRadius: 10, padding: 16 }}>
              <h3 style={{ color: '#94a3b8', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 12 }}>
                Customer
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#94a3b8', fontSize: 12 }}>Name</span>
                  <span style={{ color: '#f1f5f9', fontSize: 12, fontWeight: 600 }}>{customerName}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#94a3b8', fontSize: 12 }}>Email</span>
                  <span style={{ color: '#f1f5f9', fontSize: 12 }}>{customerEmail}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#94a3b8', fontSize: 12 }}>Phone</span>
                  <span style={{ color: '#f1f5f9', fontSize: 12 }}>{customerPhone}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <span style={{ color: '#94a3b8', fontSize: 12 }}>Address</span>
                  <span style={{ color: '#f1f5f9', fontSize: 12, textAlign: 'right', maxWidth: '60%' }}>{customerAddress}</span>
                </div>
              </div>
            </div>
          </div>

          {items.length > 0 && (
            <div style={{ marginBottom: 20 }}>
              <h3 style={{ color: '#94a3b8', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 12 }}>
                Items
              </h3>
              <div style={{
                background: '#0f172a', border: '1px solid #334155', borderRadius: 10,
                overflow: 'hidden',
              }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid #334155' }}>
                      {['Product', 'Qty', 'Price', 'Subtotal'].map(h => (
                        <th key={h} style={{
                          color: '#94a3b8', fontSize: 11, fontWeight: 600, textTransform: 'uppercase',
                          padding: '10px 14px', textAlign: 'left', letterSpacing: 0.5,
                        }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((it, idx) => {
                      const qty = Number(it.quantity || it.Quantity || 0);
                      const price = Number(it.price || it.Price || 0);
                      return (
                        <tr key={idx} style={{ borderBottom: idx < items.length - 1 ? '1px solid rgba(51,65,85,0.5)' : 'none' }}>
                          <td style={{ padding: '10px 14px', fontSize: 13, color: '#f1f5f9', fontWeight: 600 }}>
                            {it.name || it.Name || it.productName || it.ProductName || 'Item'}
                          </td>
                          <td style={{ padding: '10px 14px', fontSize: 12, color: '#94a3b8' }}>{qty}</td>
                          <td style={{ padding: '10px 14px', fontSize: 12, color: '#94a3b8' }}>{formatPrice(price)}</td>
                          <td style={{ padding: '10px 14px', fontSize: 13, color: '#f1f5f9', fontWeight: 600 }}>{formatPrice(qty * price)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <div style={{
            background: '#0f172a', border: '1px solid #334155', borderRadius: 10,
            padding: 16,
          }}>
            <h3 style={{ color: '#94a3b8', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 12 }}>
              Update Status
            </h3>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
              {STATUSES.map(s => {
                const c = STATUS_COLORS[s];
                const isActive = newStatus === s;
                return (
                  <button key={s} onClick={() => { setNewStatus(s); setConfirming(false); }} style={{
                    padding: '6px 14px', borderRadius: 20, fontSize: 12, fontWeight: 600,
                    cursor: 'pointer', border: isActive ? '2px solid ' + c.color : '1px solid #334155',
                    background: isActive ? c.bg : 'transparent',
                    color: isActive ? c.color : '#94a3b8',
                    transition: 'all 0.2s',
                  }}>
                    {STATUS_LABELS[s]}
                  </button>
                );
              })}
            </div>
            <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
              <button onClick={onClose} style={btnGhost}>Cancel</button>
              <button
                onClick={handleUpdate}
                disabled={newStatus === getStatus(order.status)}
                style={{
                  ...(confirming ? btnDanger : btnPrimary),
                  opacity: newStatus === getStatus(order.status) ? 0.4 : 1,
                  cursor: newStatus === getStatus(order.status) ? 'default' : 'pointer',
                }}
              >
                <FaSync />
                {confirming ? 'Confirm Update' : 'Update Status'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Orders() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [page, setPage] = useState(1);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [updating, setUpdating] = useState(false);

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const snap = await getDocs(collection(db, 'orders'));
      const items = [];
      snap.forEach(d => items.push({ id: d.id, ...d.data() }));
      items.sort((a, b) => {
        const da = a.createdAt?.toDate ? a.createdAt.toDate() : new Date(a.createdAt || a.date || a.Date || 0);
        const db = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(b.createdAt || b.date || b.Date || 0);
        return db - da;
      });
      setOrders(items);
    } catch (err) {
      console.error('Orders load error:', err);
      setError('Failed to load orders. Check Firestore permissions.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchOrders(); }, [fetchOrders]);

  const filtered = useMemo(() => {
    let result = orders;
    const q = search.toLowerCase();
    if (q) {
      result = result.filter(o =>
        (o.orderNumber || o.OrderNumber || '').toLowerCase().includes(q) ||
        (o.customerName || o.CustomerName || o.customer?.name || '').toLowerCase().includes(q)
      );
    }
    if (statusFilter !== 'All') {
      result = result.filter(o => (o.status || 'pending') === statusFilter);
    }
    return result;
  }, [orders, search, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / ITEMS_PER_PAGE));
  const safePage = Math.min(page, totalPages);
  const paged = filtered.slice((safePage - 1) * ITEMS_PER_PAGE, safePage * ITEMS_PER_PAGE);

  useEffect(() => { setPage(1); }, [search, statusFilter]);

  const handleUpdateStatus = async (orderId, newStatus) => {
    setUpdating(true);
    try {
      await updateDoc(doc(db, 'orders', orderId), { status: newStatus });
      setOrders(prev => prev.map(o => o.id === orderId ? { ...o, status: newStatus } : o));
      setSelectedOrder(prev => prev && prev.id === orderId ? { ...prev, status: newStatus } : prev);
    } catch (err) {
      console.error('Update order status error:', err);
      alert('Failed to update order status.');
    } finally {
      setUpdating(false);
    }
  };

  const getOrderNumber = (o) => o.orderNumber || o.OrderNumber || o.id?.slice(0, 8) || '\u2014';
  const getCustomerName = (o) => o.customerName || o.CustomerName || o.customer?.name || '\u2014';
  const getOrderTotal = (o) => {
    if (o.total || o.Total) return Number(o.total || o.Total);
    const items = o.items || o.Items || [];
    return items.reduce((s, it) => s + (Number(it.price || it.Price || 0) * Number(it.quantity || it.Quantity || 0)), 0);
  };
  const getItemsCount = (o) => (o.items || o.Items || []).length;

  if (loading) {
    return (
      <>
        <style>{`
          @keyframes shimmer {
            0% { background-position: 200% 0; }
            100% { background-position: -200% 0; }
          }
        `}</style>
        <h1 style={{ color: '#f1f5f9', fontWeight: 800, fontSize: 24, marginBottom: 20 }}>Orders</h1>
        <div style={{
          background: '#1e293b', border: '1px solid #334155', borderRadius: 12,
          padding: 20, overflow: 'hidden',
        }}>
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} style={{
              display: 'flex', gap: 16, padding: '12px 0',
              borderBottom: i < 4 ? '1px solid #334155' : 'none',
            }}>
              {['80px', '100px', '120px', '60px', '80px', '80px', '60px'].map((w, j) => (
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
        <h1 style={{ color: '#f1f5f9', fontWeight: 800, fontSize: 24, marginBottom: 20 }}>Orders</h1>
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
        .order-row:hover { background: rgba(45,212,191,0.04) !important; }
        .order-btn:hover { opacity: 0.8; }
        .order-input:focus { border-color: #2dd4bf !important; }
        .order-tab:hover { background: rgba(45,212,191,0.08) !important; }
      `}</style>

      <h1 style={{ color: '#f1f5f9', fontWeight: 800, fontSize: 24, marginBottom: 20 }}>Orders</h1>

      <div style={{
        display: 'flex', flexWrap: 'wrap', gap: 12, marginBottom: 16, alignItems: 'center',
      }}>
        <div style={{ flex: 1, minWidth: 200, position: 'relative' }}>
          <FaSearch style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8', fontSize: 13 }} />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by order number, customer..."
            className="order-input"
            style={{ ...inputStyle, paddingLeft: 36 }}
          />
        </div>
      </div>

      {/* Status Tabs */}
      <div style={{
        display: 'flex', gap: 6, marginBottom: 16, flexWrap: 'wrap',
      }}>
        {['All', ...STATUSES].map(s => {
          const isActive = statusFilter === s;
          const label = s === 'All' ? 'All' : STATUS_LABELS[s];
          const count = s === 'All' ? orders.length : orders.filter(o => (o.status || 'pending') === s).length;
          return (
            <button key={s} onClick={() => setStatusFilter(s)} className="order-tab" style={{
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
        {filtered.length} order{filtered.length !== 1 ? 's' : ''} found
        {filtered.length > ITEMS_PER_PAGE && ` \u2014 Page ${safePage} of ${totalPages}`}
      </p>

      {filtered.length === 0 ? (
        <div style={{
          background: '#1e293b', border: '1px solid #334155', borderRadius: 12,
          padding: 48, textAlign: 'center',
        }}>
          <FaShoppingCart style={{ fontSize: 40, color: '#334155', marginBottom: 12 }} />
          <p style={{ color: '#94a3b8', fontSize: 14 }}>No orders found</p>
        </div>
      ) : (
        <div style={{
          background: '#1e293b', border: '1px solid #334155', borderRadius: 12,
          overflow: 'hidden', marginBottom: 20,
        }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 800 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #334155' }}>
                  {['Order No', 'Date', 'Customer', 'Items', 'Total', 'Status', 'Actions'].map(h => (
                    <th key={h} style={{
                      color: '#94a3b8', fontSize: 11, fontWeight: 600, textTransform: 'uppercase',
                      padding: '12px', textAlign: 'left', whiteSpace: 'nowrap', letterSpacing: 0.5,
                    }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {paged.map(o => (
                  <tr key={o.id} className="order-row" style={{
                    borderBottom: '1px solid rgba(51,65,85,0.5)',
                    transition: 'background 0.15s',
                  }}>
                    <td style={{ padding: '12px' }}>
                      <span style={{ fontSize: 13, fontWeight: 600, color: '#f1f5f9', fontFamily: 'monospace' }}>
                        {getOrderNumber(o)}
                      </span>
                    </td>
                    <td style={{ padding: '12px', fontSize: 12, color: '#94a3b8' }}>
                      {formatDate(o.createdAt || o.date || o.Date)}
                    </td>
                    <td style={{ padding: '12px', fontSize: 13, color: '#f1f5f9', fontWeight: 500 }}>
                      {getCustomerName(o)}
                    </td>
                    <td style={{ padding: '12px', fontSize: 13, color: '#94a3b8', textAlign: 'center' }}>
                      {getItemsCount(o)}
                    </td>
                    <td style={{ padding: '12px', fontSize: 13, color: '#f1f5f9', fontWeight: 700 }}>
                      {formatPrice(getOrderTotal(o))}
                    </td>
                    <td style={{ padding: '12px' }}>
                      <StatusBadge status={o.status} />
                    </td>
                    <td style={{ padding: '12px' }}>
                      <button onClick={() => setSelectedOrder(o)} className="order-btn" style={{
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

      {/* Modals */}
      {selectedOrder && (
        <OrderDetail
          order={selectedOrder}
          onClose={() => setSelectedOrder(null)}
          onUpdateStatus={handleUpdateStatus}
        />
      )}
    </>
  );
}
