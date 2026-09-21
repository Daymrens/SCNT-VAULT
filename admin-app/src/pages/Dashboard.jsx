import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  collection, query, where, orderBy, limit, getDocs,
  Timestamp
} from 'firebase/firestore';
import { db } from '../firebase/firebase';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, ArcElement, Tooltip, Legend } from 'chart.js';
import { Bar, Doughnut } from 'react-chartjs-2';
import {
  FaBoxes, FaShoppingCart, FaClock, FaEnvelope,
  FaExclamationTriangle, FaEye, FaArrowRight
} from 'react-icons/fa';

ChartJS.register(CategoryScale, LinearScale, BarElement, ArcElement, Tooltip, Legend);

const STATUS_COLORS = {
  pending: { bg: 'rgba(245,158,11,0.15)', color: '#f59e0b' },
  confirmed: { bg: 'rgba(59,130,246,0.15)', color: '#3b82f6' },
  processing: { bg: 'rgba(148,163,184,0.15)', color: '#94a3b8' },
  shipped: { bg: 'rgba(59,130,246,0.15)', color: '#3b82f6' },
  delivered: { bg: 'rgba(34,197,94,0.15)', color: '#22c55e' },
  cancelled: { bg: 'rgba(239,68,68,0.15)', color: '#ef4444' },
};

function SkeletonBlock({ width, height, style = {} }) {
  return (
    <div style={{
      width, height, borderRadius: 8,
      background: 'linear-gradient(90deg, #1e293b 25%, #334155 50%, #1e293b 75%)',
      backgroundSize: '200% 100%',
      animation: 'shimmer 1.5s infinite',
      ...style,
    }} />
  );
}

function SkeletonCard() {
  return (
    <div style={{
      background: '#1e293b', border: '1px solid #334155', borderRadius: 12,
      padding: 20, display: 'flex', flexDirection: 'column', gap: 12,
    }}>
      <SkeletonBlock width="40%" height={12} />
      <SkeletonBlock width="60%" height={28} />
      <SkeletonBlock width="50%" height={12} />
    </div>
  );
}

