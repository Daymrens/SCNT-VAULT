import React, { useState, useMemo, useEffect } from 'react';
import { useData } from '../contexts/DataContext';
import { Link } from 'react-router-dom';
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';
import {
  FaCashRegister, FaPlus, FaFileInvoice, FaChartBar,
  FaExclamationTriangle, FaBoxes, FaArrowUp, FaArrowDown
} from 'react-icons/fa';
import { StatusBadge } from '../components/shared';

const COLORS = ['#2dd4bf', '#64748b', '#3b82f6', '#f59e0b', '#a78bfa'];

const TOOLTIP_STYLE = {
  background: '#1f232b',
  border: '1px solid rgba(255,255,255,0.08)',
  borderRadius: 8,
  fontSize: 12,
  boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
};
const TOOLTIP_LABEL = { color: '#e2e8f0' };
const TOOLTIP_ITEM = { color: '#94a3b8' };
const AXIS_TICK = { fontSize: 11, fill: '#64748b' };

const RANGES = [
  { label:'Last 7 days',  days:7  },
  { label:'Last 30 days', days:30 },
  { label:'Last 90 days', days:90 },
  { label:'This year',    days:365},
  { label:'All time',     days:0  },
];

const toDate = (v) => v?.toDate ? v.toDate() : new Date(v || 0);

