import React, { useState, useMemo, useRef, useEffect } from 'react';
import { useData } from '../contexts/DataContext';
import {
  FaEye, FaTrash, FaFileExport,
  FaShoppingCart,
  FaMoneyBillWave, FaUser, FaHandshake, FaWalking,
  FaCreditCard, FaMobileAlt
} from 'react-icons/fa';
import ConfirmDialog from '../components/shared/ConfirmDialog';
import SearchBar from '../components/shared/SearchBar';
import Pagination from '../components/shared/Pagination';
import Modal from '../components/shared/Modal';
import { useToast } from '../components/shared/Toast';
import { toCsv } from '../utils/csv';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';

const TABS = [
  { key:'all',      label:'All Sales',  icon:<FaShoppingCart /> },
  { key:'retail',   label:'Retail',     icon:<FaUser /> },
  { key:'reseller', label:'Reseller',   icon:<FaHandshake /> },
  { key:'walkin',   label:'Walk-in',    icon:<FaWalking /> },
];

const DATE_RANGES = [
  { key:'7',   label:'7 days' },
  { key:'30',  label:'30 days' },
  { key:'90',  label:'90 days' },
  { key:'all', label:'All time' },
];

function toDate(v) {
  if (!v) return new Date(0);
  return v?.toDate ? v.toDate() : new Date(v);
}

const typeStyle = (type) => ({
  retail:   { bg:'var(--info-bg)',    color:'var(--info)',    label:'Retail' },
  reseller: { bg:'var(--warning-bg)', color:'var(--warning)', label:'Reseller' },
  walkin:   { bg:'rgba(255,255,255,0.06)', color:'var(--text-secondary)', label:'Walk-in' },
}[type] || { bg:'rgba(255,255,255,0.06)', color:'var(--text-secondary)', label:'Unknown' });

const paymentIcon = (method) => {
  if (!method) return <FaMoneyBillWave />;
  const m = method.toLowerCase();
  if (m.includes('gcash') || m.includes('maya') || m.includes('mobile')) return <FaMobileAlt />;
  if (m.includes('card') || m.includes('credit') || m.includes('debit')) return <FaCreditCard />;
  return <FaMoneyBillWave />;
};

