import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  collection, query, where, getDocs
} from 'firebase/firestore';
import { db } from '../firebase/firebase';
import {
  FaBoxes, FaShoppingCart, FaClock, FaEnvelope,
  FaExclamationTriangle, FaEye, FaArrowRight
} from 'react-icons/fa';

const STATUS = {
  pending: { label: 'Pending', bg: '#fff7e6', color: '#b45309', bar: '#f59e0b' },
  confirmed: { label: 'Confirmed', bg: '#eef4ff', color: '#2563eb', bar: '#3b82f6' },
  processing: { label: 'Processing', bg: '#f1f5f9', color: '#64748b', bar: '#94a3b8' },
  shipped: { label: 'Shipped', bg: '#f5eeff', color: '#7c3aed', bar: '#8b5cf6' },
  delivered: { label: 'Delivered', bg: '#e9f9ef', color: '#15803d', bar: '#22c55e' },
  cancelled: { label: 'Cancelled', bg: '#feeceb', color: '#dc2626', bar: '#ef4444' },
};

const statusStyle = (s) => STATUS[s] || { bg: '#f1f5f9', color: '#64748b', bar: '#94a3b8' };

function SkeletonBlock({ width, height, style = {} }) {
  return (
    <div style={{
      width, height, borderRadius: 6,
      background: 'linear-gradient(90deg, #eceff2 25%, #f4f6f8 50%, #eceff2 75%)',
      backgroundSize: '200% 100%',
      animation: 'shimmer 1.5s infinite',
      ...style,
    }} />
  );
}

function SkeletonCard() {
  return (
    <div style={{
      background: '#fff', border: '1px solid #e6e8ec', borderRadius: 10,
      padding: 18, display: 'flex', flexDirection: 'column', gap: 12,
    }}>
      <SkeletonBlock width="40%" height={12} />
      <SkeletonBlock width="60%" height={26} />
    </div>
  );
}

function SkeletonTable({ rows = 5 }) {
  return (
    <div style={{
      background: '#fff', border: '1px solid #e6e8ec', borderRadius: 10,
      padding: 18, overflow: 'hidden',
    }}>
      <SkeletonBlock width="120px" height={18} style={{ marginBottom: 16 }} />
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} style={{
          display: 'flex', gap: 16, padding: '12px 0',
          borderBottom: i < rows - 1 ? '1px solid #eff1f4' : 'none',
        }}>
          <SkeletonBlock width="80px" height={14} />
          <SkeletonBlock width="100px" height={14} />
          <SkeletonBlock width="120px" height={14} />
          <SkeletonBlock width="60px" height={14} />
          <SkeletonBlock width="80px" height={14} />
        </div>
      ))}
    </div>
  );
}

function SkeletonChart() {
  return (
    <div style={{ background: '#fff', border: '1px solid #e6e8ec', borderRadius: 10, padding: 18 }}>
      <SkeletonBlock width="140px" height={18} style={{ marginBottom: 20 }} />
      <SkeletonBlock width="100%" height={200} />
    </div>
  );
}

function ErrorState({ message, onRetry }) {
  return (
    <div style={{
      background: '#fff', border: '1px solid #f3d6d6', borderRadius: 10,
      padding: 30, textAlign: 'center',
    }}>
      <FaExclamationTriangle style={{ fontSize: 30, color: '#dc2626', marginBottom: 12 }} />
      <p style={{ color: '#14181f', fontSize: 14, fontWeight: 600, marginBottom: 8 }}>
        {message || 'Something went wrong'}
      </p>
      {onRetry && (
        <button onClick={onRetry} style={{
          background: '#fdf2f2', color: '#dc2626',
          border: '1px solid #f3d6d6', borderRadius: 8,
          padding: '8px 20px', fontSize: 13, fontWeight: 600, cursor: 'pointer',
        }}>
          Retry
        </button>
      )}
    </div>
  );
}

