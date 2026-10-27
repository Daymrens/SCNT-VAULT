import React, { useEffect, useMemo, useState } from 'react';
import { collection, getDocs, updateDoc, doc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase/firebase';
import { FaCheck, FaExclamationTriangle, FaSyncAlt, FaTimes } from 'react-icons/fa';

function expiryInfo(value) {
  if (!value) return { label: 'No expiry date', state: 'unknown' };
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return { label: 'Invalid date', state: 'unknown' };
  const days = Math.ceil((date.setHours(0, 0, 0, 0) - new Date().setHours(0, 0, 0, 0)) / 86400000);
  return { label: date.toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' }), state: days < 0 ? 'expired' : days <= 90 ? 'soon' : 'ok' };
}

export default function Batches() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const load = async () => {
    setLoading(true); setError('');
    try { const snapshot = await getDocs(collection(db, 'products')); setProducts(snapshot.docs.map(d => ({ id: d.id, ...d.data() }))); }
    catch (e) { console.error(e); setError('Could not load batch records. Check Firestore access and retry.'); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const batches = useMemo(() => {
    const map = new Map();
    for (const product of products) {
      const number = product.BatchNumber || product.batchNumber;
      if (!number) continue;
      if (!map.has(number)) map.set(number, { number, products: [], quantity: 0, expiry: product.ExpiryDate || product.ExpirationDate || product.expiryDate || '', quality: product.QualityStatus || product.qualityStatus || 'Pending review' });
      const batch = map.get(number);
      batch.products.push(product);
      batch.quantity += Number(product.StockQty ?? product.stockQty ?? product.Stock ?? 0);
      if (!batch.expiry) batch.expiry = product.ExpiryDate || product.ExpirationDate || product.expiryDate || '';
    }
    return [...map.values()].sort((a, b) => String(a.number).localeCompare(String(b.number)));
  }, [products]);

  const setQuality = async (batch, status) => {
    setError('');
    try {
      await Promise.all(batch.products.map(product => updateDoc(doc(db, 'products', product.id), { QualityStatus: status, QualityCheckedAt: serverTimestamp() })));
      setProducts(current => current.map(product => batch.products.some(item => item.id === product.id) ? { ...product, QualityStatus: status } : product));
    } catch (e) { console.error(e); setError('Quality status could not be saved. Check your role and retry.'); }
  };

  const expiringCount = batches.filter(batch => ['soon', 'expired'].includes(expiryInfo(batch.expiry).state)).length;
  return <section className="ops-page">
    <header className="ops-page-head"><div><p className="ops-eyebrow">PRODUCTION</p><h1>Production batches</h1><p className="ops-subtitle">Review finished-product lots, quality status, and expiry dates.</p></div><button className="ops-button" onClick={load}><FaSyncAlt /> Refresh</button></header>
    <div className="ops-metrics"><article className="ops-metric"><span>Tracked batches</span><strong>{batches.length}</strong><small>From product batch records</small></article><article className="ops-metric"><span>Near or past expiry</span><strong>{expiringCount}</strong><small>Within 90 days or expired</small></article></div>
    {error && <div className="ops-alert" role="alert">{error}</div>}
    <div className="ops-panel"><div className="ops-panel-head"><div><h2>Lot review</h2><p>Quality status applies to products sharing a batch number.</p></div></div>
      {loading ? <div className="ops-empty">Loading batch records…</div> : batches.length === 0 ? <div className="ops-empty"><strong>No batch numbers recorded</strong><span>Add batch number and expiry details from Products to see lots here.</span></div> : <div className="ops-table-wrap"><table className="ops-table"><thead><tr>{['Batch', 'Products', 'Units on hand', 'Expiry', 'Quality check', 'Actions'].map(x => <th key={x}>{x}</th>)}</tr></thead><tbody>{batches.map(batch => { const expiry = expiryInfo(batch.expiry); return <tr key={batch.number}><td><strong>{batch.number}</strong></td><td>{batch.products.map(product => product.Name || product.name || 'Product').join(', ')}</td><td>{batch.quantity}</td><td><span className={`ops-status ${expiry.state === 'ok' ? 'is-good' : expiry.state === 'unknown' ? '' : 'is-warning'}`}>{expiry.state !== 'ok' && <FaExclamationTriangle />}{expiry.label}</span></td><td><span className={`ops-status ${batch.quality === 'Passed' ? 'is-good' : batch.quality === 'Rejected' ? 'is-warning' : ''}`}>{batch.quality}</span></td><td><div className="ops-actions"><button className="ops-text-button" onClick={() => setQuality(batch, 'Passed')}><FaCheck /> Pass</button><button className="ops-text-button is-danger" onClick={() => setQuality(batch, 'Rejected')}><FaTimes /> Hold</button></div></td></tr>; })}</tbody></table></div>}
    </div>
  </section>;
}
