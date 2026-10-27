import React, { useEffect, useMemo, useState } from 'react';
import { collection, getDocs, updateDoc, doc } from 'firebase/firestore';
import { db } from '../firebase/firebase';
import { FaSearch, FaTruck, FaSyncAlt } from 'react-icons/fa';

const money = value => `₱${Number(value || 0).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const dateText = value => {
  const date = value?.toDate ? value.toDate() : value ? new Date(value) : null;
  return date && !Number.isNaN(date.getTime()) ? date.toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' }) : '—';
};

export default function Purchasing() {
  const [orders, setOrders] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('All');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = async () => {
    setLoading(true); setError('');
    try {
      const [poSnap, supplierSnap] = await Promise.all([
        getDocs(collection(db, 'purchaseOrders')),
        getDocs(collection(db, 'suppliers')),
      ]);
      setOrders(poSnap.docs.map(d => ({ id: d.id, ...d.data() })));
      setSuppliers(supplierSnap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (e) { console.error(e); setError('Could not load purchasing data. Check your Firestore access and retry.'); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const supplierNames = useMemo(() => Object.fromEntries(suppliers.map(s => [String(s.id), s.Name || s.name || 'Supplier'])), [suppliers]);
  const filtered = useMemo(() => orders.filter(order => {
    const status = order.Status || order.status || 'Pending';
    const supplier = supplierNames[String(order.SupplierId || order.supplierId)] || '';
    const text = `${supplier} ${order.InvoiceNumber || order.InvoiceNo || order.id} ${status}`.toLowerCase();
    return (filter === 'All' || status.toLowerCase() === filter.toLowerCase()) && text.includes(search.toLowerCase());
  }).sort((a, b) => new Date(b.OrderDate || b.orderDate || 0) - new Date(a.OrderDate || a.orderDate || 0)), [orders, supplierNames, filter, search]);
  const spend = orders.reduce((sum, order) => sum + Number(order.TotalAmount || order.totalAmount || 0), 0);
  const pending = orders.filter(order => ['pending', 'ordered'].includes(String(order.Status || order.status || '').toLowerCase())).length;

  const changeStatus = async (order, status) => {
    const oldStatus = order.Status || order.status || 'Pending';
    setOrders(current => current.map(item => item.id === order.id ? { ...item, Status: status } : item));
    try { await updateDoc(doc(db, 'purchaseOrders', order.id), { Status: status }); }
    catch (e) { setOrders(current => current.map(item => item.id === order.id ? { ...item, Status: oldStatus } : item)); setError('Status update failed. Please retry.'); }
  };

  return <section className="ops-page">
    <header className="ops-page-head"><div><p className="ops-eyebrow">SUPPLY</p><h1>Purchasing</h1><p className="ops-subtitle">Keep supplier orders and incoming stock moving.</p></div><button className="ops-button" onClick={load} aria-label="Refresh purchasing"><FaSyncAlt /> Refresh</button></header>
    <div className="ops-metrics">
      <article className="ops-metric"><span>Purchase orders</span><strong>{orders.length}</strong><small>Across all suppliers</small></article>
      <article className="ops-metric"><span>Awaiting delivery</span><strong>{pending}</strong><small>Pending or ordered</small></article>
      <article className="ops-metric"><span>Total spend</span><strong>{money(spend)}</strong><small>Recorded purchase orders</small></article>
      <article className="ops-metric"><span>Suppliers</span><strong>{suppliers.length}</strong><small>In your supplier list</small></article>
    </div>
    <div className="ops-panel">
      <div className="ops-toolbar">
        <div className="ops-search"><FaSearch /><input aria-label="Search purchase orders" placeholder="Search suppliers or invoices" value={search} onChange={e => setSearch(e.target.value)} /></div>
        <div className="ops-tabs" role="group" aria-label="Filter purchase orders">{['All', 'Pending', 'Ordered', 'Received', 'Completed'].map(status => <button key={status} className={filter === status ? 'is-active' : ''} onClick={() => setFilter(status)}>{status}</button>)}</div>
      </div>
      {error && <div className="ops-alert" role="alert">{error}</div>}
      {loading ? <div className="ops-empty">Loading purchasing records…</div> : filtered.length === 0 ? <div className="ops-empty"><FaTruck /><strong>No purchase orders found</strong><span>Try another search or create a purchase order in Inventory.</span></div> : <div className="ops-table-wrap"><table className="ops-table"><thead><tr>{['Order', 'Supplier', 'Ordered', 'Delivery', 'Items', 'Total', 'Status'].map(x => <th key={x}>{x}</th>)}</tr></thead><tbody>{filtered.map(order => {
        const status = order.Status || order.status || 'Pending';
        const items = order.Items || order.items || [];
        return <tr key={order.id}><td><strong>{order.InvoiceNumber || order.InvoiceNo || order.id.slice(0, 8)}</strong></td><td>{supplierNames[String(order.SupplierId || order.supplierId)] || '—'}</td><td>{dateText(order.OrderDate || order.orderDate)}</td><td>{dateText(order.DeliveryDate || order.deliveryDate)}</td><td>{items.length || order.ItemCount || '—'}</td><td><strong>{money(order.TotalAmount || order.totalAmount)}</strong></td><td><select aria-label={`Status for ${order.InvoiceNumber || order.id}`} value={status} onChange={e => changeStatus(order, e.target.value)}>{['Pending', 'Ordered', 'Received', 'Completed', 'Cancelled'].map(s => <option key={s}>{s}</option>)}</select></td></tr>;
      })}</tbody></table></div>}
    </div>
  </section>;
}
