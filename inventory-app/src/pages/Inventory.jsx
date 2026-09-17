import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useData } from '../contexts/DataContext';
import { useSettings } from '../contexts/SettingsContext';
import { useToast } from '../components/shared/Toast';
import {
  FaPlus, FaEdit, FaTrash, FaExclamationTriangle, FaBoxes,
  FaHashtag, FaTh, FaList, FaSort, FaHome, FaShoppingCart,
  FaCashRegister, FaChartBar, FaArrowUp, FaArrowDown, FaSearch, FaUser,
  FaFlask, FaFileImport, FaUpload, FaBarcode
} from 'react-icons/fa';
import StatCard from '../components/shared/StatCard';
import SearchBar from '../components/shared/SearchBar';
import Pagination from '../components/shared/Pagination';
import BarcodeScanner from '../components/shared/BarcodeScanner';
import Modal, { CancelButton, PrimaryButton } from '../components/shared/Modal';
import ConfirmDialog from '../components/shared/ConfirmDialog';
import StatusBadge from '../components/shared/StatusBadge';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Link } from 'react-router-dom';
import Papa from 'papaparse';

const BASE_FORM = {
  Name:'', Brand:'', Category:'', Size:'85ml', Gender:'Unisex',
  BatchNumber:'', ExpirationDate:'', SupplierId:'',
  Stock:0, Image:''
};

const SORT_OPTIONS = [
  { value:'name-asc',    label:'Name A→Z' },
  { value:'name-desc',   label:'Name Z→A' },
  { value:'price-asc',   label:'Price Low→High' },
  { value:'price-desc',  label:'Price High→Low' },
  { value:'stock-asc',   label:'Stock Low→High' },
  { value:'stock-desc',  label:'Stock High→Low' },
];

function sortProducts(arr, sortBy) {
  const sorted = [...arr];
  switch (sortBy) {
    case 'name-asc':    return sorted.sort((a,b) => (a.Name||'').localeCompare(b.Name||''));
    case 'name-desc':   return sorted.sort((a,b) => (b.Name||'').localeCompare(a.Name||''));
    case 'price-asc':   return sorted.sort((a,b) => (a.SellingPrice||a.Price||0) - (b.SellingPrice||b.Price||0));
    case 'price-desc':  return sorted.sort((a,b) => (b.SellingPrice||b.Price||0) - (a.SellingPrice||a.Price||0));
    case 'stock-asc':   return sorted.sort((a,b) => (a.Stock||0) - (b.Stock||0));
    case 'stock-desc':  return sorted.sort((a,b) => (b.Stock||0) - (a.Stock||0));
    default:            return sorted;
  }
}

function getStockStatus(p) {
  const stock = p.Stock || 0;
  if (stock <= 0) return 'out of stock';
  if (stock <= (p.LowStockThreshold||10)) return 'low stock';
  return 'in stock';
}

function stockLabel(p) {
  const stock = p.Stock || 0;
  if (stock <= 0) return 'Out of Stock';
  if (stock <= (p.LowStockThreshold||10)) return `${stock} left`;
  return `${stock} in stock`;
}

function scentGradient(p) {
  const cat = String(p.Category || p.scent || p.ScentFamily || p.family || p.type || '').toLowerCase();
  if (/citrus|orange/.test(cat))                    return 'linear-gradient(135deg,#2a2010,#4a3520)';
  if (/fresh|aqua|marine|ocean|aquatic/.test(cat))  return 'linear-gradient(135deg,#134e3a,#0d3b2e)';
  if (/floral|rose|jasmine|lavender/.test(cat))     return 'linear-gradient(135deg,#1e3a5f,#1a2744)';
  if (/woody|oud|sandal|vetiver|patchouli/.test(cat)) return 'linear-gradient(135deg,#5b2d6e,#3d1f4e)';
  if (/oriental|amber|vanilla|spice|gourmand/.test(cat)) return 'linear-gradient(135deg,#4a3520,#2a2010)';
  return 'linear-gradient(135deg,#1f232b,#161820)';
}

const ChartTooltip = ({ active, payload, label }) =>
  (active && payload && payload.length) ? (
    <div style={{ background:'var(--chart-tooltip-bg)', border:'1px solid var(--border)',
      borderRadius:8, padding:'8px 12px', boxShadow:'0 8px 24px rgba(0,0,0,0.35)' }}>
      <div style={{ fontSize:11, color:'var(--chart-tooltip-sub)', marginBottom:2 }}>{label}</div>
      <div style={{ fontSize:13, fontWeight:700, color:'var(--chart-tooltip-text)' }}>
        {payload[0].value} units
      </div>
    </div>
  ) : null;

