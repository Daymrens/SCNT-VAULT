import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useData } from '../contexts/DataContext';
import { useSettings } from '../contexts/SettingsContext';
import {
  FaPlus, FaEdit, FaTrash, FaUser, FaSort,
  FaPhone, FaEnvelope, FaMapMarkerAlt, FaStar,
  FaShoppingBag, FaHistory, FaChevronDown, FaChevronUp,
  FaCrown, FaMedal, FaAward, FaSearch
} from 'react-icons/fa';
import SearchBar from '../components/shared/SearchBar';
import Modal, { CancelButton, PrimaryButton } from '../components/shared/Modal';
import ConfirmDialog from '../components/shared/ConfirmDialog';
import { useToast } from '../components/shared/Toast';

const EMPTY_FORM = { Name: '', Phone: '', Email: '', Address: '', LoyaltyPoints: 0 };

function toDate(v) {
  if (!v) return new Date(0);
  return v?.toDate ? v.toDate() : new Date(v);
}

function loyaltyTier(pts, tiers = {}) {
  const vip = tiers.VIP ?? 200;
  const gold = tiers.Gold ?? 100;
  const silver = tiers.Silver ?? 50;
  if (pts >= vip)    return { label:'VIP',    color:'#2dd4bf', bg:'rgba(45,212,191,0.12)', icon:<FaCrown /> };
  if (pts >= gold)   return { label:'Gold',   color:'#f59e0b', bg:'rgba(245,158,11,0.12)', icon:<FaMedal /> };
  if (pts >= silver) return { label:'Silver', color:'#94a3b8', bg:'rgba(255,255,255,0.06)', icon:<FaAward /> };
  return { label:'Member', color:'#3b82f6', bg:'rgba(59,130,246,0.12)', icon:<FaStar /> };
}

const SORT_OPTIONS = [
  { value:'name',      label:'Name' },
  { value:'purchases', label:'Purchases' },
  { value:'spent',     label:'Spent' },
  { value:'loyalty',   label:'Loyalty' },
  { value:'recent',    label:'Recent' },
];

const AVATAR_COLORS = ['#6366f1','#10b981','#f59e0b','#ec4899','#3b82f6','#8b5cf6','#14b8a6'];