export default function Sales() {
  const { sales, customers, resellers, products, deleteSale, adjustStock, loading, loadSales } = useData();
  const [tab, setTab]           = useState('all');
  const [range, setRange]       = useState('30');
  const [search, setSearch]     = useState('');
  const [viewSale, setViewSale] = useState(null);
  const [confirmDel, setConfirmDel] = useState(null);
  const searchRef = useRef(null);
  const { showToast } = useToast();
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  useEffect(() => { loadSales(); }, [loadSales]);

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

  const customerName = (sale) => {
    if (sale.ResellerId) return resellers.find(r => r.id === String(sale.ResellerId))?.Name || 'Unknown Reseller';
    if (sale.CustomerId) return customers.find(c => c.id === String(sale.CustomerId))?.Name || 'Unknown Customer';
    return 'Walk-in';
  };

  const saleType = (sale) => {
    if (sale.ResellerId) return 'reseller';
    if (sale.CustomerId) return 'retail';
    return 'walkin';
  };

  const filtered = useMemo(() => {
    const now = new Date();
    const cutoff = range === 'all' ? new Date(0) : new Date(now - Number(range) * 86400000);
    const q = search.toLowerCase();
    return sales
      .filter(s => {
        const d = toDate(s.SaleDate);
        if (d < cutoff) return false;
        if (tab !== 'all' && saleType(s) !== tab) return false;
        if (q && !customerName(s).toLowerCase().includes(q)) return false;
        return true;
      })
      .sort((a, b) => toDate(b.SaleDate) - toDate(a.SaleDate));
  }, [sales, tab, range, search, customers, resellers]);

  const paginatedSales = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, page, pageSize]);

  useEffect(() => { setPage(1); }, [search, tab, range]);

  const stats = useMemo(() => {
    const revenue  = filtered.reduce((s, x) => s + (x.Total||0), 0);
    const discount = filtered.reduce((s, x) => s + (x.Discount||0), 0);
    const bottles  = filtered.reduce((s, x) => s + (x.Items?.reduce((a,i) => a+(i.Quantity||0),0)||0), 0);
    const byType   = { retail:0, reseller:0, walkin:0 };
    filtered.forEach(s => { byType[saleType(s)] = (byType[saleType(s)]||0) + (s.Total||0); });
    const byPayment = {};
    filtered.forEach(s => {
      const m = s.PaymentMethod || 'Cash';
      byPayment[m] = (byPayment[m]||0) + 1;
    });
    return { count: filtered.length, revenue, discount, avg: filtered.length ? revenue/filtered.length : 0, bottles, byType, byPayment };
  }, [filtered]);

  const chartData = useMemo(() => {
    const useWeeks = range === 'all' || Number(range) > 30;
    if (useWeeks) {
      const map = {};
      filtered.forEach(s => {
        const d = toDate(s.SaleDate);
        const day = d.getDay();
        const diff = (day === 0 ? -6 : 1) - day;
        const mon = new Date(d); mon.setDate(d.getDate() + diff);
        const key = mon.toLocaleDateString('en-PH', { month:'short', day:'numeric' });
        map[key] = (map[key]||0) + (s.Total||0);
      });
      return Object.entries(map)
        .map(([date, revenue]) => ({ date, revenue }))
        .sort((a, b) => new Date(a.date) - new Date(b.date));
    }
    const days = Number(range);
    const map = {};
    for (let i = days-1; i >= 0; i--) {
      const d = new Date(); d.setDate(d.getDate()-i);
      const key = d.toLocaleDateString('en-PH', { month:'short', day:'numeric' });
      map[key] = 0;
    }
    filtered.forEach(s => {
      const d = toDate(s.SaleDate);
      const key = d.toLocaleDateString('en-PH', { month:'short', day:'numeric' });
      if (key in map) map[key] += s.Total||0;
    });
    return Object.entries(map).map(([date, revenue]) => ({ date, revenue }));
  }, [filtered, range]);

  const handleDelete = async () => {
    try {
      await deleteSale(confirmDel.id);
      const productMap = Object.fromEntries(products.map(p => [p.id, p]));
      for (const item of (confirmDel.Items||[])) {
        const pid = String(item.PerfumeId ?? item.ProductId ?? '');
        const qty = Number(item.Quantity)||0;
        if (!pid || qty <= 0) continue;
        const prod = productMap[pid];
        if (prod) await adjustStock(pid, +qty);
      }
      showToast('Sale deleted — stock restored', 'success');
    } catch (e) {
      console.error(e);
      showToast('Failed to delete sale', 'error');
    }
    finally { setConfirmDel(null); }
  };

  const handleExport = () => {
    const rows = [['Date','Customer','Type','Items','Subtotal','Discount','Total','Payment']];
    filtered.forEach(s => {
      const d = toDate(s.SaleDate).toLocaleDateString('en-PH');
      rows.push([d, customerName(s), saleType(s), s.Items?.length||0,
        s.Subtotal||0, s.Discount||0, s.Total||0, s.PaymentMethod||'Cash']);
    });
    const csv = toCsv(rows);
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type:'text/csv' }));
    a.download = `sales-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
  };

  if (loading) return (
    <div className="inventory-page">
      <div className="stat-cashflow-grid">
        {[1,2,3,4].map(i => <div key={i} className="skeleton" style={{ height:72, borderRadius:14 }} />)}
      </div>
      <div className="skeleton" style={{ height:240, borderRadius:16, marginBottom:20 }} />
      <div className="skeleton" style={{ height:360, borderRadius:16 }} />
    </div>
  );

  return (
    <div className="inventory-page">
      {/* Header */}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:24 }}>
        <div>
          <h1 style={{ fontSize:28, fontWeight:800, color:'var(--text-primary)', margin:'0 0 4px 0' }}>Sales</h1>
          <p style={{ color:'var(--text-secondary)', fontSize:13, margin:0 }}>
            {sales.length} total transaction{sales.length!==1?'s':''}
          </p>
        </div>
        <button onClick={handleExport} style={{
          display:'flex', alignItems:'center', gap:8, padding:'10px 18px',
          background:'var(--bg-card)', color:'var(--text-primary)', border:'1px solid var(--border)', borderRadius:10,
          fontSize:13, fontWeight:700, cursor:'pointer',
          boxShadow:'0 2px 12px rgba(0,0,0,0.12)', transition:'transform 0.15s' }}
          onMouseEnter={e => e.currentTarget.style.transform='translateY(-1px)'}
          onMouseLeave={e => e.currentTarget.style.transform='none'}
        >
          <FaFileExport /> Export CSV
        </button>
      </div>

      {/* Stats - Cash Flow Style */}
      <div className="stat-cashflow-grid">
        <div className="stat-cashflow stat-cashflow-green">
          <div className="stat-cashflow-icon" style={{ background:'rgba(255,255,255,0.2)', color:'#0f172a' }}>
            <FaMoneyBillWave />
          </div>
          <div className="stat-cashflow-value">₱{stats.revenue.toLocaleString('en-PH')}</div>
          <div className="stat-cashflow-label">Revenue</div>
        </div>
        <div className="stat-cashflow stat-cashflow-dark">
          <div className="stat-cashflow-icon" style={{ background:'rgba(255,255,255,0.15)', color:'var(--text-primary)' }}>
            <FaShoppingCart />
          </div>
          <div className="stat-cashflow-value">{stats.count}</div>
          <div className="stat-cashflow-label">Total Sales</div>
        </div>
        <div className="stat-cashflow">
          <div className="stat-cashflow-icon" style={{ background:'var(--accent-dim)', color:'var(--accent)' }}>
            <FaUser />
          </div>
          <div className="stat-cashflow-value">₱{Math.round(stats.avg).toLocaleString('en-PH')}</div>
          <div className="stat-cashflow-label">Avg per Sale</div>
        </div>
        <div className="stat-cashflow">
          <div className="stat-cashflow-icon" style={{ background:'var(--info-bg)', color:'var(--info)' }}>
            <FaHandshake />
          </div>
          <div className="stat-cashflow-value">{stats.bottles}</div>
          <div className="stat-cashflow-label">Bottles Sold</div>
        </div>
      </div>

      {/* Chart + Breakdown row */}
      <div className="chart-grid">
        {/* Revenue chart */}
        <div className="chart-card">
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:14 }}>
            <h3 style={{ margin:0 }}>Revenue Trend</h3>
            <div style={{ fontSize:11, color:'var(--text-muted)' }}>
              {range === 'all' || Number(range) > 30 ? 'Weekly' : 'Daily'}
            </div>
          </div>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={chartData} barSize={chartData.length <= 7 ? 32 : chartData.length <= 30 ? 14 : 20}
              margin={{ top:4, right:8, left:0, bottom:0 }}>
              <XAxis dataKey="date" tick={{ fontSize:10, fill:'var(--chart-text)' }}
                tickLine={false} axisLine={false}
                interval={chartData.length <= 7 ? 0 : chartData.length <= 14 ? 1 : Math.floor(chartData.length/8)} />
              <YAxis
                tick={{ fontSize:10, fill:'var(--chart-text)' }}
                tickLine={false} axisLine={false}
                tickFormatter={v => v >= 1000 ? `₱${(v/1000).toFixed(0)}k` : `₱${v}`}
                width={48}
              />
              <Tooltip
                formatter={(v) => [`₱${v.toLocaleString('en-PH')}`, 'Revenue']}
                contentStyle={{ borderRadius:10, border:'none', background:'var(--chart-tooltip-bg)', color:'var(--chart-tooltip-text)', boxShadow:'0 4px 20px rgba(0,0,0,0.3)', fontSize:12 }}
                cursor={{ fill:'var(--accent-dim)' }}
              />
              <Bar dataKey="revenue" radius={[5,5,0,0]} minPointSize={3}>
                {chartData.map((entry, i) => (
                  <Cell key={i} fill={entry.revenue > 0 ? 'var(--accent)' : 'var(--bg-secondary)'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Breakdown */}
        <div className="chart-card" style={{ display:'flex', flexDirection:'column', gap:10 }}>
          <h3 style={{ margin:'0 0 4px 0' }}>Breakdown</h3>
          {[
            { label:'Retail',   value: stats.byType.retail,   color:'var(--info)' },
            { label:'Reseller', value: stats.byType.reseller, color:'var(--warning)' },
            { label:'Walk-in',  value: stats.byType.walkin,   color:'var(--text-muted)' },
          ].map(b => {
            const pct = stats.revenue > 0 ? (b.value/stats.revenue)*100 : 0;
            return (
              <div key={b.label}>
                <div style={{ display:'flex', justifyContent:'space-between', fontSize:11, marginBottom:4 }}>
                  <span style={{ color:'var(--text-muted)', fontWeight:600 }}>{b.label}</span>
                  <span style={{ color:b.color, fontWeight:700 }}>₱{b.value.toLocaleString('en-PH')}</span>
                </div>
                <div style={{ height:6, borderRadius:3, background:'var(--bg-secondary)', overflow:'hidden' }}>
                  <div style={{ height:'100%', width:`${pct}%`, background:b.color, borderRadius:3, transition:'width 0.5s' }} />
                </div>
              </div>
            );
          })}
          <div style={{ borderTop:'1px solid var(--border)', paddingTop:10, marginTop:4 }}>
            <div style={{ fontSize:11, fontWeight:700, color:'var(--text-muted)', marginBottom:6 }}>Payment Methods</div>
            <div style={{ display:'flex', flexWrap:'wrap', gap:5 }}>
              {Object.entries(stats.byPayment).map(([method, count]) => (
                <span key={method} style={{ display:'inline-flex', alignItems:'center', gap:4,
                  padding:'3px 9px', borderRadius:20, fontSize:10, fontWeight:600,
                  background:'var(--bg-secondary)', color:'var(--text-secondary)', border:'1px solid var(--border)' }}>
                  {paymentIcon(method)} {method} ({count})
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Tabs + Date Range */}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:14, flexWrap:'wrap', gap:10 }}>
        <div className="header-tabs">
          {TABS.map(t => (
            <button key={t.key} onClick={() => setTab(t.key)} className={`header-tab ${tab===t.key ? 'header-tab-active' : ''}`}>
              {t.icon} {t.label}
            </button>
          ))}
        </div>
        <div className="header-tabs">
          {DATE_RANGES.map(r => (
            <button key={r.key} onClick={() => setRange(r.key)} className={`header-tab ${range===r.key ? 'header-tab-active' : ''}`}>
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {/* Search */}
      <SearchBar value={search} onChange={setSearch} placeholder="Search by customer or reseller name..." inputRef={searchRef} />

      {/* Sales Table */}
      {filtered.length === 0 ? (
        <div style={{ background:'var(--bg-card)', borderRadius:12, padding:'48px 20px', textAlign:'center',
          color:'var(--text-muted)', fontSize:14, border:'1px solid var(--border)' }}>
          {search ? 'No sales match your search' : 'No sales in this period'}
        </div>
      ) : (
        <>
        <div style={{ background:'var(--bg-card)', borderRadius:12, overflow:'hidden',
          border:'1px solid var(--border)' }}>
          <table className="data-table">
            <thead>
              <tr>
                {['Date','Customer','Type','Items','Subtotal','Discount','Total','Payment',''].map(h => (
                  <th key={h}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {paginatedSales.map((sale, idx) => {
                const d    = toDate(sale.SaleDate);
                const ts   = typeStyle(saleType(sale));
                const bottles = (sale.Items||[]).reduce((s,i) => s+(i.Quantity||0), 0);
                return (
                  <tr key={sale.id}>
                    <td style={{ whiteSpace:'nowrap' }}>
                      {d.toLocaleDateString('en-PH', { month:'short', day:'numeric', year:'numeric' })}
                    </td>
                    <td style={{ fontWeight:600 }}>
                      {customerName(sale)}
                    </td>
                    <td>
                      <span style={{ padding:'3px 10px', borderRadius:20, fontSize:11, fontWeight:700,
                        background:ts.bg, color:ts.color }}>{ts.label}</span>
                    </td>
                    <td>
                      {bottles} bottle{bottles!==1?'s':''}
                    </td>
                    <td>
                      ₱{(sale.Subtotal||0).toLocaleString('en-PH')}
                    </td>
                    <td style={{ color:'var(--danger)' }}>
                      {sale.Discount > 0 ? `-₱${sale.Discount.toLocaleString('en-PH')}` : '—'}
                    </td>
                    <td style={{ fontWeight:800, color:'var(--accent)' }}>
                      ₱{(sale.Total||0).toLocaleString('en-PH')}
                    </td>
                    <td>
                      <span style={{ display:'inline-flex', alignItems:'center', gap:5,
                        padding:'3px 10px', borderRadius:20, fontSize:11, fontWeight:600,
                        background:'var(--bg-secondary)', color:'var(--text-secondary)' }}>
                        {paymentIcon(sale.PaymentMethod)} {sale.PaymentMethod||'Cash'}
                      </span>
                    </td>
                    <td>
                      <div className="action-buttons">
                        <button className="btn-icon btn-info" onClick={() => setViewSale(sale)}>
                          <FaEye />
                        </button>
                        <button className="btn-icon btn-delete" onClick={() => setConfirmDel(sale)}>
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
        <Pagination
          totalItems={filtered.length}
          currentPage={page}
          pageSize={pageSize}
          onPageChange={setPage}
          onPageSizeChange={(size) => { setPageSize(size); setPage(1); }}
        />
        </>
      )}

      {/* View Sale Modal */}
      <Modal isOpen={!!viewSale} onClose={() => setViewSale(null)} title="Sale Details" icon={<FaEye />} maxWidth={640}>
        {viewSale && (() => {
          const ts      = typeStyle(saleType(viewSale));
          const d       = toDate(viewSale.SaleDate);
          const items   = viewSale.Items || [];
          const bottles = items.reduce((s,i) => s+(i.Quantity||0), 0);
          return (
            <Modal.Body padding={0}>
              {/* Meta row */}
              <div className="detail-grid" style={{ borderBottom:'1px solid var(--border)' }}>
                {[
                  { label:'Customer',  value: customerName(viewSale),                    color:'var(--text-primary)' },
                  { label:'Type',      value: ts.label,                                  color: ts.color },
                  { label:'Bottles',   value: `${bottles} bottle${bottles!==1?'s':''}`,  color:'var(--accent)' },
                  { label:'Payment',   value: viewSale.PaymentMethod||'Cash',             color:'var(--text-secondary)' },
                ].map(s => (
                  <div key={s.label} className="detail-item" style={{ padding:'12px 16px', textAlign:'center', borderRight:'1px solid var(--border)' }}>
                    <div className="detail-label">{s.label}</div>
                    <div className="detail-value" style={{ color:s.color }}>{s.value}</div>
                  </div>
                ))}
              </div>
              {/* Items */}
              <div style={{ padding:'16px 24px' }}>
                {items.length === 0
                  ? <div style={{ textAlign:'center', color:'var(--text-muted)', padding:'32px 0' }}>No item details</div>
                  : items.map((item, i) => {
                    const pid = String(item.PerfumeId ?? item.ProductId ?? '');
                    const prod = products.find(p => p.id === pid);
                    const imgSrc = prod?.ImagePath
                      ? `https://scnt-vault.web.app/${prod.ImagePath}`
                      : 'https://scnt-vault.web.app/images/scnt_default.png';
                    return (
                      <div key={i} style={{ display:'flex', alignItems:'center', gap:14,
                        padding:'10px 0', borderBottom:'1px solid var(--border)' }}>
                        <img src={imgSrc} alt={item.PerfumeName||item.ProductName}
                          style={{ width:48, height:48, objectFit:'contain', borderRadius:8, background:'var(--bg-secondary)', padding:4, flexShrink:0 }}
                          onError={e => { e.target.src='https://scnt-vault.web.app/images/scnt_default.png'; }} />
                        <div style={{ flex:1 }}>
                          <div style={{ fontSize:13, fontWeight:700, color:'var(--text-primary)' }}>
                            {item.PerfumeName||item.ProductName||`Product #${pid}`}
                          </div>
                          <div style={{ fontSize:11, color:'var(--text-muted)', marginTop:2 }}>
                            ₱{(item.UnitPrice||0).toLocaleString('en-PH')} × {item.Quantity}
                          </div>
                        </div>
                        <div style={{ fontSize:14, fontWeight:800, color:'var(--text-primary)' }}>
                          ₱{(item.Subtotal||0).toLocaleString('en-PH')}
                        </div>
                      </div>
                    );
                  })
                }
              </div>
              {/* Totals footer */}
              <div className="payment-summary" style={{ display:'flex', flexDirection:'column', gap:6 }}>
                {[
                  { label:'Subtotal', value:`₱${(viewSale.Subtotal||0).toLocaleString('en-PH')}`, color:'var(--text-secondary)' },
                  { label:'Discount', value:`-₱${(viewSale.Discount||0).toLocaleString('en-PH')}`, color:'var(--danger)' },
                  { label:'Total',    value:`₱${(viewSale.Total||0).toLocaleString('en-PH')}`,    color:'var(--accent)', bold:true },
                ].map(r => (
                  <div key={r.label} className={`summary-row ${r.bold ? 'total' : ''}`} style={{ color:r.color }}>
                    <span>{r.label}</span><span>{r.value}</span>
                  </div>
                ))}
              </div>
            </Modal.Body>
          );
        })()}
      </Modal>

      {/* Confirm Delete Modal */}
      <ConfirmDialog
        isOpen={!!confirmDel}
        onClose={() => setConfirmDel(null)}
        onConfirm={handleDelete}
        title="Delete Sale?"
        message="This will restore stock for all items in this sale. This cannot be undone."
        confirmLabel="Yes, Delete"
      />
    </div>
  );
}