export default function Dashboard() {
  const { products, sales, customers, resellers, suppliers, purchaseOrders, loading, loadSales, loadPurchaseOrders } = useData();
  const [rangeDays, setRangeDays] = useState(30);

  useEffect(() => { loadSales(); loadPurchaseOrders(); }, [loadSales, loadPurchaseOrders]);

  const cutoff = useMemo(() =>
    rangeDays === 0 ? new Date(0) : new Date(Date.now() - rangeDays * 86400000),
    [rangeDays]
  );

  const filteredSales = useMemo(() =>
    sales.filter(s => toDate(s.SaleDate) >= cutoff),
    [sales, cutoff]
  );

  const data = useMemo(() => {
    if (!products.length && !sales.length) return null;

    const productMap = {};
    products.forEach(p => { productMap[p.id] = p; });
    const customerMap = {};
    customers.forEach(c => { customerMap[c.id] = c; });
    const resellerMap = {};
    resellers.forEach(r => { resellerMap[r.id] = r; });

    let totalRevenue = 0, totalBottles = 0, totalCost = 0;
    const topMap = {}, resellerPerfMap = {}, byDate = {}, catMap = {}, customerSalesMap = {};
    const recentRaw = [];

    filteredSales.forEach(sale => {
      const total = sale.Total || 0;
      totalRevenue += total;

      if (sale.SaleDate) {
        const d = toDate(sale.SaleDate);
        const key = `${d.getMonth()+1}/${d.getDate()}`;
        if (!byDate[key]) byDate[key] = { day: key, revenue: 0, _ts: d.getTime() };
        byDate[key].revenue += total;
      }

      if (sale.CustomerId) {
        const cid = String(sale.CustomerId);
        customerSalesMap[cid] = (customerSalesMap[cid] || 0) + total;
      }

      const items = sale.Items || [];
      items.forEach(item => {
        const qty = item.Quantity || 0;
        const subtotal = item.Subtotal || 0;
        totalBottles += qty;
        const pid = String(item.PerfumeId ?? item.ProductId ?? '');
        const prod = productMap[pid];
        totalCost += (prod?.CostPrice || 0) * qty;
        if (pid) {
          if (!topMap[pid]) topMap[pid] = { name: item.PerfumeName || item.ProductName || prod?.Name || pid, qty: 0, revenue: 0 };
          topMap[pid].qty += qty;
          topMap[pid].revenue += subtotal;
        }
        const cat = prod?.Category || 'Other';
        catMap[cat] = (catMap[cat] || 0) + qty;
      });

      if (sale.ResellerId != null) {
        const rkey = String(sale.ResellerId);
        const res = resellerMap[rkey];
        if (res) {
          if (!resellerPerfMap[rkey]) resellerPerfMap[rkey] = { name: res.Name, items: 0, total: 0 };
          resellerPerfMap[rkey].items += items.reduce((s, i) => s + (i.Quantity || 0), 0);
          resellerPerfMap[rkey].total += total;
        }
      }
      recentRaw.push(sale);
    });

    recentRaw.sort((a, b) => toDate(b.SaleDate) - toDate(a.SaleDate));

    const profit = totalRevenue - totalCost;

    // Monthly trend
    const now = new Date();
    const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    let thisMonthRev = 0, lastMonthRev = 0;
    sales.forEach(sale => {
      const d = toDate(sale.SaleDate);
      const t = sale.Total || 0;
      if (d >= thisMonthStart) thisMonthRev += t;
      else if (d >= lastMonthStart && d < thisMonthStart) lastMonthRev += t;
    });
    const trend = lastMonthRev > 0
      ? ((thisMonthRev - lastMonthRev) / lastMonthRev * 100).toFixed(0)
      : null;

    // Top customers
    const topCustomers = Object.entries(customerSalesMap)
      .map(([id, total]) => ({ name: customerMap[id]?.Name || 'Unknown', total }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 5);

    // PO summary
    const pendingPO = purchaseOrders.filter(po => po.Status === 'Pending' || po.Status === 'Ordered');
    const totalPOSpend = purchaseOrders.reduce((s, po) => s + (po.TotalAmount || 0), 0);

    // Inventory value
    const inventoryValue = products.reduce((sum, p) =>
      sum + ((p.SellingPrice || p.Price || 0) * (p.Stock || 0)), 0);

    // Upcoming delivery
    const nextDelivery = purchaseOrders
      .filter(po => po.DeliveryDate && po.Status !== 'Completed')
      .sort((a, b) => toDate(a.DeliveryDate) - toDate(b.DeliveryDate))[0] || null;

    return {
      products, customers, resellers, totalRevenue, totalBottles, totalCost, profit,
      salesCount: filteredSales.length,
      allSalesCount: sales.length,
      salesActivity: Object.values(byDate).sort((a,b) => a._ts - b._ts).slice(-10),
      topSelling: Object.values(topMap).sort((a,b) => b.qty - a.qty).slice(0, 5),
      resellerPerf: Object.values(resellerPerfMap).sort((a,b) => b.total - a.total),
      categoryData: Object.entries(catMap).map(([name,value]) => ({ name, value })).sort((a,b) => b.value - a.value).slice(0, 6),
      recentSales: recentRaw.slice(0, 8),
      customerMap,
      lowStock: products.filter(p => {
        const t = p.LowStockThreshold || 0;
        return t > 0 && (p.Stock ?? p.StockLevel ?? 0) <= t;
      }),
      trend, thisMonthRev, lastMonthRev,
      topCustomers,
      pendingPOCount: pendingPO.length,
      totalPOSpend,
      inventoryValue,
      nextDelivery,
    };
  }, [products, sales, customers, resellers, filteredSales, purchaseOrders]);

  // ── Loading skeleton (#11) ────────────────────────────────
  if (loading) return (
    <div className="inventory-page">
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(180px, 1fr))', gap:16, marginBottom:24 }}>
        {[1,2,3,4,5].map(i => <div key={i} className="skeleton" style={{ height:100, borderRadius:14 }} />)}
      </div>
      <div className="dash-charts-1">
        <div className="skeleton" style={{ height:280, borderRadius:16 }} />
        <div className="skeleton" style={{ height:280, borderRadius:16 }} />
      </div>
      <div className="dash-charts-2">
        <div className="skeleton" style={{ height:280, borderRadius:16 }} />
        <div className="skeleton" style={{ height:280, borderRadius:16 }} />
      </div>
    </div>
  );

  // ── Empty state CTA (#12) ─────────────────────────────────
  if (!data) return (
    <div className="inventory-page" style={{ background:'var(--bg-card)', border:'1px solid var(--border)', borderRadius:20, padding:'64px 32px', textAlign:'center',
      boxShadow:'0 4px 20px rgba(0,0,0,0.3)' }}>
      <div style={{ width:72, height:72, borderRadius:'50%', background:'var(--accent-dim)',
        display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 20px' }}>
        <FaBoxes style={{ fontSize:32, color:'var(--accent)' }} />
      </div>
      <h2 style={{ fontSize:22, fontWeight:800, color:'var(--text-primary)', marginBottom:8 }}>Welcome to SCNT Vault</h2>
      <p style={{ color:'var(--text-secondary)', fontSize:14, marginBottom:24, maxWidth:360, margin:'0 auto 24px' }}>
        Start by adding your first product to see your business dashboard come alive.
      </p>
      <Link to="/inventory" style={{
        display:'inline-flex', alignItems:'center', gap:8, padding:'12px 24px',
        background:'var(--accent-gradient)', color:'#0f172a',
        border:'none', borderRadius:12, fontSize:14, fontWeight:700,
        textDecoration:'none', boxShadow:'0 4px 20px rgba(45,212,191,0.25)',
        transition:'transform 0.15s' }}
        onMouseEnter={e => e.currentTarget.style.transform='translateY(-2px)'}
        onMouseLeave={e => e.currentTarget.style.transform='none'}>
        <FaPlus /> Add Your First Product
      </Link>
    </div>
  );

  const { totalRevenue, totalBottles, totalCost, profit, salesCount, allSalesCount,
          products: prods, customers: custs, resellers: res, salesActivity, topSelling,
          resellerPerf, categoryData, recentSales, customerMap, lowStock,
          trend, topCustomers, pendingPOCount, totalPOSpend, inventoryValue, nextDelivery } = data;

  const marginPct = totalRevenue > 0 ? ((profit / totalRevenue) * 100).toFixed(1) : '0.0';

  const trendColor = trend === null ? 'var(--text-muted)' : Number(trend) >= 0 ? 'var(--accent)' : 'var(--danger)';
  const trendText = trend === null
    ? 'No prior month data'
    : `${Number(trend) >= 0 ? '+' : ''}${trend}% vs last month`;
  const TrendIcon = trend === null ? null : Number(trend) >= 0 ? FaArrowUp : FaArrowDown;

  return (
    <div className="inventory-page">
      {/* Header + Date range filter (#2) */}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:24, flexWrap:'wrap', gap:16 }}>
        <div>
          <h1 style={{ fontSize:24, fontWeight:800, color:'var(--text-primary)', marginBottom:4 }}>Dashboard</h1>
          <p style={{ color:'var(--text-muted)', fontSize:13 }}>SCNT Vault — real-time business overview</p>
        </div>
        <div className="header-tabs">
          {RANGES.map(r => (
            <button key={r.days} onClick={() => setRangeDays(r.days)}
              className={`header-tab ${rangeDays === r.days ? 'header-tab-active' : ''}`}>
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {/* Quick Actions (#1) */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(160px, 1fr))', gap:12, marginBottom:24 }}>
        {[
          { label:'Open POS',        path:'/pos',             icon:<FaCashRegister />, bg:'var(--accent-gradient)' },
          { label:'Add Product',     path:'/inventory',       icon:<FaPlus />,         bg:'var(--accent-gradient)' },
          { label:'New Order',       path:'/purchase-orders', icon:<FaFileInvoice />,   bg:'var(--accent-gradient)' },
          { label:'View Reports',    path:'/reports',         icon:<FaChartBar />,      bg:'var(--accent-gradient)' },
        ].map(a => (
          <Link key={a.path} to={a.path} style={{
            display:'flex', alignItems:'center', gap:10, padding:'14px 18px',
            background:a.bg, color:'#0f172a', borderRadius:14, textDecoration:'none',
            boxShadow:'0 4px 16px rgba(45,212,191,0.18)', transition:'transform 0.15s, box-shadow 0.15s' }}
            onMouseEnter={e => { e.currentTarget.style.transform='translateY(-2px)'; e.currentTarget.style.boxShadow='0 6px 24px rgba(45,212,191,0.25)'; }}
            onMouseLeave={e => { e.currentTarget.style.transform='none'; e.currentTarget.style.boxShadow='0 4px 16px rgba(45,212,191,0.18)'; }}>
            <span style={{ fontSize:18 }}>{a.icon}</span>
            <span style={{ fontSize:13, fontWeight:700 }}>{a.label}</span>
          </Link>
        ))}
      </div>

      {/* Stat Cards (#3, #4) */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(180px, 1fr))', gap:16, marginBottom:24 }}>
        <div className="stat-cashflow">
          <div className="stat-cashflow-icon" style={{background:'var(--accent-dim)'}}>
            <FaBoxes style={{ color:'var(--accent)', fontSize:18 }} />
          </div>
          <div className="stat-cashflow-value">{prods.length}</div>
          <div className="stat-cashflow-label">Total Products</div>
        </div>
        <div className="stat-cashflow stat-cashflow-green">
          <div className="stat-cashflow-icon" style={{background:'rgba(255,255,255,0.2)'}}>
            <FaArrowUp style={{ fontSize:18 }} />
          </div>
          <div className="stat-cashflow-value" style={{color:'#0f172a'}}>{totalBottles}</div>
          <div className="stat-cashflow-label" style={{color:'rgba(15,23,42,0.7)'}}>Bottles Sold</div>
        </div>
        <div className="stat-cashflow stat-cashflow-dark">
          <div className="stat-cashflow-icon" style={{background:'rgba(255,255,255,0.2)'}}>
            <FaCashRegister style={{ fontSize:18 }} />
          </div>
          <div className="stat-cashflow-value">₱{totalRevenue.toLocaleString('en-PH')}</div>
          <div className="stat-cashflow-label">Total Revenue</div>
        </div>
        <div className="stat-cashflow">
          <div className="stat-cashflow-icon" style={{background:'var(--accent-dim)'}}>
            <FaChartBar style={{ color:'var(--accent)', fontSize:18 }} />
          </div>
          <div className="stat-cashflow-value" style={{color:'var(--accent)'}}>₱{profit.toLocaleString('en-PH')}</div>
          <div className="stat-cashflow-label">Net Profit</div>
        </div>
        <div className="stat-cashflow">
          <div className="stat-cashflow-icon" style={{background:'var(--accent-dim)'}}>
            <FaBoxes style={{ color:'var(--accent)', fontSize:18 }} />
          </div>
          <div className="stat-cashflow-value">₱{inventoryValue.toLocaleString('en-PH')}</div>
          <div className="stat-cashflow-label">Inventory Value</div>
        </div>
      </div>

      {/* Trend bar (#4) */}
      {trend !== null && (
        <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:16, padding:'10px 16px',
          background:'var(--bg-card)', border:'1px solid var(--border)', borderRadius:12,
          boxShadow:'0 2px 12px rgba(0,0,0,0.2)', fontSize:13, fontWeight:600 }}>
          <span style={{ color:'var(--text-muted)' }}>Monthly trend:</span>
          <span style={{ color:trendColor, display:'flex', alignItems:'center', gap:4 }}>
            {TrendIcon && <TrendIcon style={{ fontSize:11 }} />}
            {trendText}
          </span>
          <span style={{ color:'var(--text-muted)', margin:'0 4px' }}>|</span>
          <span style={{ color:'var(--text-muted)' }}>This month: <span style={{ color:'var(--text-primary)' }}>₱{data.thisMonthRev.toLocaleString()}</span></span>
        </div>
      )}

      {/* Charts Row 1 (#10) */}
      <div className="dash-charts-1">
        <Card title="Sales Activity" subtitle="Recent days revenue trend">
          {salesActivity.length === 0 ? <Empty /> :
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={salesActivity}>
                <defs>
                  <linearGradient id="lineGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#2dd4bf" stopOpacity={0.15}/>
                    <stop offset="95%" stopColor="#2dd4bf" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
                <XAxis dataKey="day" tick={AXIS_TICK} axisLine={false} tickLine={false} />
                <YAxis tick={AXIS_TICK} axisLine={false} tickLine={false}
                  tickFormatter={v => `₱${(v/1000).toFixed(0)}k`} />
                <Tooltip formatter={v => [`₱${v.toLocaleString()}`, 'Revenue']}
                  contentStyle={TOOLTIP_STYLE} labelStyle={TOOLTIP_LABEL} itemStyle={TOOLTIP_ITEM} />
                <Line type="monotone" dataKey="revenue" stroke="#2dd4bf" strokeWidth={2.5}
                  dot={{ r:4, fill:'#2dd4bf', strokeWidth:2, stroke:'#12141a' }} activeDot={{ r:6 }} />
              </LineChart>
            </ResponsiveContainer>
          }
        </Card>

        <Card title="Profit Breakdown" subtitle="Revenue vs cost">
          {totalRevenue === 0 ? <Empty /> : <>
            <ResponsiveContainer width="100%" height={140}>
              <PieChart>
                <Pie data={[
                    { name:'Profit', value: Math.max(profit, 0) },
                    { name:'Cost',   value: totalCost }
                  ]}
                  cx="50%" cy="50%" innerRadius={42} outerRadius={60}
                  paddingAngle={4} dataKey="value" startAngle={90} endAngle={-270}>
                  <Cell fill="#2dd4bf" />
                  <Cell fill="#64748b" />
                </Pie>
                <Tooltip formatter={v => `₱${v.toLocaleString()}`}
                  contentStyle={TOOLTIP_STYLE} labelStyle={TOOLTIP_LABEL} itemStyle={TOOLTIP_ITEM} />
              </PieChart>
            </ResponsiveContainer>
            <div style={{ display:'flex', flexDirection:'column', gap:5, marginTop:4 }}>
              {[
                ['Revenue', `₱${totalRevenue.toLocaleString()}`, 'var(--text-secondary)'],
                ['Cost',    `₱${totalCost.toLocaleString()}`,    'var(--danger)'],
                ['Profit',  `₱${profit.toLocaleString()}`,       'var(--accent)'],
                ['Margin',  `${marginPct}%`,                     'var(--info)'],
              ].map(([l, v, c]) => (
                <div key={l} style={{ display:'flex', justifyContent:'space-between',
                  padding:'5px 10px', background:'rgba(255,255,255,0.04)', borderRadius:8 }}>
                  <span style={{ fontSize:12, color:'var(--text-muted)' }}>{l}</span>
                  <span style={{ fontSize:13, fontWeight:700, color:c }}>{v}</span>
                </div>
              ))}
            </div>
          </>}
        </Card>
      </div>

      {/* Charts Row 2 (#10) */}
      <div className="dash-charts-2">
        <Card title="Top Selling Products" subtitle="By bottles sold">
          {topSelling.length === 0 ? <Empty /> :
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={topSelling} layout="vertical" margin={{ left:8, right:16 }}>
                <defs>
                  <linearGradient id="barGradH" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stopColor="#2dd4bf"/>
                    <stop offset="100%" stopColor="#06b6d4"/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" horizontal={false} />
                <XAxis type="number" tick={AXIS_TICK} axisLine={false} tickLine={false} />
                <YAxis type="category" dataKey="name" width={120} tick={AXIS_TICK} axisLine={false} tickLine={false} />
                <Tooltip formatter={v => [`${v} bottles`, 'Sold']}
                  contentStyle={TOOLTIP_STYLE} labelStyle={TOOLTIP_LABEL} itemStyle={TOOLTIP_ITEM} />
                <Bar dataKey="qty" radius={[0,8,8,0]} fill="url(#barGradH)" />
              </BarChart>
            </ResponsiveContainer>
          }
        </Card>

        <Card title="Sales by Category" subtitle="Bottles per category">
          {categoryData.length === 0 ? <Empty /> :
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={categoryData}>
                <defs>
                  <linearGradient id="barGradV" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#2dd4bf"/>
                    <stop offset="100%" stopColor="#06b6d4"/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
                <XAxis dataKey="name" tick={AXIS_TICK} axisLine={false} tickLine={false} />
                <YAxis tick={AXIS_TICK} axisLine={false} tickLine={false} />
                <Tooltip formatter={v => [`${v} bottles`, 'Sold']}
                  contentStyle={TOOLTIP_STYLE} labelStyle={TOOLTIP_LABEL} itemStyle={TOOLTIP_ITEM} />
                <Bar dataKey="value" radius={[8,8,0,0]} fill="url(#barGradV)" />
              </BarChart>
            </ResponsiveContainer>
          }
        </Card>
      </div>

      {/* Bottom Row (#5, #6, #7) */}
      <div className="dash-bottom">
        <Card title="Low Stock Alert" subtitle={`${lowStock.length} item${lowStock.length !== 1 ? 's' : ''} need restocking`}>
          {lowStock.length === 0
            ? <Empty text="All items well stocked" />
            : <SimpleTable
                cols={['Product','Stock','Min']}
                rows={lowStock.slice(0,6).map(p => [
                  p.Name,
                  <StockBadge key="s" value={p.Stock ?? p.StockLevel ?? 0} />,
                  p.LowStockThreshold
                ])}
              />
          }
        </Card>

        <Card title="Reseller Performance" subtitle="Top resellers by revenue">
          {resellerPerf.length === 0
            ? <Empty text="No reseller sales yet" />
            : <SimpleTable
                cols={['Reseller','Bottles','Total']}
                rows={resellerPerf.map(r => [
                  r.name, r.items,
                  <span key="t" style={{ color:'var(--accent)', fontWeight:700 }}>₱{r.total.toLocaleString()}</span>
                ])}
              />
          }
        </Card>

        <Card title="Top Customers" subtitle="Highest spenders">
          {topCustomers.length === 0
            ? <Empty text="No customer sales yet" />
            : <SimpleTable
                cols={['Customer','Total Spent']}
                rows={topCustomers.map(c => [
                  c.name,
                  <span key="t" style={{ color:'var(--accent)', fontWeight:700 }}>₱{c.total.toLocaleString()}</span>
                ])}
              />
          }
        </Card>

        <Card title="Purchase Orders" subtitle="Orders & spend overview">
          <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
            {[
              ['Total Orders',    purchaseOrders.length,                    'var(--accent)'],
              ['Pending/Ordered', pendingPOCount,                            'var(--warning)'],
              ['Total Spend',     `₱${totalPOSpend.toLocaleString('en-PH')}`, 'var(--info)'],
            ].map(([l, v, c]) => (
              <div key={l} style={{ display:'flex', justifyContent:'space-between',
                alignItems:'center', padding:'9px 12px', background:'var(--bg-secondary)', borderRadius:8, border:'1px solid var(--border)' }}>
                <span style={{ fontSize:13, color:'var(--text-muted)' }}>{l}</span>
                <span style={{ fontSize:15, fontWeight:700, color:c }}>{v}</span>
              </div>
            ))}
          </div>
        </Card>

        <Card title="Business Summary" subtitle="Key metrics at a glance">
          <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
            {[
              ['Customers',     custs.length,  'var(--accent)'],
              ['Resellers',     res.length,    'var(--info)'],
              ['Suppliers',     suppliers.length, '#a78bfa'],
              ['Total Sales',   allSalesCount,     'var(--warning)'],
              ['Total Bottles', totalBottles,      'var(--text-secondary)'],
              ['Avg Sale',      allSalesCount > 0 ? `₱${(totalRevenue/allSalesCount).toFixed(0)}` : '₱0', 'var(--text-primary)'],
            ].map(([l, v, c]) => (
              <div key={l} style={{ display:'flex', justifyContent:'space-between',
                alignItems:'center', padding:'9px 12px', background:'var(--bg-secondary)', borderRadius:8, border:'1px solid var(--border)' }}>
                <span style={{ fontSize:13, color:'var(--text-muted)' }}>{l}</span>
                <span style={{ fontSize:15, fontWeight:700, color:c }}>{v}</span>
              </div>
            ))}
            {nextDelivery && (
              <div style={{ display:'flex', justifyContent:'space-between',
                alignItems:'center', padding:'9px 12px', background:'var(--warning-bg)', borderRadius:8, border:'1px solid var(--border)' }}>
                <span style={{ fontSize:13, color:'var(--warning)' }}>Next Delivery</span>
                <span style={{ fontSize:13, fontWeight:700, color:'var(--warning)' }}>
                  {toDate(nextDelivery.DeliveryDate).toLocaleDateString('en-PH', { month:'short', day:'numeric' })}
                </span>
              </div>
            )}
          </div>
        </Card>
      </div>

      {/* Recent Sales (#9) */}
      <Card title="Recent Sales" subtitle="Latest transactions" link="/sales">
        {recentSales.length === 0 ? <Empty /> :
          <div style={{ overflowX:'auto' }}>
            <table className="dashboard-table">
              <thead>
                <tr>
                  {['Date','Customer','Items','Total','Payment'].map(h => (
                    <th key={h}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {recentSales.map((sale, idx) => {
                  const d = toDate(sale.SaleDate);
                  const cust = sale.CustomerId != null
                    ? customerMap[String(sale.CustomerId)]?.Name
                    : null;
                  const itemCount = (sale.Items || []).reduce((s,i) => s + (i.Quantity||0), 0);
                  return (
                    <tr key={sale.id}>
                      <td style={td}>{d.toLocaleDateString('en-PH')}</td>
                      <td style={td}>
                        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                          <div style={{ width:28, height:28, borderRadius:'50%',
                            background:'var(--accent-gradient)',
                            display:'flex', alignItems:'center', justifyContent:'center',
                            color:'#0f172a', fontSize:11, fontWeight:700, flexShrink:0 }}>
                            {(cust || 'W')[0].toUpperCase()}
                          </div>
                          <span style={{ fontSize:13, color:'var(--text-primary)' }}>{cust || 'Walk-in'}</span>
                        </div>
                      </td>
                      <td style={td}>{itemCount}</td>
                      <td style={{ ...td, fontWeight:700, color:'var(--accent)' }}>
                        ₱{(sale.Total||0).toLocaleString()}
                      </td>
                      <td style={td}>
                        <StatusBadge status={sale.PaymentMethod || 'Cash'} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        }
      </Card>
    </div>
  );
}

// ── Sub-components ──────────────────────────────────────────────

function Card({ title, subtitle, link, children }) {
  return (
    <div className="chart-card">
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16 }}>
        <div>
          <div style={{ fontSize:14, fontWeight:700, color:'var(--text-primary)' }}>{title}</div>
          {subtitle && <div style={{ fontSize:11, color:'var(--text-muted)', marginTop:2 }}>{subtitle}</div>}
        </div>
        {link && (
          <Link to={link} style={{ fontSize:12, fontWeight:600, color:'var(--accent)', textDecoration:'none' }}>
            View All →
          </Link>
        )}
      </div>
      {children}
    </div>
  );
}

function SimpleTable({ cols, rows }) {
  return (
    <table className="dashboard-table">
      <thead>
        <tr>{cols.map(c => (
          <th key={c}>{c}</th>
        ))}</tr>
      </thead>
      <tbody>
        {rows.map((row, i) => (
          <tr key={i}>
            {row.map((cell, j) => (
              <td key={j}>{cell}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function StockBadge({ value }) {
  const danger = (Number(value) || 0) === 0;
  return (
    <span style={{ padding:'2px 8px', borderRadius:20, fontSize:11, fontWeight:700,
      background: danger ? 'var(--danger-bg)' : 'var(--warning-bg)',
      color: danger ? 'var(--danger)' : 'var(--warning)' }}>{value}</span>
  );
}

function Empty({ text = 'No data available' }) {
  return (
    <div style={{ textAlign:'center', color:'var(--text-muted)', padding:'24px 0', fontSize:13 }}>{text}</div>
  );
}

const td = { padding:'12px 14px', fontSize:13, color:'var(--text-primary)' };