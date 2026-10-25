import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '../firebase/firebase';

const number = o => o.OrderNumber || o.orderNumber || o.id;
const customer = o => o.customerName || o.CustomerName || o.customer?.name || o.fullName || 'Customer';
const items = o => o.items || o.order_items || o.Items || [];
const money = value => `₱${Number(value || 0).toLocaleString('en-PH', { minimumFractionDigits: 2 })}`;
const date = o => {
  const value = o.createdAt || o.orderDate || o.CreatedAt;
  return value?.toDate ? value.toDate() : new Date(value || 0);
};

export default function PendingOrders() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');

  useEffect(() => onSnapshot(query(collection(db, 'orders'), where('status', '==', 'processing')), snapshot => {
    setOrders(snapshot.docs.map(d => ({ ...d.data(), id: d.id }))
      .filter(o => o.posHandled !== true && o.fulfilled !== true)
      .sort((a, b) => date(b) - date(a)));
    setLoading(false);
    setError('');
  }, () => {
    setLoading(false);
    setError('Unable to load pending orders. Check your connection and access permissions.');
  }), []);

  const filtered = useMemo(() => orders.filter(o =>
    `${number(o)} ${customer(o)} ${o.phone || o.customerPhone || o.CustomerPhone || o.customer?.phone || ''}`
      .toLowerCase().includes(search.trim().toLowerCase())), [orders, search]);

  return (
    <div>
      <p style={{ color: 'var(--text-muted)', marginBottom: 20 }}>
        {orders.length} processing orders from the online store. Select an order to complete its sale in POS.
      </p>
      <input aria-label="Search pending orders" placeholder="Search order number, customer or phone..."
        value={search} onChange={e => setSearch(e.target.value)}
        style={{ width: '100%', boxSizing: 'border-box', padding: 12, marginBottom: 20, borderRadius: 8,
          border: '1px solid var(--border)', background: 'var(--bg-input)', color: 'var(--text-primary)' }} />
      {error ? <p role="alert">{error}</p> : loading ? <p role="status">Loading orders...</p> : filtered.length === 0 ?
        <p style={{ color: 'var(--text-muted)' }}>{search ? 'No matching orders.' : 'No processing orders awaiting POS completion.'}</p> :
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 320px), 1fr))', gap: 16 }}>
          {filtered.map(order => (
            <article key={order.id} style={{ padding: 20, borderRadius: 14, border: '1px solid var(--border)', background: 'var(--bg-card)' }}>
              <div style={{ fontWeight: 700, overflowWrap: 'anywhere' }}>{number(order)}</div>
              <span style={{ display: 'inline-block', marginTop: 8, color: 'var(--accent)', fontSize: 12 }}>Processing</span>
              <p style={{ marginBottom: 4 }}>{customer(order)}</p>
              <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>{order.phone || order.customerPhone || order.CustomerPhone || order.customer?.phone || 'No phone provided'}</div>
              <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>{date(order).getTime() > 0 ? date(order).toLocaleString('en-PH') : 'Date unavailable'}</p>
              <div style={{ fontSize: 13, marginBottom: 12 }}>{items(order).map((item, i) => (
                <div key={i}>{item.quantity || item.Quantity || item.qty || 1} × {item.name || item.Name || item.perfumeName || item.ProductName || 'Item'}</div>
              ))}</div>
              <div style={{ fontWeight: 700, marginBottom: 16 }}>{money(order.total ?? order.Total ?? items(order).reduce((sum, i) => sum + Number(i.price || i.Price || 0) * Number(i.quantity || i.Quantity || i.qty || 1), 0))}</div>
              <Link to={`/pos?posOrder=${encodeURIComponent(order.id)}`} style={{ display: 'inline-block', padding: '10px 16px', borderRadius: 8, background: 'var(--accent)', color: '#ffffff', textDecoration: 'none', fontWeight: 700 }}>Open in POS</Link>
            </article>
          ))}
        </div>}
    </div>
  );
}