export default function Inventory() {
  const { products, suppliers, sales, loading, addProduct, updateProduct, deleteProduct, addTester, loadSales, addBulkProducts, applyStockAdjustments } = useData();
  const { settings } = useSettings();
  const { showToast } = useToast();
  const EMPTY_FORM = {
    ...BASE_FORM,
    CostPrice: settings.defaultPrices?.CostPrice ?? 145,
    SellingPrice: settings.defaultPrices?.SellingPrice ?? 220,
    ResellerPrice: settings.defaultPrices?.ResellerPrice ?? 150,
    Price60ml: settings.defaultPrices?.Price60ml ?? 175,
    Cost60ml: settings.defaultPrices?.Cost60ml ?? 125,
    LowStockThreshold: settings.lowStockThreshold ?? 10,
  };

  const [search, setSearch]           = useState('');
  const [sortBy, setSortBy]           = useState('name-asc');
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [brandFilter, setBrandFilter]       = useState('All');
  const [viewMode, setViewMode]       = useState('grid');
  const [showModal, setShowModal]     = useState(false);
  const [editing, setEditing]         = useState(null);
  const [form, setForm]               = useState(EMPTY_FORM);
  const [saving, setSaving]           = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [viewBottles, setViewBottles]     = useState(null);
  const [searchFocused, setSearchFocused] = useState(false);
  const searchRef = useRef(null);
  const [importType, setImportType] = useState(null); // 'products' or 'adjustments'
  const [importData, setImportData] = useState([]);
  const [importErrors, setImportErrors] = useState([]);
  const [importing, setImporting] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const fileInputRef = useRef(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [showScanner, setShowScanner] = useState(false);
  const [scannerTarget, setScannerTarget] = useState(null);

  useEffect(() => { loadSales(); }, [loadSales]);

  // Keyboard shortcut: / to focus search
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

  // Total bottles sold per product
  const soldCountMap = useMemo(() => {
    const map = {};
    const sorted = [...sales].sort((a, b) => {
      const da = a.SaleDate?.toDate ? a.SaleDate.toDate() : new Date(a.SaleDate || 0);
      const db = b.SaleDate?.toDate ? b.SaleDate.toDate() : new Date(b.SaleDate || 0);
      return da - db;
    });
    sorted.forEach(sale => {
      (sale.Items || []).forEach(item => {
        const pid = String(item.PerfumeId ?? item.ProductId ?? '');
        if (!pid) return;
        map[pid] = (map[pid] || 0) + (item.Quantity || 0);
      });
    });
    return map;
  }, [sales]);

  const getBottleNumbers = (product) => {
    const pid   = product.id;
    const sold  = soldCountMap[pid] || 0;
    const stock = product.Stock || 0;
    const nums  = [];
    for (let i = 1; i <= stock; i++) nums.push(sold + i);
    return { sold, nums };
  };

  // Derive filter options
  const categories = useMemo(() => {
    const set = new Set(products.map(p => p.Category).filter(Boolean));
    return ['All', ...Array.from(set).sort()];
  }, [products]);

  const brands = useMemo(() => {
    const set = new Set(products.map(p => p.Brand).filter(Boolean));
    return ['All', ...Array.from(set).sort()];
  }, [products]);

  // Filter + sort
  const filtered = useMemo(() => {
    let list = products;
    const q = search.toLowerCase();
    if (q) {
      list = list.filter(p =>
        p.Name?.toLowerCase().includes(q) ||
        p.Brand?.toLowerCase().includes(q) ||
        p.Category?.toLowerCase().includes(q) ||
        p.BatchNumber?.toLowerCase().includes(q)
      );
    }
    if (categoryFilter !== 'All') list = list.filter(p => p.Category === categoryFilter);
    if (brandFilter !== 'All')    list = list.filter(p => p.Brand === brandFilter);
    return sortProducts(list, sortBy);
  }, [products, search, categoryFilter, brandFilter, sortBy]);

  const totalStockValue  = useMemo(() => products.reduce((s, p) => s + (p.Stock||0)*(p.CostPrice||0), 0), [products]);
  const potentialRevenue = useMemo(() => products.reduce((s, p) => s + (p.Stock||0)*(p.SellingPrice||p.Price||0), 0), [products]);
  const lowStockCount    = useMemo(() => products.filter(p => (p.Stock||0) <= (p.LowStockThreshold||10) && (p.Stock||0) > 0).length, [products]);

  const paginatedProducts = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, page, pageSize]);

  useEffect(() => { setPage(1); }, [search, categoryFilter, brandFilter, sortBy]);

  const openScanner = (target) => { setScannerTarget(target); setShowScanner(true); };

  const handleBarcodeScan = (code) => {
    const found = products.find(p =>
      p.BatchNumber?.toLowerCase() === code.toLowerCase() ||
      p.SKU?.toLowerCase() === code.toLowerCase() ||
      p.id?.toLowerCase() === code.toLowerCase()
    );
    if (found) {
      if (scannerTarget === 'search') {
        setSearch(found.BatchNumber || found.Name);
        showToast(`Found: ${found.Name}`, 'success');
      } else {
        openEdit(found);
        showToast(`Opened: ${found.Name}`, 'success');
      }
    } else {
      showToast(`No product found for barcode: ${code}`, 'error');
    }
  };

  const categoryData = useMemo(() => {
    const catMap = {};
    products.forEach(p => {
      const cat = p.Category || 'Other';
      catMap[cat] = (catMap[cat] || 0) + (p.Stock || 0);
    });
    return Object.entries(catMap).map(([name, value]) => ({ name, value }));
  }, [products]);

  const getEmptyForm = () => ({
    ...BASE_FORM,
    CostPrice: settings.defaultPrices.CostPrice,
    SellingPrice: settings.defaultPrices.SellingPrice,
    ResellerPrice: settings.defaultPrices.ResellerPrice,
    Price60ml: settings.defaultPrices.Price60ml,
    Cost60ml: settings.defaultPrices.Cost60ml,
    LowStockThreshold: settings.lowStockThreshold,
  });
  const openAdd  = () => { setEditing(null); setForm(getEmptyForm()); setShowModal(true); };
  const openEdit = (p) => {
    setEditing(p);
    setForm({
      Name: p.Name||'', Brand: p.Brand||'', Category: p.Category||'',
      Size: p.Size||'', Gender: p.Gender||'Unisex',
      BatchNumber: p.BatchNumber||'', ExpirationDate: p.ExpirationDate||'',
      SupplierId: p.SupplierId||'',
      CostPrice: p.CostPrice||0, SellingPrice: p.SellingPrice||p.Price||0,
      ResellerPrice: p.ResellerPrice||150, Price60ml: p.Price60ml||175, Cost60ml: p.Cost60ml||125,
      Stock: p.Stock||0, LowStockThreshold: p.LowStockThreshold||10, Image: p.Image||''
    });
    setShowModal(true);
  };
  const closeModal = () => { setShowModal(false); setEditing(null); };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (editing) await updateProduct(editing.id, form);
      else await addProduct(form);
      closeModal();
    } catch (err) { console.error(err); showToast('Failed to save product', 'error'); }
    finally { setSaving(false); }
  };

  const handleDelete = async (id) => {
    try { await deleteProduct(id); }
    catch (e) { console.error(e); }
    finally { setConfirmDelete(null); }
  };

  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const { data, errors } = results;
        if (errors.length > 0) {
          showToast('CSV parsing errors: ' + errors.map(e => e.message).join(', '), 'error');
          return;
        }
        
        const validatedData = [];
        const validationErrors = [];
        
        data.forEach((row, index) => {
          if (importType === 'products') {
            if (!row.Name || !row.SKU) {
              validationErrors.push({ row: index + 1, error: 'Name and SKU are required' });
              return;
            }
            validatedData.push({
              Name: row.Name,
              Brand: row.Brand || '',
              Category: row.Category || '',
              CostPrice: parseFloat(row.CostPrice) || 0,
              SellingPrice: parseFloat(row.SellingPrice) || 0,
              ResellerPrice: parseFloat(row.ResellerPrice) || 0,
              Price60ml: parseFloat(row.Price60ml) || 0,
              Cost60ml: parseFloat(row.Cost60ml) || 0,
              Stock: parseInt(row.StockQty) || 0,
              BatchNumber: row.BatchNumber || '',
              ExpirationDate: row.ExpiryDate || '',
            });
          } else {
            if (!row.SKU || !row.Adjustment) {
              validationErrors.push({ row: index + 1, error: 'SKU and Adjustment are required' });
              return;
            }
            validatedData.push({
              SKU: row.SKU,
              Adjustment: parseInt(row.Adjustment) || 0,
              Notes: row.Notes || '',
            });
          }
        });
        
        setImportData(validatedData);
        setImportErrors(validationErrors);
        setShowImportModal(true);
      },
      error: (error) => {
        showToast('Error reading CSV file: ' + error.message, 'error');
      }
    });
    
    e.target.value = '';
  };

  const handleImportConfirm = async () => {
    setImporting(true);
    try {
      let result;
      if (importType === 'products') {
        result = await addBulkProducts(importData);
      } else {
        result = await applyStockAdjustments(importData);
      }
      
      if (result.errors.length > 0) {
        showToast(`Imported ${result.success} items, ${result.errors.length} errors`, 'info');
      } else {
        showToast(`Successfully imported ${result.success} items`, 'success');
      }
      
      setShowImportModal(false);
      setImportData([]);
      setImportErrors([]);
    } catch (error) {
      showToast('Import failed: ' + error.message, 'error');
    } finally {
      setImporting(false);
    }
  };

  const handleAutoCreateTester = async (product) => {
    try {
      await addTester({
        Name: product.Name,
        Brand: product.Brand || '',
        Category: product.Category || '',
        ProductId: product.id,
        CostPrice: product.CostPrice || 0,
        Status: 'Available',
        Notes: `Auto-created from product: ${product.Name}`,
      });
      showToast(`Tester created for ${product.Name}`, 'success');
    } catch (e) {
      console.error(e);
      showToast('Failed to create tester', 'error');
    }
  };

  // ── Loading skeleton (#3) ────────────────────────────────
  if (loading) return (
    <div className="inventory-page">
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(180px, 1fr))', gap:16, marginBottom:24 }}>
        {[1,2,3,4].map(i => <div key={i} className="skeleton" style={{ height:100, borderRadius:14 }} />)}
      </div>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(200px, 1fr))', gap:18 }}>
        {[1,2,3,4,5,6].map(i => <div key={i} className="skeleton" style={{ height:300, borderRadius:16 }} />)}
      </div>
    </div>
  );

  // ── Empty state CTA (#7) ─────────────────────────────────
  if (!products.length) return (
    <div className="inventory-page" style={{ background:'var(--bg-card)', border:'1px solid var(--border)', borderRadius:16, padding:'64px 32px', textAlign:'center',
      boxShadow:'0 2px 16px rgba(0,0,0,0.2)' }}>
      <div style={{ width:72, height:72, borderRadius:'50%', background:'var(--accent-dim)',
        display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 20px' }}>
        <FaBoxes style={{ fontSize:32, color:'var(--accent)' }} />
      </div>
      <h2 style={{ fontSize:22, fontWeight:800, color:'var(--text-primary)', marginBottom:8 }}>No products yet</h2>
      <p style={{ color:'var(--text-muted)', fontSize:14, marginBottom:24, maxWidth:360, margin:'0 auto 24px' }}>
        Add your first product to start tracking inventory, sales, and bottle numbers.
      </p>
      <button onClick={openAdd} style={{
        display:'inline-flex', alignItems:'center', gap:8, padding:'12px 24px',
        background:'var(--accent)', color:'#0f172a',
        border:'none', borderRadius:12, fontSize:14, fontWeight:700, cursor:'pointer',
        boxShadow:'0 4px 20px var(--accent-glow)', transition:'transform 0.15s' }}
        onMouseEnter={e => e.currentTarget.style.transform='translateY(-2px)'}
        onMouseLeave={e => e.currentTarget.style.transform='none'}>
        <FaPlus /> Add Your First Product
      </button>
    </div>
  );

  return (
    <div className="inventory-page">
      {/* Header */}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:24, flexWrap:'wrap', gap:16 }}>
        <div>
          <h1 style={{ fontSize:24, fontWeight:800, color:'var(--text-primary)', marginBottom:4 }}>Inventory</h1>
          <p style={{ color:'var(--text-secondary)', fontSize:13 }}>{filtered.length} of {products.length} products</p>
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:12, flexWrap:'wrap' }}>

          <div style={{ display:'flex', background:'var(--bg-card)', borderRadius:10, padding:'8px 12px',
            border:`1.5px solid ${searchFocused ? 'var(--accent)' : 'var(--border)'}`,
            boxShadow:'0 2px 8px rgba(0,0,0,0.2)', alignItems:'center', gap:8, minWidth:200,
            transition:'border-color 0.15s' }}>
            <FaSearch style={{ color:'var(--text-muted)', fontSize:13 }} />
            <input ref={searchRef} value={search} onChange={e => setSearch(e.target.value)}
              onFocus={() => setSearchFocused(true)}
              onBlur={() => setSearchFocused(false)}
              placeholder="Search... (press /)"
              style={{ border:'none', outline:'none', fontSize:13, flex:1, background:'transparent',
                color:'var(--text-primary)', caretColor:'var(--accent)' }} />
          </div>
          <button onClick={() => openScanner('search')} style={{ display:'flex', alignItems:'center', gap:8, padding:'10px 18px',
            background:'rgba(255,255,255,0.06)', color:'var(--text-secondary)',
            border:'1px solid var(--border)', borderRadius:10, fontSize:13, fontWeight:700,
            cursor:'pointer', transition:'all 0.2s' }}
            onMouseEnter={e => e.currentTarget.style.background='rgba(255,255,255,0.12)'}
            onMouseLeave={e => e.currentTarget.style.background='rgba(255,255,255,0.06)'}>
            <FaBarcode /> Scan
          </button>
          <button onClick={openAdd} style={{ display:'flex', alignItems:'center', gap:8, padding:'10px 18px', background:'var(--accent)', color:'#0f172a', border:'none', borderRadius:10, fontSize:13, fontWeight:700, cursor:'pointer', transition:'all 0.2s' }}
            onMouseEnter={e => e.currentTarget.style.background='rgba(45,212,191,0.85)'}
            onMouseLeave={e => e.currentTarget.style.background='var(--accent)'}>
            <FaPlus /> Add Product
          </button>
          <input type="file" ref={fileInputRef} accept=".csv" onChange={handleFileSelect} style={{ display:'none' }} />
          <button onClick={() => { setImportType('products'); fileInputRef.current?.click(); }}
            style={{ display:'flex', alignItems:'center', gap:8, padding:'10px 18px', 
              background:'rgba(255,255,255,0.06)', color:'var(--text-secondary)', 
              border:'1px solid var(--border)', borderRadius:10, fontSize:13, fontWeight:700, 
              cursor:'pointer', transition:'all 0.2s' }}
            onMouseEnter={e => e.currentTarget.style.background='rgba(255,255,255,0.12)'}
            onMouseLeave={e => e.currentTarget.style.background='rgba(255,255,255,0.06)'}>
            <FaFileImport /> Import CSV
          </button>
          <button onClick={() => { setImportType('adjustments'); fileInputRef.current?.click(); }}
            style={{ display:'flex', alignItems:'center', gap:8, padding:'10px 18px', 
              background:'rgba(255,255,255,0.06)', color:'var(--text-secondary)', 
              border:'1px solid var(--border)', borderRadius:10, fontSize:13, fontWeight:700, 
              cursor:'pointer', transition:'all 0.2s' }}
            onMouseEnter={e => e.currentTarget.style.background='rgba(255,255,255,0.12)'}
            onMouseLeave={e => e.currentTarget.style.background='rgba(255,255,255,0.06)'}>
            <FaUpload /> Import Adjustments
          </button>
        </div>
      </div>

      {/* Stat Cards - Cash Flow Style */}
      <div className="stat-cashflow-grid">
        <div className="stat-cashflow" style={{ background:'var(--bg-card)', border:'1px solid var(--border)', borderRadius:12 }}>
          <div className="stat-cashflow-icon" style={{ background:'var(--accent-dim)', color:'var(--accent)' }}>
            <FaBoxes />
          </div>
          <div className="stat-cashflow-value">₱{totalStockValue.toLocaleString('en-PH')}</div>
          <div className="stat-cashflow-label">Stock Value</div>
        </div>
        <div className="stat-cashflow" style={{ background:'var(--bg-card)', border:'1px solid var(--border)', borderRadius:12 }}>
          <div className="stat-cashflow-icon" style={{ background:'rgba(255,255,255,0.06)', color:'var(--text-secondary)' }}>
            <FaBoxes />
          </div>
          <div className="stat-cashflow-value">{products.length}</div>
          <div className="stat-cashflow-label">Total Items</div>
        </div>
        <div className="stat-cashflow" style={{ background:'var(--bg-card)', border:'1px solid var(--border)', borderRadius:12 }}>
          <div className="stat-cashflow-icon" style={{ background:'var(--warning-bg)', color:'var(--warning)' }}>
            <FaExclamationTriangle />
          </div>
          <div className="stat-cashflow-value" style={{ color:'var(--warning)' }}>{lowStockCount}</div>
          <div className="stat-cashflow-label">Low Stock</div>
        </div>
        <div className="stat-cashflow" style={{ background:'var(--bg-card)', border:'1px solid var(--border)', borderRadius:12 }}>
          <div className="stat-cashflow-icon" style={{ background:'var(--accent-dim)', color:'var(--accent)' }}>
            <FaArrowUp />
          </div>
          <div className="stat-cashflow-value">₱{potentialRevenue.toLocaleString('en-PH')}</div>
          <div className="stat-cashflow-label">Revenue Potential</div>
        </div>
      </div>

      {/* Charts Section */}
      <div className="chart-grid">
        <div className="chart-card">
          <h3 style={{ fontSize:14, fontWeight:700, color:'var(--text-primary)', marginBottom:16 }}>Stock by Category</h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={categoryData}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis dataKey="name" tick={{ fontSize:11, fill:'#94a3b8' }} stroke="rgba(255,255,255,0.08)" />
              <YAxis tick={{ fontSize:11, fill:'#94a3b8' }} stroke="rgba(255,255,255,0.08)" />
              <Tooltip content={<ChartTooltip />} cursor={{ fill:'rgba(255,255,255,0.04)' }} />
              <Bar dataKey="value" fill="#2dd4bf" radius={[4,4,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="chart-card">
          <h3 style={{ fontSize:14, fontWeight:700, color:'var(--text-primary)', marginBottom:16 }}>Low Stock Alerts</h3>
          {products.filter(p => (p.Stock||0) <= (p.LowStockThreshold||10) && (p.Stock||0) > 0).slice(0,5).map(p => (
            <div key={p.id} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'10px 0', borderBottom:'1px solid var(--border)' }}>
              <div>
                <div style={{ fontSize:13, fontWeight:600, color:'var(--text-primary)' }}>{p.Name}</div>
                <div style={{ fontSize:11, color:'var(--text-muted)' }}>{p.Brand}</div>
              </div>
              <StatusBadge status="low stock" label={`${p.Stock} left`} />
            </div>
          ))}
          {products.filter(p => (p.Stock||0) <= (p.LowStockThreshold||10) && (p.Stock||0) > 0).length === 0 && (
            <div style={{ textAlign:'center', color:'var(--text-muted)', fontSize:13, padding:20 }}>No low stock alerts</div>
          )}
        </div>
      </div>

      {/* Filters Row */}
      <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:20, flexWrap:'wrap' }}>
        <select value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)}
          onFocus={e => e.target.style.borderColor='var(--accent)'}
          onBlur={e => e.target.style.borderColor='var(--border)'}
          style={{ padding:'8px 12px', border:'1.5px solid var(--border)', borderRadius:10, fontSize:12, fontWeight:600, cursor:'pointer', background:'var(--bg-input)', color:'var(--text-primary)', outline:'none' }}>
          {categories.map(c => <option key={c} value={c}>{c === 'All' ? 'All Categories' : c}</option>)}
        </select>
        <select value={brandFilter} onChange={e => setBrandFilter(e.target.value)}
          onFocus={e => e.target.style.borderColor='var(--accent)'}
          onBlur={e => e.target.style.borderColor='var(--border)'}
          style={{ padding:'8px 12px', border:'1.5px solid var(--border)', borderRadius:10, fontSize:12, fontWeight:600, cursor:'pointer', background:'var(--bg-input)', color:'var(--text-primary)', outline:'none' }}>
          {brands.map(b => <option key={b} value={b}>{b === 'All' ? 'All Brands' : b}</option>)}
        </select>
        <div style={{ display:'flex', background:'var(--bg-card)', border:'1px solid var(--border)', borderRadius:10, overflow:'hidden', boxShadow:'0 2px 8px rgba(0,0,0,0.2)', marginLeft:'auto' }}>
          <button onClick={() => setViewMode('grid')} style={{ padding:'8px 10px', border:'none', cursor:'pointer', fontSize:13, background: viewMode === 'grid' ? 'var(--accent)' : 'transparent', color: viewMode === 'grid' ? '#0f172a' : 'var(--text-muted)', transition:'background 0.15s, color 0.15s' }}>
            <FaTh />
          </button>
          <button onClick={() => setViewMode('table')} style={{ padding:'8px 10px', border:'none', cursor:'pointer', fontSize:13, background: viewMode === 'table' ? 'var(--accent)' : 'transparent', color: viewMode === 'table' ? '#0f172a' : 'var(--text-muted)', transition:'background 0.15s, color 0.15s' }}>
            <FaList />
          </button>
        </div>
      </div>

      {/* Sort row */}
      <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:20, flexWrap:'wrap' }}>
        <FaSort style={{ color:'var(--text-muted)', fontSize:13 }} />
        <div style={{ display:'flex', background:'var(--bg-card)', border:'1px solid var(--border)', borderRadius:10, overflow:'hidden',
          boxShadow:'0 1px 6px rgba(0,0,0,0.2)' }}>
          {SORT_OPTIONS.slice(0,4).map(o => (
            <button key={o.value} onClick={() => setSortBy(o.value)} style={{
              padding:'7px 12px', border:'none', fontSize:11, fontWeight:600, cursor:'pointer',
              background: sortBy === o.value ? 'var(--accent)' : 'transparent',
              color: sortBy === o.value ? '#0f172a' : 'var(--text-secondary)',
              transition:'all 0.2s', whiteSpace:'nowrap' }}>
              {o.label}
            </button>
          ))}
          {sortBy.includes('stock') && (
            <button style={{
              padding:'7px 12px', border:'none', fontSize:11, fontWeight:600, cursor:'pointer',
              background:'var(--accent)', color:'#0f172a', whiteSpace:'nowrap' }}>
              {sortBy === 'stock-asc' ? 'Stock ↑' : 'Stock ↓'}
            </button>
          )}
        </div>
      </div>

      {/* Products: Grid or Table */}
      {filtered.length === 0 ? (
        <div style={{ background:'var(--bg-card)', border:'1px solid var(--border)', borderRadius:16, padding:'48px 20px', textAlign:'center',
          color:'var(--text-muted)', fontSize:14, boxShadow:'0 2px 16px rgba(0,0,0,0.2)' }}>
          {search || categoryFilter !== 'All' || brandFilter !== 'All'
            ? 'No products match your filters'
            : 'No products yet — add one to get started'}
        </div>
      ) : viewMode === 'grid' ? (
        /* ── Grid View ── */
        <>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(200px, 1fr))', gap:18,
          gridAutoRows:'minmax(300px, auto)' }}>
          {paginatedProducts.map(p => {
            const isLow = (p.Stock||0) <= (p.LowStockThreshold||10) && (p.Stock||0) > 0;
            const { sold, nums } = getBottleNumbers(p);
            const nextBottle = sold + 1;
            const lastBottle = sold + (p.Stock || 0);
            const imgSrc = (p.ImagePath || p.Image)
              ? `https://scnt-vault.web.app/${p.ImagePath || p.Image}`
              : 'https://scnt-vault.web.app/images/scnt_default.png';
            return (
              <div key={p.id} style={{ background:'var(--bg-card)', border:'1px solid var(--border)', borderRadius:12, overflow:'hidden',
                boxShadow: isLow ? '0 0 0 2px var(--warning), 0 4px 20px rgba(245,158,11,0.15)' : '0 2px 12px rgba(0,0,0,0.2)',
                transition:'transform 0.2s, box-shadow 0.2s', display:'flex', flexDirection:'column' }}
                onMouseEnter={e => { e.currentTarget.style.transform='translateY(-3px)'; }}
                onMouseLeave={e => { e.currentTarget.style.transform='none'; }}>
                {/* Swatch + Image */}
                <div style={{ background:scentGradient(p), height:160, display:'flex', alignItems:'center',
                  justifyContent:'center', padding:12, position:'relative' }}>
                  <img src={imgSrc} alt={p.Name}
                    style={{ maxHeight:'100%', maxWidth:'100%', objectFit:'contain' }}
                    onError={e => { e.target.src='https://scnt-vault.web.app/images/scnt_default.png'; }} />
                  <div style={{ position:'absolute', top:8, right:8 }}>
                    <StatusBadge status={getStockStatus(p)} label={stockLabel(p)} />
                  </div>
                  <div className={`badge ${p.Gender==='Men' ? 'badge-men' : p.Gender==='Women' ? 'badge-women' : 'badge-unisex'}`}
                    style={{ position:'absolute', top:8, left:8 }}>
                    {p.Gender || 'Unisex'}
                  </div>
                </div>
                {/* Info */}
                <div style={{ padding:'12px 14px', flex:1, display:'flex', flexDirection:'column', gap:4 }}>
                  <div style={{ fontSize:13, fontWeight:800, color:'var(--text-primary)', lineHeight:1.3,
                    overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                    {p.Name}
                  </div>
                  <div style={{ fontSize:11, color:'var(--text-muted)',
                    overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                    {p.Brand} {p.Category ? `\u00B7 ${p.Category}` : ''}
                  </div>
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginTop:4 }}>
                    <span style={{ fontSize:14, fontWeight:800, color:'var(--accent)' }}>
                      ₱{(p.SellingPrice||p.Price||0).toLocaleString()}
                    </span>
                    <span style={{ fontSize:11, color:'var(--text-muted)' }}>
                      cost ₱{(p.CostPrice||0).toLocaleString()}
                    </span>
                  </div>
                  {(p.Stock||0) > 0 && (
                    <button onClick={() => setViewBottles(p)} style={{
                      marginTop:4, padding:'4px 0', borderRadius:8, fontSize:11, fontWeight:600,
                      background:'var(--accent-dim)', color:'var(--accent)', border:'none', cursor:'pointer',
                      display:'flex', alignItems:'center', justifyContent:'center', gap:4, transition:'background 0.15s' }}
                      onMouseEnter={e => e.currentTarget.style.background='rgba(45,212,191,0.2)'}
                      onMouseLeave={e => e.currentTarget.style.background='var(--accent-dim)'}>
                      <FaHashtag style={{ fontSize:9 }} />
                      {nums.length === 1
                        ? `#${String(nextBottle).padStart(4,'0')}`
                        : `#${String(nextBottle).padStart(4,'0')} – #${String(lastBottle).padStart(4,'0')}`}
                    </button>
                  )}
                  {p.BatchNumber && (
                    <div style={{ fontSize:10, color:'var(--text-muted)', fontFamily:'monospace', marginTop:2 }}>
                      Batch: {p.BatchNumber}
                    </div>
                  )}
                </div>
                {/* Actions */}
                <div style={{ padding:'10px 14px', borderTop:'1px solid var(--border)', display:'flex', gap:8 }}>
                  <button onClick={() => handleAutoCreateTester(p)} title="Create Tester from Product"
                    style={{ padding:'7px 10px', background:'rgba(167,139,250,0.12)', color:'#a78bfa',
                      border:'none', borderRadius:10, fontSize:12, cursor:'pointer',
                      display:'flex', alignItems:'center', justifyContent:'center',
                      transition:'background 0.15s' }}
                    onMouseEnter={e => e.currentTarget.style.background='rgba(167,139,250,0.2)'}
                    onMouseLeave={e => e.currentTarget.style.background='rgba(167,139,250,0.12)'}>
                    <FaFlask style={{ fontSize:10 }} />
                  </button>
                  <button onClick={() => openEdit(p)} style={{
                    flex:1, padding:'7px 0', background:'rgba(255,255,255,0.06)', color:'var(--text-secondary)',
                    border:'none', borderRadius:10, fontSize:12, fontWeight:700,
                    cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:5,
                    transition:'background 0.15s' }}
                    onMouseEnter={e => e.currentTarget.style.background='rgba(255,255,255,0.12)'}
                    onMouseLeave={e => e.currentTarget.style.background='rgba(255,255,255,0.06)'}>
                    <FaEdit /> Edit
                  </button>
                  <button onClick={() => setConfirmDelete(p)} style={{
                    padding:'7px 12px', background:'var(--danger-bg)', color:'var(--danger)',
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
        /* ── Table View (#6) ── */
        <>
        <div style={{ background:'var(--bg-card)', border:'1px solid var(--border)', borderRadius:12, overflow:'hidden',
          boxShadow:'0 2px 12px rgba(0,0,0,0.2)' }}>
          <div style={{ overflowX:'auto' }}>
            <table className="data-table" style={{ width:'100%', borderCollapse:'collapse' }}>
              <thead>
                <tr>
                  <th style={{ padding:'12px 16px', textAlign:'left', fontSize:11, fontWeight:700,
                    color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.5px' }}>Product</th>
                  <th style={{ padding:'12px 16px', textAlign:'left', fontSize:11, fontWeight:700,
                    color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.5px' }}>Brand</th>
                  <th style={{ padding:'12px 16px', textAlign:'left', fontSize:11, fontWeight:700,
                    color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.5px' }}>Category</th>
                  <th style={{ padding:'12px 16px', textAlign:'left', fontSize:11, fontWeight:700,
                    color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.5px' }}>Gender</th>
                  <th style={{ padding:'12px 16px', textAlign:'right', fontSize:11, fontWeight:700,
                    color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.5px' }}>Price</th>
                  <th style={{ padding:'12px 16px', textAlign:'right', fontSize:11, fontWeight:700,
                    color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.5px' }}>Stock</th>
                  <th style={{ padding:'12px 16px', textAlign:'center', fontSize:11, fontWeight:700,
                    color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.5px' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {paginatedProducts.map(p => {
                  const isLow = (p.Stock||0) <= (p.LowStockThreshold||10) && (p.Stock||0) > 0;
                  const { sold } = getBottleNumbers(p);
                  return (
                    <tr key={p.id} className={isLow ? 'low-stock-row' : undefined}>
                      <td style={{ padding:'10px 16px', fontSize:13, fontWeight:600 }}>
                        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                          <img src={(p.ImagePath||p.Image) ? `https://scnt-vault.web.app/${p.ImagePath||p.Image}` : 'https://scnt-vault.web.app/images/scnt_default.png'}
                            alt="" style={{ width:32, height:32, borderRadius:6, objectFit:'cover', background:scentGradient(p) }}
                            onError={e => { e.target.src='https://scnt-vault.web.app/images/scnt_default.png'; }} />
                          <span>{p.Name}</span>
                        </div>
                      </td>
                      <td style={{ padding:'10px 16px', fontSize:13, color:'var(--text-secondary)' }}>{p.Brand}</td>
                      <td style={{ padding:'10px 16px', fontSize:13, color:'var(--text-secondary)' }}>{p.Category}</td>
                      <td style={{ padding:'10px 16px', fontSize:12, fontWeight:600 }}>
                        <span className={`badge ${p.Gender==='Men' ? 'badge-men' : p.Gender==='Women' ? 'badge-women' : 'badge-unisex'}`}>
                          {p.Gender || 'Unisex'}
                        </span>
                      </td>
                      <td style={{ padding:'10px 16px', fontSize:13, fontWeight:700, color:'var(--accent)', textAlign:'right' }}>
                        ₱{(p.SellingPrice||p.Price||0).toLocaleString()}
                      </td>
                      <td style={{ padding:'10px 16px', textAlign:'right' }}>
                        <StatusBadge status={getStockStatus(p)} label={stockLabel(p)} />
                      </td>
                      <td style={{ padding:'10px 16px', textAlign:'center' }}>
                        <div style={{ display:'flex', gap:6, justifyContent:'center' }}>
                          <button className="btn-icon" onClick={() => handleAutoCreateTester(p)} title="Create Tester"
                            style={{ padding:'5px 8px', background:'rgba(167,139,250,0.12)', color:'#a78bfa',
                              border:'none', borderRadius:7, cursor:'pointer', fontSize:12 }}
                            onMouseEnter={e => e.currentTarget.style.background='rgba(167,139,250,0.2)'}
                            onMouseLeave={e => e.currentTarget.style.background='rgba(167,139,250,0.12)'}>
                            <FaFlask />
                          </button>
                          <button className="btn-icon btn-edit" onClick={() => openEdit(p)} title="Edit">
                            <FaEdit />
                          </button>
                          <button className="btn-icon btn-delete" onClick={() => setConfirmDelete(p)} title="Delete">
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

      {/* Bottle Numbers Modal (shared Modal) */}
      {viewBottles && (() => {
        const { sold, nums } = getBottleNumbers(viewBottles);
        return (
          <Modal isOpen={true} onClose={() => setViewBottles(null)}
            title={viewBottles.Name} icon={<FaHashtag />}
            gradient="var(--accent-gradient)" maxWidth={560}>
            <Modal.Body padding={0}>
              <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)',
                borderBottom:'1px solid var(--border)' }}>
                {[
                  { label:'Total Produced', value: sold + (viewBottles.Stock||0), color:'var(--info)' },
                  { label:'Sold',           value: sold,                           color:'var(--danger)' },
                  { label:'In Stock',       value: viewBottles.Stock || 0,         color:'var(--accent)' },
                ].map(s => (
                  <div key={s.label} style={{ padding:'12px 20px', textAlign:'center',
                    borderRight:'1px solid var(--border)' }}>
                    <div style={{ fontSize:10, color:'var(--text-muted)', fontWeight:600,
                      textTransform:'uppercase', letterSpacing:'0.5px', marginBottom:4 }}>{s.label}</div>
                    <div style={{ fontSize:22, fontWeight:800, color:s.color }}>{s.value}</div>
                  </div>
                ))}
              </div>
              <div style={{ padding:24 }}>
                {sold > 0 && (
                  <div style={{ marginBottom:16 }}>
                    <div style={{ fontSize:11, fontWeight:700, color:'var(--text-muted)', textTransform:'uppercase',
                      letterSpacing:'0.5px', marginBottom:8 }}>Sold Bottles</div>
                    <div style={{ display:'flex', flexWrap:'wrap', gap:6 }}>
                      {Array.from({ length: sold }, (_, i) => (
                        <span key={i} style={{ padding:'3px 10px', borderRadius:6, fontSize:12,
                          fontWeight:600, fontFamily:'monospace',
                          background:'var(--danger-bg)', color:'var(--danger)', textDecoration:'line-through' }}>
                          #{String(i + 1).padStart(4, '0')}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                {nums.length > 0 && (
                  <div>
                    <div style={{ fontSize:11, fontWeight:700, color:'var(--text-muted)', textTransform:'uppercase',
                      letterSpacing:'0.5px', marginBottom:8 }}>In Stock</div>
                    <div style={{ display:'flex', flexWrap:'wrap', gap:6 }}>
                      {nums.map(n => (
                        <span key={n} style={{ padding:'3px 10px', borderRadius:6, fontSize:12,
                          fontWeight:600, fontFamily:'monospace',
                          background:'var(--success-bg)', color:'var(--accent)' }}>
                          #{String(n).padStart(4, '0')}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                {sold === 0 && nums.length === 0 && (
                  <div style={{ textAlign:'center', color:'var(--text-muted)', fontSize:13, padding:20 }}>
                    No bottles to display
                  </div>
                )}
              </div>
            </Modal.Body>
          </Modal>
        );
      })()}

      {/* Add / Edit Modal (shared Modal) */}
      <Modal isOpen={showModal} onClose={closeModal}
        title={editing ? 'Edit Product' : 'Add New Product'} icon={<FaBoxes />}
        maxWidth={640}>
        <form onSubmit={handleSave}>
          <Modal.Body>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14 }}>
              {[
                { key:'Name',     label:'Product Name', required:true, col:2 },
                { key:'Brand',    label:'Brand',        required:true },
                { key:'Category', label:'Category',     placeholder:'e.g. Floral, Woody' },
                { key:'Size',     label:'Size',         placeholder:'e.g. 85ml, 60ml' },
                { key:'BatchNumber', label:'Batch Number' },
                { key:'ExpirationDate', label:'Expiration Date', type:'date' },
                { key:'CostPrice',    label:'Cost Price (₱)',    type:'number', step:'0.01', required:true },
                { key:'SellingPrice', label:'Selling Price (₱)', type:'number', step:'0.01', required:true },
                { key:'ResellerPrice',label:'Reseller Price (₱)',type:'number', step:'0.01' },
                { key:'Price60ml',    label:'60ml Price (₱)',    type:'number', step:'0.01' },
                { key:'Stock',        label:'Stock Level',       type:'number', required:true },
                { key:'LowStockThreshold', label:'Low Stock Threshold', type:'number' },
              ].map(({ key, label, required, col, type='text', step, placeholder }) => (
                <div key={key} style={{ display:'flex', flexDirection:'column', gap:6,
                  gridColumn: col === 2 ? '1/-1' : undefined }}>
                  <label style={{ fontSize:12, fontWeight:600, color:'var(--text-muted)',
                    textTransform:'uppercase', letterSpacing:'0.5px' }}>
                    {label}{required && <span style={{ color:'var(--danger)' }}> *</span>}
                  </label>
                  <input type={type} step={step} required={required} placeholder={placeholder}
                    value={form[key]}
                    onChange={e => setForm(f => ({ ...f, [key]: type === 'number' ? (step ? parseFloat(e.target.value)||0 : parseInt(e.target.value)||0) : e.target.value }))}
                    style={{ padding:'9px 12px', border:'1.5px solid var(--border)', borderRadius:8,
                      fontSize:13, outline:'none', width:'100%', boxSizing:'border-box',
                      fontFamily:'inherit', transition:'border-color 0.2s',
                      background:'var(--bg-input)', color:'var(--text-primary)' }}
                    onFocus={e => e.target.style.borderColor='var(--accent)'}
                    onBlur={e => e.target.style.borderColor='var(--border)'} />
                </div>
              ))}
              <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
                <label style={{ fontSize:12, fontWeight:600, color:'var(--text-muted)',
                  textTransform:'uppercase', letterSpacing:'0.5px' }}>Gender</label>
                <select value={form.Gender} onChange={e => setForm(f => ({ ...f, Gender: e.target.value }))}
                  style={{ padding:'9px 12px', border:'1.5px solid var(--border)', borderRadius:8,
                    fontSize:13, outline:'none', width:'100%', boxSizing:'border-box',
                    fontFamily:'inherit', transition:'border-color 0.2s',
                    background:'var(--bg-input)', color:'var(--text-primary)' }}>
                  <option>Men</option><option>Women</option><option>Unisex</option>
                </select>
              </div>
              <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
                <label style={{ fontSize:12, fontWeight:600, color:'var(--text-muted)',
                  textTransform:'uppercase', letterSpacing:'0.5px' }}>Supplier</label>
                <select value={form.SupplierId} onChange={e => setForm(f => ({ ...f, SupplierId: e.target.value }))}
                  style={{ padding:'9px 12px', border:'1.5px solid var(--border)', borderRadius:8,
                    fontSize:13, outline:'none', width:'100%', boxSizing:'border-box',
                    fontFamily:'inherit', transition:'border-color 0.2s',
                    background:'var(--bg-input)', color:'var(--text-primary)' }}>
                  <option value="">Select supplier...</option>
                  {suppliers.map(s => <option key={s.id} value={s.id}>{s.Name}</option>)}
                </select>
              </div>
              <div style={{ display:'flex', flexDirection:'column', gap:6, gridColumn:'1/-1' }}>
                <label style={{ fontSize:12, fontWeight:600, color:'var(--text-muted)',
                  textTransform:'uppercase', letterSpacing:'0.5px' }}>Image Path</label>
                <input value={form.Image} onChange={e => setForm(f => ({ ...f, Image: e.target.value }))}
                  placeholder="/images/PERFUME BOTTLES/Product Name.png"
                  style={{ padding:'9px 12px', border:'1.5px solid var(--border)', borderRadius:8,
                    fontSize:13, outline:'none', width:'100%', boxSizing:'border-box',
                    fontFamily:'inherit', transition:'border-color 0.2s',
                    background:'var(--bg-input)', color:'var(--text-primary)' }}
                  onFocus={e => e.target.style.borderColor='var(--accent)'}
                  onBlur={e => e.target.style.borderColor='var(--border)'} />
              </div>
            </div>
          </Modal.Body>
          <Modal.Footer>
            <CancelButton onClick={closeModal} />
            <PrimaryButton loading={saving} onClick={() => {}}>
              {editing ? 'Save Changes' : 'Add Product'}
            </PrimaryButton>
          </Modal.Footer>
        </form>
      </Modal>

      {/* Confirm Delete */}
      <ConfirmDialog
        isOpen={!!confirmDelete}
        onClose={() => setConfirmDelete(null)}
        onConfirm={() => handleDelete(confirmDelete.id)}
        title="Delete Product?"
        message={<span>Are you sure you want to delete <strong>{confirmDelete?.Name}</strong>? This cannot be undone.</span>}
        confirmLabel="Yes, Delete" loading={saving}
      />

      {/* Barcode Scanner */}
      <BarcodeScanner
        isOpen={showScanner}
        onClose={() => setShowScanner(false)}
        onScan={handleBarcodeScan}
      />

      {/* Import Modal */}
      <Modal isOpen={showImportModal} onClose={() => setShowImportModal(false)}
        title={importType === 'products' ? 'Import Products' : 'Import Stock Adjustments'}
        icon={<FaFileImport />}
        maxWidth={600}>
        <Modal.Body>
          <div style={{ marginBottom:16 }}>
            <p style={{ fontSize:13, color:'var(--text-muted)', marginBottom:8 }}>
              {importType === 'products' 
                ? `Ready to import ${importData.length} products. ${importErrors.length} validation errors found.`
                : `Ready to apply ${importData.length} stock adjustments. ${importErrors.length} validation errors found.`
              }
            </p>
            {importErrors.length > 0 && (
              <div style={{ background:'var(--danger-bg)', border:'1px solid var(--danger)', 
                borderRadius:8, padding:12, marginBottom:16 }}>
                <div style={{ fontSize:12, fontWeight:700, color:'var(--danger)', marginBottom:8 }}>
                  Validation Errors:
                </div>
                {importErrors.map((err, i) => (
                  <div key={i} style={{ fontSize:11, color:'var(--danger)', marginBottom:4 }}>
                    Row {err.row}: {err.error}
                  </div>
                ))}
              </div>
            )}
            <div style={{ maxHeight:300, overflowY:'auto' }}>
              <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12 }}>
                <thead>
                  <tr>
                    {importType === 'products' ? (
                      <>
                        <th style={{ padding:'8px', textAlign:'left', borderBottom:'1px solid var(--border)' }}>Name</th>
                        <th style={{ padding:'8px', textAlign:'left', borderBottom:'1px solid var(--border)' }}>SKU</th>
                        <th style={{ padding:'8px', textAlign:'right', borderBottom:'1px solid var(--border)' }}>Price</th>
                        <th style={{ padding:'8px', textAlign:'right', borderBottom:'1px solid var(--border)' }}>Stock</th>
                      </>
                    ) : (
                      <>
                        <th style={{ padding:'8px', textAlign:'left', borderBottom:'1px solid var(--border)' }}>SKU</th>
                        <th style={{ padding:'8px', textAlign:'right', borderBottom:'1px solid var(--border)' }}>Adjustment</th>
                        <th style={{ padding:'8px', textAlign:'left', borderBottom:'1px solid var(--border)' }}>Notes</th>
                      </>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {importData.slice(0, 10).map((row, i) => (
                    <tr key={i}>
                      {importType === 'products' ? (
                        <>
                          <td style={{ padding:'8px', borderBottom:'1px solid var(--border)' }}>{row.Name}</td>
                          <td style={{ padding:'8px', borderBottom:'1px solid var(--border)' }}>{row.BatchNumber}</td>
                          <td style={{ padding:'8px', textAlign:'right', borderBottom:'1px solid var(--border)' }}>₱{row.SellingPrice}</td>
                          <td style={{ padding:'8px', textAlign:'right', borderBottom:'1px solid var(--border)' }}>{row.Stock}</td>
                        </>
                      ) : (
                        <>
                          <td style={{ padding:'8px', borderBottom:'1px solid var(--border)' }}>{row.SKU}</td>
                          <td style={{ padding:'8px', textAlign:'right', borderBottom:'1px solid var(--border)', 
                            color: row.Adjustment > 0 ? 'var(--accent)' : 'var(--danger)' }}>
                            {row.Adjustment > 0 ? '+' : ''}{row.Adjustment}
                          </td>
                          <td style={{ padding:'8px', borderBottom:'1px solid var(--border)' }}>{row.Notes}</td>
                        </>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
              {importData.length > 10 && (
                <div style={{ textAlign:'center', padding:8, color:'var(--text-muted)', fontSize:12 }}>
                  ...and {importData.length - 10} more rows
                </div>
              )}
            </div>
          </div>
        </Modal.Body>
        <Modal.Footer>
          <CancelButton onClick={() => setShowImportModal(false)} />
          <PrimaryButton loading={importing} onClick={handleImportConfirm}>
            {importType === 'products' ? 'Import Products' : 'Apply Adjustments'}
          </PrimaryButton>
        </Modal.Footer>
      </Modal>
    </div>
  );
}