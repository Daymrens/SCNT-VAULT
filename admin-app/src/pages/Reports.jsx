import React, { useEffect, useMemo, useState } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../firebase/firebase';
import { FaDownload, FaExclamationTriangle, FaSyncAlt } from 'react-icons/fa';

const orderDate = order => {
  const raw = order.createdAt?.toDate ? order.createdAt.toDate() : order.createdAt || order.OrderDate;
  const date = raw instanceof Date ? raw : new Date(raw);
  return Number.isNaN(date.getTime()) ? null : date;
};
const totalOf = order => Number(order.total ?? order.grandTotal ?? order.Total ?? order.TotalAmount ?? 0);
const stockOf = product => Number(product.StockQty ?? product.stockQty ?? product.Stock ?? 0);
const formatMoney = value => `₱${Number(value || 0).toLocaleString('en-PH', { maximumFractionDigits: 0 })}`;

export default function Reports() {
  const [products, setProducts] = useState([]);
  const [orders, setOrders] = useState([]);
  const [period, setPeriod] = useState(30);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const load = async () => {
    setLoading(true); setError('');
    try {
      const [p, o] = await Promise.all([getDocs(collection(db, 'products')), getDocs(collection(db, 'orders'))]);
      setProducts(p.docs.map(d => ({ id: d.id, ...d.data() })));
      setOrders(o.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (e) { console.error(e); setError('Could not load report data. Check Firestore access and retry.'); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const recentOrders = useMemo(() => {
    const since = new Date(); since.setDate(since.getDate() - period);
    return orders.filter(o => { const date = orderDate(o); return date && date >= since; });
  }, [orders, period]);
  const revenue = recentOrders.reduce((sum, order) => sum + totalOf(order), 0);
  const lowStock = products.filter(product => stockOf(product) <= Number(product.LowStockThreshold ?? product.lowStockThreshold ?? 10));
  const stockValue = products.reduce((sum, product) => sum + stockOf(product) * Number(product.CostPrice ?? product.costPrice ?? 0), 0);
  const expiring = products.filter(product => {
    const raw = product.ExpiryDate || product.ExpirationDate || product.expiryDate;
    if (!raw) return false;
    const days = (new Date(raw).getTime() - Date.now()) / 86400000;
    return days >= 0 && days <= 90;
  });

  const exportCsv = () => {
    const rows = [['Product', 'SKU', 'Stock', 'Batch', 'Expiry'], ...products.map(p => [p.Name || p.name || '', p.SKU || p.sku || '', stockOf(p), p.BatchNumber || '', p.ExpiryDate || p.ExpirationDate || ''])];
    const csv = rows.map(row => row.map(value => `"${String(value).replaceAll('"', '""')}"`).join(',')).join('\r\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a'); link.href = url; link.download = 'scnt-inventory-report.csv'; link.click(); URL.revokeObjectURL(url);
  };

  return <section className="ops-page">
    <header className="ops-page-head"><div><p className="ops-eyebrow">INSIGHTS</p><h1>Reports</h1><p className="ops-subtitle">A clear view of sales, stock health, and upcoming expiries.</p></div><div className="ops-actions"><button className="ops-button" onClick={load} aria-label="Refresh reports"><FaSyncAlt /> Refresh</button><button className="ops-button is-primary" onClick={exportCsv}><FaDownload /> Export inventory</button></div></header>
    <div className="ops-panel ops-report-range"><span>Order period</span><div className="ops-tabs" role="group" aria-label="Choose order period">{[30, 90, 365].map(days => <button key={days} className={period === days ? 'is-active' : ''} onClick={() => setPeriod(days)}>{days === 365 ? '12 months' : `${days} days`}</button>)}</div></div>
    {error && <div className="ops-alert" role="alert">{error}</div>}
    <div className="ops-metrics">
      <article className="ops-metric"><span>Orders</span><strong>{loading ? '—' : recentOrders.length}</strong><small>In selected period</small></article>
      <article className="ops-metric"><span>Order value</span><strong>{loading ? '—' : formatMoney(revenue)}</strong><small>Based on recorded totals</small></article>
      <article className="ops-metric"><span>Stock at cost</span><strong>{loading ? '—' : formatMoney(stockValue)}</strong><small>Current catalog quantity</small></article>
      <article className="ops-metric"><span>Stock alerts</span><strong>{loading ? '—' : lowStock.length}</strong><small>{expiring.length} lots expire within 90 days</small></article>
    </div>
    <div className="ops-panel">
      <div className="ops-panel-head"><div><h2>Inventory health</h2><p>Products that need a stock or expiry check.</p></div><span className="ops-count">{lowStock.length + expiring.length} alerts</span></div>
      {loading ? <div className="ops-empty">Preparing report…</div> : lowStock.length === 0 && expiring.length === 0 ? <div className="ops-empty"><strong>Inventory looks healthy</strong><span>No low-stock or near-expiry products in this report.</span></div> : <div className="ops-table-wrap"><table className="ops-table"><thead><tr>{['Product', 'SKU', 'Batch', 'Stock', 'Expiry', 'Alert'].map(label => <th key={label}>{label}</th>)}</tr></thead><tbody>{[...new Map([...lowStock, ...expiring].map(p => [p.id, p])).values()].map(product => {
        const stock = stockOf(product); const expiry = product.ExpiryDate || product.ExpirationDate || product.expiryDate;
        const isLow = stock <= Number(product.LowStockThreshold ?? product.lowStockThreshold ?? 10);
        return <tr key={product.id}><td><strong>{product.Name || product.name || 'Unnamed product'}</strong></td><td>{product.SKU || product.sku || '—'}</td><td>{product.BatchNumber || '—'}</td><td>{stock}</td><td>{expiry || '—'}</td><td><span className={`ops-status ${isLow ? 'is-warning' : 'is-expiry'}`}><FaExclamationTriangle /> {isLow ? 'Low stock' : 'Near expiry'}</span></td></tr>;
      })}</tbody></table></div>}
    </div>
  </section>;
}
