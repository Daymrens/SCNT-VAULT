import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useData } from '../contexts/DataContext';
import {
  FaPlus, FaEdit, FaTrash, FaTruck, FaSort,
  FaPhone, FaEnvelope, FaMapMarkerAlt, FaUser,
  FaEye, FaCheck, FaSearch
} from 'react-icons/fa';
import SearchBar from '../components/shared/SearchBar';
import Pagination from '../components/shared/Pagination';
import Modal, { CancelButton, PrimaryButton } from '../components/shared/Modal';
import ConfirmDialog from '../components/shared/ConfirmDialog';
import { useToast } from '../components/shared/Toast';

const EMPTY_FORM = { Name: '', ContactPerson: '', Phone: '', Email: '', Address: '' };

const SORT_OPTIONS = [
  { value:'name-asc',  label:'Name A→Z' },
  { value:'name-desc', label:'Name Z→A' },
  { value:'spend-desc', label:'Spend ↓' },
  { value:'po-desc',    label:'POs ↓' },
  { value:'products-desc', label:'Products ↓' },
];

function sortSuppliers(arr, sortBy, poBySupplier, productsBySupplier) {
  const sorted = [...arr];
  switch (sortBy) {
    case 'name-asc':       return sorted.sort((a,b) => (a.Name||'').localeCompare(b.Name||''));
    case 'name-desc':      return sorted.sort((a,b) => (b.Name||'').localeCompare(a.Name||''));
    case 'spend-desc':     return sorted.sort((a,b) => ((poBySupplier[b.id]?.total)||0) - ((poBySupplier[a.id]?.total)||0));
    case 'po-desc':        return sorted.sort((a,b) => ((poBySupplier[b.id]?.count)||0) - ((poBySupplier[a.id]?.count)||0));
    case 'products-desc':  return sorted.sort((a,b) => ((productsBySupplier[b.id]?.length)||0) - ((productsBySupplier[a.id]?.length)||0));
    default:               return sorted;
  }
}

const AVATAR_COLORS = ['#5b8def','#2dd4bf','#f59e0b','#f472b6','#a78bfa','#38bdf8','#fb923c'];

