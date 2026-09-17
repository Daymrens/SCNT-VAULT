import React, { useState, useMemo, useRef, useEffect } from 'react';
import { useData } from '../contexts/DataContext';
import { FaPlus, FaEdit, FaTrash, FaFlask, FaThLarge, FaList, FaSearch } from 'react-icons/fa';
import ConfirmDialog from '../components/shared/ConfirmDialog';
import Modal from '../components/shared/Modal';
import CancelButton, { PrimaryButton } from '../components/shared/Modal';
import { useToast } from '../components/shared/Toast';

const STATUSES = ['Available', 'In Use', 'Empty', 'Damaged'];

const STATUS_STYLE = {
  Available: { background:'var(--success-bg)', color:'var(--accent)' },
  'In Use':  { background:'var(--info-bg)',    color:'var(--info)' },
  Empty:     { background:'var(--warning-bg)', color:'var(--warning)' },
  Damaged:   { background:'var(--danger-bg)',  color:'var(--danger)' },
};

const statusStyle = (s) => STATUS_STYLE[s] || { background:'rgba(255,255,255,0.06)', color:'var(--text-secondary)' };

// Scent-family color system — maps the free-form Category field to a small
// set of dark-friendly nose families so identical scents share one color.
const SCENT_STYLE = {
  citrus: { background:'rgba(249,115,22,0.12)',  color:'#fb923c' },
  floral: { background:'rgba(236,72,153,0.12)',  color:'#f472b6' },
  fresh:  { background:'rgba(45,212,191,0.12)',  color:'#2dd4bf' },
  woody:  { background:'rgba(167,139,250,0.12)', color:'#a78bfa' },
  amber:  { background:'rgba(245,158,11,0.12)',  color:'#f59e0b' },
};

const SCENT_FAMILIES = [
  { name:'citrus',   keys:['citrus','bergamot','lemon','lime','grapefruit','mandarin','yuzu','orange'] },
  { name:'floral',   keys:['floral','rose','jasmine','peony','tuberose','blossom','freesia','iris','lily','sakura'] },
  { name:'fresh',    keys:['fresh','aquatic','marine','ocean','clean','ozonic','breeze','rain','aromatic','water','sport','cool'] },
  { name:'woody',    keys:['woody','wood','cedar','sandal','vetiver','patchouli','oak','salty'] },
  { name:'oriental', keys:['oriental','spicy','spice','cinnamon','incense','oud'] },
  { name:'amber',    keys:['amber'] },
  { name:'fougere',  keys:['fougere','fern','lavender'] },
  { name:'sweet',    keys:['sweet','gourmand','vanilla','caramel','musk','fruity','berry','pear','chocolate','tonka','praline','candy'] },
];

const DEFAULT_SCENT_STYLE = { background:'rgba(255,255,255,0.06)', color:'var(--text-muted)' };

function scentTagStyle(scent) {
  const raw = String(scent || '').toLowerCase();
  for (const fam of SCENT_FAMILIES) {
    if (fam.keys.some(k => raw.includes(k))) {
      if (fam.name === 'oriental' || fam.name === 'sweet') return SCENT_STYLE.amber; // Oriental/Amber share the warm amber slot
      if (fam.name === 'fougere') return SCENT_STYLE.fresh;                            // Fougère sits in the fresh/green family
      return SCENT_STYLE[fam.name];
    }
  }
  return DEFAULT_SCENT_STYLE;
}

const EMPTY_FORM = { Name:'', Brand:'', Category:'', Status:'Available', Notes:'', ProductId:'' };

