import React, { useState, useMemo, useRef, useEffect } from 'react';
import { useData } from '../contexts/DataContext';
import { useSettings } from '../contexts/SettingsContext';
import {
  FaPlus, FaTimes, FaFileInvoice,
  FaEdit, FaTrash, FaBoxes, FaTruck, FaCheckCircle,
  FaClock, FaTimesCircle, FaChevronDown, FaChevronUp,
  FaMagic, FaStickyNote, FaExclamationTriangle, FaCartPlus
} from 'react-icons/fa';
import ConfirmDialog from '../components/shared/ConfirmDialog';
import StatCard from '../components/shared/StatCard';
import SearchBar from '../components/shared/SearchBar';
import Pagination from '../components/shared/Pagination';
import Modal from '../components/shared/Modal';
import CancelButton, { PrimaryButton } from '../components/shared/Modal';
import StatusBadge from '../components/shared/StatusBadge';
import { useToast } from '../components/shared/Toast';

const STATUSES = ['Pending', 'Ordered', 'Received', 'Completed', 'Cancelled'];

const STATUS_STYLE = {
  Pending:   { bg:'var(--warning-bg)', color:'var(--warning)', dot:'var(--warning)', icon:<FaClock /> },
  Ordered:   { bg:'rgba(255,255,255,0.06)', color:'var(--text-secondary)', dot:'var(--text-muted)', icon:<FaTruck /> },
  Received:  { bg:'var(--success-bg)', color:'var(--accent)', dot:'var(--accent)', icon:<FaBoxes /> },
  Completed: { bg:'var(--success-bg)', color:'var(--accent)', dot:'var(--accent)', icon:<FaCheckCircle /> },
  Cancelled: { bg:'var(--danger-bg)', color:'var(--danger)', dot:'var(--danger)', icon:<FaTimesCircle /> },
};

const EMPTY_FORM = {
  SupplierId: '', Status: 'Pending', OrderDate: '', DeliveryDate: '',
  InvoiceNumber: '', Notes: '',
  Items: [{ PerfumeId: '', ProductName: '', OrderedQuantity: 1, UnitCost: 0 }]
};

const avatarColor = (name) => {
  const colors = ['#6366f1','#10b981','#f59e0b','#ec4899','#3b82f6','#8b5cf6','#14b8a6','#ef4444'];
  return colors[(name?.charCodeAt(0) || 0) % colors.length];
};