/* Small helper: a smooth line path through the given points */
function smoothPath(pts) {
  if (pts.length === 0) return '';
  if (pts.length === 1) return `M${pts[0][0]},${pts[0][1]}`;
  let d = `M${pts[0][0].toFixed(1)},${pts[0][1].toFixed(1)}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] || pts[i];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2] || p2;
    const t = 0.16;
    const c1x = p1[0] + (p2[0] - p0[0]) * t;
    const c1y = p1[1] + (p2[1] - p0[1]) * t;
    const c2x = p2[0] - (p3[0] - p1[0]) * t;
    const c2y = p2[1] - (p3[1] - p1[1]) * t;
    d += ` C${c1x.toFixed(1)},${c1y.toFixed(1)} ${c2x.toFixed(1)},${c2y.toFixed(1)} ${p2[0].toFixed(1)},${p2[1].toFixed(1)}`;
  }
  return d;
}

/* Lightweight line chart drawn as plain SVG — no chart library, no downloads */
function LineChart({ labels, values }) {
  const [hover, setHover] = useState(null);
  const W = 660, H = 240;
  const P = { t: 18, r: 18, b: 30, l: 38 };
  const iw = W - P.l - P.r;
  const ih = H - P.t - P.b;
  const n = values.length;

  if (n === 0) {
    return (
      <div style={{ height: 240, display: 'grid', placeItems: 'center', color: '#9aa3af', fontSize: 13 }}>
        No order data yet
      </div>
    );
  }

  const max = Math.max(...values, 1);
  const x = i => P.l + (n <= 1 ? iw / 2 : iw * i / (n - 1));
  const y = v => P.t + ih - ih * (v / max);
  const pts = values.map((v, i) => [x(i), y(v)]);
  const line = smoothPath(pts);
  const area = `${line} L${pts[n - 1][0].toFixed(1)},${(P.t + ih).toFixed(1)} L${pts[0][0].toFixed(1)},${(P.t + ih).toFixed(1)} Z`;

  // y gridlines + labels
  const rows = [];
  for (let g = 0; g <= 4; g++) {
    const val = Math.round(max * g / 4);
    const yy = y(val);
    rows.push(
      <g key={g}>
        <line x1={P.l} y1={yy} x2={W - P.r} y2={yy}
          stroke={g === 0 ? '#e6e8ec' : '#eff1f4'} strokeWidth="1" />
        <text x={P.l - 8} y={yy + 3.5} textAnchor="end" fontSize="10" fill="#9aa3af">{val}</text>
      </g>
    );
  }

  // x labels — show at most 6, evenly spaced
  const maxLabels = 6;
  const stepL = Math.max(1, Math.ceil(n / maxLabels));
  const xLabels = labels.map((lb, i) => (
    i % stepL === 0 || i === n - 1
      ? <text key={i} x={x(i)} y={H - 10} textAnchor="middle" fontSize="10" fill="#9aa3af">{lb}</text>
      : null
  ));

  const hv = hover != null ? values[hover] : null;
  const step = n > 1 ? iw / (n - 1) : iw;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" style={{ width: '100%', height: 240, display: 'block' }}>
      <defs>
        <linearGradient id="dashArea" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#0d9488" stopOpacity="0.16" />
          <stop offset="1" stopColor="#0d9488" stopOpacity="0" />
        </linearGradient>
      </defs>

      {rows}
      {xLabels}

      <path d={area} fill="url(#dashArea)" />
      <path d={line} fill="none" stroke="#0d9488" strokeWidth="2"
        strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />

      {hover != null && (
        <line x1={x(hover)} y1={P.t} x2={x(hover)} y2={P.t + ih}
          stroke="#cbd5e1" strokeWidth="1" strokeDasharray="3 3" vectorEffect="non-scaling-stroke" />
      )}
      {pts.map((p, i) => (
        <circle key={i} cx={p[0]} cy={p[1]}
          r={hover === i ? 4.5 : (i === values.indexOf(max) ? 3.5 : 0)}
          fill={hover === i || i === values.indexOf(max) ? '#0d9488' : 'transparent'}
          stroke="#fff" strokeWidth="2" vectorEffect="non-scaling-stroke" />
      ))}

      {/* hover zones */}
      {values.map((v, i) => (
        <rect key={`h${i}`} x={Math.max(0, x(i) - step / 2)} y={P.t}
          width={step} height={ih + P.b - 4} fill="transparent"
          onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}
          style={{ cursor: 'pointer' }} />
      ))}

      {hover != null && (() => {
        const px = x(hover);
        const bw = 74, bh = 34;
        const bx = Math.min(Math.max(px - bw / 2, P.l), W - P.r - bw);
        const by = Math.max(2, y(hv) - bh - 10);
        return (
          <g pointerEvents="none">
            <rect x={bx} y={by} width={bw} height={bh} rx="6" fill="#14181f" />
            <text x={bx + bw / 2} y={by + 14} textAnchor="middle" fontSize="9.5" fill="#9aa3af">{labels[hover]}</text>
            <text x={bx + bw / 2} y={by + 27} textAnchor="middle" fontSize="11.5" fontWeight="700" fill="#fff">
              {hv} {hv === 1 ? 'order' : 'orders'}
            </text>
          </g>
        );
      })()}
    </svg>
  );
}

/* Orders-by-status as slim bars */
function StatusBars({ data }) {
  const entries = Object.keys(data).map(k => ({ key: k, count: data[k] }));
  entries.sort((a, b) => b.count - a.count);
  const max = Math.max(...entries.map(e => e.count), 1);

  if (entries.length === 0) {
    return <div style={{ padding: 24, textAlign: 'center', color: '#9aa3af', fontSize: 13 }}>No order data</div>;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 13, padding: '4px 2px' }}>
      {entries.map(({ key, count }) => {
        const s = statusStyle(key);
        return (
          <div key={key} style={{ display: 'grid', gridTemplateColumns: '84px 1fr 30px', alignItems: 'center', gap: 12 }}>
            <span style={{ fontSize: 12.5, color: '#6b7280', textTransform: 'capitalize' }}>{key}</span>
            <span style={{ height: 8, borderRadius: 20, background: '#f1f3f5', overflow: 'hidden' }}>
              <span style={{
                display: 'block', height: '100%', borderRadius: 20,
                width: `${Math.round(count / max * 100)}%`, background: s.bar,
                transition: 'width .5s ease',
              }} />
            </span>
            <span style={{ fontSize: 12.5, fontWeight: 700, textAlign: 'right' }}>{count}</span>
          </div>
        );
      })}
    </div>
  );
}

export default function Dashboard() {
  const [stats, setStats] = useState({ products: 0, orders: 0, pending: 0, messages: 0 });
  const [ordersByDay, setOrdersByDay] = useState({ labels: [], data: [] });
  const [ordersByStatus, setOrdersByStatus] = useState({});
  const [recentOrders, setRecentOrders] = useState([]);
  const [lowStock, setLowStock] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const loadDashboard = async () => {
    setLoading(true);
    setError(null);
    try {
      const [productsSnap, ordersSnap, pendingSnap, messagesSnap] = await Promise.all([
        getDocs(collection(db, 'products')),
        getDocs(collection(db, 'orders')),
        getDocs(query(collection(db, 'orders'), where('status', '==', 'pending'))),
        getDocs(query(collection(db, 'contacts'), where('status', '==', 'unread'))),
      ]);

      setStats({
        products: productsSnap.size,
        orders: ordersSnap.size,
        pending: pendingSnap.size,
        messages: messagesSnap.size,
      });

      const dayCounts = {};
      const statusCounts = {};
      const recent = [];

      ordersSnap.forEach(doc => {
        const d = doc.data();

        const ts = d.createdAt?.toDate?.() || d.createdAt;
        if (ts instanceof Date) {
          const dateStr = ts.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
          dayCounts[dateStr] = (dayCounts[dateStr] || 0) + 1;
        }

        const status = d.status || 'pending';
        statusCounts[status] = (statusCounts[status] || 0) + 1;

        recent.push({ id: doc.id, ...d, _createdAt: ts });
      });

      recent.sort((a, b) => {
        const ta = a._createdAt instanceof Date ? a._createdAt.getTime() : 0;
        const tb = b._createdAt instanceof Date ? b._createdAt.getTime() : 0;
        return tb - ta;
      });
      setRecentOrders(recent.slice(0, 10));

      const now = new Date();
      const sortedDays = Object.entries(dayCounts)
        .sort((a, b) => {
          const da = new Date(a[0] + ', ' + now.getFullYear());
          const db2 = new Date(b[0] + ', ' + now.getFullYear());
          return da - db2;
        });
      setOrdersByDay({
        labels: sortedDays.map(d => d[0]),
        data: sortedDays.map(d => d[1]),
      });

      setOrdersByStatus(statusCounts);

      const lowStockItems = [];
      productsSnap.forEach(doc => {
        const d = doc.data();
        const stock = d.StockQty ?? d.stockQty ?? 0;
        const threshold = d.LowStockThreshold ?? d.lowStockThreshold ?? 10;
        if (stock <= threshold) {
          lowStockItems.push({ id: doc.id, ...d });
        }
      });
      setLowStock(lowStockItems.slice(0, 10));

    } catch (err) {
      console.error('Dashboard load error:', err);
      setError('Failed to load dashboard data. Check Firestore permissions.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadDashboard(); }, []);

  const pageTitle = { color: '#14181f', fontWeight: 800, fontSize: 22, marginBottom: 20, letterSpacing: '-.4px' };

  if (loading) {
    return (
      <>
        <style>{`@keyframes shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }`}</style>
        <h1 style={pageTitle}>Dashboard</h1>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14, marginBottom: 20 }}>
          {Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} />)}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 14, marginBottom: 20 }}>
          <SkeletonChart />
          <SkeletonChart />
        </div>
        <SkeletonTable />
      </>
    );
  }

  if (error) {
    return (
      <>
        <h1 style={pageTitle}>Dashboard</h1>
        <ErrorState message={error} onRetry={loadDashboard} />
      </>
    );
  }

  const statCards = [
    { label: 'Total Products', value: stats.products, icon: <FaBoxes />, color: '#0f766e', bg: '#e8f6f4' },
    { label: 'Website Orders', value: stats.orders, icon: <FaShoppingCart />, color: '#2563eb', bg: '#eef4ff' },
    { label: 'Pending Orders', value: stats.pending, icon: <FaClock />, color: '#b45309', bg: '#fff7e6' },
    { label: 'New Messages', value: stats.messages, icon: <FaEnvelope />, color: '#7c3aed', bg: '#f5eeff' },
  ];

  const panel = { background: '#fff', border: '1px solid #e6e8ec', borderRadius: 10, boxShadow: '0 1px 2px rgba(16,24,40,.04)' };
  const panelHead = { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 14, flexWrap: 'wrap' };
  const panelTitle = { color: '#14181f', fontSize: 13.5, fontWeight: 700 };
  const th = {
    color: '#9aa3af', fontSize: 10.5, fontWeight: 700, textTransform: 'uppercase',
    letterSpacing: '.5px', padding: '10px 12px', textAlign: 'left', whiteSpace: 'nowrap',
  };

  return (
    <>
      <style>{`
        .dash-card:hover { box-shadow: 0 4px 16px rgba(16,24,40,0.07); }
        .dash-btn:hover { background: #dff0ee !important; }
        .dash-link:hover { text-decoration: underline; }
      `}</style>

      <h1 style={pageTitle}>Dashboard</h1>

      {/* Stats Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14, marginBottom: 20 }}>
        {statCards.map(card => (
          <div key={card.label} className="dash-card" style={{
            ...panel, padding: 18, display: 'flex', alignItems: 'center', gap: 14,
            transition: 'box-shadow 0.2s',
          }}>
            <div style={{
              width: 44, height: 44, borderRadius: 10, background: card.bg, flexShrink: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: card.color, fontSize: 18,
            }}>
              {card.icon}
            </div>
            <div>
              <p style={{ color: '#6b7280', fontSize: 12, fontWeight: 500, marginBottom: 3 }}>{card.label}</p>
              <p style={{ color: '#14181f', fontSize: 23, fontWeight: 700, letterSpacing: '-.5px', lineHeight: 1 }}>{card.value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Charts */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 14, marginBottom: 20 }}>
        <div style={{ ...panel, padding: 18 }}>
          <div style={panelHead}>
            <h3 style={panelTitle}>Orders — last 30 days</h3>
            <span style={{ fontSize: 11.5, color: '#9aa3af' }}>
              Total {ordersByDay.data.reduce((a, b) => a + b, 0)}
            </span>
          </div>
          <LineChart labels={ordersByDay.labels} values={ordersByDay.data} />
        </div>

        <div style={{ ...panel, padding: 18 }}>
          <div style={panelHead}>
            <h3 style={panelTitle}>Orders by status</h3>
          </div>
          <StatusBars data={ordersByStatus} />
        </div>
      </div>

      {/* Recent Orders Table */}
      <div style={{ ...panel, padding: 18, marginBottom: 20, overflowX: 'auto' }}>
        <div style={panelHead}>
          <h3 style={panelTitle}>Recent orders</h3>
          <Link to="/orders" className="dash-link" style={{
            color: '#0f766e', fontSize: 12.5, fontWeight: 600, textDecoration: 'none',
            display: 'flex', alignItems: 'center', gap: 4,
          }}>
            View all <FaArrowRight style={{ fontSize: 10 }} />
          </Link>
        </div>

        {recentOrders.length === 0 ? (
          <p style={{ color: '#9aa3af', fontSize: 13, textAlign: 'center', padding: 24 }}>No orders yet</p>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 700 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #e6e8ec' }}>
                {['Order No', 'Date', 'Customer', 'Items', 'Total', 'Status', 'Actions'].map(h => (
                  <th key={h} style={th}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {recentOrders.map(order => {
                const status = order.status || 'pending';
                const sc = statusStyle(status);
                const date = order._createdAt instanceof Date
                  ? order._createdAt.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                  : '—';
                const items = order.items?.length || order.itemCount || 0;
                const total = order.total != null
                  ? `₱${Number(order.total).toFixed(2)}`
                  : order.grandTotal != null
                    ? `₱${Number(order.grandTotal).toFixed(2)}`
                    : '—';
                const orderNo = order.orderNo || order.orderNumber || order.id?.slice(0, 8) || '—';
                const customer = order.customerName || order.customer?.name || order.email || '—';

                return (
                  <tr key={order.id} style={{ borderBottom: '1px solid #eff1f4' }}>
                    <td style={{ padding: '12px', fontSize: 13, color: '#14181f', fontWeight: 600 }}>{orderNo}</td>
                    <td style={{ padding: '12px', fontSize: 12, color: '#6b7280' }}>{date}</td>
                    <td style={{ padding: '12px', fontSize: 13, color: '#14181f' }}>{customer}</td>
                    <td style={{ padding: '12px', fontSize: 13, color: '#6b7280', textAlign: 'center' }}>{items}</td>
                    <td style={{ padding: '12px', fontSize: 13, color: '#14181f', fontWeight: 600 }}>{total}</td>
                    <td style={{ padding: '12px' }}>
                      <span style={{
                        display: 'inline-block', padding: '3px 10px', borderRadius: 20,
                        fontSize: 10.5, fontWeight: 700, textTransform: 'capitalize',
                        background: sc.bg, color: sc.color,
                      }}>
                        {status}
                      </span>
                    </td>
                    <td style={{ padding: '12px' }}>
                      <Link to={`/orders?id=${order.id}`} className="dash-btn" style={{
                        display: 'inline-flex', alignItems: 'center', gap: 5,
                        padding: '5px 10px', borderRadius: 6, fontSize: 11.5, fontWeight: 600,
                        background: '#e8f6f4', color: '#0f766e',
                        textDecoration: 'none', transition: 'background 0.15s',
                      }}>
                        <FaEye /> View
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Low Stock Alerts */}
      {lowStock.length > 0 && (
        <div style={{ ...panel, border: '1px solid #f5e3bf', padding: 18, marginBottom: 20 }}>
          <div style={panelHead}>
            <h3 style={{ color: '#b45309', fontSize: 13.5, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
              <FaExclamationTriangle /> Low stock alerts
            </h3>
            <Link to="/products" className="dash-link" style={{
              color: '#0f766e', fontSize: 12.5, fontWeight: 600, textDecoration: 'none',
              display: 'flex', alignItems: 'center', gap: 4,
            }}>
              Manage products <FaArrowRight style={{ fontSize: 10 }} />
            </Link>
          </div>

          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 500 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #e6e8ec' }}>
                {['Product Name', 'SKU', 'Stock', 'Category'].map(h => (
                  <th key={h} style={th}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {lowStock.map(p => {
                const stock = p.StockQty ?? p.stockQty ?? 0;
                return (
                  <tr key={p.id} style={{ borderBottom: '1px solid #eff1f4' }}>
                    <td style={{ padding: '12px', fontSize: 13, color: '#14181f', fontWeight: 600 }}>
                      {p.name || p.Name || '—'}
                    </td>
                    <td style={{ padding: '12px', fontSize: 12, color: '#6b7280' }}>
                      {p.sku || p.SKU || '—'}
                    </td>
                    <td style={{ padding: '12px', fontSize: 13, color: stock === 0 ? '#dc2626' : '#b45309', fontWeight: 700 }}>
                      {stock}
                    </td>
                    <td style={{ padding: '12px', fontSize: 12, color: '#6b7280' }}>
                      {p.category || p.Category || '—'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