export default function Customers() {
  const { customers, sales, loading, addCustomer, updateCustomer, deleteCustomer, loadSales } = useData();
  const { settings } = useSettings();
  const { showToast } = useToast();
  const [search, setSearch]             = useState('');
  const [sortBy, setSortBy]             = useState('name');
  const [viewMode, setViewMode]         = useState('grid');
  const [showModal, setShowModal]       = useState(false);
  const [editing, setEditing]           = useState(null);
  const [form, setForm]                 = useState(EMPTY_FORM);
  const [saving, setSaving]             = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [viewOrders, setViewOrders]       = useState(null);
  const [copied, setCopied]               = useState('');
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

  const ordersByCustomer = useMemo(() => {
    const map = {};
    sales.forEach(s => {
      if (s.CustomerId != null) {
        const k = String(s.CustomerId);
        if (!map[k]) map[k] = [];
        map[k].push(s);
      }
    });
    Object.values(map).forEach(arr =>
      arr.sort((a, b) => toDate(b.SaleDate) - toDate(a.SaleDate))
    );
    return map;
  }, [sales]);

  const customerStats = useMemo(() => {
    const map = {};
    customers.forEach(c => {
      const orders = ordersByCustomer[c.id] || [];
      const totalSpent = orders.reduce((s, o) => s + (o.Total || 0), 0);
      const lastOrder  = orders[0] ? toDate(orders[0].SaleDate) : null;
      const prodCount = {};
      orders.forEach(o => (o.Items||[]).forEach(i => {
        const n = i.ProductName || i.PerfumeName || 'Unknown';
        prodCount[n] = (prodCount[n] || 0) + (i.Quantity || 1);
      }));
      const topProducts = Object.entries(prodCount).sort((a,b) => b[1]-a[1]).slice(0,3).map(([n]) => n);
      map[c.id] = { count: orders.length, totalSpent, lastOrder, topProducts };
    });
    return map;
  }, [customers, ordersByCustomer]);

  const totalLoyalty   = useMemo(() => customers.reduce((s, c) => s + (c.LoyaltyPoints||0), 0), [customers]);
  const totalRevenue   = useMemo(() => Object.values(customerStats).reduce((s, v) => s + v.totalSpent, 0), [customerStats]);
  const topCustomer    = useMemo(() => customers.reduce((best, c) =>
    (customerStats[c.id]?.totalSpent || 0) > (customerStats[best?.id]?.totalSpent || 0) ? c : best
  , customers[0]), [customers, customerStats]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    const list = customers.filter(c =>
      c.Name?.toLowerCase().includes(q) ||
      c.Email?.toLowerCase().includes(q) ||
      c.Phone?.toLowerCase().includes(q)
    );
    return [...list].sort((a, b) => {
      if (sortBy === 'purchases') return (customerStats[b.id]?.count||0) - (customerStats[a.id]?.count||0);
      if (sortBy === 'loyalty')   return (b.LoyaltyPoints||0) - (a.LoyaltyPoints||0);
      if (sortBy === 'spent')     return (customerStats[b.id]?.totalSpent||0) - (customerStats[a.id]?.totalSpent||0);
      if (sortBy === 'recent') {
        const da = customerStats[a.id]?.lastOrder || new Date(0);
        const db = customerStats[b.id]?.lastOrder || new Date(0);
        return db - da;
      }
      return (a.Name||'').localeCompare(b.Name||'');
    });
  }, [customers, search, sortBy, customerStats]);

  const openAdd  = () => { setEditing(null); setForm(EMPTY_FORM); setShowModal(true); };
  const openEdit = (c) => {
    setEditing(c);
    setForm({ Name: c.Name||'', Phone: c.Phone||'', Email: c.Email||'', Address: c.Address||'', LoyaltyPoints: c.LoyaltyPoints||0 });
    setShowModal(true);
  };
  const closeModal = () => { setShowModal(false); setEditing(null); setForm(EMPTY_FORM); };

  const handleSave = async () => {
    if (!form.Name.trim()) return;
    setSaving(true);
    try {
      const payload = { ...form, LoyaltyPoints: Number(form.LoyaltyPoints)||0 };
      if (editing) {
        await updateCustomer(editing.id, payload);
        showToast('Customer updated', 'success');
      } else {
        await addCustomer(payload);
        showToast('Customer added', 'success');
      }
      closeModal();
    } catch (e) { console.error(e); showToast('Failed to save customer', 'error'); }
    finally { setSaving(false); }
  };

  const handleDelete = async (id) => {
    try {
      await deleteCustomer(id);
      showToast('Customer deleted', 'success');
    }
    catch (e) { console.error(e); showToast('Failed to delete customer', 'error'); }
    finally { setConfirmDelete(null); }
  };

  const copy = (text, key) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(key); setTimeout(() => setCopied(''), 1500);
    });
  };

  const avatarColor = (name) => {
    return AVATAR_COLORS[(name?.charCodeAt(0)||0) % AVATAR_COLORS.length];
  };

  if (loading) return (
    <div className="inventory-page">
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(180px, 1fr))', gap:16, marginBottom:24 }}>
        {[1,2,3,4].map(i => <div key={i} className="skeleton" style={{ height:100, borderRadius:14 }} />)}
      </div>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(280px, 1fr))', gap:18 }}>
        {[1,2,3,4,5,6].map(i => <div key={i} className="skeleton" style={{ height:320, borderRadius:20 }} />)}
      </div>
    </div>
  );

  if (!customers.length) return (
    <div className="inventory-page" style={{ background:'var(--bg-card)', borderRadius:16, padding:'64px 32px', textAlign:'center',
      border:'1px solid rgba(255,255,255,0.06)' }}>
      <div style={{ width:72, height:72, borderRadius:'50%', background:'rgba(45,212,191,0.12)',
        display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 20px' }}>
        <FaUser style={{ fontSize:32, color:'#2dd4bf' }} />
      </div>
      <h2 style={{ fontSize:22, fontWeight:800, color:'#e2e8f0', marginBottom:8 }}>No customers yet</h2>
      <p style={{ color:'#94a3b8', fontSize:14, marginBottom:24, maxWidth:360, margin:'0 auto 24px' }}>
        Add your first customer to start tracking orders, loyalty points, and purchase history.
      </p>
      <button onClick={openAdd} style={{
        display:'inline-flex', alignItems:'center', gap:8, padding:'12px 24px',
        background:'#2dd4bf', color:'#0f172a',
        border:'none', borderRadius:12, fontSize:14, fontWeight:700, cursor:'pointer',
        transition:'transform 0.15s' }}
        onMouseEnter={e => e.currentTarget.style.transform='translateY(-2px)'}
        onMouseLeave={e => e.currentTarget.style.transform='none'}>
        <FaPlus /> Add Your First Customer
      </button>
    </div>
  );

  return (
    <div className="inventory-page">
      {/* Header */}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:24, flexWrap:'wrap', gap:16 }}>
        <div>
          <h1 style={{ fontSize:24, fontWeight:800, color:'#e2e8f0', marginBottom:4 }}>Customers</h1>
          <p style={{ color:'#64748b', fontSize:13 }}>{filtered.length} of {customers.length} customer{customers.length !== 1 ? 's' : ''}</p>
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
          <div style={{ display:'flex', background:'#1f232b', borderRadius:10, padding:'8px 12px', border:'1px solid rgba(255,255,255,0.06)', alignItems:'center', gap:8, minWidth:200 }}>
            <FaSearch style={{ color:'#64748b', fontSize:13 }} />
            <input ref={searchRef} value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search customers... (press /)"
              style={{ border:'none', outline:'none', fontSize:13, flex:1, background:'transparent', color:'#e2e8f0' }} />
          </div>
          <button onClick={openAdd} style={{ display:'flex', alignItems:'center', gap:8, padding:'10px 18px', background:'#2dd4bf', color:'#0f172a', border:'none', borderRadius:10, fontSize:13, fontWeight:700, cursor:'pointer', transition:'all 0.2s' }}
            onMouseEnter={e => e.currentTarget.style.background='#25b8a5'}
            onMouseLeave={e => e.currentTarget.style.background='#2dd4bf'}>
            <FaPlus /> Add Customer
          </button>
        </div>
      </div>

      {/* Stat Cards */}
      <div className="stat-cashflow-grid">
        <div className="stat-cashflow stat-cashflow-green">
          <div className="stat-cashflow-icon" style={{ background:'rgba(255,255,255,0.2)' }}>
            <FaUser />
          </div>
          <div className="stat-cashflow-value">{customers.length}</div>
          <div className="stat-cashflow-label">Total Customers</div>
        </div>
        <div className="stat-cashflow stat-cashflow-dark">
          <div className="stat-cashflow-icon" style={{ background:'rgba(255,255,255,0.1)' }}>
            <FaShoppingBag />
          </div>
          <div className="stat-cashflow-value">{sales.filter(s => s.CustomerId != null).length}</div>
          <div className="stat-cashflow-label">Total Purchases</div>
        </div>
        <div className="stat-cashflow">
          <div className="stat-cashflow-icon" style={{ background:'rgba(45,212,191,0.12)', color:'#2dd4bf' }}>
            <FaStar />
          </div>
          <div className="stat-cashflow-value" style={{ color:'#2dd4bf' }}>₱{totalRevenue.toLocaleString('en-PH')}</div>
          <div className="stat-cashflow-label">Customer Revenue</div>
        </div>
        <div className="stat-cashflow">
          <div className="stat-cashflow-icon" style={{ background:'rgba(245,158,11,0.12)', color:'#f59e0b' }}>
            <FaMedal />
          </div>
          <div className="stat-cashflow-value" style={{ color:'#f59e0b' }}>{totalLoyalty.toLocaleString()}</div>
          <div className="stat-cashflow-label">Total Loyalty Pts</div>
        </div>
      </div>

      {/* Sort pills */}
      <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:20, flexWrap:'wrap' }}>
        <FaSort style={{ color:'#64748b', fontSize:13 }} />
        <div style={{ display:'flex', background:'#1f232b', borderRadius:10, overflow:'hidden',
          border:'1px solid rgba(255,255,255,0.06)' }}>
          {SORT_OPTIONS.map(o => (
            <button key={o.value} onClick={() => setSortBy(o.value)} style={{
              padding:'7px 12px', border:'none', fontSize:11, fontWeight:600, cursor:'pointer',
              background: sortBy === o.value ? '#2dd4bf' : 'transparent',
              color: sortBy === o.value ? '#0f172a' : '#64748b',
              transition:'all 0.2s', whiteSpace:'nowrap' }}>
              {o.label}
            </button>
          ))}
        </div>
      </div>

      {/* Customers: Grid or Table */}
      {filtered.length === 0 ? (
        <div style={{ background:'#1f232b', borderRadius:16, padding:'48px 20px', textAlign:'center',
          color:'#64748b', fontSize:14, border:'1px solid rgba(255,255,255,0.06)' }}>
          {search ? 'No customers match your search' : 'No customers yet — add one to get started'}
        </div>
      ) : viewMode === 'grid' ? (
        /* ── Grid View ── */
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(280px, 1fr))', gap:18 }}>
          {filtered.map(c => {
            const color  = avatarColor(c.Name);
            const stats  = customerStats[c.id] || { count:0, totalSpent:0, lastOrder:null, topProducts:[] };
            const tier   = loyaltyTier(c.LoyaltyPoints, settings.loyaltyTiers || 0);
            const isTop  = topCustomer?.id === c.id && stats.totalSpent > 0;
            return (
              <div key={c.id} style={{ background:'#1f232b', borderRadius:12, overflow:'hidden',
                border: isTop ? '1px solid #2dd4bf' : '1px solid rgba(255,255,255,0.06)',
                transition:'transform 0.2s', display:'flex', flexDirection:'column' }}
                onMouseEnter={e => { e.currentTarget.style.transform='translateY(-3px)'; }}
                onMouseLeave={e => { e.currentTarget.style.transform='none'; }}>
                {/* Card Header */}
                <div style={{ padding:'18px 18px 14px',
                  background:`linear-gradient(135deg, ${color}18, ${color}08)`,
                  borderBottom:'1px solid rgba(255,255,255,0.06)' }}>
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
                    <div style={{ display:'flex', alignItems:'center', gap:12 }}>
                      <div style={{ width:48, height:48, borderRadius:14,
                        background:`linear-gradient(135deg,${color},${color}cc)`,
                        display:'flex', alignItems:'center', justifyContent:'center',
                        color:'white', fontSize:20, fontWeight:800, flexShrink:0, position:'relative' }}>
                        {(c.Name||'C')[0].toUpperCase()}
                        {isTop && (
                          <div style={{ position:'absolute', top:-6, right:-6, fontSize:14, color:'#f59e0b' }}><FaCrown /></div>
                        )}
                      </div>
                      <div>
                        <div style={{ fontSize:15, fontWeight:800, color:'#e2e8f0' }}>{c.Name}</div>
                        <div style={{ fontSize:10, color:'#64748b', fontFamily:'monospace', marginTop:1 }}>#{c.id.slice(0,8)}</div>
                      </div>
                    </div>
                    <span style={{ display:'inline-flex', alignItems:'center', gap:4,
                      padding:'3px 10px', borderRadius:20, fontSize:11, fontWeight:700,
                      background: tier.bg, color: tier.color }}>
                      {tier.icon} {tier.label}
                    </span>
                  </div>
                </div>

                {/* Contact */}
                <div style={{ padding:'12px 18px', display:'flex', flexDirection:'column', gap:7,
                  borderBottom:'1px solid rgba(255,255,255,0.06)' }}>
                  {c.Phone && (
                    <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                      <div style={{ display:'flex', alignItems:'center', gap:7, fontSize:12, color:'#94a3b8' }}>
                        <FaPhone style={{ color:'#64748b', fontSize:10 }} /> {c.Phone}
                      </div>
                      <button onClick={() => copy(c.Phone, c.id+'p')} style={{ background:'none', border:'none',
                        cursor:'pointer', color: copied===c.id+'p' ? '#2dd4bf' : '#64748b', fontSize:11, padding:3 }}>
                        {copied===c.id+'p' ? <span style={{color:'#2dd4bf'}}>&#10003;</span> : <span style={{fontSize:10}}>&#9776;</span>}
                      </button>
                    </div>
                  )}
                  {c.Email && (
                    <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                      <div style={{ display:'flex', alignItems:'center', gap:7, fontSize:12, color:'#94a3b8' }}>
                        <FaEnvelope style={{ color:'#64748b', fontSize:10 }} />
                        <span style={{ overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', maxWidth:170 }}>{c.Email}</span>
                      </div>
                      <button onClick={() => copy(c.Email, c.id+'e')} style={{ background:'none', border:'none',
                        cursor:'pointer', color: copied===c.id+'e' ? '#2dd4bf' : '#64748b', fontSize:11, padding:3 }}>
                        {copied===c.id+'e' ? <span style={{color:'#2dd4bf'}}>&#10003;</span> : <span style={{fontSize:10}}>&#9776;</span>}
                      </button>
                    </div>
                  )}
                  {c.Address && (
                    <div style={{ display:'flex', alignItems:'flex-start', gap:7, fontSize:12, color:'#94a3b8' }}>
                      <FaMapMarkerAlt style={{ color:'#64748b', fontSize:10, marginTop:2, flexShrink:0 }} />
                      <span style={{ lineHeight:1.4 }}>{c.Address}</span>
                    </div>
                  )}
                  {!c.Phone && !c.Email && !c.Address && (
                    <div style={{ fontSize:11, color:'#64748b' }}>No contact info</div>
                  )}
                </div>

                {/* Stats */}
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', borderBottom:'1px solid rgba(255,255,255,0.06)' }}>
                  {[
                    { label:'Orders',  value: stats.count,                                    color:'#3b82f6' },
                    { label:'Spent',   value: stats.totalSpent > 0 ? `₱${(stats.totalSpent/1000).toFixed(1)}k` : '₱0', color:'#2dd4bf' },
                    { label:'Loyalty', value: c.LoyaltyPoints||0,                             color:'#f59e0b' },
                  ].map(st => (
                    <div key={st.label} style={{ padding:'10px 6px', textAlign:'center' }}>
                      <div style={{ fontSize:10, color:'#64748b', fontWeight:600, textTransform:'uppercase', letterSpacing:'0.4px', marginBottom:3 }}>{st.label}</div>
                      <div style={{ fontSize:15, fontWeight:800, color:st.color }}>{st.value}</div>
                    </div>
                  ))}
                </div>

                {/* Top products + last visit */}
                <div style={{ padding:'10px 18px', borderBottom:'1px solid rgba(255,255,255,0.06)', flex:1 }}>
                  {stats.topProducts.length > 0 ? (
                    <>
                      <div style={{ fontSize:10, color:'#64748b', fontWeight:600, textTransform:'uppercase', letterSpacing:'0.4px', marginBottom:6 }}>Favourite Scents</div>
                      <div style={{ display:'flex', flexWrap:'wrap', gap:4 }}>
                        {stats.topProducts.map(p => (
                          <span key={p} style={{ padding:'2px 8px', borderRadius:6, fontSize:10,
                            fontWeight:600, background:'rgba(255,255,255,0.06)', color:'#94a3b8',
                            overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', maxWidth:120 }}>
                            {p}
                          </span>
                        ))}
                      </div>
                    </>
                  ) : (
                    <div style={{ fontSize:11, color:'#64748b' }}>No purchases yet</div>
                  )}
                  {stats.lastOrder && (
                    <div style={{ fontSize:10, color:'#64748b', marginTop:6 }}>
                      Last visit: {stats.lastOrder.toLocaleDateString('en-PH', { month:'short', day:'numeric', year:'numeric' })}
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div style={{ padding:'10px 14px', display:'flex', gap:7 }}>
                  <button onClick={() => setViewOrders(c)} style={{
                    flex:1, padding:'7px 0', background:'rgba(59,130,246,0.12)', color:'#3b82f6',
                    border:'none', borderRadius:10, fontSize:12, fontWeight:700,
                    cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:5,
                    transition:'background 0.15s' }}
                    onMouseEnter={e => e.currentTarget.style.background='rgba(59,130,246,0.2)'}
                    onMouseLeave={e => e.currentTarget.style.background='rgba(59,130,246,0.12)'}>
                    <FaHistory style={{ fontSize:10 }} /> Orders
                  </button>
                  <button onClick={() => openEdit(c)} style={{
                    flex:1, padding:'7px 0', background:'rgba(45,212,191,0.12)', color:'#2dd4bf',
                    border:'none', borderRadius:10, fontSize:12, fontWeight:700,
                    cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:5,
                    transition:'background 0.15s' }}
                    onMouseEnter={e => e.currentTarget.style.background='rgba(45,212,191,0.2)'}
                    onMouseLeave={e => e.currentTarget.style.background='rgba(45,212,191,0.12)'}>
                    <FaEdit /> Edit
                  </button>
                  <button onClick={() => setConfirmDelete(c)} style={{
                    padding:'7px 12px', background:'rgba(239,68,68,0.12)', color:'#ef4444',
                    border:'none', borderRadius:10, fontSize:12, cursor:'pointer',
                    display:'flex', alignItems:'center', justifyContent:'center',
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
                  {['Customer','Phone','Email','Orders','Spent','Loyalty','Last Visit',''].map(h => (
                    <th key={h} style={{ padding:'12px 16px', textAlign: h === 'Orders' || h === 'Spent' || h === 'Loyalty' ? 'right' : 'left',
                      fontSize:11, fontWeight:700, color:'#64748b', textTransform:'uppercase', letterSpacing:'0.5px',
                      background:'#1a1d24', borderBottom:'1px solid rgba(255,255,255,0.06)' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map(c => {
                  const color = avatarColor(c.Name);
                  const stats = customerStats[c.id] || { count:0, totalSpent:0, lastOrder:null };
                  const tier  = loyaltyTier(c.LoyaltyPoints, settings.loyaltyTiers || 0);
                  const isTop = topCustomer?.id === c.id && stats.totalSpent > 0;
                  return (
                    <tr key={c.id}
                      onMouseEnter={e => e.currentTarget.style.background='rgba(255,255,255,0.04)'}
                      onMouseLeave={e => e.currentTarget.style.background='transparent'}>
                      <td style={{ padding:'12px 16px', borderBottom:'1px solid rgba(255,255,255,0.06)' }}>
                        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                          <div style={{ width:36, height:36, borderRadius:10,
                            background:`linear-gradient(135deg,${color},${color}cc)`,
                            display:'flex', alignItems:'center', justifyContent:'center',
                            color:'white', fontSize:14, fontWeight:800, flexShrink:0, position:'relative' }}>
                            {(c.Name||'C')[0].toUpperCase()}
                            {isTop && (
                              <div style={{ position:'absolute', top:-4, right:-4, fontSize:10, color:'#f59e0b' }}><FaCrown /></div>
                            )}
                          </div>
                          <div>
                            <div style={{ fontSize:13, fontWeight:700, color:'#e2e8f0' }}>{c.Name}</div>
                            <span style={{ display:'inline-flex', alignItems:'center', gap:3,
                              padding:'1px 6px', borderRadius:10, fontSize:9, fontWeight:700, marginTop:2,
                              background: tier.bg, color: tier.color }}>
                              {tier.icon} {tier.label}
                            </span>
                          </div>
                        </div>
                      </td>
                      <td style={{ padding:'12px 16px', borderBottom:'1px solid rgba(255,255,255,0.06)', fontSize:13, color:'#94a3b8' }}>
                        {c.Phone || '—'}
                      </td>
                      <td style={{ padding:'12px 16px', borderBottom:'1px solid rgba(255,255,255,0.06)', fontSize:13, color:'#94a3b8', maxWidth:160,
                        overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                        {c.Email || '—'}
                      </td>
                      <td style={{ padding:'12px 16px', borderBottom:'1px solid rgba(255,255,255,0.06)', textAlign:'right' }}>
                        <span style={{ padding:'2px 8px', borderRadius:8, fontSize:12, fontWeight:700,
                          background:'rgba(59,130,246,0.12)', color:'#3b82f6' }}>
                          {stats.count}
                        </span>
                      </td>
                      <td style={{ padding:'12px 16px', borderBottom:'1px solid rgba(255,255,255,0.06)', textAlign:'right', fontSize:13, fontWeight:700, color:'#2dd4bf' }}>
                        ₱{stats.totalSpent.toLocaleString('en-PH')}
                      </td>
                      <td style={{ padding:'12px 16px', borderBottom:'1px solid rgba(255,255,255,0.06)', textAlign:'right' }}>
                        <span style={{ padding:'2px 8px', borderRadius:8, fontSize:12, fontWeight:700,
                          background: tier.bg, color: tier.color }}>
                          {c.LoyaltyPoints||0}
                        </span>
                      </td>
                      <td style={{ padding:'12px 16px', borderBottom:'1px solid rgba(255,255,255,0.06)', fontSize:12, color:'#64748b' }}>
                        {stats.lastOrder ? stats.lastOrder.toLocaleDateString('en-PH', { month:'short', day:'numeric', year:'numeric' }) : '—'}
                      </td>
                      <td style={{ padding:'12px 16px', borderBottom:'1px solid rgba(255,255,255,0.06)' }}>
                        <div style={{ display:'flex', gap:6, justifyContent:'center' }}>
                          <button onClick={() => setViewOrders(c)} style={{
                            padding:'5px 8px', background:'rgba(59,130,246,0.12)', color:'#3b82f6',
                            border:'none', borderRadius:7, cursor:'pointer', fontSize:12,
                            display:'inline-flex', alignItems:'center', justifyContent:'center' }}
                            onMouseEnter={e => e.currentTarget.style.background='rgba(59,130,246,0.2)'}
                            onMouseLeave={e => e.currentTarget.style.background='rgba(59,130,246,0.12)'}>
                            <FaHistory />
                          </button>
                          <button onClick={() => openEdit(c)} style={{
                            padding:'5px 8px', background:'rgba(45,212,191,0.12)', color:'#2dd4bf',
                            border:'none', borderRadius:7, cursor:'pointer', fontSize:12,
                            display:'inline-flex', alignItems:'center', justifyContent:'center' }}
                            onMouseEnter={e => e.currentTarget.style.background='rgba(45,212,191,0.2)'}
                            onMouseLeave={e => e.currentTarget.style.background='rgba(45,212,191,0.12)'}>
                            <FaEdit />
                          </button>
                          <button onClick={() => setConfirmDelete(c)} style={{
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

      {/* Order History Modal */}
      {viewOrders && (() => {
        const orders     = ordersByCustomer[viewOrders.id] || [];
        const totalSpent = orders.reduce((s, o) => s + (o.Total||0), 0);
        const color      = avatarColor(viewOrders.Name);
        const tier       = loyaltyTier(viewOrders.LoyaltyPoints||0);
        return (
          <Modal isOpen={true} onClose={() => setViewOrders(null)}
            title={viewOrders.Name} icon={<FaHistory />}
            gradient="linear-gradient(135deg,#2dd4bf,#06b6d4)" maxWidth={700}>
            <Modal.Body padding={0}>
              <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)',
                borderBottom:'1px solid rgba(255,255,255,0.06)' }}>
                {[
                  { label:'Orders',       value: orders.length,                                                              color:'#3b82f6' },
                  { label:'Total Spent',  value: `₱${totalSpent.toLocaleString('en-PH')}`,                                  color:'#2dd4bf' },
                  { label:'Avg Order',    value: orders.length > 0 ? `₱${(totalSpent/orders.length).toFixed(0)}` : '₱0',   color:'#f59e0b' },
                  { label:'Loyalty Pts',  value: viewOrders.LoyaltyPoints||0,                                               color:'#ec4899' },
                ].map(s => (
                  <div key={s.label} style={{ padding:'12px 16px', textAlign:'center', borderRight:'1px solid rgba(255,255,255,0.06)' }}>
                    <div style={{ fontSize:10, color:'#64748b', fontWeight:600, textTransform:'uppercase', letterSpacing:'0.5px', marginBottom:4 }}>{s.label}</div>
                    <div style={{ fontSize:18, fontWeight:800, color:s.color }}>{s.value}</div>
                  </div>
                ))}
              </div>
              <div style={{ padding:'16px 24px' }}>
                {orders.length === 0 ? (
                  <div style={{ textAlign:'center', color:'#64748b', padding:'40px 0', fontSize:14 }}>No orders found</div>
                ) : orders.map((order, idx) => {
                  const d = toDate(order.SaleDate);
                  const items = order.Items || [];
                  const bottleCount = items.reduce((s, i) => s + (i.Quantity||0), 0);
                  return <OrderRow key={order.id} order={order} d={d} items={items} bottleCount={bottleCount} idx={idx} />;
                })}
              </div>
            </Modal.Body>
          </Modal>
        );
      })()}

      {/* Add / Edit Modal */}
      <Modal isOpen={showModal} onClose={closeModal}
        title={editing ? 'Edit Customer' : 'Add New Customer'} icon={<FaUser />}
        maxWidth={500}>
        <Modal.Body>
          <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
            {[
              { key:'Name',  label:'Full Name',    icon:<FaUser />,     type:'text',  required:true },
              { key:'Phone', label:'Phone Number', icon:<FaPhone />,    type:'tel' },
              { key:'Email', label:'Email Address',icon:<FaEnvelope />, type:'email' },
            ].map(({ key, label, icon, type, required }) => (
              <div key={key} style={{ display:'flex', flexDirection:'column', gap:6 }}>
                <label style={{ fontSize:12, fontWeight:600, color:'#64748b', textTransform:'uppercase', letterSpacing:'0.5px' }}>
                  {label}{required && <span style={{ color:'#ef4444' }}> *</span>}
                </label>
                <div style={{ position:'relative' }}>
                  <span style={{ position:'absolute', left:10, top:'50%', transform:'translateY(-50%)', color:'#64748b', fontSize:13 }}>{icon}</span>
                  <input type={type} value={form[key]}
                    onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                    style={{ width:'100%', padding:'9px 10px 9px 32px', border:'1.5px solid rgba(255,255,255,0.06)',
                      borderRadius:8, fontSize:13, outline:'none', boxSizing:'border-box', transition:'border-color 0.2s',
                      background:'#1a1d24', color:'#e2e8f0' }}
                    onFocus={e => e.target.style.borderColor='#2dd4bf'}
                    onBlur={e => e.target.style.borderColor='rgba(255,255,255,0.06)'} />
                </div>
              </div>
            ))}
            <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
              <label style={{ fontSize:12, fontWeight:600, color:'#64748b', textTransform:'uppercase', letterSpacing:'0.5px' }}>Address</label>
              <div style={{ position:'relative' }}>
                <span style={{ position:'absolute', left:10, top:10, color:'#64748b', fontSize:13 }}><FaMapMarkerAlt /></span>
                <textarea value={form.Address} onChange={e => setForm(f => ({ ...f, Address: e.target.value }))} rows={2}
                  style={{ width:'100%', padding:'9px 10px 9px 32px', border:'1.5px solid rgba(255,255,255,0.06)',
                    borderRadius:8, fontSize:13, outline:'none', resize:'vertical', fontFamily:'inherit',
                    boxSizing:'border-box', transition:'border-color 0.2s',
                    background:'#1a1d24', color:'#e2e8f0' }}
                  onFocus={e => e.target.style.borderColor='#2dd4bf'}
                  onBlur={e => e.target.style.borderColor='rgba(255,255,255,0.06)'} />
              </div>
            </div>
            <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
              <label style={{ fontSize:12, fontWeight:600, color:'#64748b', textTransform:'uppercase', letterSpacing:'0.5px' }}>Loyalty Points</label>
              <div style={{ position:'relative' }}>
                <span style={{ position:'absolute', left:10, top:'50%', transform:'translateY(-50%)', color:'#64748b', fontSize:13 }}><FaStar /></span>
                <input type="number" min={0} value={form.LoyaltyPoints}
                  onChange={e => setForm(f => ({ ...f, LoyaltyPoints: e.target.value }))}
                  style={{ width:'100%', padding:'9px 10px 9px 32px', border:'1.5px solid rgba(255,255,255,0.06)',
                    borderRadius:8, fontSize:13, outline:'none', boxSizing:'border-box', transition:'border-color 0.2s',
                    background:'#1a1d24', color:'#e2e8f0' }}
                  onFocus={e => e.target.style.borderColor='#2dd4bf'}
                  onBlur={e => e.target.style.borderColor='rgba(255,255,255,0.06)'} />
              </div>
            </div>
          </div>
        </Modal.Body>
        <Modal.Footer>
          <CancelButton onClick={closeModal} />
          <PrimaryButton loading={saving} disabled={!form.Name.trim()} onClick={handleSave}>
            {editing ? 'Save Changes' : 'Add Customer'}
          </PrimaryButton>
        </Modal.Footer>
      </Modal>

      {/* Confirm Delete */}
      <ConfirmDialog
        isOpen={!!confirmDelete}
        onClose={() => setConfirmDelete(null)}
        onConfirm={() => handleDelete(confirmDelete.id)}
        title="Delete Customer?"
        message={<span>Are you sure you want to delete <strong style={{color:'#2dd4bf'}}>{confirmDelete?.Name}</strong>? This cannot be undone.</span>}
        confirmLabel="Yes, Delete" loading={saving}
      />
    </div>
  );
}

function OrderRow({ order, d, items, bottleCount, idx }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div style={{ marginBottom:10, border:'1px solid rgba(255,255,255,0.06)', borderRadius:12, overflow:'hidden' }}>
      <div onClick={() => setExpanded(e => !e)}
        style={{ display:'grid', gridTemplateColumns:'1.2fr 1fr 1fr 1fr auto',
          alignItems:'center', padding:'12px 16px', gap:8, cursor:'pointer',
          background: idx%2===0 ? '#1f232b' : '#1a1d24', transition:'background 0.15s' }}
        onMouseEnter={e => e.currentTarget.style.background='rgba(255,255,255,0.04)'}
        onMouseLeave={e => e.currentTarget.style.background= idx%2===0 ? '#1f232b' : '#1a1d24'}
      >
        <div>
          <div style={{ fontSize:11, color:'#64748b', marginBottom:2 }}>Date</div>
          <div style={{ fontSize:13, fontWeight:600, color:'#e2e8f0' }}>
            {d.toLocaleDateString('en-PH', { year:'numeric', month:'short', day:'numeric' })}
          </div>
        </div>
        <div>
          <div style={{ fontSize:11, color:'#64748b', marginBottom:2 }}>Items</div>
          <span style={{ display:'inline-flex', alignItems:'center', gap:4,
            padding:'2px 8px', borderRadius:20, fontSize:11, fontWeight:600,
            background:'rgba(59,130,246,0.12)', color:'#3b82f6' }}>
            <FaShoppingBag style={{ fontSize:9 }} /> {bottleCount} bottle{bottleCount!==1?'s':''}
          </span>
        </div>
        <div>
          <div style={{ fontSize:11, color:'#64748b', marginBottom:2 }}>Total</div>
          <div style={{ fontSize:14, fontWeight:700, color:'#2dd4bf' }}>₱{(order.Total||0).toLocaleString('en-PH')}</div>
        </div>
        <div>
          <div style={{ fontSize:11, color:'#64748b', marginBottom:2 }}>Payment</div>
          <span style={{ padding:'2px 10px', borderRadius:20, fontSize:11, fontWeight:600,
            background:'rgba(59,130,246,0.12)', color:'#3b82f6' }}>{order.PaymentMethod||'Cash'}</span>
        </div>
        <div style={{ color:'#64748b', fontSize:12 }}>{expanded ? <FaChevronUp /> : <FaChevronDown />}</div>
      </div>
      {expanded && (
        <div style={{ borderTop:'1px solid rgba(255,255,255,0.06)', background:'#1a1d24', padding:'10px 16px' }}>
          {items.length === 0
            ? <div style={{ fontSize:12, color:'#64748b', padding:'8px 0' }}>No item details</div>
            : <table style={{ width:'100%', borderCollapse:'collapse' }}>
                <thead>
                  <tr>{['Product','Qty','Unit Price','Subtotal'].map(h => (
                    <th key={h} style={{ padding:'6px 10px', textAlign:'left', fontSize:10,
                      fontWeight:700, color:'#64748b', textTransform:'uppercase', letterSpacing:'0.5px',
                      borderBottom:'1px solid rgba(255,255,255,0.06)' }}>{h}</th>
                  ))}</tr>
                </thead>
                <tbody>
                  {items.map((item, i) => (
                    <tr key={i} style={{ borderBottom:'1px solid rgba(255,255,255,0.03)' }}>
                      <td style={{ padding:'7px 10px', fontSize:12, color:'#94a3b8', fontWeight:500 }}>
                        {item.PerfumeName||item.ProductName||`Product #${item.PerfumeId}`}
                      </td>
                      <td style={{ padding:'7px 10px', fontSize:12, color:'#94a3b8' }}>{item.Quantity}</td>
                      <td style={{ padding:'7px 10px', fontSize:12, color:'#94a3b8' }}>₱{(item.UnitPrice||0).toLocaleString()}</td>
                      <td style={{ padding:'7px 10px', fontSize:12, fontWeight:700, color:'#3b82f6' }}>₱{(item.Subtotal||0).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
          }
          {order.Discount > 0 && (
            <div style={{ textAlign:'right', fontSize:12, color:'#ef4444', marginTop:6 }}>
              Discount: -₱{order.Discount.toLocaleString()}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
