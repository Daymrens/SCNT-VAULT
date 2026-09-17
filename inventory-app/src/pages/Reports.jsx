import React, { useState, useMemo, useEffect } from 'react';
import { useData } from '../contexts/DataContext';
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts';
import { FaDownload, FaCalendarAlt, FaChartBar, FaBoxes, FaUsers, FaHandshake, FaExclamationTriangle, FaClock } from 'react-icons/fa';
import { toCsv } from '../utils/csv';
import { collection, query, where, getDocs, orderBy, Timestamp } from 'firebase/firestore';
import { db } from '../firebase/firebase';

const COLORS = ['#2dd4bf','#64748b','#3b82f6','#f59e0b','#a78bfa','#ec4899','#ef4444','#14b8a6'];

const RANGES = [
  { label:'Last 7 days',  days:7  },
  { label:'Last 30 days', days:30 },
  { label:'Last 90 days', days:90 },
  { label:'This year',    days:365},
  { label:'All time',     days:0  },
];

export default function Reports() {
  const { sales, products, customers, resellers, suppliers, purchaseOrders, loading, loadSales, loadPurchaseOrders } = useData();
  const [rangeDays, setRangeDays] = useState(30);
  const [activeTab, setActiveTab] = useState('sales');
  const [stockMovements, setStockMovements] = useState([]);
  const [loadingMovements, setLoadingMovements] = useState(false);

  useEffect(() => { loadSales(); loadPurchaseOrders(); }, [loadSales, loadPurchaseOrders]);

  useEffect(() => {
    if (activeTab === 'stock-movements' && stockMovements.length === 0 && !loadingMovements) {
      setLoadingMovements(true);
      const loadMovements = async () => {
        try {
          const q = query(collection(db, 'stockMovements'), orderBy('Date', 'desc'));
          const snapshot = await getDocs(q);
          const movements = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
          setStockMovements(movements);
        } catch (error) {
          console.error('Error loading stock movements:', error);
        } finally {
          setLoadingMovements(false);
        }
      };
      loadMovements();
    }
  }, [activeTab, stockMovements.length, loadingMovements]);

  const now = new Date();
  const cutoff = rangeDays === 0 ? new Date(0) : new Date(now - rangeDays * 86400000);

  const toDate = (v) => v?.toDate ? v.toDate() : new Date(v || 0);

  const filteredSales = useMemo(() =>
    sales.filter(s => toDate(s.SaleDate) >= cutoff),
    [sales, rangeDays, cutoff]
  );

  // -- Core metrics ----------------------------------------------
  const metrics = useMemo(() => {
    let revenue = 0, cost = 0, bottles = 0;
    const productMap = {};
    products.forEach(p => { productMap[p.id] = p; });

    const byDate = {}, byProduct = {}, byCategory = {}, byCustomer = {}, byReseller = {};

    filteredSales.forEach(sale => {
      revenue += sale.Total || 0;
      const d = toDate(sale.SaleDate);
      const dk = `${d.getMonth()+1}/${d.getDate()}`;
      if (!byDate[dk]) byDate[dk] = { day: dk, revenue: 0, _ts: d.getTime() };
      byDate[dk].revenue += sale.Total || 0;

      (sale.Items || []).forEach(item => {
        const qty = item.Quantity || 0;
        bottles += qty;
        const prod = productMap[String(item.PerfumeId ?? item.ProductId ?? '')];
        cost += (prod?.CostPrice || 0) * qty;

        const pid = String(item.PerfumeId ?? item.ProductId ?? '');
        const name = item.PerfumeName || item.ProductName || prod?.Name || pid;
        if (!byProduct[pid]) byProduct[pid] = { name, qty: 0, revenue: 0 };
        byProduct[pid].qty += qty;
        byProduct[pid].revenue += item.Subtotal || 0;

        const cat = prod?.Category || 'Other';
        if (!byCategory[cat]) byCategory[cat] = { name: cat, qty: 0, revenue: 0 };
        byCategory[cat].qty += qty;
        byCategory[cat].revenue += item.Subtotal || 0;
      });

      if (sale.CustomerId != null) {
        const k = String(sale.CustomerId);
        if (!byCustomer[k]) byCustomer[k] = { id: k, count: 0, total: 0 };
        byCustomer[k].count++;
        byCustomer[k].total += sale.Total || 0;
      }
      if (sale.ResellerId != null) {
        const k = String(sale.ResellerId);
        if (!byReseller[k]) byReseller[k] = { id: k, count: 0, total: 0 };
        byReseller[k].count++;
        byReseller[k].total += sale.Total || 0;
      }
    });

    return {
      revenue, cost, profit: revenue - cost, bottles,
      salesCount: filteredSales.length,
      marginPct: revenue > 0 ? ((revenue - cost) / revenue * 100).toFixed(1) : '0.0',
      salesByDate: Object.values(byDate).sort((a,b) => a._ts - b._ts),
      topProducts: Object.values(byProduct).sort((a,b) => b.qty - a.qty).slice(0,10),
      topCategories: Object.values(byCategory).sort((a,b) => b.qty - a.qty),
      topCustomers: Object.values(byCustomer).sort((a,b) => b.total - a.total).slice(0,10),
      topResellers: Object.values(byReseller).sort((a,b) => b.total - a.total),
    };
  }, [filteredSales, products]);

  // -- PO spend --------------------------------------------------
  const poSpend = useMemo(() =>
    purchaseOrders.filter(po => toDate(po.OrderDate) >= cutoff)
      .reduce((s, po) => s + (po.TotalAmount || 0), 0),
    [purchaseOrders, rangeDays, cutoff]
  );

  // -- Customer map ----------------------------------------------
  const customerMap = useMemo(() => {
    const m = {}; customers.forEach(c => { m[c.id] = c; }); return m;
  }, [customers]);

  const resellerMap = useMemo(() => {
    const m = {}; resellers.forEach(r => { m[r.id] = r; }); return m;
  }, [resellers]);

  // -- Dead Stock Report (products with zero sales in last 90 days AND stock > 0) --
  const deadStock = useMemo(() => {
    const ninetyDaysAgo = new Date(now - 90 * 86400000);
    const soldProducts = new Set();
    
    sales.forEach(sale => {
      const saleDate = toDate(sale.SaleDate);
      if (saleDate >= ninetyDaysAgo) {
        (sale.Items || []).forEach(item => {
          const pid = String(item.PerfumeId ?? item.ProductId ?? '');
          if (pid) soldProducts.add(pid);
        });
      }
    });
    
    return products.filter(p => p.Stock > 0 && !soldProducts.has(p.id)).map(p => {
      const lastSale = sales
        .filter(s => (s.Items || []).some(item => String(item.PerfumeId ?? item.ProductId ?? '') === p.id))
        .sort((a, b) => toDate(b.SaleDate) - toDate(a.SaleDate))[0];
      const lastSoldDate = lastSale ? toDate(lastSale.SaleDate) : null;
      const daysSinceLastSale = lastSoldDate ? Math.floor((now - lastSoldDate) / 86400000) : 'Never';
      return { ...p, lastSoldDate, daysSinceLastSale };
    });
  }, [products, sales, now]);

  // -- Slow Mover Report (products with sales velocity < 1 unit/week in last 30 days) --
  const slowMovers = useMemo(() => {
    const thirtyDaysAgo = new Date(now - 30 * 86400000);
    const salesByProduct = {};
    
    sales.forEach(sale => {
      const saleDate = toDate(sale.SaleDate);
      if (saleDate >= thirtyDaysAgo) {
        (sale.Items || []).forEach(item => {
          const pid = String(item.PerfumeId ?? item.ProductId ?? '');
          if (pid) {
            salesByProduct[pid] = (salesByProduct[pid] || 0) + (item.Quantity || 0);
          }
        });
      }
    });
    
    return products
      .filter(p => {
        const totalSold = salesByProduct[p.id] || 0;
        const weeklyVelocity = totalSold / 4; // 30 days ≈ 4 weeks
        return weeklyVelocity < 1 && p.Stock > 0;
      })
      .map(p => {
        const totalSold = salesByProduct[p.id] || 0;
        const weeklyVelocity = (totalSold / 4).toFixed(2);
        let suggestedAction = 'restock';
        if (p.Stock > 20) suggestedAction = 'liquidate';
        else if (p.Stock > 10) suggestedAction = 'discontinue';
        return { ...p, weeklyVelocity, suggestedAction };
      });
  }, [products, sales, now]);

  // -- CSV export ------------------------------------------------
  const exportCSV = () => {
    const rows = [['Date','Customer/Reseller','Items','Total','Payment']];
    filteredSales.forEach(s => {
      const d = toDate(s.SaleDate).toLocaleDateString('en-PH');
      const who = s.CustomerId != null
        ? (customerMap[String(s.CustomerId)]?.Name || 'Walk-in')
        : (resellerMap[String(s.ResellerId)]?.Name || 'Reseller');
      const items = (s.Items||[]).reduce((t,i) => t+(i.Quantity||0), 0);
      rows.push([d, who, items, s.Total||0, s.PaymentMethod||'Cash']);
    });
    const csv = toCsv(rows);
    const blob = new Blob([csv], { type:'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url;
    a.download = `scnt-sales-report-${new Date().toISOString().slice(0,10)}.csv`;
    a.click(); URL.revokeObjectURL(url);
  };

  const exportStockMovementsCSV = () => {
    const rows = [['Date','Product','SKU','Type','Qty','Reference','Notes']];
    stockMovements.forEach(m => {
      const d = m.Date?.toDate ? m.Date.toDate().toLocaleDateString('en-PH') : new Date(m.Date || 0).toLocaleDateString('en-PH');
      rows.push([d, m.ProductName, m.SKU, m.Type, m.Quantity, m.Reference, m.Notes]);
    });
    const csv = toCsv(rows);
    const blob = new Blob([csv], { type:'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url;
    a.download = `scnt-stock-movements-${new Date().toISOString().slice(0,10)}.csv`;
    a.click(); URL.revokeObjectURL(url);
  };

  const exportDeadStockCSV = () => {
    const rows = [['Product','SKU','Current Stock','Last Sold Date','Days Since Last Sale']];
    deadStock.forEach(p => {
      rows.push([p.Name, p.BatchNumber || p.id, p.Stock, 
        p.lastSoldDate ? p.lastSoldDate.toLocaleDateString('en-PH') : 'Never',
        p.daysSinceLastSale]);
    });
    const csv = toCsv(rows);
    const blob = new Blob([csv], { type:'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url;
    a.download = `scnt-dead-stock-${new Date().toISOString().slice(0,10)}.csv`;
    a.click(); URL.revokeObjectURL(url);
  };

  const exportSlowMoversCSV = () => {
    const rows = [['Product','SKU','Current Stock','Weekly Velocity','Suggested Action']];
    slowMovers.forEach(p => {
      rows.push([p.Name, p.BatchNumber || p.id, p.Stock, p.weeklyVelocity, p.suggestedAction]);
    });
    const csv = toCsv(rows);
    const blob = new Blob([csv], { type:'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url;
    a.download = `scnt-slow-movers-${new Date().toISOString().slice(0,10)}.csv`;
    a.click(); URL.revokeObjectURL(url);
  };

  if (loading) return (
    <div className="inventory-page" style={{ display:'flex', justifyContent:'center', alignItems:'center', height:'60vh' }}>
      <div className="spinner" />
    </div>
  );

  const tabs = [
    { id:'sales',     label:'Sales',     icon:<FaChartBar /> },
    { id:'products',  label:'Products',  icon:<FaBoxes /> },
    { id:'customers', label:'Customers', icon:<FaUsers /> },
    { id:'resellers', label:'Resellers', icon:<FaHandshake /> },
    { id:'stock-movements', label:'Stock Movements', icon:<FaBoxes /> },
    { id:'dead-stock', label:'Dead Stock', icon:<FaExclamationTriangle /> },
    { id:'slow-movers', label:'Slow Movers', icon:<FaClock /> },
  ];

  const tooltipStyle = { borderRadius:8, border:'1px solid rgba(255,255,255,0.08)', background:'#1f232b', boxShadow:'0 4px 20px rgba(0,0,0,0.3)', fontSize:12, color:'#e2e8f0' };

  return (
    <div className="inventory-page">
      {/* Header */}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:24, flexWrap:'wrap', gap:12 }}>
        <div>
          <h1 style={{ fontSize:24, fontWeight:800, color:'var(--text-primary)', marginBottom:4 }}>Reports</h1>
          <div className="header-tabs">
            {tabs.map(t => (
              <button key={t.id} onClick={() => setActiveTab(t.id)} className={`header-tab ${activeTab === t.id ? 'header-tab-active' : ''}`}>
                {t.icon} {t.label}
              </button>
            ))}
          </div>
        </div>
        <div style={{ display:'flex', gap:10, alignItems:'center' }}>
          {/* Date range */}
          <div style={{ display:'flex', background:'var(--bg-card)', borderRadius:12, overflow:'hidden',
            boxShadow:'0 2px 8px rgba(0,0,0,0.2)', border:'1px solid var(--border)' }}>
            {RANGES.map(r => (
              <button key={r.days} onClick={() => setRangeDays(r.days)} style={{
                padding:'8px 14px', border:'none', fontSize:12, fontWeight:600, cursor:'pointer',
                background: rangeDays === r.days ? 'var(--accent)' : 'transparent',
                color: rangeDays === r.days ? '#0f172a' : 'var(--text-muted)',
                transition:'all 0.2s', whiteSpace:'nowrap' }}>
                {r.label}
              </button>
            ))}
          </div>
          <button onClick={exportCSV} className="btn btn-primary" style={{
            display:'flex', alignItems:'center', gap:7, padding:'9px 16px',
            borderRadius:10, fontSize:13, fontWeight:700, cursor:'pointer' }}>
            <FaDownload /> Export CSV
          </button>
        </div>
      </div>

      {/* KPI Cards - Cash Flow Style */}
      <div className="stat-cashflow-grid">
        <div className="stat-cashflow">
          <div className="stat-cashflow-icon" style={{ background:'var(--accent-dim)' }}>
            <FaChartBar style={{ color:'var(--accent)' }} />
          </div>
          <div className="stat-cashflow-label">Revenue</div>
          <div className="stat-cashflow-value">
            ₱{metrics.revenue.toLocaleString('en-PH')}
          </div>
        </div>
        <div className="stat-cashflow">
          <div className="stat-cashflow-icon" style={{ background:'var(--danger-bg)' }}>
            <FaChartBar style={{ color:'var(--danger)' }} />
          </div>
          <div className="stat-cashflow-label">Cost</div>
          <div className="stat-cashflow-value" style={{ color:'var(--danger)' }}>
            ₱{metrics.cost.toLocaleString('en-PH')}
          </div>
        </div>
        <div className="stat-cashflow stat-cashflow-green">
          <div className="stat-cashflow-icon" style={{ background:'rgba(255,255,255,0.2)' }}>
            <FaChartBar style={{ color:'white' }} />
          </div>
          <div className="stat-cashflow-label">Profit</div>
          <div className="stat-cashflow-value" style={{ color:'white' }}>
            ₱{metrics.profit.toLocaleString('en-PH')}
          </div>
        </div>
        <div className="stat-cashflow stat-cashflow-dark">
          <div className="stat-cashflow-icon" style={{ background:'rgba(255,255,255,0.15)' }}>
            <FaBoxes style={{ color:'white' }} />
          </div>
          <div className="stat-cashflow-label">Bottles Sold</div>
          <div className="stat-cashflow-value" style={{ color:'white' }}>
            {metrics.bottles}
          </div>
        </div>
      </div>

      {/* Margin indicator */}
      <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:20, padding:'10px 16px',
        background:'var(--bg-card)', borderRadius:12, boxShadow:'0 2px 12px rgba(0,0,0,0.2)', fontSize:13, fontWeight:600,
        border:'1px solid var(--border)' }}>
        <span style={{ color:'var(--text-muted)' }}>Margin:</span>
        <span style={{ color:'var(--accent)', display:'flex', alignItems:'center', gap:4 }}>
          {metrics.marginPct}%
        </span>
        <span style={{ color:'rgba(255,255,255,0.1)', margin:'0 4px' }}>|</span>
        <span style={{ color:'var(--text-muted)' }}>PO Spend: <span style={{ color:'var(--danger)' }}>₱{poSpend.toLocaleString('en-PH')}</span></span>
      </div>

      {/* -- SALES TAB -- */}
      {activeTab === 'sales' && (
        <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
          {/* Revenue trend */}
          <div className="chart-card">
            <h3 style={{ fontSize:14, fontWeight:700, color:'var(--text-primary)', marginBottom:4 }}>Revenue Trend</h3>
            <p style={{ fontSize:11, color:'var(--text-muted)', marginBottom:14 }}>{metrics.salesCount} transactions in period</p>
            {metrics.salesByDate.length === 0 ? <Empty /> :
              <ResponsiveContainer width="100%" height={260}>
                <LineChart data={metrics.salesByDate}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
                  <XAxis dataKey="day" tick={{ fontSize:11, fill:'#64748b' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize:11, fill:'#64748b' }} axisLine={false} tickLine={false}
                    tickFormatter={v => `₱${(v/1000).toFixed(0)}k`} />
                  <Tooltip formatter={v => [`₱${v.toLocaleString()}`, 'Revenue']}
                    contentStyle={tooltipStyle} />
                  <Line type="monotone" dataKey="revenue" stroke="#2dd4bf" strokeWidth={2.5}
                    dot={{ r:3, fill:'#2dd4bf', strokeWidth:2, stroke:'#1f232b' }} activeDot={{ r:6 }} />
                </LineChart>
              </ResponsiveContainer>
            }
          </div>

          {/* Profit breakdown */}
          <div className="chart-grid">
            <div className="chart-card">
              <h3 style={{ fontSize:14, fontWeight:700, color:'var(--text-primary)', marginBottom:4 }}>Profit vs Cost</h3>
              <p style={{ fontSize:11, color:'var(--text-muted)', marginBottom:14 }}>Revenue breakdown</p>
              {metrics.revenue === 0 ? <Empty /> :
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie data={[
                        { name:'Profit', value: Math.max(metrics.profit, 0) },
                        { name:'Cost',   value: metrics.cost }
                      ]}
                      cx="50%" cy="50%" innerRadius={55} outerRadius={80}
                      paddingAngle={4} dataKey="value" startAngle={90} endAngle={-270}>
                      <Cell fill="#2dd4bf" />
                      <Cell fill="#334155" />
                    </Pie>
                    <Tooltip formatter={v => `₱${v.toLocaleString()}`} contentStyle={tooltipStyle} />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              }
            </div>
            <div className="chart-card">
              <h3 style={{ fontSize:14, fontWeight:700, color:'var(--text-primary)', marginBottom:4 }}>PO Spend vs Revenue</h3>
              <p style={{ fontSize:11, color:'var(--text-muted)', marginBottom:14 }}>Procurement vs sales</p>
              {metrics.revenue === 0 ? <Empty /> :
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={[
                    { name:'Revenue', value: metrics.revenue },
                    { name:'PO Spend', value: poSpend },
                    { name:'Profit',  value: Math.max(metrics.profit, 0) },
                  ]}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
                    <XAxis dataKey="name" tick={{ fontSize:11, fill:'#64748b' }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize:11, fill:'#64748b' }} axisLine={false} tickLine={false}
                      tickFormatter={v => `₱${(v/1000).toFixed(0)}k`} />
                    <Tooltip formatter={v => `₱${v.toLocaleString()}`}
                      contentStyle={tooltipStyle} />
                    <Bar dataKey="value" radius={[8,8,0,0]}>
                      <Cell fill="#2dd4bf" />
                      <Cell fill="#ef4444" />
                      <Cell fill="#3b82f6" />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              }
            </div>
          </div>
        </div>
      )}

      {/* -- PRODUCTS TAB -- */}
      {activeTab === 'products' && (
        <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
          <div className="chart-grid">
            <div className="chart-card">
              <h3 style={{ fontSize:14, fontWeight:700, color:'var(--text-primary)', marginBottom:4 }}>Top 10 Products by Bottles Sold</h3>
              {metrics.topProducts.length === 0 ? <Empty /> :
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={metrics.topProducts} layout="vertical" margin={{ left:8, right:16 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" horizontal={false} />
                    <XAxis type="number" tick={{ fontSize:11, fill:'#64748b' }} axisLine={false} tickLine={false} />
                    <YAxis type="category" dataKey="name" width={130} tick={{ fontSize:10, fill:'#64748b' }} axisLine={false} tickLine={false} />
                    <Tooltip formatter={v => [`${v} bottles`, 'Sold']}
                      contentStyle={tooltipStyle} />
                    <Bar dataKey="qty" radius={[0,8,8,0]}>
                      {metrics.topProducts.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              }
            </div>
            <div className="chart-card">
              <h3 style={{ fontSize:14, fontWeight:700, color:'var(--text-primary)', marginBottom:4 }}>Sales by Category</h3>
              {metrics.topCategories.length === 0 ? <Empty /> :
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie data={metrics.topCategories} dataKey="qty" nameKey="name"
                      cx="50%" cy="50%" outerRadius={100} paddingAngle={3}>
                      {metrics.topCategories.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                    </Pie>
                    <Tooltip formatter={(v, n) => [`${v} bottles`, n]}
                      contentStyle={tooltipStyle} />
                    <Legend iconType="circle" iconSize={10} wrapperStyle={{ fontSize:11, color:'#94a3b8' }} />
                  </PieChart>
                </ResponsiveContainer>
              }
            </div>
          </div>
          {/* Product table */}
          <div className="chart-card">
            <h3 style={{ fontSize:14, fontWeight:700, color:'var(--text-primary)', marginBottom:14 }}>Product Revenue Breakdown</h3>
            <SimpleTable
              cols={['Product','Bottles Sold','Revenue','Avg/Bottle']}
              rows={metrics.topProducts.map(p => [
                p.name,
                <Pill key="q" bg="var(--accent-dim)" color="var(--accent)">{p.qty}</Pill>,
                <span key="r" style={{ fontWeight:700, color:'var(--accent)' }}>₱{p.revenue.toLocaleString()}</span>,
                `₱${p.qty > 0 ? (p.revenue/p.qty).toFixed(0) : 0}`
              ])}
            />
          </div>
        </div>
      )}

      {/* -- CUSTOMERS TAB -- */}
      {activeTab === 'customers' && (
        <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
          <div className="chart-grid">
            <div className="chart-card">
              <h3 style={{ fontSize:14, fontWeight:700, color:'var(--text-primary)', marginBottom:4 }}>Top Customers by Spend</h3>
              {metrics.topCustomers.length === 0 ? <Empty /> :
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={metrics.topCustomers.map(c => ({
                    name: customerMap[c.id]?.Name || 'Walk-in',
                    total: c.total
                  }))} layout="vertical" margin={{ left:8, right:16 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" horizontal={false} />
                    <XAxis type="number" tick={{ fontSize:11, fill:'#64748b' }} axisLine={false} tickLine={false}
                      tickFormatter={v => `₱${(v/1000).toFixed(0)}k`} />
                    <YAxis type="category" dataKey="name" width={110} tick={{ fontSize:10, fill:'#64748b' }} axisLine={false} tickLine={false} />
                    <Tooltip formatter={v => [`₱${v.toLocaleString()}`, 'Spent']}
                      contentStyle={tooltipStyle} />
                    <Bar dataKey="total" radius={[0,8,8,0]}>
                      {metrics.topCustomers.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              }
            </div>
            <div className="chart-card">
              <h3 style={{ fontSize:14, fontWeight:700, color:'var(--text-primary)', marginBottom:4 }}>Customer Stats</h3>
              <div style={{ display:'flex', flexDirection:'column', gap:8, marginTop:4 }}>
                {[
                  ['Total Customers',    customers.length,                                                'var(--text-primary)'],
                  ['Active in Period',   metrics.topCustomers.length,                                    'var(--accent)'],
                  ['Total Transactions', metrics.salesCount,                                             'var(--warning)'],
                  ['Avg per Customer',   metrics.topCustomers.length > 0
                    ? `₱${(metrics.revenue / metrics.topCustomers.length).toFixed(0)}` : '₱0',          '#a78bfa'],
                  ['Repeat Customers',   metrics.topCustomers.filter(c => c.count > 1).length,           'var(--info)'],
                ].map(([l, v, c]) => (
                  <div key={l} style={{ display:'flex', justifyContent:'space-between', alignItems:'center',
                    padding:'10px 14px', background:'var(--bg-secondary)', borderRadius:10, borderLeft:`3px solid ${c}` }}>
                    <span style={{ fontSize:13, color:'var(--text-muted)' }}>{l}</span>
                    <span style={{ fontSize:15, fontWeight:700, color:c }}>{v}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <div className="chart-card">
            <h3 style={{ fontSize:14, fontWeight:700, color:'var(--text-primary)', marginBottom:14 }}>Top Customers Table</h3>
            <SimpleTable
              cols={['Customer','Purchases','Total Spent','Avg Order']}
              rows={metrics.topCustomers.map(c => [
                customerMap[c.id]?.Name || 'Walk-in',
                <Pill key="p" bg="var(--accent-dim)" color="var(--accent)">{c.count}</Pill>,
                <span key="t" style={{ fontWeight:700, color:'var(--accent)' }}>₱{c.total.toLocaleString()}</span>,
                `₱${(c.total / c.count).toFixed(0)}`
              ])}
            />
          </div>
        </div>
      )}

      {/* -- RESELLERS TAB -- */}
      {activeTab === 'resellers' && (
        <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
          <div className="chart-grid">
            <div className="chart-card">
              <h3 style={{ fontSize:14, fontWeight:700, color:'var(--text-primary)', marginBottom:4 }}>Reseller Revenue</h3>
              {metrics.topResellers.length === 0 ? <Empty text="No reseller sales in this period" /> :
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={metrics.topResellers.map(r => ({
                    name: resellerMap[r.id]?.Name || 'Unknown',
                    total: r.total
                  }))}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
                    <XAxis dataKey="name" tick={{ fontSize:10, fill:'#64748b' }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize:11, fill:'#64748b' }} axisLine={false} tickLine={false}
                      tickFormatter={v => `₱${(v/1000).toFixed(0)}k`} />
                    <Tooltip formatter={v => [`₱${v.toLocaleString()}`, 'Revenue']}
                      contentStyle={tooltipStyle} />
                    <Bar dataKey="total" radius={[8,8,0,0]}>
                      {metrics.topResellers.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              }
            </div>
            <div className="chart-card">
              <h3 style={{ fontSize:14, fontWeight:700, color:'var(--text-primary)', marginBottom:4 }}>Reseller Stats</h3>
              <div style={{ display:'flex', flexDirection:'column', gap:8, marginTop:4 }}>
                {[
                  ['Total Resellers',    resellers.length,                                                'var(--text-primary)'],
                  ['Active in Period',   metrics.topResellers.length,                                    'var(--accent)'],
                  ['Reseller Revenue',   `₱${metrics.topResellers.reduce((s,r)=>s+r.total,0).toLocaleString('en-PH')}`, 'var(--warning)'],
                  ['Reseller Orders',    metrics.topResellers.reduce((s,r)=>s+r.count,0),               '#a78bfa'],
                ].map(([l, v, c]) => (
                  <div key={l} style={{ display:'flex', justifyContent:'space-between', alignItems:'center',
                    padding:'10px 14px', background:'var(--bg-secondary)', borderRadius:10, borderLeft:`3px solid ${c}` }}>
                    <span style={{ fontSize:13, color:'var(--text-muted)' }}>{l}</span>
                    <span style={{ fontSize:15, fontWeight:700, color:c }}>{v}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <div className="chart-card">
            <h3 style={{ fontSize:14, fontWeight:700, color:'var(--text-primary)', marginBottom:14 }}>Reseller Performance Table</h3>
            <SimpleTable
              cols={['Reseller','Orders','Revenue','Avg Order','Discount']}
              rows={metrics.topResellers.map(r => {
                const res = resellerMap[r.id];
                return [
                  res?.Name || 'Unknown',
                  <Pill key="o" bg="var(--info-bg)" color="var(--info)">{r.count}</Pill>,
                  <span key="t" style={{ fontWeight:700, color:'var(--accent)' }}>₱{r.total.toLocaleString()}</span>,
                  `₱${(r.total / r.count).toFixed(0)}`,
                  res?.DiscountRate ? `${res.DiscountRate}%` : '·'
                ];
              })}
            />
          </div>
        </div>
      )}

      {/* -- STOCK MOVEMENTS TAB -- */}
      {activeTab === 'stock-movements' && (
        <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
          <div className="chart-card">
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:14 }}>
              <h3 style={{ fontSize:14, fontWeight:700, color:'var(--text-primary)' }}>Stock Movements</h3>
              <button onClick={exportStockMovementsCSV} className="btn btn-primary" style={{
                display:'flex', alignItems:'center', gap:7, padding:'9px 16px',
                borderRadius:10, fontSize:13, fontWeight:700, cursor:'pointer' }}>
                <FaDownload /> Export CSV
              </button>
            </div>
            {loadingMovements ? (
              <div style={{ textAlign:'center', padding:20, color:'var(--text-muted)' }}>Loading...</div>
            ) : stockMovements.length === 0 ? (
              <Empty text="No stock movements recorded yet" />
            ) : (
              <SimpleTable
                cols={['Date','Product','SKU','Type','Qty','Reference','Notes']}
                rows={stockMovements.map(m => {
                  const d = m.Date?.toDate ? m.Date.toDate().toLocaleDateString('en-PH') : new Date(m.Date || 0).toLocaleDateString('en-PH');
                  return [
                    d,
                    m.ProductName,
                    m.SKU,
                    <Pill key="t" bg={m.Type === 'in' ? 'var(--success-bg)' : 'var(--danger-bg)'} 
                          color={m.Type === 'in' ? 'var(--accent)' : 'var(--danger)'}>{m.Type}</Pill>,
                    m.Quantity,
                    m.Reference,
                    m.Notes
                  ];
                })}
              />
            )}
          </div>
        </div>
      )}

      {/* -- DEAD STOCK TAB -- */}
      {activeTab === 'dead-stock' && (
        <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
          <div className="chart-card">
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:14 }}>
              <h3 style={{ fontSize:14, fontWeight:700, color:'var(--text-primary)' }}>
                Dead Stock (No sales in 90 days, stock &gt; 0)
              </h3>
              <button onClick={exportDeadStockCSV} className="btn btn-primary" style={{
                display:'flex', alignItems:'center', gap:7, padding:'9px 16px',
                borderRadius:10, fontSize:13, fontWeight:700, cursor:'pointer' }}>
                <FaDownload /> Export CSV
              </button>
            </div>
            {deadStock.length === 0 ? (
              <Empty text="No dead stock found" />
            ) : (
              <SimpleTable
                cols={['Product','SKU','Current Stock','Last Sold Date','Days Since Last Sale']}
                rows={deadStock.map(p => [
                  p.Name,
                  p.BatchNumber || p.id,
                  <Pill key="s" bg="var(--warning-bg)" color="var(--warning)">{p.Stock}</Pill>,
                  p.lastSoldDate ? p.lastSoldDate.toLocaleDateString('en-PH') : 'Never',
                  <Pill key="d" bg="var(--danger-bg)" color="var(--danger)">{p.daysSinceLastSale}</Pill>
                ])}
              />
            )}
          </div>
        </div>
      )}

      {/* -- SLOW MOVERS TAB -- */}
      {activeTab === 'slow-movers' && (
        <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
          <div className="chart-card">
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:14 }}>
              <h3 style={{ fontSize:14, fontWeight:700, color:'var(--text-primary)' }}>
                Slow Movers (Velocity &lt; 1 unit/week)
              </h3>
              <button onClick={exportSlowMoversCSV} className="btn btn-primary" style={{
                display:'flex', alignItems:'center', gap:7, padding:'9px 16px',
                borderRadius:10, fontSize:13, fontWeight:700, cursor:'pointer' }}>
                <FaDownload /> Export CSV
              </button>
            </div>
            {slowMovers.length === 0 ? (
              <Empty text="No slow movers found" />
            ) : (
              <SimpleTable
                cols={['Product','SKU','Current Stock','Weekly Velocity','Suggested Action']}
                rows={slowMovers.map(p => [
                  p.Name,
                  p.BatchNumber || p.id,
                  <Pill key="s" bg="var(--info-bg)" color="var(--info)">{p.Stock}</Pill>,
                  p.weeklyVelocity,
                  <Pill key="a" bg={p.suggestedAction === 'restock' ? 'var(--success-bg)' : 
                         p.suggestedAction === 'liquidate' ? 'var(--warning-bg)' : 'var(--danger-bg)'}
                        color={p.suggestedAction === 'restock' ? 'var(--accent)' : 
                               p.suggestedAction === 'liquidate' ? 'var(--warning)' : 'var(--danger)'}>
                    {p.suggestedAction}
                  </Pill>
                ])}
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// -- Shared components ------------------------------------------

function SimpleTable({ cols, rows }) {
  return (
    <div style={{ overflowX:'auto' }}>
      <table className="dashboard-table" style={{ width:'100%', borderCollapse:'collapse' }}>
        <thead>
          <tr>{cols.map(c => (
            <th key={c}>{c}</th>
          ))}</tr>
        </thead>
        <tbody>
          {rows.length === 0
            ? <tr><td colSpan={cols.length} style={{ padding:'24px', textAlign:'center', color:'var(--text-muted)', fontSize:13 }}>No data</td></tr>
            : rows.map((row, i) => (
              <tr key={i}>
                {row.map((cell, j) => (
                  <td key={j}>{cell}</td>
                ))}
              </tr>
            ))
          }
        </tbody>
      </table>
    </div>
  );
}

function Pill({ bg, color, children }) {
  return (
    <span style={{ display:'inline-block', padding:'3px 10px', borderRadius:20,
      fontSize:12, fontWeight:600, background:bg, color }}>{children}</span>
  );
}

function Empty({ text = 'No data for this period' }) {
  return (
    <div style={{ textAlign:'center', color:'var(--text-muted)', padding:'32px 0', fontSize:13 }}>{text}</div>
  );
}
