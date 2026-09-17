import React, { useState, useEffect } from 'react';
import { Outlet, Link, useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from './shared/Toast';
import { useData } from '../contexts/DataContext';
import { ToastProvider } from './shared/Toast';
import {
  FaHome, FaBoxes, FaTruck, FaUsers, FaHandshake,
  FaShoppingCart, FaFileInvoice, FaFlask, FaChartBar,
  FaCashRegister, FaSignOutAlt, FaBars, FaChevronLeft, FaTimes, FaBell
} from 'react-icons/fa';

const menuItems = [
  { path: '/',               icon: <FaHome />,        label: 'Dashboard' },
  { path: '/inventory',      icon: <FaBoxes />,       label: 'Inventory' },
  { path: '/suppliers',      icon: <FaTruck />,       label: 'Suppliers' },
  { path: '/customers',      icon: <FaUsers />,       label: 'Customers' },
  { path: '/resellers',      icon: <FaHandshake />,   label: 'Resellers' },
  { path: '/sales',          icon: <FaShoppingCart />,label: 'Sales' },
  { path: '/purchase-orders',icon: <FaFileInvoice />, label: 'Purchase Orders' },
  { path: '/testers',        icon: <FaFlask />,       label: 'Testers' },
  { path: '/reports',        icon: <FaChartBar />,    label: 'Reports' },
  { path: '/pos',            icon: <FaCashRegister />,label: 'POS' },
];

const pageLabels = {
  '/': 'Dashboard', '/inventory': 'Inventory', '/suppliers': 'Suppliers',
  '/customers': 'Customers', '/resellers': 'Resellers', '/sales': 'Sales',
  '/purchase-orders': 'Purchase Orders', '/testers': 'Testers',
  '/reports': 'Reports', '/pos': 'Point of Sale',
};

function useIsMobile(breakpoint = 768) {
  const [mobile, setMobile] = useState(() => window.innerWidth <= breakpoint);
  useEffect(() => {
    const handler = () => setMobile(window.innerWidth <= breakpoint);
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, [breakpoint]);
  return mobile;
}

export default function Layout() {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const isMobile = useIsMobile();
  const { currentUser, signOut } = useAuth();
  const { showToast } = useToast();
  const { readyOrders } = useData();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();

  useEffect(() => { setMobileOpen(false); }, [location.pathname]);

  const posOrderParam = searchParams.get('posOrder');
  useEffect(() => {
    if (posOrderParam) {
      navigate(`/pos?posOrder=${encodeURIComponent(posOrderParam)}`, { replace: true });
    }
  }, [posOrderParam, navigate]);

  const openReadyOrder = (order) => navigate(`/pos?posOrder=${encodeURIComponent(order.id)}`);

  const handleLogout = async () => {
    try { await signOut(); navigate('/login'); }
    catch (e) { console.error(e); }
  };

  const sideW = collapsed ? 68 : 240;
  const pageLabel = pageLabels[location.pathname] || location.pathname.replace('/', '').replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

  return (
    <ToastProvider>
    <div style={{ display: 'flex', minHeight: '100vh' }}>

      {readyOrders.length > 0 && (
        <div onClick={() => openReadyOrder(readyOrders[0])} title={`Order ${readyOrders[0].OrderNumber || readyOrders[0].id} ready — tap to open in POS`}
          style={{
            position: 'fixed', top: 76, left: '50%', transform: 'translateX(-50%)', zIndex: 300,
            background: 'linear-gradient(135deg,#6366f1,#8b5cf6)', color: 'white',
            borderRadius: 999, padding: '10px 20px', display: 'flex', alignItems: 'center', gap: 10,
            boxShadow: '0 8px 24px rgba(99,102,241,0.35)', cursor: 'pointer',
            fontSize: 13, fontWeight: 600, maxWidth: 'calc(100vw - 32px)',
            animation: 'toastSlideIn 0.25s ease',
          }}
          onMouseEnter={e => e.currentTarget.style.opacity = 0.92}
          onMouseLeave={e => e.currentTarget.style.opacity = 1}
        >
          <FaBell style={{ fontSize: 14, flexShrink: 0 }} />
          <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            Order {readyOrders[0].OrderNumber || readyOrders[0].id.slice(0, 8)} ready — tap to open in POS
            {readyOrders.length > 1 ? ` (+${readyOrders.length - 1} more)` : ''}
          </span>
        </div>
      )}

      {/* Mobile overlay */}
      {isMobile && mobileOpen && (
        <div onClick={() => setMobileOpen(false)}
          style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.6)',
            zIndex: 150 }} />
      )}

      {/* Sidebar */}
      <aside style={{
        width: isMobile ? 240 : sideW,
        minWidth: isMobile ? 240 : sideW,
        background: 'var(--bg-sidebar)',
        display: 'flex', flexDirection: 'column',
        position: 'fixed', height: '100vh', zIndex: isMobile ? 200 : 100,
        transition: isMobile ? 'transform 0.25s ease' : 'width 0.25s ease, min-width 0.25s ease',
        overflow: 'hidden',
        boxShadow: isMobile
          ? mobileOpen ? '4px 0 24px rgba(0,0,0,0.3)' : 'none'
          : '4px 0 24px rgba(0,0,0,0.3)',
        transform: isMobile
          ? mobileOpen ? 'translateX(0)' : 'translateX(-100%)'
          : 'translateX(0)',
      }}>

        {/* Logo */}
        <div style={{
          padding: collapsed && !isMobile ? '20px 0' : '20px 20px',
          display: 'flex', alignItems: 'center',
          justifyContent: collapsed && !isMobile ? 'center' : 'space-between',
          borderBottom: '1px solid var(--border)',
          minHeight: 64,
        }}>
          {!collapsed && (
            <div style={{ display:'flex', alignItems:'center', gap:10 }}>
              <svg viewBox="0 0 32 32" width="26" height="26" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M16 3C16 3 8 9 8 18c0 4.418 3.582 8 8 8s8-3.582 8-8C24 9 16 3 16 3z" fill="var(--text-primary)"/>
                <ellipse cx="16" cy="18" rx="4.5" ry="5.5" fill="var(--text-secondary)" opacity="0.5"/>
                <rect x="14" y="2" width="4" height="4" rx="2" fill="var(--text-primary)"/>
              </svg>
              <span style={{ color:'var(--text-primary)', fontWeight:800, fontSize:18, letterSpacing:2 }}>SCNT</span>
              <span style={{ color:'var(--text-muted)', fontSize:11, fontWeight:400, marginTop:2 }}>Vault</span>
            </div>
          )}
          {collapsed && !isMobile && (
            <svg viewBox="0 0 32 32" width="26" height="26" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M16 3C16 3 8 9 8 18c0 4.418 3.582 8 8 8s8-3.582 8-8C24 9 16 3 16 3z" fill="var(--text-primary)"/>
              <ellipse cx="16" cy="18" rx="4.5" ry="5.5" fill="var(--text-secondary)" opacity="0.5"/>
              <rect x="14" y="2" width="4" height="4" rx="2" fill="var(--text-primary)"/>
            </svg>
          )}
          {isMobile && (
            <button onClick={() => setMobileOpen(false)}
              style={{ background:'rgba(255,255,255,0.07)', border:'none', borderRadius:8,
                color:'var(--text-muted)', cursor:'pointer', width:32, height:32,
                display:'flex', alignItems:'center', justifyContent:'center' }}>
              <FaTimes />
            </button>
          )}
        </div>

        {/* Nav */}
        <nav style={{ flex:1, padding:'12px 8px', overflowY:'auto', overflowX:'hidden' }}>
          {menuItems.map(item => {
            const active = location.pathname === item.path ||
              (item.path !== '/' && location.pathname.startsWith(item.path));
            return (
              <Link key={item.path} to={item.path}
                title={collapsed && !isMobile ? item.label : undefined} style={{
                  display:'flex', alignItems:'center',
                  gap: collapsed && !isMobile ? 0 : 12,
                  justifyContent: collapsed && !isMobile ? 'center' : 'flex-start',
                  padding: collapsed && !isMobile ? '12px 0' : '10px 14px',
                  borderRadius:10, marginBottom:4, textDecoration:'none',
                  color: active ? 'var(--accent)' : 'var(--text-muted)',
                  background: active ? 'var(--accent-dim)' : 'transparent',
                  fontWeight: active ? 700 : 400, fontSize:13,
                  transition:'all 0.2s', whiteSpace:'nowrap',
                  borderLeft: active ? '3px solid var(--accent)' : '3px solid transparent',
                }}
                onMouseEnter={e => { if (!active) e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; }}
                onMouseLeave={e => { if (!active) e.currentTarget.style.background = 'transparent'; }}
              >
                <span style={{ fontSize:15, flexShrink:0 }}>{item.icon}</span>
                {!collapsed || isMobile ? <span>{item.label}</span> : null}
              </Link>
            );
          })}
        </nav>

        {/* Collapse toggle (desktop only) */}
        {!isMobile && (
          <button onClick={() => setCollapsed(c => !c)} style={{
            margin:'12px 8px', padding:10, background:'rgba(255,255,255,0.07)',
            border:'none', borderRadius:10, color:'var(--text-muted)',
            cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center',
            gap:8, fontSize:13, transition:'background 0.2s',
          }}
          onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.12)'}
          onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.07)'}
          >
            <FaChevronLeft style={{ transform: collapsed ? 'rotate(180deg)' : 'none', transition:'transform 0.25s' }} />
            {!collapsed && <span>Collapse</span>}
          </button>
        )}
      </aside>

      {/* Main */}
      <div style={{ flex:1, marginLeft: isMobile ? 0 : sideW, transition:'margin-left 0.25s ease', display:'flex', flexDirection:'column', minHeight:'100vh' }}>

        {/* Header */}
        <header style={{
          background:'var(--bg-sidebar)', padding:'0 24px', height:64,
          display:'flex', justifyContent:'space-between', alignItems:'center',
          gap:16, position:'sticky', top:0, zIndex:50,
          borderBottom:'1px solid var(--border)',
        }}>
          {/* Left side: hamburger + page title */}
          <div style={{ display:'flex', alignItems:'center', gap:12 }}>
            {isMobile && (
              <button onClick={() => setMobileOpen(true)} style={{
                background:'none', border:'none', color:'var(--text-primary)', cursor:'pointer',
                fontSize:20, padding:4,
              }}>
                <FaBars />
              </button>
            )}
            <span style={{ color:'var(--text-primary)', fontWeight:700, fontSize:16 }}>{pageLabel}</span>
          </div>

          {/* Right side: email + logout */}
          <div style={{ display:'flex', alignItems:'center', gap:16 }}>
            <span style={{ fontSize:13, color:'var(--text-muted)' }}>{currentUser?.email}</span>
            <button onClick={handleLogout} style={{
              display:'flex', alignItems:'center', gap:6,
              padding:'7px 14px',
              background:'rgba(239,68,68,0.12)', color:'var(--danger)',
              border:'1px solid rgba(239,68,68,0.25)', borderRadius:8,
              fontSize:13, fontWeight:600, cursor:'pointer', transition:'background 0.2s',
            }}
            onMouseEnter={e => e.currentTarget.style.background = 'rgba(239,68,68,0.2)'}
            onMouseLeave={e => e.currentTarget.style.background = 'rgba(239,68,68,0.12)'}
            >
              <FaSignOutAlt /> Logout
            </button>
          </div>
        </header>

        {/* Page */}
        <main style={{ flex:1, padding: isMobile ? '20px 16px 80px' : '28px 28px 80px',
          background:'var(--bg-base)', minHeight:'calc(100vh - 64px)' }}>
          <Outlet />
        </main>

        {/* Bottom Navigation Bar — mobile only */}
        {isMobile && (
        <nav style={{
          position: 'fixed', bottom: 0, left: 0, right: 0,
          height: 64, background: 'var(--bg-sidebar)',
          display: 'flex', justifyContent: 'space-around', alignItems: 'center',
          zIndex: 90, borderTop: '1px solid var(--border)',
          boxShadow: '0 -2px 12px rgba(0,0,0,0.3)',
        }}>
          {[
            { path: '/', icon: <FaHome />, label: 'Dashboard' },
            { path: '/inventory', icon: <FaBoxes />, label: 'Inventory' },
            { path: '/sales', icon: <FaShoppingCart />, label: 'Sales' },
            { path: '/pos', icon: <FaCashRegister />, label: 'POS' },
            { path: '/reports', icon: <FaChartBar />, label: 'Reports' },
          ].map(item => {
            const active = location.pathname === item.path ||
              (item.path !== '/' && location.pathname.startsWith(item.path));
            return (
              <Link key={item.path} to={item.path} style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                textDecoration: 'none', gap: 3, flex: 1, padding: '8px 0',
                color: active ? 'var(--accent)' : 'var(--text-muted)',
                transition: 'color 0.2s',
              }}>
                <span style={{ fontSize: 20 }}>{item.icon}</span>
                <span style={{ fontSize: 10, fontWeight: active ? 700 : 400 }}>{item.label}</span>
              </Link>
            );
          })}
        </nav>
        )}
      </div>
    </div>
    </ToastProvider>
  );
}