export default function Testers() {
  const { testers, products, loading, addTester, updateTester, deleteTester } = useData();
  const [search, setSearch]       = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing]     = useState(null);
  const [form, setForm]           = useState(EMPTY_FORM);
  const [saving, setSaving]       = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [filterStatus, setFilterStatus]   = useState('all');
  const [viewMode, setViewMode]   = useState('grid');
  const searchRef = useRef(null);
  const { showToast } = useToast();

  useEffect(() => {
    const handler = (e) => {
      if (e.key === '/' && !['INPUT','SELECT','TEXTAREA'].includes(document.activeElement?.tagName)) {
        e.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return testers.filter(t => {
      const matchSearch =
        t.Name?.toLowerCase().includes(q) ||
        t.Brand?.toLowerCase().includes(q) ||
        t.Category?.toLowerCase().includes(q);
      const matchStatus = filterStatus === 'all' || t.Status === filterStatus;
      return matchSearch && matchStatus;
    });
  }, [testers, search, filterStatus]);

  const statusCounts = useMemo(() => {
    const m = {};
    testers.forEach(t => { m[t.Status] = (m[t.Status] || 0) + 1; });
    return m;
  }, [testers]);

  const openAdd  = () => { setEditing(null); setForm(EMPTY_FORM); setShowModal(true); };
  const openEdit = (t) => {
    setEditing(t);
    setForm({ Name: t.Name||'', Brand: t.Brand||'', Category: t.Category||'', Status: t.Status||'Available', Notes: t.Notes||'', ProductId: t.ProductId||'' });
    setShowModal(true);
  };
  const closeModal = () => { setShowModal(false); setEditing(null); setForm(EMPTY_FORM); };

  const handleSave = async () => {
    if (!form.Name.trim()) return;
    setSaving(true);
    try {
      if (editing) {
        await updateTester(editing.id, form);
        showToast('Tester updated', 'success');
      } else {
        await addTester(form);
        showToast('Tester added', 'success');
      }
      closeModal();
    } catch (e) {
      console.error(e);
      showToast('Failed to save tester', 'error');
    }
    finally { setSaving(false); }
  };

  const handleDelete = async (id) => {
    try {
      await deleteTester(id);
      showToast('Tester deleted', 'success');
    } catch (e) {
      console.error(e);
      showToast('Failed to delete tester', 'error');
    }
    finally { setConfirmDelete(null); }
  };

  if (loading) return (
    <div className="inventory-page">
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(140px,1fr))', gap:14, marginBottom:20 }}>
        {[1,2,3,4].map(i => <div key={i} className="skeleton" style={{ height:72, borderRadius:14 }} />)}
      </div>
      <div className="skeleton" style={{ height:48, borderRadius:12, marginBottom:20 }} />
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(180px,1fr))', gap:16 }}>
        {[1,2,3,4,5,6].map(i => <div key={i} className="skeleton" style={{ height:260, borderRadius:16 }} />)}
      </div>
    </div>
  );

  return (
    <div className="inventory-page">
      {/* Header */}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:24, flexWrap:'wrap', gap:16 }}>
        <div>
          <h1 style={{ fontSize:24, fontWeight:800, color:'var(--text-primary)', marginBottom:4 }}>Testers</h1>
          <p style={{ color:'var(--text-muted)', fontSize:13 }}>{testers.length} tester{testers.length !== 1 ? 's' : ''} in collection</p>
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
              placeholder="Search testers... (press /)"
              style={{ border:'none', outline:'none', fontSize:13, flex:1, background:'transparent', color:'var(--text-primary)' }} />
          </div>
          <button onClick={openAdd} style={{ display:'flex', alignItems:'center', gap:8, padding:'10px 18px', background:'var(--accent)', color:'#0f172a', border:'none', borderRadius:10, fontSize:13, fontWeight:700, cursor:'pointer', transition:'all 0.2s' }}
            onMouseEnter={e => e.currentTarget.style.background='#5eead4'}
            onMouseLeave={e => e.currentTarget.style.background='var(--accent)'}>
            <FaPlus /> Add Tester
          </button>
        </div>
      </div>

      {/* Stat Cards - Cash Flow Style */}
      <div className="stat-cashflow-grid">
        <div className="stat-cashflow stat-cashflow-green" style={{ border:'1px solid rgba(45,212,191,0.25)', borderRadius:12 }}>
          <div className="stat-cashflow-icon" style={{ background:'rgba(255,255,255,0.2)' }}>
            <FaFlask />
          </div>
          <div className="stat-cashflow-value">{testers.length}</div>
          <div className="stat-cashflow-label">Total Testers</div>
        </div>
        <div className="stat-cashflow stat-cashflow-dark" style={{ border:'1px solid var(--border)', borderRadius:12 }}>
          <div className="stat-cashflow-icon" style={{ background:'rgba(255,255,255,0.1)' }}>
            <FaFlask />
          </div>
          <div className="stat-cashflow-value">{statusCounts['Available'] || 0}</div>
          <div className="stat-cashflow-label">Available</div>
        </div>
        <div className="stat-cashflow" style={{ border:'1px solid var(--border)', borderRadius:12 }}>
          <div className="stat-cashflow-icon" style={{ background:'var(--info-bg)', color:'var(--info)' }}>
            <FaFlask />
          </div>
          <div className="stat-cashflow-value" style={{ color:'var(--info)' }}>{statusCounts['In Use'] || 0}</div>
          <div className="stat-cashflow-label">In Use</div>
        </div>
        <div className="stat-cashflow" style={{ border:'1px solid var(--border)', borderRadius:12 }}>
          <div className="stat-cashflow-icon" style={{ background:'var(--warning-bg)', color:'var(--warning)' }}>
            <FaFlask />
          </div>
          <div className="stat-cashflow-value" style={{ color:'var(--warning)' }}>{statusCounts['Empty'] || 0}</div>
          <div className="stat-cashflow-label">Empty</div>
        </div>
      </div>

      {/* Filter + View Toggle */}
      <div style={{ display:'flex', gap:12, marginBottom:20, flexWrap:'wrap' }}>
        <div style={{ display:'flex', background:'var(--bg-card)', border:'1px solid var(--border)', borderRadius:10, overflow:'hidden', boxShadow:'0 1px 6px rgba(0,0,0,0.2)' }}>
          {[['all','All'], ...STATUSES.map(s => [s, s])].map(([val, label]) => (
            <button key={val} onClick={() => setFilterStatus(val)} style={{
              padding:'7px 14px', border:'none', fontSize:12, fontWeight:600, cursor:'pointer',
              background: filterStatus === val ? 'var(--accent)' : 'transparent',
              color: filterStatus === val ? '#0f172a' : 'var(--text-muted)', transition:'all 0.2s' }}>
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      {filtered.length === 0 ? (
        <div style={{ background:'var(--bg-card)', border:'1px solid var(--border)', borderRadius:16, padding:'48px 20px', textAlign:'center',
          boxShadow:'0 2px 16px rgba(0,0,0,0.2)' }}>
          <div style={{ width:56, height:56, borderRadius:'50%', background:'var(--success-bg)', display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 12px' }}>
            <FaFlask style={{ fontSize:24, color:'var(--accent)' }} />
          </div>
          <div style={{ fontSize:14, color:'var(--text-secondary)', fontWeight:600 }}>
            {search ? 'No testers match your search' : 'No testers yet'}
          </div>
          {!search && (
            <button onClick={openAdd} style={{
              marginTop:12, padding:'8px 18px', background:'var(--accent)',
              color:'#0f172a', border:'none', borderRadius:8, fontSize:13, fontWeight:600, cursor:'pointer',
              display:'inline-flex', alignItems:'center', gap:6 }}>
              <FaPlus /> Add Tester
            </button>
          )}
        </div>
      ) : viewMode === 'grid' ? (
        /* Grid View */
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(180px, 1fr))', gap:16 }}>
          {filtered.map(t => {
            const scent = scentTagStyle(t.Category);
            return (
              <div key={t.id} style={{
                background:'var(--bg-card)', border:'1px solid var(--border)', borderRadius:12,
                boxShadow:'0 4px 20px rgba(0,0,0,0.2)',
                overflow:'hidden', transition:'transform 0.2s, box-shadow 0.2s',
                cursor:'default',
              }}
              onMouseEnter={e => { e.currentTarget.style.transform='translateY(-4px)'; e.currentTarget.style.boxShadow='0 8px 28px rgba(0,0,0,0.35)'; }}
              onMouseLeave={e => { e.currentTarget.style.transform='none'; e.currentTarget.style.boxShadow='0 4px 20px rgba(0,0,0,0.2)'; }}
              >
                {/* Image placeholder */}
                <div style={{
                  width:'100%', aspectRatio:'1/1',
                  background: scent.background,
                  display:'flex', alignItems:'center', justifyContent:'center',
                  position:'relative',
                }}>
                  {t.ImageUrl
                    ? <img src={t.ImageUrl} alt={t.Name}
                        style={{ width:'100%', height:'100%', objectFit:'cover', position:'absolute', inset:0 }} />
                    : <FaFlask style={{ fontSize:48, color:'rgba(255,255,255,0.3)' }} />
                  }
                  {/* Status badge */}
                  <span style={{
                    position:'absolute', top:10, right:10,
                    padding:'3px 9px', borderRadius:20, fontSize:10, fontWeight:700,
                    ...statusStyle(t.Status),
                  }}>{t.Status}</span>
                </div>

                {/* Info */}
                <div style={{ padding:'12px 14px' }}>
                  <div style={{ fontSize:13, fontWeight:700, color:'var(--text-primary)', marginBottom:2,
                    overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                    {t.Name}
                  </div>
                  <div style={{ fontSize:11, color:'var(--text-muted)', marginBottom:6,
                    overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                    {t.Brand}
                  </div>
                  <span style={{
                    display:'inline-block',
                    padding:'3px 9px', borderRadius:20, fontSize:10, fontWeight:700,
                    maxWidth:'100%', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap',
                    marginBottom:10, ...scent,
                  }}>{t.Category || 'Other'}</span>
                  {/* Actions */}
                  <div style={{ display:'flex', gap:6 }}>
                    <button onClick={() => openEdit(t)} style={{
                      flex:1, padding:'6px 0', background:'var(--success-bg)', color:'var(--accent)',
                      border:'none', borderRadius:8, fontSize:11, fontWeight:600,
                      cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:4,
                      transition:'background 0.2s' }}
                      onMouseEnter={e => e.currentTarget.style.background='rgba(45,212,191,0.2)'}
                      onMouseLeave={e => e.currentTarget.style.background='var(--success-bg)'}
                    >
                      <FaEdit style={{ fontSize:10 }} /> Edit
                    </button>
                    <button onClick={() => setConfirmDelete(t)} style={{
                      padding:'6px 10px', background:'var(--danger-bg)', color:'var(--danger)',
                      border:'none', borderRadius:8, fontSize:11, cursor:'pointer',
                      display:'flex', alignItems:'center', transition:'background 0.2s' }}
                      onMouseEnter={e => e.currentTarget.style.background='rgba(239,68,68,0.2)'}
                      onMouseLeave={e => e.currentTarget.style.background='var(--danger-bg)'}
                    >
                      <FaTrash style={{ fontSize:10 }} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* Table View */
        <div style={{ background:'var(--bg-card)', border:'1px solid var(--border)', borderRadius:16, overflow:'hidden', boxShadow:'0 4px 20px rgba(0,0,0,0.2)' }}>
          <table style={{ width:'100%', borderCollapse:'collapse' }}>
            <thead>
              <tr>
                {['Name','Brand','Scent Family','Status',''].map(h => (
                  <th key={h} style={{ padding:'12px 16px', textAlign:'left', fontSize:11,
                    fontWeight:700, color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.5px',
                    background:'var(--bg-secondary)', borderBottom:'2px solid var(--border)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((t) => {
                const scent = scentTagStyle(t.Category);
                return (
                  <tr key={t.id}
                    onMouseEnter={e => e.currentTarget.style.background='var(--bg-card-hover)'}
                    onMouseLeave={e => e.currentTarget.style.background='transparent'}
                  >
                    <td style={{ padding:'12px 16px', borderBottom:'1px solid var(--border)', fontSize:13, fontWeight:600, color:'var(--text-primary)' }}>{t.Name}</td>
                    <td style={{ padding:'12px 16px', borderBottom:'1px solid var(--border)', fontSize:12, color:'var(--text-secondary)' }}>{t.Brand || '—'}</td>
                    <td style={{ padding:'12px 16px', borderBottom:'1px solid var(--border)', fontSize:12, color:'var(--text-secondary)' }}>
                      <span style={{ padding:'3px 10px', borderRadius:20, fontSize:11, fontWeight:700, ...scent }}>
                        {t.Category || 'Other'}
                      </span>
                    </td>
                    <td style={{ padding:'12px 16px', borderBottom:'1px solid var(--border)' }}>
                      <span style={{ padding:'3px 10px', borderRadius:20, fontSize:11, fontWeight:700,
                        ...statusStyle(t.Status) }}>{t.Status}</span>
                    </td>
                    <td style={{ padding:'12px 16px', borderBottom:'1px solid var(--border)' }}>
                      <div style={{ display:'flex', gap:6 }}>
                        <button onClick={() => openEdit(t)} style={{
                          padding:'5px 10px', background:'var(--success-bg)', color:'var(--accent)',
                          border:'none', borderRadius:7, fontSize:11, fontWeight:700, cursor:'pointer' }}
                          onMouseEnter={e => e.currentTarget.style.background='rgba(45,212,191,0.2)'}
                          onMouseLeave={e => e.currentTarget.style.background='var(--success-bg)'}>
                          <FaEdit />
                        </button>
                        <button onClick={() => setConfirmDelete(t)} style={{
                          padding:'5px 10px', background:'var(--danger-bg)', color:'var(--danger)',
                          border:'none', borderRadius:7, fontSize:11, cursor:'pointer' }}
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
      )}

      {/* Add / Edit Modal */}
      <Modal isOpen={showModal} onClose={closeModal}
        title={editing ? 'Edit Tester' : 'Add New Tester'}
        icon={<FaFlask />} maxWidth={460}>
        <Modal.Body>
          <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
            <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
              <label style={lbl}>Link to Product (Optional)</label>
              <select value={form.ProductId || ''} onChange={e => {
                const pid = e.target.value;
                if (pid) {
                  const prod = products.find(p => p.id === pid);
                  if (prod) {
                    setForm(f => ({ ...f, ProductId: pid, Name: prod.Name || f.Name, Brand: prod.Brand || f.Brand, Category: prod.Category || f.Category }));
                    return;
                  }
                }
                setForm(f => ({ ...f, ProductId: pid }));
              }} style={inp}>
                <option value="">No linked product</option>
                {products.map(p => <option key={p.id} value={p.id}>{p.Name} — {p.Brand}</option>)}
              </select>
            </div>
            {[
              { key:'Name',     label:'Tester Name', required:true },
              { key:'Brand',    label:'Brand' },
              { key:'Category', label:'Category / Scent Family' },
            ].map(({ key, label, required }) => (
              <div key={key} style={{ display:'flex', flexDirection:'column', gap:6 }}>
                <label style={lbl}>{label}{required && <span style={{ color:'var(--danger)' }}> *</span>}</label>
                <input value={form[key]} onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                  style={inp}
                  onFocus={e => e.currentTarget.style.borderColor='var(--accent)'}
                  onBlur={e => e.currentTarget.style.borderColor='var(--border)'} />
              </div>
            ))}
            <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
              <label style={lbl}>Status</label>
              <select value={form.Status} onChange={e => setForm(f => ({ ...f, Status: e.target.value }))}
                style={inp}>
                {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
              <label style={lbl}>Notes</label>
              <textarea value={form.Notes} onChange={e => setForm(f => ({ ...f, Notes: e.target.value }))} rows={2}
                style={{ ...inp, resize:'vertical', fontFamily:'inherit' }}
                onFocus={e => e.currentTarget.style.borderColor='var(--accent)'}
                onBlur={e => e.currentTarget.style.borderColor='var(--border)'} />
            </div>
          </div>
        </Modal.Body>
        <div style={{ padding:'16px 24px', borderTop:'1px solid var(--border)', display:'flex', justifyContent:'flex-end', gap:10 }}>
          <CancelButton onClick={closeModal} />
          <PrimaryButton onClick={handleSave} disabled={!form.Name.trim()} loading={saving}>
            {editing ? 'Save Changes' : 'Add Tester'}
          </PrimaryButton>
        </div>
      </Modal>

      {/* Confirm Delete */}
      <ConfirmDialog
        isOpen={!!confirmDelete}
        onClose={() => setConfirmDelete(null)}
        onConfirm={() => handleDelete(confirmDelete.id)}
        title="Delete Tester?"
        message={<span>Remove <strong>{confirmDelete?.Name}</strong> from your tester collection?</span>}
        confirmLabel="Yes, Delete" loading={saving}
      />
    </div>
  );
}

const lbl = { fontSize:12, fontWeight:600, color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.5px' };
const inp = { padding:'9px 12px', border:'1.5px solid var(--border)', borderRadius:8, fontSize:13,
  outline:'none', width:'100%', boxSizing:'border-box', fontFamily:'inherit', transition:'border-color 0.2s',
  background:'var(--bg-input)', color:'var(--text-primary)' };