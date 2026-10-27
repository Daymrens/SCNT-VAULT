import React, { useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { addDoc, collection, deleteDoc, doc, getDocs, serverTimestamp, updateDoc } from 'firebase/firestore';
import { db } from '../firebase/firebase';
import { FaBoxes, FaMapMarkedAlt, FaPlus, FaTimes, FaTrash } from 'react-icons/fa';

const CONFIG = {
  materials: {
    collection: 'rawMaterials', title: 'Raw materials', subtitle: 'Track ingredients and components before they reach production.', icon: <FaBoxes />,
    fields: [
      { key: 'name', label: 'Material name', required: true }, { key: 'sku', label: 'SKU' },
      { key: 'supplier', label: 'Supplier' }, { key: 'unit', label: 'Unit', placeholder: 'kg, ml, pcs' },
      { key: 'quantity', label: 'On hand', type: 'number' }, { key: 'reorderAt', label: 'Reorder at', type: 'number' },
      { key: 'unitCost', label: 'Cost per unit', type: 'number' }, { key: 'location', label: 'Storage location' },
    ],
  },
  locations: {
    collection: 'storageLocations', title: 'Storage map', subtitle: 'See capacity and stock zones at a glance.', icon: <FaMapMarkedAlt />,
    fields: [
      { key: 'name', label: 'Location name', required: true }, { key: 'code', label: 'Location code', required: true },
      { key: 'zone', label: 'Zone' }, { key: 'capacity', label: 'Slot capacity', type: 'number' },
      { key: 'occupied', label: 'Occupied slots', type: 'number' }, { key: 'notes', label: 'Notes' },
    ],
  },
};

const emptyFor = config => Object.fromEntries(config.fields.map(field => [field.key, '']));

export default function SupplyRecords() {
  const path = useLocation().pathname;
  const mode = path.includes('warehouse') ? 'locations' : 'materials';
  const config = CONFIG[mode];
  const [records, setRecords] = useState([]);
  const [form, setForm] = useState(null);
  const [editing, setEditing] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const load = async () => {
    setLoading(true); setError('');
    try { const snap = await getDocs(collection(db, config.collection)); setRecords(snap.docs.map(d => ({ id: d.id, ...d.data() }))); }
    catch (e) { console.error(e); setError(`Could not load ${config.title.toLowerCase()}. Check Firestore access and retry.`); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); setForm(null); setEditing(null); }, [mode]);

  const summary = useMemo(() => {
    if (mode === 'materials') return { count: records.length, detail: `${records.filter(item => Number(item.quantity || 0) <= Number(item.reorderAt || 0)).length} below reorder level` };
    const capacity = records.reduce((sum, item) => sum + Number(item.capacity || 0), 0);
    const occupied = records.reduce((sum, item) => sum + Number(item.occupied || 0), 0);
    return { count: records.length, detail: capacity ? `${occupied} of ${capacity} slots occupied` : 'Add capacity to map your storage' };
  }, [records, mode]);

  const startEdit = record => { setEditing(record?.id || null); setForm(record ? Object.fromEntries(config.fields.map(f => [f.key, record[f.key] ?? ''])) : emptyFor(config)); };
  const save = async event => {
    event.preventDefault(); setError('');
    const payload = { ...form, updatedAt: serverTimestamp() };
    for (const field of config.fields) if (field.type === 'number') payload[field.key] = Number(payload[field.key] || 0);
    try {
      if (editing) await updateDoc(doc(db, config.collection, editing), payload);
      else await addDoc(collection(db, config.collection), { ...payload, createdAt: serverTimestamp() });
      setForm(null); setEditing(null); await load();
    } catch (e) { console.error(e); setError('Save failed. Check your role and retry.'); }
  };
  const remove = async record => {
    if (!window.confirm(`Delete ${record.name || record.code || 'this record'}?`)) return;
    try { await deleteDoc(doc(db, config.collection, record.id)); await load(); }
    catch (e) { console.error(e); setError('Delete failed. Owner access is required.'); }
  };

  return <section className="ops-page">
    <header className="ops-page-head"><div><p className="ops-eyebrow">SUPPLY</p><h1>{config.title}</h1><p className="ops-subtitle">{config.subtitle}</p></div><button className="ops-button is-primary" onClick={() => startEdit(null)}><FaPlus /> {mode === 'materials' ? 'Add material' : 'Add location'}</button></header>
    <div className="ops-metrics"><article className="ops-metric"><span>{mode === 'materials' ? 'Materials' : 'Locations'}</span><strong>{records.length}</strong><small>{summary.detail}</small></article><article className="ops-metric"><span>{mode === 'materials' ? 'Reorder alerts' : 'Mapped capacity'}</span><strong>{mode === 'materials' ? records.filter(item => Number(item.quantity || 0) <= Number(item.reorderAt || 0)).length : records.reduce((sum, item) => sum + Number(item.capacity || 0), 0)}</strong><small>{mode === 'materials' ? 'At or below minimum' : 'Total storage slots'}</small></article></div>
    {error && <div className="ops-alert" role="alert">{error}</div>}
    {form && <form className="ops-panel ops-record-form" onSubmit={save}><div className="ops-panel-head"><div><h2>{editing ? 'Edit record' : `New ${mode === 'materials' ? 'material' : 'location'}`}</h2><p>Changes are saved to the SCNT supply records.</p></div><button type="button" className="ops-icon-button" onClick={() => { setForm(null); setEditing(null); }} aria-label="Close form"><FaTimes /></button></div><div className="ops-form-grid">{config.fields.map(field => <label key={field.key}>{field.label}{field.required && <span aria-hidden="true"> *</span>}<input required={field.required} type={field.type || 'text'} min={field.type === 'number' ? 0 : undefined} placeholder={field.placeholder || ''} value={form[field.key]} onChange={e => setForm(current => ({ ...current, [field.key]: e.target.value }))} /></label>)}</div><div className="ops-form-actions"><button type="button" className="ops-button" onClick={() => { setForm(null); setEditing(null); }}>Cancel</button><button className="ops-button is-primary" type="submit">Save record</button></div></form>}
    <div className="ops-panel"><div className="ops-panel-head"><div><h2>{mode === 'materials' ? 'Material list' : 'Locations and capacity'}</h2><p>{records.length} records</p></div><span className="ops-count">{summary.detail}</span></div>
      {loading ? <div className="ops-empty">Loading records…</div> : records.length === 0 ? <div className="ops-empty">{config.icon}<strong>No {mode === 'materials' ? 'raw materials' : 'storage locations'} yet</strong><span>Add your first record to start building this workspace.</span></div> : mode === 'materials' ? <div className="ops-table-wrap"><table className="ops-table"><thead><tr>{['Material', 'SKU', 'Supplier', 'On hand', 'Reorder at', 'Unit cost', 'Location', ''].map(x => <th key={x}>{x}</th>)}</tr></thead><tbody>{records.map(item => { const low = Number(item.quantity || 0) <= Number(item.reorderAt || 0); return <tr key={item.id}><td><strong>{item.name || 'Unnamed material'}</strong></td><td>{item.sku || '—'}</td><td>{item.supplier || '—'}</td><td><strong>{item.quantity ?? 0} {item.unit || ''}</strong></td><td>{item.reorderAt ?? '—'}</td><td>{item.unitCost ? `₱${Number(item.unitCost).toFixed(2)}` : '—'}</td><td>{item.location || '—'}</td><td><button className="ops-text-button" onClick={() => startEdit(item)}>Edit</button><button className="ops-text-button is-danger" onClick={() => remove(item)} aria-label={`Delete ${item.name}`}><FaTrash /></button>{low && <span className="ops-status is-warning">Reorder</span>}</td></tr>; })}</tbody></table></div> : <div className="ops-location-grid">{records.map(location => { const capacity = Math.max(1, Math.min(48, Number(location.capacity || 1))); const occupied = Math.max(0, Math.min(capacity, Number(location.occupied || 0))); return <article className="ops-location-card" key={location.id}><div className="ops-location-head"><div><span className="ops-location-code">{location.code || 'ZONE'}</span><h3>{location.name || 'Storage area'}</h3><p>{location.zone || 'Unassigned zone'} · {occupied}/{capacity} slots</p></div><button className="ops-text-button" onClick={() => startEdit(location)}>Edit</button></div><div className="ops-slot-map" role="img" aria-label={`${occupied} occupied of ${capacity} storage slots`}>{Array.from({ length: capacity }, (_, i) => <span key={i} className={i < occupied ? 'is-occupied' : ''} />)}</div>{location.notes && <p className="ops-location-notes">{location.notes}</p>}<button className="ops-text-button is-danger" onClick={() => remove(location)}><FaTrash /> Remove location</button></article>; })}</div>}
    </div>
  </section>;
}
