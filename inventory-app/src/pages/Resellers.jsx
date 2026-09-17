import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useData } from '../contexts/DataContext';
import {
  FaPlus, FaEdit, FaTrash, FaHandshake, FaSort,
  FaPhone, FaEnvelope, FaMapMarkerAlt, FaPercent,
  FaToggleOn, FaToggleOff, FaEye, FaSearch
} from 'react-icons/fa';
import SearchBar from '../components/shared/SearchBar';
import Modal, { CancelButton, PrimaryButton } from '../components/shared/Modal';
import ConfirmDialog from '../components/shared/ConfirmDialog';
import { useToast } from '../components/shared/Toast';

const EMPTY_FORM = {
  Name: '', ContactPerson: '', Phone: '', Email: '',
  Address: '', DiscountRate: 0, IsActive: true
};

function toDate(v) {
  if (!v) return new Date(0);
  return v?.toDate ? v.toDate() : new Date(v);
}

const FILTER_OPTIONS = [
  { value:'all',      label:'All' },
  { value:'active',   label:'Active' },
  { value:'inactive', label:'Inactive' },
];

const AVATAR_COLORS = ['#6366f1','#10b981','#f59e0b','#ec4899','#3b82f6','#8b5cf6','#14b8a6'];

export default function Resellers() {
  const { resellers, sales, loading, addReseller, updateReseller, deleteReseller, loadSales } = useData();
  const { showToast } = useToast();
  const [search, setSearch]             = useState('');
  const [filterActive, setFilterActive] = useState('all');
  const [viewMode, setViewMode]         = useState('grid');
  const [showModal, setShowModal]       = useState(false);
  const [editing, setEditing]           = useState(null);
  const [form, setForm]                 = useState(EMPTY_FORM);
  const [saving, setSaving]             = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [viewSales, setViewSales]       = useState(null);
  const searchRef = useRef(null);

  useEffect(() => { loadSales(); }, [loadSales]);

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

  const resellerStats = useMemo(() => {
    const map = {};
    sales.forEach(s => {
      if (s.ResellerId != null) {
        const k = String(s.ResellerId);
        if (!map[k]) map[k] = { count: 0, total: 0, sales: [] };
        map[k].count += 1;
        map[k].total += s.Total || 0;
        map[k].sales.push(s);
      }
    });
    Object.values(map).forEach(v =>
      v.sales.sort((a, b) => toDate(b.SaleDate) - toDate(a.SaleDate))
    );
    return map;
  }, [sales]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return resellers.filter(r => {
      const matchSearch =
        r.Name?.toLowerCase().includes(q) ||
        r.ContactPerson?.toLowerCase().includes(q) ||
        r.Email?.toLowerCase().includes(q) ||
        r.Phone?.toLowerCase().includes(q);
      const matchActive =
        filterActive === 'all' ||
        (filterActive === 'active'   &&  r.IsActive) ||
        (filterActive === 'inactive' && !r.IsActive);
      return matchSearch && matchActive;
    });
  }, [resellers, search, filterActive]);

  const activeCount  = resellers.filter(r => r.IsActive).length;
  const totalRevenue = Object.values(resellerStats).reduce((s, r) => s + r.total, 0);

  const openAdd  = () => { setEditing(null); setForm(EMPTY_FORM); setShowModal(true); };
  const openEdit = (r) => {
    setEditing(r);
    setForm({
      Name: r.Name || '', ContactPerson: r.ContactPerson || '',
      Phone: r.Phone || '', Email: r.Email || '',
      Address: r.Address || '', DiscountRate: r.DiscountRate || 0,
      IsActive: r.IsActive !== false,
    });
    setShowModal(true);
  };
  const closeModal = () => { setShowModal(false); setEditing(null); setForm(EMPTY_FORM); };

  const handleSave = async () => {
    if (!form.Name.trim()) return;
    setSaving(true);
    try {
      const payload = { ...form, DiscountRate: Number(form.DiscountRate) || 0 };
      if (editing) {
        await updateReseller(editing.id, payload);
        showToast('Reseller updated', 'success');
      } else {
        await addReseller(payload);
        showToast('Reseller added', 'success');
      }
      closeModal();
    } catch (e) { console.error(e); showToast('Failed to save reseller', 'error'); }
    finally { setSaving(false); }
  };

  const handleDelete = async (id) => {
    try {
      await deleteReseller(id);
      showToast('Reseller deleted', 'success');
    }
    catch (e) { console.error(e); showToast('Failed to delete reseller', 'error'); }
    finally { setConfirmDelete(null); }
  };

  const avatarColor = (name) => {
    return AVATAR_COLORS[(name?.charCodeAt(0) || 0) % AVATAR_COLORS.length];
  };

  if (loading) return (
    <div className="inventory-page">
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(180px, 1fr))', gap:16, marginBottom:24 }}>
        {[1,2,3,4].map(i => <div key={i} className="skeleton" style={{ height:100, borderRadius:14 }} />)}
      </div>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(320px, 1fr))', gap:20 }}>
        {[1,2,3,4,5,6].map(i => <div key={i} className="skeleton" style={{ height:280, borderRadius:20 }} />)}
      </div>
    </div>
  );

  if (!resellers.length) return (
    <div className="inventory-page" style={{ background:'#1f232b', borderRadius:16, padding:'64px 32px', textAlign:'center',
      border:'1px solid rgba(255,255,255,0.06)' }}>
      <div style={{ width:72, height:72, borderRadius:'50%', background:'rgba(45,212,191,0.12)',
        display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 20px' }}>
        <FaHandshake style={{ fontSize:32, color:'#2dd4bf' }} />
      </div>
      <h2 style={{ fontSize:22, fontWeight:800, color:'#e2e8f0', marginBottom:8 }}>No resellers yet</h2>
      <p style={{ color:'#94a3b8', fontSize:14, marginBottom:24, maxWidth:360, margin:'0 auto 24px' }}>
        Add your first reseller to start tracking sales, discounts, and performance.
      </p>
      <button onClick={openAdd} style={{
        display:'inline-flex', alignItems:'center', gap:8, padding:'12px 24px',
        background:'#2dd4bf', color:'#0f172a',
        border:'none', borderRadius:12, fontSize:14, fontWeight:700, cursor:'pointer',
        transition:'transform 0.15s' }}
        onMouseEnter={e => e.currentTarget.style.transform='translateY(-2px)'}
        onMouseLeave={e => e.currentTarget.style.transform='none'}>
        <FaPlus /> Add Your First Reseller
      </button>
    </div>
  );

  return (
    <div className="inventory-page">
      {/* Header */}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:24, flexWrap:'wrap', gap:16 }}>
        <div>
          <h1 style={{ fontSize:24, fontWeight:800, color:'#e2e8f0', marginBottom:4 }}>Resellers</h1>
          <p style={{ color:'#64748b', fontSize:13 }}>{filtered.length} of {resellers.length} reseller{resellers.length !== 1 ? 's' : ''} · {activeCount} active</p>
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:12 }}>
          <div className="header-tabs">
            {['Overview', 'Grid', 'Table'].map((tab, i) => (
              <button key={tab}
                className={`header-tab ${(i === 1 && viewMode === 'grid') || (i === 2 && viewMode === 'table') ? 'header-tab-active' : ''}`}
                onClick={() => { if (i === 1) setViewMode('grid'); if (i === 2) setViewMode('table'); }}>
                {tab}
              </button>
            ))}
          </div>
          <div style={{ display:'flex', background:'#1f232b', borderRadius:10, padding:'8px 12px', border:'1px solid rgba(255,255,255,0.06)', alignItems:'center', gap:8, minWidth:200 }}>
            <FaSearch style={{ color:'#64748b', fontSize:13 }} />
            <input ref={searchRef} value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search resellers... (press /)"
              style={{ border:'none', outline:'none', fontSize:13, flex:1, background:'transparent', color:'#e2e8f0' }} />
          </div>
          <button onClick={openAdd} style={{ display:'flex', alignItems:'center', gap:8, padding:'10px 18px', background:'#2dd4bf', color:'#0f172a', border:'none', borderRadius:10, fontSize:13, fontWeight:700, cursor:'pointer', transition:'all 0.2s' }}
            onMouseEnter={e => e.currentTarget.style.background='#25b8a5'}
            onMouseLeave={e => e.currentTarget.style.background='#2dd4bf'}>
            <FaPlus /> Add Reseller
          </button>
        </div>
      </div>

      {/* Stat Cards */}
      <div className="stat-cashflow-grid">
        <div className="stat-cashflow stat-cashflow-green">
          <div className="stat-cashflow-icon" style={{ background:'rgba(255,255,255,0.2)' }}>
            <FaHandshake />
          </div>
          <div className="stat-cashflow-value">{resellers.length}</div>
          <div className="stat-cashflow-label">Total Resellers</div>
        </div>
        <div className="stat-cashflow stat-cashflow-dark">
          <div className="stat-cashflow-icon" style={{ background:'rgba(255,255,255,0.1)' }}>
            <FaToggleOn />
          </div>
          <div className="stat-cashflow-value">{activeCount}</div>
          <div className="stat-cashflow-label">Active</div>
        </div>
        <div className="stat-cashflow">
          <div className="stat-cashflow-icon" style={{ background:'rgba(239,68,68,0.12)', color:'#ef4444' }}>
            <FaToggleOff />
          </div>
          <div className="stat-cashflow-value" style={{ color:'#ef4444' }}>{resellers.length - activeCount}</div>
          <div className="stat-cashflow-label">Inactive</div>
        </div>
        <div className="stat-cashflow">
          <div className="stat-cashflow-icon" style={{ background:'rgba(245,158,11,0.12)', color:'#f59e0b' }}>
            <FaPercent />
          </div>
          <div className="stat-cashflow-value" style={{ color:'#f59e0b' }}>₱{totalRevenue.toLocaleString('en-PH')}</div>
          <div className="stat-cashflow-label">Reseller Revenue</div>
        </div>
      </div>

      {/* Active/Inactive filter */}
      <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:20, flexWrap:'wrap' }}>
        <FaSort style={{ color:'#64748b', fontSize:13 }} />
        <div style={{ display:'flex', background:'#1f232b', borderRadius:10, overflow:'hidden',
          border:'1px solid rgba(255,255,255,0.06)' }}>
          {FILTER_OPTIONS.map(o => (
            <button key={o.value} onClick={() => setFilterActive(o.value)} style={{
              padding:'7px 14px', border:'none', fontSize:12, fontWeight:600, cursor:'pointer',
              background: filterActive === o.value ? '#2dd4bf' : 'transparent',
              color: filterActive === o.value ? '#0f172a' : '#64748b',
              transition:'all 0.2s', whiteSpace:'nowrap' }}>
              {o.label}
            </button>
          ))}
        </div>
      </div>

      {/* Resellers: Grid or Table */}
      {filtered.length === 0 ? (
        <div style={{ background:'#1f232b', borderRadius:16, padding:'48px 20px', textAlign:'center',
          color:'#64748b', fontSize:14, border:'1px solid rgba(255,255,255,0.06)' }}>
          {search || filterActive !== 'all'
            ? 'No resellers match your filters'
            : 'No resellers yet — add one to get started'}
        </div>
      ) : viewMode === 'grid' ? (
        /* ── Grid View ── */
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(320px, 1fr))', gap:20 }}>
          {filtered.map(r => {
            const color = avatarColor(r.Name);
            const stats = resellerStats[r.id] || { count: 0, total: 0, sales: [] };
            const isActive = r.IsActive !== false;
            return (
              <div key={r.id} style={{ background:'#1f232b', borderRadius:12,
                border:'1px solid rgba(255,255,255,0.06)', overflow:'hidden',
                transition:'transform 0.2s' }}
                onMouseEnter={e => { e.currentTarget.style.transform='translateY(-3px)'; }}
                onMouseLeave={e => { e.currentTarget.style.transform='none'; }}>
                {/* Card Header */}
                <div style={{ padding:'20px 20px 16px', background:`linear-gradient(135deg, ${color}18, ${color}08)`,
                  borderBottom:'1px solid rgba(255,255,255,0.06)' }}>
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
                    <div style={{ display:'flex', alignItems:'center', gap:12 }}>
                      <div style={{ width:48, height:48, borderRadius:14,
                        background:`linear-gradient(135deg,${color},${color}cc)`,
                        display:'flex', alignItems:'center', justifyContent:'center',
                        color:'white', fontSize:20, fontWeight:800, flexShrink:0 }}>
                        {(r.Name || 'R')[0].toUpperCase()}
                      </div>
                      <div>
                        <div style={{ fontSize:16, fontWeight:800, color:'#e2e8f0' }}>{r.Name}</div>
                        {r.ContactPerson && (
                          <div style={{ fontSize:12, color:'#64748b', marginTop:2 }}>{r.ContactPerson}</div>
                        )}
                      </div>
                    </div>
                    <span style={{ padding:'4px 12px', borderRadius:20, fontSize:11, fontWeight:700,
                      background: isActive ? 'rgba(45,212,191,0.12)' : 'rgba(239,68,68,0.12)',
                      color: isActive ? '#2dd4bf' : '#ef4444' }}>
                      {isActive ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                </div>

                {/* Contact Info */}
                <div style={{ padding:'14px 20px', display:'flex', flexDirection:'column', gap:8,
                  borderBottom:'1px solid rgba(255,255,255,0.06)' }}>
                  {r.Phone && (
                    <div style={{ display:'flex', alignItems:'center', gap:8, fontSize:13, color:'#94a3b8' }}>
                      <FaPhone style={{ color:'#64748b', fontSize:11, flexShrink:0 }} /> {r.Phone}
                    </div>
                  )}
                  {r.Email && (
                    <div style={{ display:'flex', alignItems:'center', gap:8, fontSize:13, color:'#94a3b8' }}>
                      <FaEnvelope style={{ color:'#64748b', fontSize:11, flexShrink:0 }} /> {r.Email}
                    </div>
                  )}
                  {r.Address && (
                    <div style={{ display:'flex', alignItems:'center', gap:8, fontSize:13, color:'#94a3b8' }}>
                      <FaMapMarkerAlt style={{ color:'#64748b', fontSize:11, flexShrink:0 }} />
                      <span style={{ overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{r.Address}</span>
                    </div>
                  )}
                  {!r.Phone && !r.Email && !r.Address && (
                    <div style={{ fontSize:12, color:'#64748b' }}>No contact info</div>
                  )}
                </div>

                {/* Stats Row */}
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', borderBottom:'1px solid rgba(255,255,255,0.06)' }}>
                  {[
                    { label:'Sales',    value: stats.count,                                    color:'#3b82f6' },
                    { label:'Revenue',  value: `₱${stats.total.toLocaleString('en-PH')}`,      color:'#2dd4bf' },
                    { label:'Discount', value: `${r.DiscountRate || 0}%`,                      color:'#f59e0b' },
                  ].map(s => (
                    <div key={s.label} style={{ padding:'12px 8px', textAlign:'center' }}>
                      <div style={{ fontSize:11, color:'#64748b', fontWeight:600, textTransform:'uppercase',
                        letterSpacing:'0.4px', marginBottom:4 }}>{s.label}</div>
                      <div style={{ fontSize:15, fontWeight:800, color:s.color }}>{s.value}</div>
                    </div>
                  ))}
                </div>

                {/* Actions */}
                <div style={{ padding:'12px 16px', display:'flex', gap:8 }}>
                  <button onClick={() => setViewSales(r)} style={{
                    flex:1, padding:'8px 0', background:'rgba(59,130,246,0.12)', color:'#3b82f6',
                    border:'none', borderRadius:10, fontSize:12, fontWeight:700,
                    cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:6,
                    transition:'background 0.15s' }}
                    onMouseEnter={e => e.currentTarget.style.background='rgba(59,130,246,0.2)'}
                    onMouseLeave={e => e.currentTarget.style.background='rgba(59,130,246,0.12)'}>
                    <FaEye /> View Sales
                  </button>
                  <button onClick={() => openEdit(r)} style={{
                    flex:1, padding:'8px 0', background:'rgba(45,212,191,0.12)', color:'#2dd4bf',
                    border:'none', borderRadius:10, fontSize:12, fontWeight:700,
                    cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:6,
                    transition:'background 0.15s' }}
                    onMouseEnter={e => e.currentTarget.style.background='rgba(45,212,191,0.2)'}
                    onMouseLeave={e => e.currentTarget.style.background='rgba(45,212,191,0.12)'}>
                    <FaEdit /> Edit
                  </button>
                  <button onClick={() => setConfirmDelete(r)} style={{
                    padding:'8px 14px', background:'rgba(239,68,68,0.12)', color:'#ef4444',
                    border:'none', borderRadius:10, fontSize:12, fontWeight:700,
                    cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center',
                    transition:'background 0.15s' }}
                    onMouseEnter={e => e.currentTarget.style.background='rgba(239,68,68,0.2)'}
                    onMouseLeave={e => e.currentTarget.style.background='rgba(239,68,68,0.12)'}>
                    <FaTrash />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* ── Table View ── */
        <div style={{ background:'#1f232b', borderRadius:12, overflow:'hidden',
          border:'1px solid rgba(255,255,255,0.06)' }}>
          <div style={{ overflowX:'auto' }}>
            <table style={{ width:'100%', borderCollapse:'collapse' }}>
              <thead>
                <tr>
                  {['Reseller','Contact','Phone','Email','Discount','Sales','Revenue',''].map(h => (
                    <th key={h} style={{ padding:'12px 16px', textAlign: h === 'Sales' || h === 'Revenue' || h === 'Discount' ? 'right' : 'left',
                      fontSize:11, fontWeight:700, color:'#64748b', textTransform:'uppercase', letterSpacing:'0.5px',
                      background:'#1a1d24', borderBottom:'1px solid rgba(255,255,255,0.06)' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map(r => {
                  const color = avatarColor(r.Name);
                  const stats = resellerStats[r.id] || { count: 0, total: 0, sales: [] };
                  const isActive = r.IsActive !== false;
                  return (
                    <tr key={r.id}
                      onMouseEnter={e => e.currentTarget.style.background='rgba(255,255,255,0.04)'}
                      onMouseLeave={e => e.currentTarget.style.background='transparent'}>
                      <td style={{ padding:'12px 16px', borderBottom:'1px solid rgba(255,255,255,0.06)' }}>
                        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                          <div style={{ width:36, height:36, borderRadius:10,
                            background:`linear-gradient(135deg,${color},${color}cc)`,
                            display:'flex', alignItems:'center', justifyContent:'center',
                            color:'white', fontSize:14, fontWeight:800, flexShrink:0 }}>
                            {(r.Name||'R')[0].toUpperCase()}
                          </div>
                          <div>
                            <div style={{ fontSize:13, fontWeight:700, color:'#e2e8f0' }}>{r.Name}</div>
                            <span style={{ padding:'1px 6px', borderRadius:10, fontSize:9, fontWeight:700,
                              background: isActive ? 'rgba(45,212,191,0.12)' : 'rgba(239,68,68,0.12)',
                              color: isActive ? '#2dd4bf' : '#ef4444' }}>
                              {isActive ? 'Active' : 'Inactive'}
                            </span>
                          </div>
                        </div>
                      </td>
                      <td style={{ padding:'12px 16px', borderBottom:'1px solid rgba(255,255,255,0.06)', fontSize:13, color:'#94a3b8' }}>
                        {r.ContactPerson || '—'}
                      </td>
                      <td style={{ padding:'12px 16px', borderBottom:'1px solid rgba(255,255,255,0.06)', fontSize:13, color:'#94a3b8' }}>
                        {r.Phone || '—'}
                      </td>
                      <td style={{ padding:'12px 16px', borderBottom:'1px solid rgba(255,255,255,0.06)', fontSize:13, color:'#94a3b8', maxWidth:160,
                        overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                        {r.Email || '—'}
                      </td>
                      <td style={{ padding:'12px 16px', borderBottom:'1px solid rgba(255,255,255,0.06)', textAlign:'right' }}>
                        <span style={{ padding:'2px 8px', borderRadius:8, fontSize:12, fontWeight:700,
                          background:'rgba(245,158,11,0.12)', color:'#f59e0b' }}>
                          {r.DiscountRate || 0}%
                        </span>
                      </td>
                      <td style={{ padding:'12px 16px', borderBottom:'1px solid rgba(255,255,255,0.06)', textAlign:'right' }}>
                        <span style={{ padding:'2px 8px', borderRadius:8, fontSize:12, fontWeight:700,
                          background:'rgba(59,130,246,0.12)', color:'#3b82f6' }}>
                          {stats.count}
                        </span>
                      </td>
                      <td style={{ padding:'12px 16px', borderBottom:'1px solid rgba(255,255,255,0.06)', textAlign:'right', fontSize:13, fontWeight:700, color:'#2dd4bf' }}>
                        ₱{stats.total.toLocaleString('en-PH')}
                      </td>
                      <td style={{ padding:'12px 16px', borderBottom:'1px solid rgba(255,255,255,0.06)' }}>
                        <div style={{ display:'flex', gap:6, justifyContent:'center' }}>
                          <button onClick={() => setViewSales(r)} style={{
                            padding:'5px 8px', background:'rgba(59,130,246,0.12)', color:'#3b82f6',
                            border:'none', borderRadius:7, cursor:'pointer', fontSize:12,
                            display:'inline-flex', alignItems:'center', justifyContent:'center' }}
                            onMouseEnter={e => e.currentTarget.style.background='rgba(59,130,246,0.2)'}
                            onMouseLeave={e => e.currentTarget.style.background='rgba(59,130,246,0.12)'}>
                            <FaEye />
                          </button>
                          <button onClick={() => openEdit(r)} style={{
                            padding:'5px 8px', background:'rgba(45,212,191,0.12)', color:'#2dd4bf',
                            border:'none', borderRadius:7, cursor:'pointer', fontSize:12,
                            display:'inline-flex', alignItems:'center', justifyContent:'center' }}
                            onMouseEnter={e => e.currentTarget.style.background='rgba(45,212,191,0.2)'}
                            onMouseLeave={e => e.currentTarget.style.background='rgba(45,212,191,0.12)'}>
                            <FaEdit />
                          </button>
                          <button onClick={() => setConfirmDelete(r)} style={{
                            padding:'5px 8px', background:'rgba(239,68,68,0.12)', color:'#ef4444',
                            border:'none', borderRadius:7, cursor:'pointer', fontSize:12,
                            display:'inline-flex', alignItems:'center', justifyContent:'center' }}
                            onMouseEnter={e => e.currentTarget.style.background='rgba(239,68,68,0.2)'}
                            onMouseLeave={e => e.currentTarget.style.background='rgba(239,68,68,0.12)'}>
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
      )}

      {/* View Sales Modal */}
      {viewSales && (() => {
        const stats = resellerStats[viewSales.id] || { count: 0, total: 0, sales: [] };
        const color = avatarColor(viewSales.Name);
        return (
          <Modal isOpen={true} onClose={() => setViewSales(null)}
            title={viewSales.Name} icon={<FaEye />}
            gradient="linear-gradient(135deg,#2dd4bf,#06b6d4)" maxWidth={720}>
            <Modal.Body padding={0}>
              <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)',
                borderBottom:'1px solid rgba(255,255,255,0.06)' }}>
                {[
                  { label:'Total Sales',   value: stats.count,                                                              color:'#3b82f6' },
                  { label:'Total Revenue', value: `₱${stats.total.toLocaleString('en-PH')}`,                               color:'#2dd4bf' },
                  { label:'Avg Sale',      value: stats.count > 0 ? `₱${(stats.total/stats.count).toFixed(0)}` : '₱0',    color:'#f59e0b' },
                ].map(s => (
                  <div key={s.label} style={{ padding:'14px 20px', textAlign:'center', borderRight:'1px solid rgba(255,255,255,0.06)' }}>
                    <div style={{ fontSize:11, color:'#64748b', fontWeight:600, textTransform:'uppercase', letterSpacing:'0.5px', marginBottom:4 }}>{s.label}</div>
                    <div style={{ fontSize:20, fontWeight:800, color:s.color }}>{s.value}</div>
                  </div>
                ))}
              </div>
              <div style={{ padding:'16px 24px' }}>
                {stats.sales.length === 0 ? (
                  <div style={{ textAlign:'center', color:'#64748b', padding:'40px 0', fontSize:14 }}>
                    No sales recorded for this reseller
                  </div>
                ) : stats.sales.map((sale, idx) => {
                  const d = toDate(sale.SaleDate);
                  const items = sale.Items || [];
                  const bottleCount = items.reduce((s, i) => s + (i.Quantity || 0), 0);
                  return (
                    <div key={sale.id} style={{ marginBottom:12, border:'1px solid rgba(255,255,255,0.06)',
                      borderRadius:14, overflow:'hidden' }}>
                      <div style={{ padding:'12px 16px', background: idx % 2 === 0 ? '#1f232b' : '#1a1d24',
                        display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                        <div style={{ display:'flex', alignItems:'center', gap:12 }}>
                          <div style={{ width:36, height:36, borderRadius:10, background:'linear-gradient(135deg,#2dd4bf,#06b6d4)',
                            display:'flex', alignItems:'center', justifyContent:'center',
                            color:'#0f172a', fontSize:12, fontWeight:700, flexShrink:0 }}>
                            #{idx + 1}
                          </div>
                          <div>
                            <div style={{ fontSize:13, fontWeight:700, color:'#e2e8f0' }}>
                              {d.toLocaleDateString('en-PH', { year:'numeric', month:'short', day:'numeric' })}
                            </div>
                            <div style={{ fontSize:11, color:'#64748b', marginTop:1 }}>
                              {bottleCount} bottle{bottleCount !== 1 ? 's' : ''} · {sale.PaymentMethod || 'Cash'}
                            </div>
                          </div>
                        </div>
                        <div style={{ textAlign:'right' }}>
                          <div style={{ fontSize:15, fontWeight:800, color:'#2dd4bf' }}>
                            ₱{(sale.Total || 0).toLocaleString('en-PH')}
                          </div>
                          {sale.Discount > 0 && (
                            <div style={{ fontSize:11, color:'#f59e0b', marginTop:1 }}>
                              -₱{sale.Discount.toLocaleString('en-PH')} disc
                            </div>
                          )}
                        </div>
                      </div>
                      {items.length > 0 && (
                        <div style={{ padding:'8px 16px 12px', background:'#1a1d24', borderTop:'1px solid rgba(255,255,255,0.06)' }}>
                          {items.map((item, i) => (
                            <div key={i} style={{ display:'flex', justifyContent:'space-between',
                              fontSize:12, color:'#94a3b8', padding:'3px 0' }}>
                              <span>{item.ProductName || item.Name || 'Item'} · {item.Quantity || 1}</span>
                              <span style={{ fontWeight:600, color:'#e2e8f0' }}>
                                ₱{((item.Price || 0) * (item.Quantity || 1)).toLocaleString('en-PH')}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
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
        title={editing ? 'Edit Reseller' : 'Add New Reseller'} icon={<FaHandshake />}
        maxWidth={540}>
        <Modal.Body>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14 }}>
            <div style={{ gridColumn:'1/-1', display:'flex', flexDirection:'column', gap:6 }}>
              <label style={{ fontSize:12, fontWeight:600, color:'#64748b', textTransform:'uppercase', letterSpacing:'0.5px' }}>
                Business Name <span style={{ color:'#ef4444' }}>*</span>
              </label>
              <input value={form.Name} onChange={e => setForm(f => ({ ...f, Name: e.target.value }))}
                style={{ padding:'9px 12px', border:'1.5px solid rgba(255,255,255,0.06)', borderRadius:8, fontSize:13, outline:'none', transition:'border-color 0.2s',
                  background:'#1a1d24', color:'#e2e8f0' }}
                onFocus={e => e.target.style.borderColor='#2dd4bf'}
                onBlur={e => e.target.style.borderColor='rgba(255,255,255,0.06)'} />
            </div>
            {[
              { key:'ContactPerson', label:'Contact Person' },
              { key:'Phone',         label:'Phone' },
              { key:'Email',         label:'Email' },
            ].map(({ key, label }) => (
              <div key={key} style={{ display:'flex', flexDirection:'column', gap:6 }}>
                <label style={{ fontSize:12, fontWeight:600, color:'#64748b', textTransform:'uppercase', letterSpacing:'0.5px' }}>{label}</label>
                <input value={form[key]} onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                  style={{ padding:'9px 12px', border:'1.5px solid rgba(255,255,255,0.06)', borderRadius:8, fontSize:13, outline:'none', transition:'border-color 0.2s',
                    background:'#1a1d24', color:'#e2e8f0' }}
                  onFocus={e => e.target.style.borderColor='#2dd4bf'}
                  onBlur={e => e.target.style.borderColor='rgba(255,255,255,0.06)'} />
              </div>
            ))}
            <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
              <label style={{ fontSize:12, fontWeight:600, color:'#64748b', textTransform:'uppercase', letterSpacing:'0.5px' }}>Discount Rate (%)</label>
              <input type="number" min={0} max={100} value={form.DiscountRate}
                onChange={e => setForm(f => ({ ...f, DiscountRate: e.target.value }))}
                style={{ padding:'9px 12px', border:'1.5px solid rgba(255,255,255,0.06)', borderRadius:8, fontSize:13, outline:'none', transition:'border-color 0.2s',
                  background:'#1a1d24', color:'#e2e8f0' }}
                onFocus={e => e.target.style.borderColor='#2dd4bf'}
                onBlur={e => e.target.style.borderColor='rgba(255,255,255,0.06)'} />
            </div>
            <div style={{ gridColumn:'1/-1', display:'flex', flexDirection:'column', gap:6 }}>
              <label style={{ fontSize:12, fontWeight:600, color:'#64748b', textTransform:'uppercase', letterSpacing:'0.5px' }}>Address</label>
              <textarea value={form.Address} onChange={e => setForm(f => ({ ...f, Address: e.target.value }))} rows={2}
                style={{ padding:'9px 12px', border:'1.5px solid rgba(255,255,255,0.06)', borderRadius:8, fontSize:13, outline:'none',
                  resize:'vertical', fontFamily:'inherit', transition:'border-color 0.2s',
                  background:'#1a1d24', color:'#e2e8f0' }}
                onFocus={e => e.target.style.borderColor='#2dd4bf'}
                onBlur={e => e.target.style.borderColor='rgba(255,255,255,0.06)'} />
            </div>
            <div style={{ gridColumn:'1/-1', display:'flex', alignItems:'center', justifyContent:'space-between',
              padding:'12px 16px', background:'#161820', borderRadius:10, border:'1px solid rgba(255,255,255,0.06)' }}>
              <div>
                <div style={{ fontSize:13, fontWeight:600, color:'#e2e8f0' }}>Active Status</div>
                <div style={{ fontSize:11, color:'#64748b', marginTop:2 }}>Inactive resellers won't appear in POS</div>
              </div>
              <button onClick={() => setForm(f => ({ ...f, IsActive: !f.IsActive }))} style={{
                background:'none', border:'none', cursor:'pointer', fontSize:28,
                color: form.IsActive ? '#2dd4bf' : '#64748b', transition:'color 0.2s' }}>
                {form.IsActive ? <FaToggleOn /> : <FaToggleOff />}
              </button>
            </div>
          </div>
        </Modal.Body>
        <Modal.Footer>
          <CancelButton onClick={closeModal} />
          <PrimaryButton loading={saving} disabled={!form.Name.trim()} onClick={handleSave}>
            {editing ? 'Save Changes' : 'Add Reseller'}
          </PrimaryButton>
        </Modal.Footer>
      </Modal>

      {/* Confirm Delete */}
      <ConfirmDialog
        isOpen={!!confirmDelete}
        onClose={() => setConfirmDelete(null)}
        onConfirm={() => handleDelete(confirmDelete.id)}
        title="Delete Reseller?"
        message={<span>Are you sure you want to delete <strong style={{color:'#2dd4bf'}}>{confirmDelete?.Name}</strong>? This cannot be undone.</span>}
        confirmLabel="Yes, Delete" loading={saving}
      />
    </div>
  );
}