export default function Suppliers() {
  const { suppliers, products, purchaseOrders, loading, addSupplier, updateSupplier, deleteSupplier, loadPurchaseOrders } = useData();
  const { showToast } = useToast();
  useEffect(() => { loadPurchaseOrders(); }, [loadPurchaseOrders]);
  const [search, setSearch]             = useState('');
  const [sortBy, setSortBy]             = useState('name-asc');
  const [viewMode, setViewMode]         = useState('grid');
  const [showModal, setShowModal]       = useState(false);
  const [editing, setEditing]           = useState(null);
  const [form, setForm]                 = useState(EMPTY_FORM);
  const [saving, setSaving]             = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [viewSupplier, setViewSupplier]   = useState(null);
  const [copied, setCopied]             = useState('');
  const searchRef = useRef(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  useEffect(() => {
    const handler = (e) => {
      if (e.key === '/' && !['INPUT','TEXTAREA','SELECT'].includes(document.activeElement?.tagName)) {
        e.preventDefault();
        searchRef.current?.focus();
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, []);

  const productsBySupplier = useMemo(() => {
    const map = {};
    products.forEach(p => {
      const sid = p.SupplierId != null ? String(p.SupplierId) : null;
      if (!sid) return;
      if (!map[sid]) map[sid] = [];
      map[sid].push(p);
    });
    return map;
  }, [products]);

  const poBySupplier = useMemo(() => {
    const map = {};
    (purchaseOrders || []).forEach(po => {
      const sid = po.SupplierId != null ? String(po.SupplierId) : null;
      if (!sid) return;
      if (!map[sid]) map[sid] = { count: 0, total: 0, orders: [] };
      map[sid].count++;
      map[sid].total += po.TotalAmount || po.Total || 0;
      map[sid].orders.push(po);
    });
    return map;
  }, [purchaseOrders]);

  const totalSpend = useMemo(() =>
    Object.values(poBySupplier).reduce((s, v) => s + v.total, 0), [poBySupplier]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    let list = suppliers.filter(s =>
      s.Name?.toLowerCase().includes(q) ||
      s.ContactPerson?.toLowerCase().includes(q) ||
      s.Email?.toLowerCase().includes(q) ||
      s.Phone?.toLowerCase().includes(q)
    );
    return sortSuppliers(list, sortBy, poBySupplier, productsBySupplier);
  }, [suppliers, search, sortBy, poBySupplier, productsBySupplier]);

  const paginatedSuppliers = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, page, pageSize]);

  useEffect(() => { setPage(1); }, [search, sortBy]);

  const openAdd  = () => { setEditing(null); setForm(EMPTY_FORM); setShowModal(true); };
  const openEdit = (s) => {
    setEditing(s);
    setForm({ Name: s.Name||'', ContactPerson: s.ContactPerson||'',
      Phone: s.Phone||'', Email: s.Email||'', Address: s.Address||'' });
    setShowModal(true);
  };
  const closeModal = () => { setShowModal(false); setEditing(null); setForm(EMPTY_FORM); };

  const handleSave = async () => {
    if (!form.Name.trim()) return;
    setSaving(true);
    try {
      if (editing) {
        await updateSupplier(editing.id, form);
        showToast('Supplier updated', 'success');
      } else {
        await addSupplier(form);
        showToast('Supplier added', 'success');
      }
      closeModal();
    } catch (e) { console.error(e); showToast('Failed to save supplier', 'error'); }
    finally { setSaving(false); }
  };

  const handleDelete = async (id) => {
    try {
      await deleteSupplier(id);
      showToast('Supplier deleted', 'success');
    }
    catch (e) { console.error(e); showToast('Failed to delete supplier', 'error'); }
    finally { setConfirmDelete(null); }
  };

  const copyToClipboard = (text, key) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(key);
      setTimeout(() => setCopied(''), 1500);
    });
  };

  const avatarColor = (name) => {
    return AVATAR_COLORS[(name?.charCodeAt(0) || 0) % AVATAR_COLORS.length];
  };

  if (loading) return (
    <div className="inventory-page">
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(180px, 1fr))', gap:16, marginBottom:24 }}>
        {[1,2,3,4].map(i => <div key={i} className="skeleton" style={{ height:100, borderRadius:14 }} />)}
      </div>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(300px, 1fr))', gap:20 }}>
        {[1,2,3,4,5,6].map(i => <div key={i} className="skeleton" style={{ height:280, borderRadius:20 }} />)}
      </div>
    </div>
  );

  if (!suppliers.length) return (
    <div className="inventory-page" style={{ background:'var(--bg-card)', border:'1px solid var(--border)',
      borderRadius:16, padding:'64px 32px', textAlign:'center', boxShadow:'0 2px 16px rgba(0,0,0,0.2)' }}>
      <div style={{ width:72, height:72, borderRadius:'50%', background:'var(--success-bg)',
        display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 20px' }}>
        <FaTruck style={{ fontSize:32, color:'var(--accent)' }} />
      </div>
      <h2 style={{ fontSize:22, fontWeight:800, color:'var(--text-primary)', marginBottom:8 }}>No suppliers yet</h2>
      <p style={{ color:'var(--text-secondary)', fontSize:14, marginBottom:24, maxWidth:360, margin:'0 auto 24px' }}>
        Add your first supplier to start tracking products, purchase orders, and spending.
      </p>
      <button onClick={openAdd} style={{
        display:'inline-flex', alignItems:'center', gap:8, padding:'12px 24px',
        background:'var(--accent)', color:'#0f172a',
        border:'none', borderRadius:12, fontSize:14, fontWeight:700, cursor:'pointer',
        boxShadow:'0 4px 20px var(--accent-glow)', transition:'transform 0.15s' }}
        onMouseEnter={e => e.currentTarget.style.transform='translateY(-2px)'}
        onMouseLeave={e => e.currentTarget.style.transform='none'}>
        <FaPlus /> Add Your First Supplier
      </button>
    </div>
  );

  return (
    <div className="inventory-page">
      {/* Header */}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:24, flexWrap:'wrap', gap:16 }}>
        <div>
          <h1 style={{ fontSize:24, fontWeight:800, color:'var(--text-primary)', marginBottom:4 }}>Suppliers</h1>
          <p style={{ color:'var(--text-muted)', fontSize:13 }}>{filtered.length} of {suppliers.length} supplier{suppliers.length !== 1 ? 's' : ''}</p>
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:12 }}>
          <div className="header-tabs">
            {['Grid', 'Table'].map((tab, i) => (
              <button key={tab}
                className={`header-tab ${(i === 0 && viewMode === 'grid') || (i === 1 && viewMode === 'table') ? 'header-tab-active' : ''}`}
                onClick={() => { if (i === 0) setViewMode('grid'); if (i === 1) setViewMode('table'); }}>
                {tab}
              </button>
            ))}
          </div>
          <div style={{ display:'flex', background:'var(--bg-card)', border:'1px solid var(--border)', borderRadius:10, padding:'8px 12px', boxShadow:'0 2px 8px rgba(0,0,0,0.2)', alignItems:'center', gap:8, minWidth:200 }}>
            <FaSearch style={{ color:'var(--text-muted)', fontSize:13 }} />
            <input ref={searchRef} value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search suppliers... (press /)"
              style={{ border:'none', outline:'none', fontSize:13, flex:1, background:'transparent', color:'var(--text-primary)' }} />
          </div>
          <button onClick={openAdd} style={{ display:'flex', alignItems:'center', gap:8, padding:'10px 18px', background:'var(--accent)', color:'#0f172a', border:'none', borderRadius:10, fontSize:13, fontWeight:700, cursor:'pointer', transition:'all 0.2s' }}
            onMouseEnter={e => e.currentTarget.style.background='#5eead4'}
            onMouseLeave={e => e.currentTarget.style.background='var(--accent)'}>
            <FaPlus /> Add Supplier
          </button>
        </div>
      </div>

      {/* Stat Cards - Cash Flow Style */}
      <div className="stat-cashflow-grid">
        <div className="stat-cashflow stat-cashflow-green" style={{ border:'1px solid rgba(45,212,191,0.25)', borderRadius:12 }}>
          <div className="stat-cashflow-icon" style={{ background:'rgba(255,255,255,0.2)' }}>
            <FaTruck />
          </div>
          <div className="stat-cashflow-value">{suppliers.length}</div>
          <div className="stat-cashflow-label">Total Suppliers</div>
        </div>
        <div className="stat-cashflow stat-cashflow-dark" style={{ border:'1px solid var(--border)', borderRadius:12 }}>
          <div className="stat-cashflow-icon" style={{ background:'rgba(255,255,255,0.1)' }}>
            <FaEye />
          </div>
          <div className="stat-cashflow-value">{products.length}</div>
          <div className="stat-cashflow-label">Products Supplied</div>
        </div>
        <div className="stat-cashflow" style={{ border:'1px solid var(--border)', borderRadius:12 }}>
          <div className="stat-cashflow-icon" style={{ background:'var(--info-bg)', color:'var(--info)' }}>
            <FaUser />
          </div>
          <div className="stat-cashflow-value" style={{ color:'var(--info)' }}>{(purchaseOrders||[]).length}</div>
          <div className="stat-cashflow-label">Purchase Orders</div>
        </div>
        <div className="stat-cashflow" style={{ border:'1px solid var(--border)', borderRadius:12 }}>
          <div className="stat-cashflow-icon" style={{ background:'var(--warning-bg)', color:'var(--warning)' }}>
            <FaSort />
          </div>
          <div className="stat-cashflow-value" style={{ color:'var(--warning)' }}>₱{totalSpend.toLocaleString('en-PH')}</div>
          <div className="stat-cashflow-label">Total Spend</div>
        </div>
      </div>

      {/* Sort pills */}
      <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:20, flexWrap:'wrap' }}>
        <FaSort style={{ color:'var(--text-muted)', fontSize:13 }} />
        <div style={{ display:'flex', background:'var(--bg-card)', border:'1px solid var(--border)', borderRadius:10, overflow:'hidden',
          boxShadow:'0 1px 6px rgba(0,0,0,0.2)' }}>
          {SORT_OPTIONS.map(o => (
            <button key={o.value} onClick={() => setSortBy(o.value)} style={{
              padding:'7px 12px', border:'none', fontSize:11, fontWeight:600, cursor:'pointer',
              background: sortBy === o.value ? 'var(--accent)' : 'transparent',
              color: sortBy === o.value ? '#0f172a' : 'var(--text-muted)',
              transition:'all 0.2s', whiteSpace:'nowrap' }}>
              {o.label}
            </button>
          ))}
        </div>
      </div>

      {/* Suppliers: Grid or Table */}
      {filtered.length === 0 ? (
        <div style={{ background:'var(--bg-card)', border:'1px solid var(--border)', borderRadius:16, padding:'48px 20px', textAlign:'center',
          color:'var(--text-secondary)', fontSize:14, boxShadow:'0 2px 16px rgba(0,0,0,0.2)' }}>
          {search ? 'No suppliers match your search' : 'No suppliers yet — add one to get started'}
        </div>
      ) : viewMode === 'grid' ? (
        /* ── Grid View ── */
        <>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(300px, 1fr))', gap:20 }}>
          {paginatedSuppliers.map(s => {
            const color    = avatarColor(s.Name);
            const prodList = productsBySupplier[s.id] || [];
            const poStats  = poBySupplier[s.id] || { count: 0, total: 0 };
            return (
              <div key={s.id} style={{ background:'var(--bg-card)', border:'1px solid var(--border)', borderRadius:12,
                boxShadow:'0 4px 20px rgba(0,0,0,0.2)', overflow:'hidden',
                transition:'transform 0.2s, box-shadow 0.2s' }}
                onMouseEnter={e => { e.currentTarget.style.transform='translateY(-3px)'; e.currentTarget.style.boxShadow='0 8px 32px rgba(0,0,0,0.35)'; }}
                onMouseLeave={e => { e.currentTarget.style.transform='none'; e.currentTarget.style.boxShadow='0 4px 20px rgba(0,0,0,0.2)'; }}>
                {/* Card Header */}
                <div style={{ padding:'20px 20px 16px',
                  background:`linear-gradient(135deg, ${color}22, ${color}08)`,
                  borderBottom:'1px solid var(--border)' }}>
                  <div style={{ display:'flex', alignItems:'center', gap:12 }}>
                    <div style={{ width:52, height:52, borderRadius:16,
                      background:`linear-gradient(135deg,${color},${color}cc)`,
                      display:'flex', alignItems:'center', justifyContent:'center',
                      color:'#f8fafc', fontSize:22, fontWeight:800, flexShrink:0 }}>
                      {(s.Name || 'S')[0].toUpperCase()}
                    </div>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ fontSize:16, fontWeight:800, color:'var(--text-primary)',
                        overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                        {s.Name}
                      </div>
                      {s.ContactPerson && (
                        <div style={{ fontSize:12, color:'var(--text-muted)', marginTop:2, display:'flex', alignItems:'center', gap:4 }}>
                          <FaUser style={{ fontSize:10 }} /> {s.ContactPerson}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Contact Info */}
                <div style={{ padding:'14px 20px', display:'flex', flexDirection:'column', gap:8,
                  borderBottom:'1px solid var(--border)' }}>
                  {s.Phone && (
                    <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                      <div style={{ display:'flex', alignItems:'center', gap:8, fontSize:13, color:'var(--text-primary)' }}>
                        <FaPhone style={{ color:'var(--text-muted)', fontSize:11 }} /> {s.Phone}
                      </div>
                      <button onClick={() => copyToClipboard(s.Phone, s.id+'phone')} style={{
                        background:'none', border:'none', cursor:'pointer', color: copied === s.id+'phone' ? 'var(--accent)' : 'var(--text-muted)',
                        fontSize:12, padding:4 }}>
                        {copied === s.id+'phone' ? <FaCheck /> : <FaPlus style={{ transform:'rotate(45deg)', fontSize:10 }} />}
                      </button>
                    </div>
                  )}
                  {s.Email && (
                    <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                      <div style={{ display:'flex', alignItems:'center', gap:8, fontSize:13, color:'var(--text-primary)' }}>
                        <FaEnvelope style={{ color:'var(--text-muted)', fontSize:11 }} />
                        <span style={{ overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', maxWidth:180 }}>{s.Email}</span>
                      </div>
                      <button onClick={() => copyToClipboard(s.Email, s.id+'email')} style={{
                        background:'none', border:'none', cursor:'pointer', color: copied === s.id+'email' ? 'var(--accent)' : 'var(--text-muted)',
                        fontSize:12, padding:4 }}>
                        {copied === s.id+'email' ? <FaCheck /> : <FaPlus style={{ transform:'rotate(45deg)', fontSize:10 }} />}
                      </button>
                    </div>
                  )}
                  {s.Address && (
                    <div style={{ display:'flex', alignItems:'flex-start', gap:8, fontSize:13, color:'var(--text-primary)' }}>
                      <FaMapMarkerAlt style={{ color:'var(--text-muted)', fontSize:11, marginTop:2, flexShrink:0 }} />
                      <span style={{ lineHeight:1.4 }}>{s.Address}</span>
                    </div>
                  )}
                  {!s.Phone && !s.Email && !s.Address && (
                    <div style={{ fontSize:12, color:'var(--text-muted)' }}>No contact info</div>
                  )}
                </div>

                {/* Stats Row */}
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', borderBottom:'1px solid var(--border)' }}>
                  {[
                    { label:'Products',  value: prodList.length,                              color:'var(--info)' },
                    { label:'PO Count',  value: poStats.count,                                color:'var(--info)' },
                    { label:'Spend',     value: poStats.total > 0 ? `₱${(poStats.total/1000).toFixed(1)}k` : '₱0', color:'var(--warning)' },
                  ].map(st => (
                    <div key={st.label} style={{ padding:'12px 8px', textAlign:'center' }}>
                      <div style={{ fontSize:10, color:'var(--text-muted)', fontWeight:600, textTransform:'uppercase', letterSpacing:'0.4px', marginBottom:4 }}>{st.label}</div>
                      <div style={{ fontSize:16, fontWeight:800, color:st.color }}>{st.value}</div>
                    </div>
                  ))}
                </div>

                {/* Product preview chips */}
                {prodList.length > 0 && (
                  <div style={{ padding:'10px 16px', borderBottom:'1px solid var(--border)',
                    display:'flex', flexWrap:'wrap', gap:5 }}>
                    {prodList.slice(0, 4).map(p => (
                      <span key={p.id} style={{ padding:'2px 8px', borderRadius:6, fontSize:11,
                        fontWeight:600, background:'var(--bg-secondary)', color:'var(--text-secondary)',
                        overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', maxWidth:100 }}>
                        {p.Name}
                      </span>
                    ))}
                    {prodList.length > 4 && (
                      <span style={{ padding:'2px 8px', borderRadius:6, fontSize:11,
                        fontWeight:600, background:'var(--success-bg)', color:'var(--accent)' }}>
                        +{prodList.length - 4} more
                      </span>
                    )}
                  </div>
                )}

                {/* Actions */}
                <div style={{ padding:'12px 16px', display:'flex', gap:8 }}>
                  <button onClick={() => setViewSupplier(s)} style={{
                    flex:1, padding:'8px 0', background:'var(--info-bg)', color:'var(--info)',
                    border:'none', borderRadius:10, fontSize:12, fontWeight:700,
                    cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:6,
                    transition:'background 0.15s' }}
                    onMouseEnter={e => e.currentTarget.style.background='rgba(59,130,246,0.2)'}
                    onMouseLeave={e => e.currentTarget.style.background='var(--info-bg)'}>
                    <FaEye /> View Products
                  </button>
                  <button onClick={() => openEdit(s)} style={{
                    flex:1, padding:'8px 0', background:'var(--success-bg)', color:'var(--accent)',
                    border:'none', borderRadius:10, fontSize:12, fontWeight:700,
                    cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:6,
                    transition:'background 0.15s' }}
                    onMouseEnter={e => e.currentTarget.style.background='rgba(45,212,191,0.2)'}
                    onMouseLeave={e => e.currentTarget.style.background='var(--success-bg)'}>
                    <FaEdit /> Edit
                  </button>
                  <button onClick={() => setConfirmDelete(s)} style={{
                    padding:'8px 14px', background:'var(--danger-bg)', color:'var(--danger)',
                    border:'none', borderRadius:10, fontSize:12, cursor:'pointer',
                    display:'flex', alignItems:'center', justifyContent:'center',
                    transition:'background 0.15s' }}
                    onMouseEnter={e => e.currentTarget.style.background='rgba(239,68,68,0.2)'}
                    onMouseLeave={e => e.currentTarget.style.background='var(--danger-bg)'}>
                    <FaTrash />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
        <Pagination
          totalItems={filtered.length}
          currentPage={page}
          pageSize={pageSize}
          onPageChange={setPage}
          onPageSizeChange={(size) => { setPageSize(size); setPage(1); }}
        />
        </>
      ) : (
        /* ── Table View ── */
        <>
        <div style={{ background:'var(--bg-card)', border:'1px solid var(--border)', borderRadius:16, overflow:'hidden',
          boxShadow:'0 4px 20px rgba(0,0,0,0.2)' }}>
          <div style={{ overflowX:'auto' }}>
            <table style={{ width:'100%', borderCollapse:'collapse' }}>
              <thead>
                <tr>
                  {['Supplier','Phone','Email','Products','POs','Spend',''].map(h => (
                    <th key={h} style={{ padding:'12px 16px', textAlign: h === 'Spend' || h === 'Products' || h === 'POs' ? 'right' : 'left',
                      fontSize:11, fontWeight:700, color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.5px',
                      background:'var(--bg-secondary)', borderBottom:'2px solid var(--border)' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {paginatedSuppliers.map(s => {
                  const color    = avatarColor(s.Name);
                  const prodList = productsBySupplier[s.id] || [];
                  const poStats  = poBySupplier[s.id] || { count: 0, total: 0 };
                  return (
                    <tr key={s.id}
                      onMouseEnter={e => e.currentTarget.style.background='var(--bg-card-hover)'}
                      onMouseLeave={e => e.currentTarget.style.background='transparent'}>
                      <td style={{ padding:'12px 16px', borderBottom:'1px solid var(--border)' }}>
                        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                          <div style={{ width:36, height:36, borderRadius:10,
                            background:`linear-gradient(135deg,${color},${color}cc)`,
                            display:'flex', alignItems:'center', justifyContent:'center',
                            color:'#f8fafc', fontSize:14, fontWeight:800, flexShrink:0 }}>
                            {(s.Name||'S')[0].toUpperCase()}
                          </div>
                          <div>
                            <div style={{ fontSize:13, fontWeight:700, color:'var(--text-primary)' }}>{s.Name}</div>
                            {s.ContactPerson && <div style={{ fontSize:11, color:'var(--text-muted)' }}>{s.ContactPerson}</div>}
                          </div>
                        </div>
                      </td>
                      <td style={{ padding:'12px 16px', borderBottom:'1px solid var(--border)', fontSize:13, color:'var(--text-secondary)' }}>
                        {s.Phone || '—'}
                      </td>
                      <td style={{ padding:'12px 16px', borderBottom:'1px solid var(--border)', fontSize:13, color:'var(--text-secondary)', maxWidth:160,
                        overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                        {s.Email || '—'}
                      </td>
                      <td style={{ padding:'12px 16px', borderBottom:'1px solid var(--border)', textAlign:'right' }}>
                        <span style={{ padding:'2px 8px', borderRadius:8, fontSize:12, fontWeight:700,
                          background:'rgba(167,139,250,0.12)', color:'#a78bfa' }}>
                          {prodList.length}
                        </span>
                      </td>
                      <td style={{ padding:'12px 16px', borderBottom:'1px solid var(--border)', textAlign:'right' }}>
                        <span style={{ padding:'2px 8px', borderRadius:8, fontSize:12, fontWeight:700,
                          background:'var(--info-bg)', color:'var(--info)' }}>
                          {poStats.count}
                        </span>
                      </td>
                      <td style={{ padding:'12px 16px', borderBottom:'1px solid var(--border)', textAlign:'right', fontSize:13, fontWeight:700, color:'var(--warning)' }}>
                        ₱{poStats.total.toLocaleString('en-PH')}
                      </td>
                      <td style={{ padding:'12px 16px', borderBottom:'1px solid var(--border)' }}>
                        <div style={{ display:'flex', gap:6, justifyContent:'center' }}>
                          <button onClick={() => setViewSupplier(s)} style={{
                            padding:'5px 8px', background:'var(--info-bg)', color:'var(--info)',
                            border:'none', borderRadius:7, cursor:'pointer', fontSize:12,
                            display:'inline-flex', alignItems:'center', justifyContent:'center' }}
                            onMouseEnter={e => e.currentTarget.style.background='rgba(59,130,246,0.2)'}
                            onMouseLeave={e => e.currentTarget.style.background='var(--info-bg)'}>
                            <FaEye />
                          </button>
                          <button onClick={() => openEdit(s)} style={{
                            padding:'5px 8px', background:'var(--success-bg)', color:'var(--accent)',
                            border:'none', borderRadius:7, cursor:'pointer', fontSize:12,
                            display:'inline-flex', alignItems:'center', justifyContent:'center' }}
                            onMouseEnter={e => e.currentTarget.style.background='rgba(45,212,191,0.2)'}
                            onMouseLeave={e => e.currentTarget.style.background='var(--success-bg)'}>
                            <FaEdit />
                          </button>
                          <button onClick={() => setConfirmDelete(s)} style={{
                            padding:'5px 8px', background:'var(--danger-bg)', color:'var(--danger)',
                            border:'none', borderRadius:7, cursor:'pointer', fontSize:12,
                            display:'inline-flex', alignItems:'center', justifyContent:'center' }}
                            onMouseEnter={e => e.currentTarget.style.background='rgba(239,68,68,0.2)'}
                            onMouseLeave={e => e.currentTarget.style.background='var(--danger-bg)'}>
                            <FaTrash />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
        <Pagination
          totalItems={filtered.length}
          currentPage={page}
          pageSize={pageSize}
          onPageChange={setPage}
          onPageSizeChange={(size) => { setPageSize(size); setPage(1); }}
        />
        </>
      )}

      {/* View Products Modal */}
      {viewSupplier && (() => {
        const color    = avatarColor(viewSupplier.Name);
        const prodList = productsBySupplier[viewSupplier.id] || [];
        const poStats  = poBySupplier[viewSupplier.id] || { count: 0, total: 0, orders: [] };
        const totalStock = prodList.reduce((s, p) => s + (p.Stock||0), 0);
        return (
          <Modal isOpen={true} onClose={() => setViewSupplier(null)}
            title={viewSupplier.Name} icon={<FaEye />}
            gradient="var(--accent-gradient)" maxWidth={700}>
            <Modal.Body padding={0}>
              <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)',
                borderBottom:'1px solid var(--border)' }}>
                {[
                  { label:'Products',    value: prodList.length,                                color:'var(--info)' },
                  { label:'Total Stock', value: totalStock,                                     color:'var(--accent)' },
                  { label:'PO Orders',   value: poStats.count,                                  color:'var(--info)' },
                  { label:'Total Spend', value: `₱${poStats.total.toLocaleString('en-PH')}`,    color:'var(--warning)' },
                ].map(st => (
                  <div key={st.label} style={{ padding:'12px 16px', textAlign:'center', borderRight:'1px solid var(--border)' }}>
                    <div style={{ fontSize:10, color:'var(--text-muted)', fontWeight:600, textTransform:'uppercase', letterSpacing:'0.5px', marginBottom:4 }}>{st.label}</div>
                    <div style={{ fontSize:18, fontWeight:800, color:st.color }}>{st.value}</div>
                  </div>
                ))}
              </div>
              <div style={{ padding:'16px 24px' }}>
                {prodList.length === 0 ? (
                  <div style={{ textAlign:'center', color:'var(--text-muted)', padding:'40px 0', fontSize:14 }}>
                    No products linked to this supplier
                  </div>
                ) : prodList.map((p, idx) => {
                  const imgSrc = (p.ImagePath || p.Image)
                    ? `https://scnt-vault.web.app/${p.ImagePath || p.Image}`
                    : 'https://scnt-vault.web.app/images/scnt_default.png';
                  const isLow = (p.Stock||0) <= (p.LowStockThreshold||10);
                  return (
                    <div key={p.id} style={{ display:'flex', alignItems:'center', gap:14,
                      padding:'12px 0', borderBottom: idx < prodList.length-1 ? '1px solid var(--border)' : 'none' }}>
                      <div style={{ width:52, height:52, borderRadius:12, background:'var(--bg-secondary)',
                        display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                        <img src={imgSrc} alt={p.Name}
                          style={{ maxWidth:44, maxHeight:44, objectFit:'contain' }}
                          onError={e => { e.target.src='https://scnt-vault.web.app/images/scnt_default.png'; }} />
                      </div>
                      <div style={{ flex:1, minWidth:0 }}>
                        <div style={{ fontSize:13, fontWeight:700, color:'var(--text-primary)',
                          overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{p.Name}</div>
                        <div style={{ fontSize:11, color:'var(--text-muted)', marginTop:1 }}>{p.Brand} · {p.Category}</div>
                      </div>
                      <div style={{ textAlign:'right', flexShrink:0 }}>
                        <div style={{ fontSize:13, fontWeight:700, color:'var(--accent)' }}>
                          ₱{(p.SellingPrice||p.Price||0).toLocaleString()}
                        </div>
                        <div style={{ fontSize:11, marginTop:2, fontWeight:600,
                          color: isLow ? 'var(--danger)' : 'var(--text-muted)' }}>
                          {p.Stock||0} in stock
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </Modal.Body>
          </Modal>
        );
      })()}

      {/* Add / Edit Modal */}
      <Modal isOpen={showModal} onClose={closeModal}
        title={editing ? 'Edit Supplier' : 'Add New Supplier'} icon={<FaTruck />}
        maxWidth={520}>
        <Modal.Body>
          <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
            {[
              { key:'Name',          label:'Supplier Name',  icon:<FaTruck />,       required:true },
              { key:'ContactPerson', label:'Contact Person', icon:<FaUser /> },
              { key:'Phone',         label:'Phone Number',   icon:<FaPhone />,       type:'tel' },
              { key:'Email',         label:'Email Address',  icon:<FaEnvelope />,    type:'email' },
            ].map(({ key, label, icon, type='text', required }) => (
              <div key={key} style={{ display:'flex', flexDirection:'column', gap:6 }}>
                <label style={{ fontSize:12, fontWeight:600, color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.5px' }}>
                  {label}{required && <span style={{ color:'var(--danger)' }}> *</span>}
                </label>
                <div style={{ position:'relative' }}>
                  <span style={{ position:'absolute', left:10, top:'50%', transform:'translateY(-50%)', color:'var(--text-muted)', fontSize:13 }}>{icon}</span>
                  <input type={type} value={form[key]}
                    onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                    style={{ width:'100%', padding:'9px 10px 9px 32px', border:'1.5px solid var(--border)',
                      borderRadius:8, fontSize:13, outline:'none', boxSizing:'border-box', transition:'border-color 0.2s',
                      background:'var(--bg-input)', color:'var(--text-primary)' }}
                    onFocus={e => e.currentTarget.style.borderColor='var(--accent)'}
                    onBlur={e => e.currentTarget.style.borderColor='var(--border)'} />
                </div>
              </div>
            ))}
            <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
              <label style={{ fontSize:12, fontWeight:600, color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.5px' }}>Address</label>
              <div style={{ position:'relative' }}>
                <span style={{ position:'absolute', left:10, top:10, color:'var(--text-muted)', fontSize:13 }}><FaMapMarkerAlt /></span>
                <textarea value={form.Address} onChange={e => setForm(f => ({ ...f, Address: e.target.value }))} rows={2}
                  style={{ width:'100%', padding:'9px 10px 9px 32px', border:'1.5px solid var(--border)',
                    borderRadius:8, fontSize:13, outline:'none', resize:'vertical', fontFamily:'inherit',
                    boxSizing:'border-box', transition:'border-color 0.2s',
                    background:'var(--bg-input)', color:'var(--text-primary)' }}
                  onFocus={e => e.currentTarget.style.borderColor='var(--accent)'}
                  onBlur={e => e.currentTarget.style.borderColor='var(--border)'} />
              </div>
            </div>
          </div>
        </Modal.Body>
        <Modal.Footer>
          <CancelButton onClick={closeModal} />
          <PrimaryButton loading={saving} disabled={!form.Name.trim()} onClick={handleSave}>
            {editing ? 'Save Changes' : 'Add Supplier'}
          </PrimaryButton>
        </Modal.Footer>
      </Modal>

      {/* Confirm Delete */}
      <ConfirmDialog
        isOpen={!!confirmDelete}
        onClose={() => setConfirmDelete(null)}
        onConfirm={() => handleDelete(confirmDelete.id)}
        title="Delete Supplier?"
        message={<span>Are you sure you want to delete <strong>{confirmDelete?.Name}</strong>? This cannot be undone.</span>}
        confirmLabel="Yes, Delete" loading={saving}
      />
    </div>
  );
}