export default function PurchaseOrders() {
  const { purchaseOrders, suppliers, products, sales, loading,
          addPurchaseOrder, updatePurchaseOrder, deletePurchaseOrder, adjustStock,
          loadSales, loadPurchaseOrders } = useData();
  const { settings } = useSettings();

  const [search, setSearch]             = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [showModal, setShowModal]       = useState(false);
  const [editing, setEditing]           = useState(null);
  const [form, setForm]                 = useState(EMPTY_FORM);
  const [saving, setSaving]             = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [expandedId, setExpandedId]     = useState(null);
  const [generating, setGenerating]     = useState(false);
  const [genResult, setGenResult]       = useState(null);
  const [stockingId, setStockingId]     = useState(null);
  const [releasingId, setReleasingId]   = useState(null);
  const [processingAction, setProcessingAction] = useState(null);
  const [activeTab, setActiveTab] = useState('orders');
  const searchRef = useRef(null);
  const { showToast } = useToast();
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  useEffect(() => { loadPurchaseOrders(); loadSales(); }, [loadPurchaseOrders, loadSales]);

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

  const supplierMap = useMemo(() => {
    const m = {};
    suppliers.forEach(s => { m[s.id] = s; if (s.Id != null) m[String(s.Id)] = s; });
    return m;
  }, [suppliers]);

  const resolveSupplier = (id) => supplierMap[String(id)] || supplierMap[id] || null;

  const productMap = useMemo(() => {
    const m = {};
    products.forEach(p => { m[p.id] = p; if (p.Id != null) m[String(p.Id)] = p; });
    return m;
  }, [products]);

  const resolveProduct = (id) => productMap[String(id)] || productMap[id] || null;

  const resolveItemName = (item) => {
    if (item.ProductName && !item.ProductName.startsWith('Product #')) return item.ProductName;
    return resolveProduct(item.PerfumeId)?.Name || item.ProductName || `#${item.PerfumeId}`;
  };

  const normalizeProductId = (id) => resolveProduct(id)?.id || String(id);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return [...purchaseOrders]
      .filter(po => {
        const sup = resolveSupplier(po.SupplierId);
        const matchSearch =
          sup?.Name?.toLowerCase().includes(q) ||
          po.InvoiceNumber?.toLowerCase().includes(q) ||
          po.Status?.toLowerCase().includes(q);
        return matchSearch && (filterStatus === 'all' || po.Status === filterStatus);
      })
      .sort((a, b) => {
        const da = a.OrderDate?.toDate ? a.OrderDate.toDate() : new Date(a.OrderDate || 0);
        const db = b.OrderDate?.toDate ? b.OrderDate.toDate() : new Date(b.OrderDate || 0);
        return db - da;
      });
  }, [purchaseOrders, search, filterStatus, supplierMap]);

  const paginatedPOs = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, page, pageSize]);

  useEffect(() => { setPage(1); }, [search, filterStatus]);

  const totalSpend   = useMemo(() => purchaseOrders.reduce((s, po) => s + (po.TotalAmount||0), 0), [purchaseOrders]);
  const statusCounts = useMemo(() => {
    const m = {};
    purchaseOrders.forEach(po => { m[po.Status] = (m[po.Status]||0)+1; });
    return m;
  }, [purchaseOrders]);

  // F3.4: Low-stock reorder suggestions
  const reorderSuggestions = useMemo(() => {
    const lowStockProducts = products.filter(p => (p.Stock||0) <= (p.LowStockThreshold || settings.lowStockThreshold || 10));
    if (!lowStockProducts.length) return [];
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30*24*60*60*1000);
    const soldMap = {};
    sales.forEach(sale => {
      const sd = sale.SaleDate?.toDate ? sale.SaleDate.toDate() : new Date(sale.SaleDate||0);
      if (sd < thirtyDaysAgo || sd > now) return;
      (sale.Items||[]).forEach(item => {
        const pid = String(item.PerfumeId ?? item.ProductId ?? '');
        if (pid) soldMap[pid] = (soldMap[pid]||0) + (item.Quantity||0);
      });
    });
    return lowStockProducts.map(p => {
      const soldLast30 = soldMap[p.id] || 0;
      const avgWeekly = (soldLast30 / 30) * 7;
      const safetyStock = avgWeekly * 2;
      const suggestedQty = Math.max(1, Math.ceil(safetyStock - (p.Stock||0)));
      const supplier = suppliers.find(s => s.id === p.SupplierId);
      return {
        product: p,
        currentStock: p.Stock || 0,
        avgWeekly: avgWeekly.toFixed(1),
        suggestedQty,
        supplierName: supplier?.Name || '—',
        supplierId: p.SupplierId || '',
        unitCost: p.CostPrice || settings.defaultPrices.CostPrice,
      };
    });
  }, [products, sales, suppliers, settings]);

  const handlePrefillPO = () => {
    if (!reorderSuggestions.length) { showToast('No items to reorder', 'info'); return; }
    const defaultSupplier = suppliers.find(s => s.id === reorderSuggestions[0]?.supplierId) || suppliers[0];
    if (!defaultSupplier) { showToast('No suppliers found', 'error'); return; }
    const items = reorderSuggestions.map(s => ({
      PerfumeId: s.product.id,
      ProductName: s.product.Name,
      OrderedQuantity: s.suggestedQty,
      UnitCost: s.unitCost,
    }));
    setForm({
      SupplierId: defaultSupplier.id,
      Status: 'Pending',
      OrderDate: new Date().toISOString().slice(0,10),
      DeliveryDate: '',
      InvoiceNumber: '',
      Notes: `Auto-filled from reorder suggestions — ${reorderSuggestions.length} item(s)`,
      Items: items,
    });
    setActiveTab('orders');
    setShowModal(true);
  };

  const fmtDate = (val) => {
    if (!val) return '—';
    const d = val?.toDate ? val.toDate() : new Date(val);
    return isNaN(d) ? '—' : d.toLocaleDateString('en-PH', { month:'short', day:'numeric', year:'numeric' });
  };

  const soldAfterPO = useMemo(() => {
    const result = {};
    purchaseOrders.forEach(po => {
      if (!po._stockAdded) return;
      const deliveryDate = po.DeliveryDate?.toDate ? po.DeliveryDate.toDate() : new Date(po.DeliveryDate||0);
      const soldMap = {};
      sales.forEach(sale => {
        const sd = sale.SaleDate?.toDate ? sale.SaleDate.toDate() : new Date(sale.SaleDate||0);
        if (sd <= deliveryDate) return;
        (sale.Items||[]).forEach(item => {
          const pid = String(item.PerfumeId ?? item.ProductId ?? '');
          if (pid) soldMap[pid] = (soldMap[pid]||0) + (item.Quantity||0);
        });
      });
      result[po.id] = soldMap;
    });
    return result;
  }, [purchaseOrders, sales]);

  const hasAnySold = (po) => {
    if (!po._stockAdded) return false;
    const soldMap = soldAfterPO[po.id] || {};
    return (po.Items||[]).some(item => (soldMap[normalizeProductId(item.PerfumeId)]||0) > 0);
  };

  const getBottleSerials = (po) => {
    if (!po._stockAdded) return [];
    const soldMap = soldAfterPO[po.id] || {};
    const bottles = [];
    (po.Items||[]).forEach(item => {
      const pid = normalizeProductId(item.PerfumeId);
      const qty = item.OrderedQuantity || 0;
      const soldQty = soldMap[pid] || 0;
      const poShort = po.id.slice(-6).toUpperCase();
      for (let i = 1; i <= qty; i++) {
        const seq = String(i).padStart(3,'0');
        bottles.push({
          serial: `BTL-${poShort}-${pid.slice(-4).toUpperCase()}-${seq}`,
          name: resolveItemName(item),
          status: i <= soldQty ? 'sold' : 'in_stock',
        });
      }
    });
    return bottles;
  };

  const openAdd = () => {
    setEditing(null);
    setForm({ ...EMPTY_FORM, OrderDate: new Date().toISOString().slice(0,10),
      Items: [{ PerfumeId:'', ProductName:'', OrderedQuantity:1, UnitCost:0 }] });
    setShowModal(true);
  };

  const openEdit = (po) => {
    setEditing(po);
    const d  = po.OrderDate?.toDate    ? po.OrderDate.toDate()    : new Date(po.OrderDate||'');
    const dd = po.DeliveryDate?.toDate ? po.DeliveryDate.toDate() : new Date(po.DeliveryDate||'');
    setForm({
      SupplierId: po.SupplierId||'', Status: po.Status||'Pending',
      OrderDate: isNaN(d) ? '' : d.toISOString().slice(0,10),
      DeliveryDate: isNaN(dd) ? '' : dd.toISOString().slice(0,10),
      InvoiceNumber: po.InvoiceNumber||'', Notes: po.Notes||'',
      Items: (po.Items||[]).map(i => ({
        PerfumeId: i.PerfumeId||'',
        ProductName: i.ProductName || productMap[String(i.PerfumeId)]?.Name || '',
        OrderedQuantity: i.OrderedQuantity||1, UnitCost: i.UnitCost||0,
      }))
    });
    setShowModal(true);
  };

  const closeModal = () => { setShowModal(false); setEditing(null); setForm(EMPTY_FORM); };
  const itemTotal  = (items) => items.reduce((s,i) => s + (Number(i.OrderedQuantity)||0)*(Number(i.UnitCost)||0), 0);
  const addItem    = () => setForm(f => ({ ...f, Items:[...f.Items,{PerfumeId:'',ProductName:'',OrderedQuantity:1,UnitCost:0}] }));
  const removeItem = (idx) => setForm(f => ({ ...f, Items: f.Items.filter((_,i) => i!==idx) }));
  const updateItem = (idx, key, val) => setForm(f => ({ ...f, Items: f.Items.map((item,i) => i===idx ? {...item,[key]:val} : item) }));

  const handleProductSelect = (idx, pid) => {
    const prod = resolveProduct(pid);
    setForm(f => ({ ...f, Items: f.Items.map((item,i) => i===idx
      ? { ...item, PerfumeId:pid, ProductName:prod?.Name||'', UnitCost:prod?.CostPrice||item.UnitCost }
      : item) }));
  };

  const handleSave = async () => {
    if (!form.SupplierId) return;
    setSaving(true);
    try {
      const payload = { ...form, TotalAmount: itemTotal(form.Items) };
      if (editing) {
        await updatePurchaseOrder(editing.id, payload);
        showToast('Changes saved', 'success');
      } else {
        await addPurchaseOrder(payload);
        showToast('Purchase order created', 'success');
      }
      closeModal();
    } catch(e) {
      console.error(e);
      showToast('Failed to save purchase order', 'error');
    }
    finally { setSaving(false); }
  };

  const handleAddStock = async (po) => {
    if (processingAction) return;
    setStockingId(po.id);
    setProcessingAction(po.id);
    try {
      for (const item of (po.Items||[])) {
        const pid = String(item.PerfumeId); const qty = Number(item.OrderedQuantity)||0;
        if (!pid || qty<=0) continue;
        const prod = resolveProduct(pid);
        if (prod) await adjustStock(prod.id, +qty);
      }
      await updatePurchaseOrder(po.id, { ...po, Status:'Completed', _stockAdded:true });
      showToast('Stock added to inventory', 'success');
    } catch(e) {
      console.error(e);
      showToast('Failed to add stock', 'error');
    }
    finally { setProcessingAction(null); setStockingId(null); }
  };

  const handleReleaseStock = async (po) => {
    if (hasAnySold(po)) return;
    if (processingAction) return;
    setReleasingId(po.id);
    setProcessingAction(po.id);
    try {
      for (const item of (po.Items||[])) {
        const pid = String(item.PerfumeId); const qty = Number(item.OrderedQuantity)||0;
        if (!pid || qty<=0) continue;
        const prod = resolveProduct(pid);
        if (prod) {
          const release = Math.min(qty, Math.max(0, prod.Stock || 0));
          if (release > 0) await adjustStock(prod.id, -release);
        }
      }
      await updatePurchaseOrder(po.id, { ...po, Status:'Received', _stockAdded:false });
      showToast('Stock released', 'success');
    } catch(e) {
      console.error(e);
      showToast('Failed to release stock', 'error');
    }
    finally { setProcessingAction(null); setReleasingId(null); }
  };

  const handleDelete = async (id) => {
    try {
      await deletePurchaseOrder(id);
      showToast('Purchase order deleted', 'success');
    } catch(e) {
      console.error(e);
      showToast('Failed to delete', 'error');
    }
    finally { setConfirmDelete(null); }
  };

  const handleGenerate = async () => {
    if (!sales.length) return;
    setGenerating(true); setGenResult(null);
    try {
      const existingKeys = new Set(purchaseOrders.filter(po => po._generatedBatch).map(po => po._generatedBatch));
      const defaultSupplier = suppliers[0];
      if (!defaultSupplier) throw new Error('No suppliers found.');
      const batches = {};
      sales.forEach(sale => {
        const d = sale.SaleDate?.toDate ? sale.SaleDate.toDate() : new Date(sale.SaleDate);
        if (isNaN(d)) return;
        const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
        if (!batches[key]) batches[key] = { dates:[], itemMap:{} };
        batches[key].dates.push(d);
        (sale.Items||[]).forEach(item => {
          const pid = String(item.PerfumeId ?? item.ProductId ?? '');
          if (!pid) return;
          if (!batches[key].itemMap[pid]) batches[key].itemMap[pid] = {
            PerfumeId:pid, ProductName:item.PerfumeName||item.ProductName||productMap[pid]?.Name||pid,
            OrderedQuantity:0, ReceivedQuantity:0, UnitCost:productMap[pid]?.CostPrice||settings.defaultPrices.CostPrice,
          };
          batches[key].itemMap[pid].OrderedQuantity  += (item.Quantity||1);
          batches[key].itemMap[pid].ReceivedQuantity += (item.Quantity||1);
        });
      });
      let created=0, skipped=0;
      for (const [monthKey, batch] of Object.entries(batches)) {
        const batchKey = `${monthKey}__${defaultSupplier.id}`;
        if (existingKeys.has(batchKey)) { skipped++; continue; }
        const items = Object.values(batch.itemMap);
        const earliest = new Date(Math.min(...batch.dates.map(d=>d.getTime())));
        const orderDate = new Date(earliest); orderDate.setDate(orderDate.getDate()-1);
        const latest = new Date(Math.max(...batch.dates.map(d=>d.getTime())));
        await addPurchaseOrder({
          SupplierId:defaultSupplier.id, Status:'Completed',
          OrderDate:orderDate.toISOString(), DeliveryDate:latest.toISOString(),
          InvoiceNumber:`AUTO-${monthKey}`,
          Notes:`Auto-generated from ${batch.dates.length} sale(s) in ${monthKey}`,
          Items:items, TotalAmount:items.reduce((s,i)=>s+i.OrderedQuantity*i.UnitCost,0),
          _generatedBatch:batchKey,
        });
        created++;
      }
      setGenResult({ created, skipped });
      if (created > 0) showToast(`Generated ${created} order${created!==1?'s':''}`, 'success');
      else showToast('No new orders to generate', 'info');
    } catch(e) { console.error(e); setGenResult({ error:e.message }); showToast(e.message, 'error'); }
    finally { setGenerating(false); }
  };

  if (loading) return (
    <div className="inventory-page">
      <div style={{ marginBottom:24 }}>
        <div className="skeleton" style={{ height:24, width:200, borderRadius:4, marginBottom:8 }} />
        <div className="skeleton" style={{ height:14, width:280, borderRadius:4 }} />
      </div>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(160px,1fr))', gap:14, marginBottom:20 }}>
        {[1,2,3,4,5].map(i => <div key={i} className="skeleton" style={{ height:72, borderRadius:8 }} />)}
      </div>
      <div className="skeleton" style={{ height:48, borderRadius:8, marginBottom:20 }} />
      <div className="skeleton" style={{ height:420, borderRadius:12 }} />
    </div>
  );

  return (
    <div className="inventory-page">
      {/* Header */}
      <div style={{ marginBottom:24 }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:16 }}>
          <div>
            <h1 style={{ fontSize:24, fontWeight:700, color:'var(--text-primary)', margin:0, letterSpacing:'-0.5px' }}>Purchase Orders</h1>
            <p style={{ color:'var(--text-muted)', fontSize:13, marginTop:4 }}>
              {purchaseOrders.length} order{purchaseOrders.length!==1?'s':''} · ₱{totalSpend.toLocaleString('en-PH')} total spend
            </p>
          </div>
          <div style={{ display:'flex', gap:10 }}>
            <button onClick={handleGenerate} disabled={generating} style={{
              display:'flex', alignItems:'center', gap:8, padding:'10px 18px',
              background:'var(--bg-card)', color:'var(--text-primary)',
              border:'1px solid var(--border)', borderRadius:8,
              fontSize:13, fontWeight:600, cursor:generating?'not-allowed':'pointer',
              transition:'all 0.15s', opacity:generating?0.7:1 }}
              onMouseEnter={e => { if (!generating) { e.currentTarget.style.background='var(--bg-card-hover)'; e.currentTarget.style.borderColor='rgba(255,255,255,0.1)'; } }}
              onMouseLeave={e => { e.currentTarget.style.background='var(--bg-card)'; e.currentTarget.style.borderColor='var(--border)'; }}
            ><FaMagic /> {generating?'Generating...':'Generate from Sales'}</button>
            <button onClick={openAdd} style={{
              display:'flex', alignItems:'center', gap:8, padding:'10px 18px',
              background:'var(--accent)', color:'#0f172a', border:'none', borderRadius:8,
              fontSize:13, fontWeight:600, cursor:'pointer',
              transition:'all 0.15s' }}
              onMouseEnter={e => e.currentTarget.style.opacity='0.9'}
              onMouseLeave={e => e.currentTarget.style.opacity='1'}
            ><FaPlus /> New Order</button>
          </div>
        </div>
        {/* Tabs */}
        <div style={{ display:'flex', gap:4, borderBottom:'1px solid var(--border)' }}>
          {[
            { key:'orders', label:'Orders', count:purchaseOrders.length },
            { key:'reorder', label:'Reorder Suggestions', count:reorderSuggestions.length, icon:<FaExclamationTriangle style={{ fontSize:10 }} /> },
          ].map(tab => (
            <button key={tab.key} onClick={() => setActiveTab(tab.key)} style={{
              padding:'10px 16px', border:'none', background:'none', cursor:'pointer',
              fontSize:13, fontWeight:600, color:activeTab===tab.key?'var(--accent)':'var(--text-muted)',
              borderBottom:activeTab===tab.key?'2px solid var(--accent)':'2px solid transparent',
              marginBottom:-1, transition:'all 0.2s', display:'flex', alignItems:'center', gap:6 }}>
              {tab.icon} {tab.label}
              <span style={{ padding:'2px 7px', borderRadius:10, fontSize:11, fontWeight:700,
                background:activeTab===tab.key?'var(--accent-dim)':'var(--bg-secondary)',
                color:activeTab===tab.key?'var(--accent)':'var(--text-muted)' }}>
                {tab.count}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Gen result banner */}
      {genResult && (
        <div style={{ marginBottom:16, padding:'12px 18px', borderRadius:8,
          background:genResult.error?'var(--danger-bg)':'var(--success-bg)',
          border:genResult.error?'1px solid rgba(239,68,68,0.2)':'1px solid rgba(45,212,191,0.2)',
          color:genResult.error?'var(--danger)':'var(--accent)',
          display:'flex', justifyContent:'space-between', alignItems:'center', fontSize:13, fontWeight:600 }}>
          <span>{genResult.error ? `Error: ${genResult.error}`
            : `Generated ${genResult.created} order${genResult.created!==1?'s':''}${genResult.skipped>0?` · ${genResult.skipped} already existed`:''}`}
          </span>
          <button onClick={() => setGenResult(null)} style={{ background:'none', border:'none', cursor:'pointer', fontSize:16, color:'inherit' }}><FaTimes /></button>
        </div>
      )}

      {/* F3.4: Reorder Suggestions tab */}
      {activeTab === 'reorder' && (
        <div style={{ marginBottom:20 }}>
          {reorderSuggestions.length === 0 ? (
            <div style={{ background:'var(--bg-card)', border:'1px solid var(--border)', borderRadius:12, padding:'48px 20px', textAlign:'center' }}>
              <div style={{ width:56, height:56, borderRadius:'50%', background:'var(--success-bg)', display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 12px' }}>
                <FaBoxes style={{ fontSize:24, color:'var(--accent)' }} />
              </div>
              <div style={{ fontSize:14, color:'var(--text-secondary)', fontWeight:600 }}>All products are well-stocked</div>
              <div style={{ fontSize:12, color:'var(--text-muted)', marginTop:4 }}>No items below the low stock threshold</div>
            </div>
          ) : (
            <>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:12 }}>
                <div style={{ fontSize:13, color:'var(--text-muted)' }}>
                  {reorderSuggestions.length} product{reorderSuggestions.length!==1?'s':''} below threshold
                </div>
                <button onClick={handlePrefillPO} style={{
                  display:'flex', alignItems:'center', gap:8, padding:'10px 18px',
                  background:'var(--accent)', color:'#0f172a', border:'none', borderRadius:8,
                  fontSize:13, fontWeight:600, cursor:'pointer', transition:'all 0.15s' }}
                  onMouseEnter={e => e.currentTarget.style.opacity='0.9'}
                  onMouseLeave={e => e.currentTarget.style.opacity='1'}>
                  <FaCartPlus /> Generate PO
                </button>
              </div>
              <div style={{ background:'var(--bg-card)', border:'1px solid var(--border)', borderRadius:12, overflow:'hidden' }}>
                <div style={{ overflowX:'auto' }}>
                  <table style={{ width:'100%', borderCollapse:'collapse' }}>
                    <thead>
                      <tr style={{ background:'var(--bg-secondary)' }}>
                        {['Product','SKU','Current Stock','Avg Weekly Usage','Suggested Qty','Supplier'].map(h => (
                          <th key={h} style={{ padding:'12px 16px', textAlign:'left', fontSize:11,
                            fontWeight:700, color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.5px',
                            borderBottom:'1px solid var(--border)', whiteSpace:'nowrap' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {reorderSuggestions.map(s => (
                        <tr key={s.product.id}
                          onMouseEnter={e => e.currentTarget.style.background='var(--bg-card-hover)'}
                          onMouseLeave={e => e.currentTarget.style.background='transparent'}>
                          <td style={{ padding:'12px 16px', fontSize:13, fontWeight:600, color:'var(--text-primary)' }}>
                            <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                              <div style={{ width:6, height:6, borderRadius:'50%', background:'var(--danger)' }} />
                              {s.product.Name}
                            </div>
                          </td>
                          <td style={{ padding:'12px 16px', fontSize:12, color:'var(--text-muted)', fontFamily:'monospace' }}>
                            {s.product.BatchNumber || s.product.id.slice(0,8)}
                          </td>
                          <td style={{ padding:'12px 16px', fontSize:13, color:'var(--danger)', fontWeight:700 }}>
                            {s.currentStock}
                          </td>
                          <td style={{ padding:'12px 16px', fontSize:13, color:'var(--text-secondary)' }}>
                            {s.avgWeekly}/wk
                          </td>
                          <td style={{ padding:'12px 16px' }}>
                            <span style={{ padding:'3px 10px', borderRadius:20, fontSize:12, fontWeight:700,
                              background:'var(--warning-bg)', color:'var(--warning)' }}>
                              {s.suggestedQty}
                            </span>
                          </td>
                          <td style={{ padding:'12px 16px', fontSize:12, color:'var(--text-secondary)' }}>
                            {s.supplierName}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* Stats */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(160px, 1fr))', gap:14, marginBottom:20 }}>
        <StatCard
          color="var(--info)"
          icon={<FaFileInvoice />}
          label="Total Orders"
          value={purchaseOrders.length}
          sub="all time"
        />
        <StatCard
          color="var(--warning)"
          icon={<FaClock />}
          label="Pending"
          value={statusCounts['Pending']||0}
          sub="awaiting order"
        />
        <StatCard
          color="var(--info)"
          icon={<FaTruck />}
          label="Ordered"
          value={statusCounts['Ordered']||0}
          sub="in transit"
        />
        <StatCard
          color="var(--accent)"
          icon={<FaCheckCircle />}
          label="Completed"
          value={statusCounts['Completed']||0}
          sub="stock added"
        />
        <StatCard
          color="var(--info)"
          icon={<FaFileInvoice />}
          label="Total Spend"
          value={`₱${totalSpend.toLocaleString('en-PH')}`}
          sub={purchaseOrders.length > 0 ? `₱${Math.round(totalSpend/purchaseOrders.length).toLocaleString('en-PH')} avg/order` : 'no orders yet'}
        />
      </div>

      {/* Search + Filter */}
      <div style={{ display:'flex', gap:12, marginBottom:20 }}>
        <div style={{ flex:1 }}>
          <SearchBar value={search} onChange={setSearch} placeholder="Search by supplier, invoice number or status..." inputRef={searchRef} />
        </div>
        <div style={{ display:'flex', background:'var(--bg-card)', borderRadius:8, overflow:'hidden', border:'1px solid var(--border)' }}>
          {STATUSES.map(s => (
            <button key={s} onClick={() => setFilterStatus(filterStatus===s?'all':s)} style={{
              padding:'10px 14px', border:'none', borderRight:'1px solid var(--border)', fontSize:12, fontWeight:600, cursor:'pointer',
              background:filterStatus===s?'var(--accent)':'var(--bg-card)',
              color:filterStatus===s?'#0f172a':'var(--text-muted)', transition:'all 0.2s' }}>
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div style={{ background:'var(--bg-card)', borderRadius:12, border:'1px solid var(--border)', overflow:'hidden' }}>
        <div style={{ overflowX:'auto' }}>
          <table style={{ width:'100%', borderCollapse:'collapse' }}>
            <thead>
              <tr style={{ background:'var(--bg-secondary)', position:'sticky', top:0, zIndex:2 }}>
                {['','Order Date','Supplier','Invoice #','Items','Total','Delivery','Status','Actions'].map(h => (
                  <th key={h} style={{ padding:'12px 16px', textAlign:'left', fontSize:11,
                    fontWeight:700, color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.5px',
                    borderBottom:'1px solid var(--border)', whiteSpace:'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={9} style={{ padding:'56px 20px', textAlign:'center' }}>
                  <div style={{ width:56, height:56, borderRadius:'50%', background:'var(--bg-secondary)', display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 10px' }}>
                    <FaFileInvoice style={{ fontSize:24, color:'var(--text-muted)' }} />
                  </div>
                  <div style={{ fontSize:14, color:'var(--text-muted)', fontWeight:600 }}>
                    {search ? 'No orders match your search' : 'No purchase orders yet'}
                  </div>
                  {!search && <div style={{ fontSize:12, color:'var(--text-muted)', marginTop:4 }}>Click "New Order" to create one</div>}
                </td></tr>
              ) : paginatedPOs.map((po, idx) => {
                const sup        = resolveSupplier(po.SupplierId);
                const st         = STATUS_STYLE[po.Status] || STATUS_STYLE['Pending'];
                const itemCount  = (po.Items||[]).reduce((s,i) => s+(i.OrderedQuantity||0), 0);
                const isExpanded = expandedId === po.id;
                const supColor   = avatarColor(sup?.Name || 'S');
                const soldMap    = soldAfterPO[po.id] || {};
                const totalSold  = Object.values(soldMap).reduce((a,b)=>a+b,0);
                const soldPct    = itemCount > 0 ? Math.min(100, Math.round((totalSold/itemCount)*100)) : 0;

                return (
                  <React.Fragment key={po.id}>
                    <tr style={{ borderBottom:isExpanded?'none':'1px solid var(--border)',
                      transition:'background 0.15s' }}
                      onMouseEnter={e => e.currentTarget.style.background='var(--bg-card-hover)'}
                      onMouseLeave={e => e.currentTarget.style.background='transparent'}
                    >
                      {/* Expand toggle */}
                      <td style={{ padding:'14px 8px 14px 16px', width:32 }}>
                        <button onClick={() => setExpandedId(isExpanded?null:po.id)}
                          style={{ background:isExpanded?'var(--accent-dim)':'var(--bg-secondary)', border:'none', cursor:'pointer',
                            color:isExpanded?'var(--accent)':'var(--text-muted)', fontSize:11, width:26, height:26,
                            borderRadius:6, display:'flex', alignItems:'center', justifyContent:'center',
                            transition:'all 0.15s' }}>
                          {isExpanded ? <FaChevronUp /> : <FaChevronDown />}
                        </button>
                      </td>

                      {/* Order Date */}
                      <td style={{ padding:'14px 16px', whiteSpace:'nowrap' }}>
                        <div style={{ fontSize:13, fontWeight:600, color:'var(--text-primary)' }}>{fmtDate(po.OrderDate)}</div>
                        {po.InvoiceNumber && (
                          <div style={{ fontSize:10, color:'var(--text-muted)', marginTop:2, fontFamily:'monospace' }}>{po.InvoiceNumber}</div>
                        )}
                      </td>

                      {/* Supplier */}
                      <td style={{ padding:'14px 16px' }}>
                        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                          <div style={{ width:34, height:34, borderRadius:10, flexShrink:0,
                            background:`linear-gradient(135deg,${supColor},${supColor}cc)`,
                            display:'flex', alignItems:'center', justifyContent:'center',
                            color:'white', fontSize:13, fontWeight:800 }}>
                            {(sup?.Name||'S')[0].toUpperCase()}
                          </div>
                          <div>
                            <div style={{ fontSize:13, fontWeight:700, color:'var(--text-primary)' }}>{sup?.Name||'—'}</div>
                            {sup?.Phone && <div style={{ fontSize:11, color:'var(--text-muted)', marginTop:1 }}>{sup.Phone}</div>}
                          </div>
                        </div>
                      </td>

                      {/* Invoice — merged into date cell above, show dash here */}
                      <td style={{ padding:'14px 16px', fontSize:12, color:'var(--text-muted)', fontFamily:'monospace' }}>
                        {po.InvoiceNumber || <span style={{ color:'var(--text-muted)' }}>—</span>}
                      </td>

                      {/* Items */}
                      <td style={{ padding:'14px 16px' }}>
                        <div style={{ display:'flex', flexDirection:'column', gap:4 }}>
                          <span style={{ padding:'3px 10px', borderRadius:20, fontSize:12, fontWeight:700,
                            background:'var(--accent-dim)', color:'var(--accent)', display:'inline-block', width:'fit-content' }}>
                            {itemCount} bottle{itemCount!==1?'s':''}
                          </span>
                          {po._stockAdded && itemCount > 0 && (
                            <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                              <div style={{ flex:1, height:4, borderRadius:2, background:'var(--bg-secondary)', overflow:'hidden', minWidth:60 }}>
                                <div style={{ height:'100%', width:`${soldPct}%`, borderRadius:2,
                                  background: soldPct===100?'var(--danger)':soldPct>0?'var(--warning)':'var(--accent)',
                                  transition:'width 0.4s' }} />
                              </div>
                              <span style={{ fontSize:10, color:'var(--text-muted)', whiteSpace:'nowrap' }}>{soldPct}% sold</span>
                            </div>
                          )}
                        </div>
                      </td>

                      {/* Total */}
                      <td style={{ padding:'14px 16px' }}>
                        <div style={{ fontSize:14, fontWeight:700, color:'var(--text-primary)' }}>
                          ₱{(po.TotalAmount||0).toLocaleString('en-PH')}
                        </div>
                      </td>

                      {/* Delivery */}
                      <td style={{ padding:'14px 16px', fontSize:13, color:'var(--text-secondary)', whiteSpace:'nowrap' }}>
                        {fmtDate(po.DeliveryDate)}
                      </td>

                      {/* Status */}
                      <td style={{ padding:'14px 16px' }}>
                        <StatusBadge status={po.Status} />
                      </td>

                      {/* Actions */}
                      <td style={{ padding:'14px 16px' }}>
                        <div style={{ display:'flex', gap:5, flexWrap:'wrap', alignItems:'center' }}>
                          {/* Stock action */}
                          {!po._stockAdded && po.Status==='Completed' ? (
                            <span title="Historical — stock already in system"
                              style={{ padding:'5px 10px', background:'var(--bg-secondary)', color:'var(--text-muted)',
                                borderRadius:8, fontSize:11, fontWeight:600, display:'inline-flex', alignItems:'center', gap:4 }}>
                              <FaCheckCircle style={{ fontSize:9 }} /> Historical
                            </span>
                          ) : !po._stockAdded && po.Status!=='Cancelled' ? (
                            <button onClick={() => handleAddStock(po)} disabled={processingAction !== null}
                              title="Add stock to inventory"
                              style={{ padding:'5px 10px', background:stockingId===po.id?'var(--bg-secondary)':'var(--accent-dim)',
                                color:stockingId===po.id?'var(--text-muted)':'var(--accent)', border:'none', borderRadius:6,
                                fontSize:11, fontWeight:600, cursor:stockingId===po.id?'not-allowed':'pointer',
                                display:'inline-flex', alignItems:'center', gap:4 }}
                              onMouseEnter={e => { if (stockingId!==po.id) e.currentTarget.style.background='rgba(45,212,191,0.2)'; }}
                              onMouseLeave={e => e.currentTarget.style.background=stockingId===po.id?'var(--bg-secondary)':'var(--accent-dim)'}
                            ><FaBoxes style={{ fontSize:9 }} /> {stockingId===po.id?'Adding...':'Add Stock'}</button>
                          ) : po._stockAdded ? (() => {
                            const anySold = hasAnySold(po);
                            const busy    = releasingId===po.id;
                            const dis     = anySold||busy||processingAction !== null;
                            return (
                              <button onClick={() => !dis && handleReleaseStock(po)} disabled={dis}
                                title={anySold?`${totalSold}/${itemCount} sold — cannot release`:'Reverse stock'}
                                style={{ padding:'5px 10px', background:dis?'var(--bg-secondary)':'var(--warning-bg)',
                                  color:dis?'var(--text-muted)':'var(--warning)', border:'none', borderRadius:8,
                                  fontSize:11, fontWeight:700, cursor:dis?'not-allowed':'pointer',
                                  display:'inline-flex', alignItems:'center', gap:4 }}
                                onMouseEnter={e => { if (!dis) e.currentTarget.style.background='rgba(245,158,11,0.2)'; }}
                                onMouseLeave={e => e.currentTarget.style.background=dis?'var(--bg-secondary)':'var(--warning-bg)'}
                              ><FaTimesCircle style={{ fontSize:9 }} />
                                {busy?'Releasing...':anySold?`${totalSold}/${itemCount} Sold`:'Release'}
                              </button>
                            );
                          })() : null}

                          <button onClick={() => openEdit(po)} title="Edit"
                            style={{ padding:'5px 10px', background:'var(--bg-secondary)', color:'var(--text-secondary)',
                              border:'none', borderRadius:6, fontSize:11, fontWeight:600, cursor:'pointer',
                              display:'inline-flex', alignItems:'center', gap:4 }}
                            onMouseEnter={e => e.currentTarget.style.background='var(--bg-card-hover)'}
                            onMouseLeave={e => e.currentTarget.style.background='var(--bg-secondary)'}
                          ><FaEdit /> Edit</button>

                          <button onClick={() => setConfirmDelete(po)} title="Delete"
                            style={{ padding:'5px 9px', background:'var(--danger-bg)', color:'var(--danger)',
                              border:'none', borderRadius:6, fontSize:11, cursor:'pointer',
                              display:'inline-flex', alignItems:'center' }}
                            onMouseEnter={e => e.currentTarget.style.background='rgba(239,68,68,0.2)'}
                            onMouseLeave={e => e.currentTarget.style.background='var(--danger-bg)'}
                          ><FaTrash /></button>
                        </div>
                      </td>
                    </tr>

                    {/* Expanded row */}
                    {isExpanded && (
                      <tr style={{ borderBottom:'1px solid var(--border)' }}>
                        <td colSpan={9} style={{ padding:'0 16px 20px 56px', background:'var(--bg-secondary)' }}>
                          <div style={{ display:'grid', gridTemplateColumns: po.Notes ? '1fr 260px' : '1fr', gap:12 }}>
                            {/* Items table */}
                            <div style={{ background:'var(--bg-card)', borderRadius:8, overflow:'hidden', border:'1px solid var(--border)' }}>
                              <table style={{ width:'100%', borderCollapse:'collapse' }}>
                                <thead>
                                  <tr style={{ background:'var(--bg-secondary)' }}>
                                    {['Product','Ordered','Received','Unit Cost','Subtotal', ...(po._stockAdded?['Sold / Left']:[])].map(h => (
                                      <th key={h} style={{ padding:'9px 14px', textAlign:'left', fontSize:10,
                                        fontWeight:700, color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.5px',
                                        borderBottom:'1px solid var(--border)' }}>{h}</th>
                                    ))}
                                  </tr>
                                </thead>
                                <tbody>
                                  {(po.Items||[]).length===0
                                    ? <tr><td colSpan={6} style={{ padding:'16px', textAlign:'center', color:'var(--text-muted)', fontSize:12 }}>No items</td></tr>
                                    : (po.Items||[]).map((item,i) => {
                                      const pid      = normalizeProductId(item.PerfumeId);
                                      const soldQty  = po._stockAdded ? (soldAfterPO[po.id]?.[pid]||0) : null;
                                      const ordered  = item.OrderedQuantity||0;
                                      const remaining = soldQty!==null ? ordered-soldQty : null;
                                      const pct      = soldQty!==null && ordered>0 ? Math.min(100,Math.round((soldQty/ordered)*100)) : 0;
                                      return (
                                        <tr key={i} style={{ borderBottom:'1px solid var(--border)' }}>
                                          <td style={{ padding:'9px 14px', fontSize:12, fontWeight:600, color:'var(--text-primary)' }}>
                                            {resolveItemName(item)}
                                          </td>
                                          <td style={{ padding:'9px 14px', fontSize:12, color:'var(--text-secondary)' }}>{ordered}</td>
                          <td style={{ padding:'9px 14px', fontSize:12, color:'var(--text-secondary)' }}>{item.ReceivedQuantity??'—'}</td>
                                          <td style={{ padding:'9px 14px', fontSize:12, color:'var(--text-secondary)' }}>₱{(item.UnitCost||0).toLocaleString()}</td>
                          <td style={{ padding:'9px 14px', fontSize:12, fontWeight:700, color:'var(--text-primary)' }}>
                            ₱{(ordered*(item.UnitCost||0)).toLocaleString()}
                          </td>
                                          {po._stockAdded && (
                                            <td style={{ padding:'9px 14px' }}>
                                              <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                                                <div style={{ width:60, height:5, borderRadius:3, background:'var(--bg-secondary)', overflow:'hidden' }}>
                                                  <div style={{ height:'100%', width:`${pct}%`, borderRadius:3,
                                                    background:pct===100?'var(--danger)':pct>0?'var(--warning)':'var(--accent)' }} />
                                                </div>
                                                <span style={{ fontSize:11, color:'var(--text-secondary)', whiteSpace:'nowrap' }}>
                                                  <span style={{ color:'var(--danger)', fontWeight:700 }}>{soldQty}</span> sold
                                                  {remaining>0 && <span style={{ color:'var(--accent)' }}> · {remaining} left</span>}
                                                </span>
                                              </div>
                                            </td>
                                          )}
                                        </tr>
                                      );
                                    })
                                  }
                                </tbody>
                              </table>
                            </div>

                            {/* Notes panel */}
                            {po.Notes && (
                              <div style={{ background:'var(--bg-card)', borderRadius:8, border:'1px solid var(--border)', padding:'14px 16px' }}>
                                <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:8,
                                  fontSize:11, fontWeight:700, color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.5px' }}>
                                  <FaStickyNote style={{ color:'var(--warning)' }} /> Notes
                                </div>
                                <div style={{ fontSize:12, color:'var(--text-secondary)', lineHeight:1.6 }}>{po.Notes}</div>
                              </div>
                            )}
                          </div>

                          {/* Bottle serials */}
                          {po._stockAdded && (() => {
                            const bottles = getBottleSerials(po);
                            if (!bottles.length) return null;
                            return (
                              <div style={{ marginTop:12, background:'var(--bg-card)', borderRadius:8,
                                border:'1px solid var(--border)', padding:'12px 16px' }}>
                                <div style={{ fontSize:11, fontWeight:700, color:'var(--text-muted)', textTransform:'uppercase',
                                  letterSpacing:'0.5px', marginBottom:8 }}>Bottle Serials</div>
                                <div style={{ display:'flex', flexWrap:'wrap', gap:5 }}>
                                  {bottles.map(b => (
                                    <span key={b.serial} title={b.name} style={{
                                      padding:'3px 9px', borderRadius:6, fontSize:10, fontWeight:600, fontFamily:'monospace',
                                      background:b.status==='sold'?'var(--danger-bg)':'var(--success-bg)',
                                      color:b.status==='sold'?'var(--danger)':'var(--accent)',
                                      textDecoration:b.status==='sold'?'line-through':'none' }}>
                                      {b.serial}
                                    </span>
                                  ))}
                                </div>
                                <div style={{ marginTop:8, fontSize:11, color:'var(--text-muted)' }}>
                                  <span style={{ color:'var(--accent)', fontWeight:700 }}>●</span> In stock &nbsp;
                                  <span style={{ color:'var(--danger)', fontWeight:700 }}>●</span> Sold
                                </div>
                              </div>
                            );
                          })()}
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
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

      {/* Add / Edit Modal */}
      <Modal isOpen={showModal} onClose={closeModal}
        title={editing ? 'Edit Purchase Order' : 'New Purchase Order'}
        icon={<FaFileInvoice />} maxWidth={680}>
        <Modal.Body>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14, marginBottom:20 }}>
            <div style={{ gridColumn:'1/-1', display:'flex', flexDirection:'column', gap:6 }}>
              <label style={lbl}>Supplier <span style={{ color:'var(--danger)' }}>*</span></label>
              <select value={form.SupplierId} onChange={e => setForm(f => ({ ...f, SupplierId:e.target.value }))} style={inp}>
                <option value="">Select supplier...</option>
                {suppliers.map(s => <option key={s.id} value={s.id}>{s.Name}</option>)}
              </select>
            </div>
            <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
              <label style={lbl}>Status</label>
              <select value={form.Status} onChange={e => setForm(f => ({ ...f, Status:e.target.value }))} style={inp}>
                {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
              <label style={lbl}>Invoice Number</label>
              <input value={form.InvoiceNumber} onChange={e => setForm(f => ({ ...f, InvoiceNumber:e.target.value }))} style={inp} />
            </div>
            <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
              <label style={lbl}>Order Date</label>
              <input type="date" value={form.OrderDate} onChange={e => setForm(f => ({ ...f, OrderDate:e.target.value }))} style={inp} />
            </div>
            <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
              <label style={lbl}>Delivery Date</label>
              <input type="date" value={form.DeliveryDate} onChange={e => setForm(f => ({ ...f, DeliveryDate:e.target.value }))} style={inp} />
            </div>
            <div style={{ gridColumn:'1/-1', display:'flex', flexDirection:'column', gap:6 }}>
              <label style={lbl}>Notes</label>
              <textarea value={form.Notes} onChange={e => setForm(f => ({ ...f, Notes:e.target.value }))} rows={2}
                style={{ ...inp, resize:'vertical', fontFamily:'inherit' }} />
            </div>
          </div>
          <div style={{ marginBottom:16 }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:10 }}>
              <span style={{ fontSize:13, fontWeight:700, color:'var(--text-secondary)' }}>Order Items</span>
              <button onClick={addItem} style={{ display:'flex', alignItems:'center', gap:5,
                padding:'6px 12px', background:'var(--accent-dim)', color:'var(--accent)',
                border:'none', borderRadius:6, fontSize:12, fontWeight:600, cursor:'pointer' }}>
                <FaPlus /> Add Item
              </button>
            </div>
            <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
              {form.Items.map((item,idx) => (
                <div key={idx} style={{ display:'grid', gridTemplateColumns:'2fr 1fr 1fr auto',
                  gap:8, alignItems:'center', padding:10, background:'var(--bg-secondary)', borderRadius:8, border:'1px solid var(--border)' }}>
                  <select value={item.PerfumeId} onChange={e => handleProductSelect(idx, e.target.value)} style={{ ...inp, margin:0 }}>
                    <option value="">Select product...</option>
                    {products.map(p => <option key={p.id} value={p.id}>{p.Name}</option>)}
                  </select>
                  <input type="number" min={1} placeholder="Qty" value={item.OrderedQuantity}
                    onChange={e => updateItem(idx,'OrderedQuantity',e.target.value)} style={{ ...inp, margin:0 }} />
                  <input type="number" min={0} placeholder="Unit Cost" value={item.UnitCost}
                    onChange={e => updateItem(idx,'UnitCost',e.target.value)} style={{ ...inp, margin:0 }} />
                  <button onClick={() => removeItem(idx)} disabled={form.Items.length===1}
                    style={{ padding:8, background:'var(--danger-bg)', color:'var(--danger)', border:'none',
                      borderRadius:6, cursor:form.Items.length===1?'not-allowed':'pointer',
                      opacity:form.Items.length===1?0.4:1 }}>
                    <FaTimes />
                  </button>
                </div>
              ))}
            </div>
            <div style={{ display:'flex', justifyContent:'flex-end', marginTop:10,
              padding:'10px 14px', background:'var(--bg-secondary)', borderRadius:8, border:'1px solid var(--border)' }}>
              <span style={{ fontSize:14, fontWeight:700, color:'var(--text-primary)' }}>
                Total: ₱{itemTotal(form.Items).toLocaleString('en-PH')}
              </span>
            </div>
          </div>
        </Modal.Body>
        <div style={{ padding:'16px 24px', borderTop:'1px solid var(--border)', display:'flex', justifyContent:'flex-end', gap:10 }}>
          <CancelButton onClick={closeModal} />
          <PrimaryButton onClick={handleSave} disabled={!form.SupplierId} loading={saving}>
            {editing ? 'Save Changes' : 'Create Order'}
          </PrimaryButton>
        </div>
      </Modal>

      {/* Confirm Delete */}
      <ConfirmDialog
        isOpen={!!confirmDelete}
        onClose={() => setConfirmDelete(null)}
        onConfirm={() => handleDelete(confirmDelete.id)}
        title="Delete Purchase Order?"
        message="This order will be permanently removed. This cannot be undone."
        confirmLabel="Yes, Delete" loading={saving}
      />
    </div>
  );
}

const lbl = { fontSize:12, fontWeight:600, color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.5px' };
const inp = { padding:'9px 12px', border:'1.5px solid var(--border)', borderRadius:6, fontSize:13,
  outline:'none', width:'100%', boxSizing:'border-box', fontFamily:'inherit',
  transition:'border-color 0.2s', background:'var(--bg-input)', color:'var(--text-primary)' };
