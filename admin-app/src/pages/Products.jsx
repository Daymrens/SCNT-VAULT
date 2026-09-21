import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc } from 'firebase/firestore';
import { db } from '../firebase/firebase';
import {
  FaPlus, FaEdit, FaTrash, FaSearch, FaDownload,
  FaTh, FaList, FaTimes, FaChevronLeft, FaChevronRight,
  FaExclamationTriangle, FaBoxOpen
} from 'react-icons/fa';

const ITEMS_PER_PAGE = 25;

const EMPTY_PRODUCT = {
  Name: '',
  SKU: '',
  Category: '',
  Brand: '',
  CostPrice: '',
  SellingPrice: '',
  ResellerPrice: '',
  Price60ml: '',
  Cost60ml: '',
  StockQty: '',
  BatchNumber: '',
  ExpiryDate: '',
  Description: '',
  ImageUrl: '',
};

const SORT_OPTIONS = [
  { value: 'name-asc', label: 'Name A-Z' },
  { value: 'name-desc', label: 'Name Z-A' },
  { value: 'price-asc', label: 'Price Low-High' },
  { value: 'price-desc', label: 'Price High-Low' },
  { value: 'stock-asc', label: 'Stock Low-High' },
  { value: 'stock-desc', label: 'Stock High-Low' },
];

const STOCK_STATUSES = ['All', 'In Stock', 'Low Stock', 'Out of Stock'];

const inputStyle = {
  width: '100%', padding: '10px 12px', borderRadius: 8,
  border: '1px solid #334155', background: '#0f172a', color: '#f1f5f9',
  fontSize: 13, outline: 'none', transition: 'border-color 0.2s',
};

const labelStyle = {
  display: 'block', fontSize: 12, fontWeight: 600, color: '#94a3b8',
  marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.5,
};

const btnPrimary = {
  display: 'inline-flex', alignItems: 'center', gap: 6,
  background: 'rgba(45,212,191,0.15)', color: '#2dd4bf',
  border: '1px solid rgba(45,212,191,0.3)', borderRadius: 8,
  padding: '8px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer',
  transition: 'all 0.2s',
};

const btnDanger = {
  ...btnPrimary, background: 'rgba(239,68,68,0.15)',
  color: '#ef4444', border: '1px solid rgba(239,68,68,0.3)',
};

const btnGhost = {
  background: 'transparent', border: '1px solid #334155', borderRadius: 8,
  padding: '6px 10px', color: '#94a3b8', cursor: 'pointer',
  display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12,
  fontWeight: 600, transition: 'all 0.2s',
};

const btnGhostActive = {
  ...btnGhost, background: 'rgba(45,212,191,0.15)',
  color: '#2dd4bf', border: '1px solid rgba(45,212,191,0.3)',
};

const modalOverlay = {
  position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  zIndex: 1000, backdropFilter: 'blur(4px)',
};

const modalBox = {
  background: '#1e293b', border: '1px solid #334155', borderRadius: 16,
  width: '90%', maxWidth: 640, maxHeight: '85vh', overflow: 'auto',
  boxShadow: '0 24px 48px rgba(0,0,0,0.4)',
};

function getStockStatus(p) {
  const qty = p.StockQty ?? p.stockQty ?? 0;
  const threshold = p.LowStockThreshold ?? p.lowStockThreshold ?? 10;
  if (qty === 0) return 'Out of Stock';
  if (qty <= threshold) return 'Low Stock';
  return 'In Stock';
}

function stockBadge(status) {
  const colors = {
    'In Stock': { bg: 'rgba(34,197,94,0.15)', color: '#22c55e' },
    'Low Stock': { bg: 'rgba(245,158,11,0.15)', color: '#f59e0b' },
    'Out of Stock': { bg: 'rgba(239,68,68,0.15)', color: '#ef4444' },
  };
  return colors[status] || colors['In Stock'];
}

function formatPrice(v) {
  const n = Number(v);
  return isNaN(n) ? '$0.00' : `$${n.toFixed(2)}`;
}