function SkeletonTable({ rows = 5 }) {
  return (
    <div style={{
      background: '#1e293b', border: '1px solid #334155', borderRadius: 12,
      padding: 20, overflow: 'hidden',
    }}>
      <SkeletonBlock width="120px" height={18} style={{ marginBottom: 16 }} />
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} style={{
          display: 'flex', gap: 16, padding: '12px 0',
          borderBottom: i < rows - 1 ? '1px solid #334155' : 'none',
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
    <div style={{
      background: '#1e293b', border: '1px solid #334155', borderRadius: 12,
      padding: 20,
    }}>
      <SkeletonBlock width="140px" height={18} style={{ marginBottom: 20 }} />
      <SkeletonBlock width="100%" height={200} style={{ borderRadius: 8 }} />
    </div>
  );
}

function ErrorState({ message, onRetry }) {
  return (
    <div style={{
      background: '#1e293b', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 12,
      padding: 32, textAlign: 'center',
    }}>
      <FaExclamationTriangle style={{ fontSize: 32, color: '#ef4444', marginBottom: 12 }} />
      <p style={{ color: '#f1f5f9', fontSize: 14, fontWeight: 600, marginBottom: 8 }}>
        {message || 'Something went wrong'}
      </p>
      {onRetry && (
        <button onClick={onRetry} style={{
          background: 'rgba(45,212,191,0.1)', color: '#2dd4bf',
          border: '1px solid rgba(45,212,191,0.3)', borderRadius: 8,
          padding: '8px 20px', fontSize: 13, fontWeight: 600, cursor: 'pointer',
        }}>
          Retry
        </button>
      )}
    </div>
  );
}

export default function Dashboard() {
  const [stats, setStats] = useState({ products: 0, orders: 0, pending: 0, messages: 0 });
  const [ordersByDay, setOrdersByDay] = useState({ labels: [], data: [] });
  const [ordersByStatus, setOrdersByStatus] = useState({ labels: [], data: [] });
  const [recentOrders, setRecentOrders] = useState([]);
  const [lowStock, setLowStock] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const loadDashboard = async () => {
    setLoading(true);
    setError(null);
    try {
      const now = new Date();
      const thirtyDaysAgo = new Date(now);
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

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

      const sortedDays = Object.entries(dayCounts)
        .sort((a, b) => {
          const da = new Date(a[0] + ', ' + now.getFullYear());
          const db = new Date(b[0] + ', ' + now.getFullYear());
          return da - db;
        });
      setOrdersByDay({
        labels: sortedDays.map(d => d[0]),
        data: sortedDays.map(d => d[1]),
      });

      setOrdersByStatus({
        labels: Object.keys(statusCounts),
        data: Object.values(statusCounts),
      });

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

  if (loading) {
    return (
      <>
        <style>{`
          @keyframes shimmer {
            0% { background-position: 200% 0; }
            100% { background-position: -200% 0; }
          }
        `}</style>
        <h1 style={{ color: '#f1f5f9', fontWeight: 800, fontSize: 24, marginBottom: 20 }}>Dashboard</h1>
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: 16, marginBottom: 24,
        }}>
          {Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} />)}
        </div>
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
          gap: 16, marginBottom: 24,
        }}>
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
        <h1 style={{ color: '#f1f5f9', fontWeight: 800, fontSize: 24, marginBottom: 20 }}>Dashboard</h1>
        <ErrorState message={error} onRetry={loadDashboard} />
      </>
    );
  }

  const statCards = [
    { label: 'Total Products', value: stats.products, icon: <FaBoxes />, color: '#2dd4bf', bg: 'rgba(45,212,191,0.1)' },
    { label: 'Website Orders', value: stats.orders, icon: <FaShoppingCart />, color: '#3b82f6', bg: 'rgba(59,130,246,0.1)' },
    { label: 'Pending Orders', value: stats.pending, icon: <FaClock />, color: '#f59e0b', bg: 'rgba(245,158,11,0.1)' },
    { label: 'New Messages', value: stats.messages, icon: <FaEnvelope />, color: '#a855f7', bg: 'rgba(168,85,247,0.1)' },
  ];

  const barData = {
    labels: ordersByDay.labels,
    datasets: [{
      label: 'Orders',
      data: ordersByDay.data,
      backgroundColor: 'rgba(45,212,191,0.6)',
      borderColor: '#2dd4bf',
      borderWidth: 1,
      borderRadius: 4,
      maxBarThickness: 24,
    }],
  };

  const barOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: '#1e293b',
        titleColor: '#f1f5f9',
        bodyColor: '#94a3b8',
        borderColor: '#334155',
        borderWidth: 1,
        cornerRadius: 8,
        padding: 10,
      },
    },
    scales: {
      x: {
        ticks: { color: '#94a3b8', font: { size: 10 }, maxRotation: 45 },
        grid: { color: 'rgba(51,65,85,0.3)' },
        border: { color: '#334155' },
      },
      y: {
        beginAtZero: true,
        ticks: { color: '#94a3b8', font: { size: 11 }, stepSize: 1 },
        grid: { color: 'rgba(51,65,85,0.3)' },
        border: { color: '#334155' },
      },
    },
  };

  const doughnutData = {
    labels: ordersByStatus.labels.map(l => l.charAt(0).toUpperCase() + l.slice(1)),
    datasets: [{
      data: ordersByStatus.data,
      backgroundColor: ordersByStatus.labels.map(s => STATUS_COLORS[s]?.color || '#94a3b8'),
      borderColor: '#1e293b',
      borderWidth: 3,
      hoverOffset: 6,
    }],
  };

  const doughnutOptions = {
    responsive: true,
    maintainAspectRatio: false,
    cutout: '65%',
    plugins: {
      legend: {
        position: 'bottom',
        labels: { color: '#94a3b8', font: { size: 12 }, padding: 16, usePointStyle: true, pointStyleWidth: 10 },
      },
      tooltip: {
        backgroundColor: '#1e293b',
        titleColor: '#f1f5f9',
        bodyColor: '#94a3b8',
        borderColor: '#334155',
        borderWidth: 1,
        cornerRadius: 8,
        padding: 10,
      },
    },
  };

  return (
    <>
      <style>{`
        @keyframes shimmer {
          0% { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
        .dash-card:hover { transform: translateY(-2px); box-shadow: 0 8px 24px rgba(0,0,0,0.3); }
        .dash-badge { transition: background 0.2s; }
        .dash-btn:hover { opacity: 0.85; }
        .dash-link:hover { text-decoration: underline; }
      `}</style>

      <h1 style={{ color: '#f1f5f9', fontWeight: 800, fontSize: 24, marginBottom: 20 }}>Dashboard</h1>

      {/* Stats Cards */}
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: 16, marginBottom: 24,
      }}>
        {statCards.map(card => (
          <div key={card.label} className="dash-card" style={{
            background: '#1e293b', border: '1px solid #334155', borderRadius: 12,
            padding: 20, display: 'flex', alignItems: 'center', gap: 16,
            transition: 'transform 0.2s, box-shadow 0.2s', cursor: 'default',
          }}>
            <div style={{
              width: 48, height: 48, borderRadius: 12, background: card.bg,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: card.color, fontSize: 20,
            }}>
              {card.icon}
            </div>
            <div>
              <p style={{ color: '#94a3b8', fontSize: 12, fontWeight: 500, marginBottom: 4 }}>{card.label}</p>
              <p style={{ color: '#f1f5f9', fontSize: 24, fontWeight: 800 }}>{card.value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Charts */}
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
        gap: 16, marginBottom: 24,
      }}>
        <div style={{
          background: '#1e293b', border: '1px solid #334155', borderRadius: 12,
          padding: 20,
        }}>
          <h3 style={{ color: '#f1f5f9', fontSize: 14, fontWeight: 700, marginBottom: 16 }}>
            Orders — Last 30 Days
          </h3>
          <div style={{ height: 220 }}>
            <Bar data={barData} options={barOptions} />
          </div>
        </div>

        <div style={{
          background: '#1e293b', border: '1px solid #334155', borderRadius: 12,
          padding: 20,
        }}>
          <h3 style={{ color: '#f1f5f9', fontSize: 14, fontWeight: 700, marginBottom: 16 }}>
            Orders by Status
          </h3>
          <div style={{ height: 220, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {ordersByStatus.data.length > 0 ? (
              <Doughnut data={doughnutData} options={doughnutOptions} />
            ) : (
              <p style={{ color: '#94a3b8', fontSize: 13 }}>No order data</p>
            )}
          </div>
        </div>
      </div>

      {/* Recent Orders Table */}
      <div style={{
        background: '#1e293b', border: '1px solid #334155', borderRadius: 12,
        padding: 20, marginBottom: 24, overflowX: 'auto',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h3 style={{ color: '#f1f5f9', fontSize: 14, fontWeight: 700 }}>Recent Orders</h3>
          <Link to="/orders" className="dash-link" style={{
            color: '#2dd4bf', fontSize: 12, fontWeight: 600, textDecoration: 'none',
            display: 'flex', alignItems: 'center', gap: 4,
          }}>
            View All <FaArrowRight style={{ fontSize: 10 }} />
          </Link>
        </div>

        {recentOrders.length === 0 ? (
          <p style={{ color: '#94a3b8', fontSize: 13, textAlign: 'center', padding: 24 }}>No orders yet</p>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 700 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #334155' }}>
                {['Order No', 'Date', 'Customer', 'Items', 'Total', 'Status', 'Actions'].map(h => (
                  <th key={h} style={{
                    color: '#94a3b8', fontSize: 11, fontWeight: 600, textTransform: 'uppercase',
                    padding: '10px 12px', textAlign: 'left', whiteSpace: 'nowrap',
                  }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {recentOrders.map(order => {
                const status = order.status || 'pending';
                const sc = STATUS_COLORS[status] || STATUS_COLORS.pending;
                const date = order._createdAt instanceof Date
                  ? order._createdAt.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                  : '—';
                const items = order.items?.length || order.itemCount || 0;
                const total = order.total != null
                  ? `$${Number(order.total).toFixed(2)}`
                  : order.grandTotal != null
                    ? `$${Number(order.grandTotal).toFixed(2)}`
                    : '—';
                const orderNo = order.orderNo || order.orderNumber || order.id?.slice(0, 8) || '—';
                const customer = order.customerName || order.customer?.name || order.email || '—';

                return (
                  <tr key={order.id} style={{ borderBottom: '1px solid rgba(51,65,85,0.5)' }}>
                    <td style={{ padding: '12px', fontSize: 13, color: '#f1f5f9', fontWeight: 600 }}>
                      {orderNo}
                    </td>
                    <td style={{ padding: '12px', fontSize: 12, color: '#94a3b8' }}>{date}</td>
                    <td style={{ padding: '12px', fontSize: 13, color: '#f1f5f9' }}>{customer}</td>
                    <td style={{ padding: '12px', fontSize: 13, color: '#94a3b8', textAlign: 'center' }}>{items}</td>
                    <td style={{ padding: '12px', fontSize: 13, color: '#f1f5f9', fontWeight: 600 }}>{total}</td>
                    <td style={{ padding: '12px' }}>
                      <span className="dash-badge" style={{
                        display: 'inline-block', padding: '4px 10px', borderRadius: 20,
                        fontSize: 11, fontWeight: 700, textTransform: 'capitalize',
                        background: sc.bg, color: sc.color,
                      }}>
                        {status}
                      </span>
                    </td>
                    <td style={{ padding: '12px' }}>
                      <Link to={`/orders?id=${order.id}`} className="dash-btn" style={{
                        display: 'inline-flex', alignItems: 'center', gap: 4,
                        padding: '5px 10px', borderRadius: 6, fontSize: 11, fontWeight: 600,
                        background: 'rgba(45,212,191,0.1)', color: '#2dd4bf',
                        textDecoration: 'none', transition: 'opacity 0.2s',
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
        <div style={{
          background: '#1e293b', border: '1px solid rgba(245,158,11,0.3)', borderRadius: 12,
          padding: 20, marginBottom: 24,
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h3 style={{
              color: '#f59e0b', fontSize: 14, fontWeight: 700,
              display: 'flex', alignItems: 'center', gap: 8,
            }}>
              <FaExclamationTriangle /> Low Stock Alerts
            </h3>
            <Link to="/products" className="dash-link" style={{
              color: '#2dd4bf', fontSize: 12, fontWeight: 600, textDecoration: 'none',
              display: 'flex', alignItems: 'center', gap: 4,
            }}>
              Manage Products <FaArrowRight style={{ fontSize: 10 }} />
            </Link>
          </div>

          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 500 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #334155' }}>
                {['Product Name', 'SKU', 'Stock', 'Category'].map(h => (
                  <th key={h} style={{
                    color: '#94a3b8', fontSize: 11, fontWeight: 600, textTransform: 'uppercase',
                    padding: '10px 12px', textAlign: 'left', whiteSpace: 'nowrap',
                  }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {lowStock.map(p => {
                const stock = p.StockQty ?? p.stockQty ?? 0;
                return (
                  <tr key={p.id} style={{ borderBottom: '1px solid rgba(51,65,85,0.5)' }}>
                    <td style={{ padding: '12px', fontSize: 13, color: '#f1f5f9', fontWeight: 600 }}>
                      {p.name || p.Name || '—'}
                    </td>
                    <td style={{ padding: '12px', fontSize: 12, color: '#94a3b8' }}>
                      {p.sku || p.SKU || '—'}
                    </td>
                    <td style={{ padding: '12px', fontSize: 13, color: stock === 0 ? '#ef4444' : '#f59e0b', fontWeight: 700 }}>
                      {stock}
                    </td>
                    <td style={{ padding: '12px', fontSize: 12, color: '#94a3b8' }}>
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