function exportCSV(products) {
  if (!products.length) return;
  const headers = ['Name', 'SKU', 'Category', 'Brand', 'CostPrice', 'SellingPrice', 'ResellerPrice', 'Price60ml', 'Cost60ml', 'StockQty', 'BatchNumber', 'ExpiryDate', 'Description', 'ImageUrl'];
  const rows = products.map(p => headers.map(h => {
    const v = String(p[h] ?? '').replace(/"/g, '""');
    return `"${v}"`;
  }).join(','));
  const csv = [headers.join(','), ...rows].join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `products_${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function ProductForm({ product, onSave, onCancel }) {
  const [form, setForm] = useState(product || { ...EMPTY_PRODUCT });
  const [errors, setErrors] = useState({});

  const set = (key, val) => {
    setForm(f => ({ ...f, [key]: val }));
    if (errors[key]) setErrors(e => ({ ...e, [key]: null }));
  };

  const validate = () => {
    const errs = {};
    if (!form.Name.trim()) errs.Name = 'Name is required';
    if (!form.SKU.trim()) errs.SKU = 'SKU is required';
    const numFields = ['CostPrice', 'SellingPrice', 'ResellerPrice', 'Price60ml', 'Cost60ml', 'StockQty'];
    numFields.forEach(f => {
      if (form[f] !== '' && (isNaN(Number(form[f])) || Number(form[f]) < 0)) {
        errs[f] = 'Must be a positive number';
      }
    });
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!validate()) return;
    const data = { ...form };
    ['CostPrice', 'SellingPrice', 'ResellerPrice', 'Price60ml', 'Cost60ml', 'StockQty'].forEach(f => {
      data[f] = data[f] === '' ? null : Number(data[f]);
    });
    onSave(data);
  };

  const Field = ({ label, key, type = 'text', required, half }) => (
    <div style={{ flex: half ? 1 : undefined, minWidth: half ? 'calc(50% - 8px)' : undefined }}>
      <label style={labelStyle}>{label}{required && <span style={{ color: '#ef4444' }}> *</span>}</label>
      <input
        type={type}
        value={form[key] ?? ''}
        onChange={e => set(key, e.target.value)}
        style={{
          ...inputStyle,
          borderColor: errors[key] ? '#ef4444' : '#334155',
        }}
      />
      {errors[key] && <p style={{ color: '#ef4444', fontSize: 11, marginTop: 2 }}>{errors[key]}</p>}
    </div>
  );

  return (
    <div style={modalOverlay} onClick={onCancel}>
      <div style={modalBox} onClick={e => e.stopPropagation()}>
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          padding: '16px 20px', borderBottom: '1px solid #334155',
        }}>
          <h2 style={{ color: '#f1f5f9', fontSize: 16, fontWeight: 700 }}>
            {product?.id ? 'Edit Product' : 'Add Product'}
          </h2>
          <button onClick={onCancel} style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: 18 }}>
            <FaTimes />
          </button>
        </div>
        <form onSubmit={handleSubmit} style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <Field label="Product Name" key="Name" required half />
            <Field label="SKU" key="SKU" required half />
          </div>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <Field label="Category" key="Category" half />
            <Field label="Brand" key="Brand" half />
          </div>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <Field label="Cost Price" key="CostPrice" type="number" half />
            <Field label="Selling Price" key="SellingPrice" type="number" half />
          </div>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <Field label="Reseller Price" key="ResellerPrice" type="number" half />
            <Field label="Price 60ml" key="Price60ml" type="number" half />
          </div>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <Field label="Cost 60ml" key="Cost60ml" type="number" half />
            <Field label="Stock Qty" key="StockQty" type="number" half />
          </div>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <Field label="Batch Number" key="BatchNumber" half />
            <Field label="Expiry Date" key="ExpiryDate" type="date" half />
          </div>
          <div>
            <label style={labelStyle}>Description</label>
            <textarea
              value={form.Description ?? ''}
              onChange={e => set('Description', e.target.value)}
              rows={3}
              style={{ ...inputStyle, resize: 'vertical' }}
            />
          </div>
          <div>
            <label style={labelStyle}>Image URL</label>
            <input
              value={form.ImageUrl ?? ''}
              onChange={e => set('ImageUrl', e.target.value)}
              style={inputStyle}
              placeholder="https://..."
            />
          </div>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', marginTop: 8, paddingTop: 16, borderTop: '1px solid #334155' }}>
            <button type="button" onClick={onCancel} style={btnGhost}>Cancel</button>
            <button type="submit" style={btnPrimary}>{product?.id ? 'Save Changes' : 'Add Product'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

function DeleteConfirm({ product, onConfirm, onCancel }) {
  return (
    <div style={modalOverlay} onClick={onCancel}>
      <div style={{ ...modalBox, maxWidth: 400 }} onClick={e => e.stopPropagation()}>
        <div style={{ padding: 24, textAlign: 'center' }}>
          <div style={{
            width: 56, height: 56, borderRadius: '50%', background: 'rgba(239,68,68,0.15)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px',
          }}>
            <FaExclamationTriangle style={{ color: '#ef4444', fontSize: 24 }} />
          </div>
          <h3 style={{ color: '#f1f5f9', fontSize: 16, fontWeight: 700, marginBottom: 8 }}>Delete Product</h3>
          <p style={{ color: '#94a3b8', fontSize: 13, marginBottom: 20 }}>
            Are you sure you want to delete <strong style={{ color: '#f1f5f9' }}>{product?.Name || 'this product'}</strong>? This action cannot be undone.
          </p>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
            <button onClick={onCancel} style={btnGhost}>Cancel</button>
            <button onClick={onConfirm} style={btnDanger}>Delete</button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Products() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [stockFilter, setStockFilter] = useState('All');
  const [sort, setSort] = useState('name-asc');
  const [viewMode, setViewMode] = useState('table');
  const [page, setPage] = useState(1);
  const [showForm, setShowForm] = useState(false);
  const [editProduct, setEditProduct] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [saving, setSaving] = useState(false);

  const fetchProducts = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const snap = await getDocs(collection(db, 'products'));
      const items = [];
      snap.forEach(d => items.push({ id: d.id, ...d.data() }));
      setProducts(items);
    } catch (err) {
      console.error('Products load error:', err);
      setError('Failed to load products. Check Firestore permissions.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchProducts(); }, [fetchProducts]);

  const categories = useMemo(() => {
    const set = new Set(products.map(p => p.Category || p.category).filter(Boolean));
    return ['All', ...Array.from(set).sort()];
  }, [products]);

  const filtered = useMemo(() => {
    let result = products;
    const q = search.toLowerCase();
    if (q) {
      result = result.filter(p =>
        (p.Name || p.name || '').toLowerCase().includes(q) ||
        (p.SKU || p.sku || '').toLowerCase().includes(q) ||
        (p.Brand || p.brand || '').toLowerCase().includes(q)
      );
    }
    if (categoryFilter !== 'All') {
      result = result.filter(p => (p.Category || p.category) === categoryFilter);
    }
    if (stockFilter !== 'All') {
      result = result.filter(p => getStockStatus(p) === stockFilter);
    }
    const [key, dir] = sort.split('-');
    result = [...result].sort((a, b) => {
      let va, vb;
      if (key === 'name') {
        va = (a.Name || a.name || '').toLowerCase();
        vb = (b.Name || b.name || '').toLowerCase();
        return dir === 'asc' ? va.localeCompare(vb) : vb.localeCompare(va);
      }
      if (key === 'price') {
        va = Number(a.SellingPrice || a.sellingPrice || 0);
        vb = Number(b.SellingPrice || b.sellingPrice || 0);
      } else {
        va = Number(a.StockQty || a.stockQty || 0);
        vb = Number(b.StockQty || b.stockQty || 0);
      }
      return dir === 'asc' ? va - vb : vb - va;
    });
    return result;
  }, [products, search, categoryFilter, stockFilter, sort]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / ITEMS_PER_PAGE));
  const safePage = Math.min(page, totalPages);
  const paged = filtered.slice((safePage - 1) * ITEMS_PER_PAGE, safePage * ITEMS_PER_PAGE);

  useEffect(() => { setPage(1); }, [search, categoryFilter, stockFilter, sort]);

  const handleSave = async (data) => {
    setSaving(true);
    try {
      if (editProduct?.id) {
        const ref = doc(db, 'products', editProduct.id);
        await updateDoc(ref, data);
        setProducts(prev => prev.map(p => p.id === editProduct.id ? { ...p, ...data } : p));
      } else {
        const ref = await addDoc(collection(db, 'products'), data);
        setProducts(prev => [...prev, { id: ref.id, ...data }]);
      }
      setShowForm(false);
      setEditProduct(null);
    } catch (err) {
      console.error('Save product error:', err);
      alert('Failed to save product.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteDoc(doc(db, 'products', deleteTarget.id));
      setProducts(prev => prev.filter(p => p.id !== deleteTarget.id));
      setDeleteTarget(null);
    } catch (err) {
      console.error('Delete product error:', err);
      alert('Failed to delete product.');
    }
  };

  const openEdit = (p) => {
    setEditProduct(p);
    setShowForm(true);
  };

  const openAdd = () => {
    setEditProduct(null);
    setShowForm(true);
  };

  if (loading) {
    return (
      <>
        <style>{`
          @keyframes shimmer {
            0% { background-position: 200% 0; }
            100% { background-position: -200% 0; }
          }
        `}</style>
        <h1 style={{ color: '#f1f5f9', fontWeight: 800, fontSize: 24, marginBottom: 20 }}>Products</h1>
        <div style={{
          background: '#1e293b', border: '1px solid #334155', borderRadius: 12,
          padding: 20, overflow: 'hidden',
        }}>
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} style={{
              display: 'flex', gap: 16, padding: '12px 0',
              borderBottom: i < 4 ? '1px solid #334155' : 'none',
            }}>
              {['80px', '120px', '100px', '80px', '60px', '80px'].map((w, j) => (
                <div key={j} style={{
                  width: w, height: 14, borderRadius: 4,
                  background: 'linear-gradient(90deg, #1e293b 25%, #334155 50%, #1e293b 75%)',
                  backgroundSize: '200% 100%', animation: 'shimmer 1.5s infinite',
                }} />
              ))}
            </div>
          ))}
        </div>
      </>
    );
  }

  if (error) {
    return (
      <>
        <h1 style={{ color: '#f1f5f9', fontWeight: 800, fontSize: 24, marginBottom: 20 }}>Products</h1>
        <div style={{
          background: '#1e293b', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 12,
          padding: 32, textAlign: 'center',
        }}>
          <FaExclamationTriangle style={{ fontSize: 32, color: '#ef4444', marginBottom: 12 }} />
          <p style={{ color: '#f1f5f9', fontSize: 14, fontWeight: 600, marginBottom: 8 }}>{error}</p>
          <button onClick={fetchProducts} style={btnPrimary}>Retry</button>
        </div>
      </>
    );
  }

  return (
    <>
      <style>{`
        .prod-row:hover { background: rgba(45,212,191,0.04) !important; }
        .prod-card:hover { transform: translateY(-2px); box-shadow: 0 8px 24px rgba(0,0,0,0.3); }
        .prod-btn:hover { opacity: 0.8; }
        .prod-input:focus { border-color: #2dd4bf !important; }
        .prod-select:focus { border-color: #2dd4bf !important; outline: none; }
      `}</style>

      <h1 style={{ color: '#f1f5f9', fontWeight: 800, fontSize: 24, marginBottom: 20 }}>Products</h1>

      {/* Toolbar */}
      <div style={{
        display: 'flex', flexWrap: 'wrap', gap: 12, marginBottom: 20, alignItems: 'center',
      }}>
        <div style={{ flex: 1, minWidth: 200, position: 'relative' }}>
          <FaSearch style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8', fontSize: 13 }} />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by name, SKU, brand..."
            className="prod-input"
            style={{ ...inputStyle, paddingLeft: 36 }}
          />
        </div>

        <select
          value={categoryFilter}
          onChange={e => setCategoryFilter(e.target.value)}
          className="prod-select"
          style={{ ...inputStyle, width: 'auto', minWidth: 140, cursor: 'pointer' }}
        >
          {categories.map(c => <option key={c} value={c}>{c === 'All' ? 'All Categories' : c}</option>)}
        </select>

        <select
          value={stockFilter}
          onChange={e => setStockFilter(e.target.value)}
          className="prod-select"
          style={{ ...inputStyle, width: 'auto', minWidth: 140, cursor: 'pointer' }}
        >
          {STOCK_STATUSES.map(s => <option key={s} value={s}>{s === 'All' ? 'All Stock' : s}</option>)}
        </select>

        <select
          value={sort}
          onChange={e => setSort(e.target.value)}
          className="prod-select"
          style={{ ...inputStyle, width: 'auto', minWidth: 160, cursor: 'pointer' }}
        >
          {SORT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>

        <button onClick={() => setViewMode('table')} style={viewMode === 'table' ? btnGhostActive : btnGhost} title="Table view">
          <FaList />
        </button>
        <button onClick={() => setViewMode('grid')} style={viewMode === 'grid' ? btnGhostActive : btnGhost} title="Grid view">
          <FaTh />
        </button>

        <button onClick={() => exportCSV(filtered)} style={btnGhost} title="Export CSV">
          <FaDownload /> CSV
        </button>

        <button onClick={openAdd} style={btnPrimary} className="prod-btn">
          <FaPlus /> Add Product
        </button>
      </div>

      {/* Results count */}
      <p style={{ color: '#94a3b8', fontSize: 12, marginBottom: 12 }}>
        {filtered.length} product{filtered.length !== 1 ? 's' : ''} found
        {filtered.length > ITEMS_PER_PAGE && ` — Page ${safePage} of ${totalPages}`}
      </p>

      {filtered.length === 0 ? (
        <div style={{
          background: '#1e293b', border: '1px solid #334155', borderRadius: 12,
          padding: 48, textAlign: 'center',
        }}>
          <FaBoxOpen style={{ fontSize: 40, color: '#334155', marginBottom: 12 }} />
          <p style={{ color: '#94a3b8', fontSize: 14 }}>No products found</p>
        </div>
      ) : viewMode === 'table' ? (
        /* Table View */
        <div style={{
          background: '#1e293b', border: '1px solid #334155', borderRadius: 12,
          overflow: 'hidden', marginBottom: 20,
        }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 900 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #334155' }}>
                  {['Product', 'SKU', 'Category', 'Brand', 'Cost', 'Price', 'Stock', 'Status', 'Actions'].map(h => (
                    <th key={h} style={{
                      color: '#94a3b8', fontSize: 11, fontWeight: 600, textTransform: 'uppercase',
                      padding: '12px', textAlign: 'left', whiteSpace: 'nowrap', letterSpacing: 0.5,
                    }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {paged.map(p => {
                  const status = getStockStatus(p);
                  const sc = stockBadge(status);
                  return (
                    <tr key={p.id} className="prod-row" style={{
                      borderBottom: '1px solid rgba(51,65,85,0.5)',
                      transition: 'background 0.15s',
                    }}>
                      <td style={{ padding: '12px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          {p.ImageUrl ? (
                            <img src={p.ImageUrl} alt="" style={{
                              width: 36, height: 36, borderRadius: 8, objectFit: 'cover',
                              border: '1px solid #334155',
                            }} />
                          ) : (
                            <div style={{
                              width: 36, height: 36, borderRadius: 8, background: '#0f172a',
                              border: '1px solid #334155', display: 'flex', alignItems: 'center',
                              justifyContent: 'center', color: '#334155', fontSize: 14,
                            }}>
                              <FaBoxOpen />
                            </div>
                          )}
                          <span style={{ fontSize: 13, fontWeight: 600, color: '#f1f5f9' }}>
                            {p.Name || p.name || '—'}
                          </span>
                        </div>
                      </td>
                      <td style={{ padding: '12px', fontSize: 12, color: '#94a3b8', fontFamily: 'monospace' }}>
                        {p.SKU || p.sku || '—'}
                      </td>
                      <td style={{ padding: '12px', fontSize: 12, color: '#94a3b8' }}>
                        {p.Category || p.category || '—'}
                      </td>
                      <td style={{ padding: '12px', fontSize: 12, color: '#94a3b8' }}>
                        {p.Brand || p.brand || '—'}
                      </td>
                      <td style={{ padding: '12px', fontSize: 12, color: '#94a3b8' }}>
                        {formatPrice(p.CostPrice || p.costPrice)}
                      </td>
                      <td style={{ padding: '12px', fontSize: 13, color: '#f1f5f9', fontWeight: 600 }}>
                        {formatPrice(p.SellingPrice || p.sellingPrice)}
                      </td>
                      <td style={{ padding: '12px', fontSize: 13, fontWeight: 700, color: sc.color }}>
                        {p.StockQty ?? p.stockQty ?? 0}
                      </td>
                      <td style={{ padding: '12px' }}>
                        <span style={{
                          display: 'inline-block', padding: '4px 10px', borderRadius: 20,
                          fontSize: 11, fontWeight: 700, whiteSpace: 'nowrap',
                          background: sc.bg, color: sc.color,
                        }}>
                          {status}
                        </span>
                      </td>
                      <td style={{ padding: '12px' }}>
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button onClick={() => openEdit(p)} className="prod-btn" style={{
                            background: 'rgba(45,212,191,0.1)', color: '#2dd4bf',
                            border: 'none', borderRadius: 6, padding: '5px 8px', cursor: 'pointer',
                            fontSize: 12, transition: 'opacity 0.2s',
                          }} title="Edit">
                            <FaEdit />
                          </button>
                          <button onClick={() => setDeleteTarget(p)} className="prod-btn" style={{
                            background: 'rgba(239,68,68,0.1)', color: '#ef4444',
                            border: 'none', borderRadius: 6, padding: '5px 8px', cursor: 'pointer',
                            fontSize: 12, transition: 'opacity 0.2s',
                          }} title="Delete">
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
      ) : (
        /* Grid View */
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
          gap: 16, marginBottom: 20,
        }}>
          {paged.map(p => {
            const status = getStockStatus(p);
            const sc = stockBadge(status);
            return (
              <div key={p.id} className="prod-card" style={{
                background: '#1e293b', border: '1px solid #334155', borderRadius: 12,
                overflow: 'hidden', transition: 'transform 0.2s, box-shadow 0.2s',
              }}>
                {p.ImageUrl ? (
                  <img src={p.ImageUrl} alt="" style={{
                    width: '100%', height: 140, objectFit: 'cover',
                    borderBottom: '1px solid #334155',
                  }} />
                ) : (
                  <div style={{
                    width: '100%', height: 140, background: '#0f172a',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: '#334155', fontSize: 32, borderBottom: '1px solid #334155',
                  }}>
                    <FaBoxOpen />
                  </div>
                )}
                <div style={{ padding: 16 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                    <h3 style={{ fontSize: 14, fontWeight: 700, color: '#f1f5f9', lineHeight: 1.3 }}>
                      {p.Name || p.name || '—'}
                    </h3>
                    <span style={{
                      padding: '3px 8px', borderRadius: 12, fontSize: 10, fontWeight: 700,
                      background: sc.bg, color: sc.color, whiteSpace: 'nowrap', flexShrink: 0, marginLeft: 8,
                    }}>
                      {status}
                    </span>
                  </div>
                  <p style={{ fontSize: 11, color: '#94a3b8', marginBottom: 4, fontFamily: 'monospace' }}>
                    {p.SKU || p.sku || '—'}
                  </p>
                  <p style={{ fontSize: 11, color: '#94a3b8', marginBottom: 4 }}>
                    {p.Category || p.category || 'No Category'} · {p.Brand || p.brand || 'No Brand'}
                  </p>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 12, paddingTop: 12, borderTop: '1px solid rgba(51,65,85,0.5)' }}>
                    <span style={{ fontSize: 16, fontWeight: 800, color: '#2dd4bf' }}>
                      {formatPrice(p.SellingPrice || p.sellingPrice)}
                    </span>
                    <span style={{
                      fontSize: 12, fontWeight: 700,
                      color: sc.color,
                    }}>
                      {p.StockQty ?? p.stockQty ?? 0} in stock
                    </span>
                  </div>
                  <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                    <button onClick={() => openEdit(p)} className="prod-btn" style={{
                      ...btnGhost, flex: 1, justifyContent: 'center', color: '#2dd4bf',
                    }}>
                      <FaEdit /> Edit
                    </button>
                    <button onClick={() => setDeleteTarget(p)} className="prod-btn" style={{
                      ...btnGhost, color: '#ef4444',
                    }}>
                      <FaTrash />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 8, marginTop: 8 }}>
          <button
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={safePage <= 1}
            style={{ ...btnGhost, opacity: safePage <= 1 ? 0.4 : 1, cursor: safePage <= 1 ? 'default' : 'pointer' }}
          >
            <FaChevronLeft />
          </button>
          {Array.from({ length: totalPages }, (_, i) => i + 1)
            .filter(n => n === 1 || n === totalPages || Math.abs(n - safePage) <= 2)
            .reduce((acc, n, i, arr) => {
              if (i > 0 && n - arr[i - 1] > 1) acc.push('...');
              acc.push(n);
              return acc;
            }, [])
            .map((n, i) => (
              n === '...' ? (
                <span key={`e${i}`} style={{ color: '#94a3b8', fontSize: 13, padding: '0 4px' }}>…</span>
              ) : (
                <button
                  key={n}
                  onClick={() => setPage(n)}
                  style={{
                    ...btnGhost,
                    ...(n === safePage ? btnGhostActive : {}),
                    minWidth: 36, justifyContent: 'center',
                  }}
                >
                  {n}
                </button>
              )
            ))
          }
          <button
            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
            disabled={safePage >= totalPages}
            style={{ ...btnGhost, opacity: safePage >= totalPages ? 0.4 : 1, cursor: safePage >= totalPages ? 'default' : 'pointer' }}
          >
            <FaChevronRight />
          </button>
        </div>
      )}

      {/* Modals */}
      {showForm && (
        <ProductForm
          product={editProduct}
          onSave={handleSave}
          onCancel={() => { setShowForm(false); setEditProduct(null); }}
        />
      )}
      {deleteTarget && (
        <DeleteConfirm
          product={deleteTarget}
          onConfirm={handleDelete}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </>
  );
}
