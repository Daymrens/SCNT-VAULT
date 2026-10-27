import React, { useState, useEffect } from 'react';
import { Outlet, Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import {
  FaHome, FaBoxes, FaShoppingCart, FaAddressBook, FaUsers,
  FaCog, FaSignOutAlt, FaBars, FaChevronLeft, FaTimes, FaShieldAlt, FaTruck, FaChartLine, FaMapMarkedAlt, FaMoon, FaSun, FaClipboardList
} from 'react-icons/fa';

const menuSections = [
  { label: 'Workspace', items: [
    { path: '/', icon: <FaHome />, label: 'Overview' },
    { path: '/products', icon: <FaBoxes />, label: 'Products' },
    { path: '/orders', icon: <FaShoppingCart />, label: 'Orders' },
  ] },
  { label: 'Relationships', items: [
    { path: '/customers', icon: <FaUsers />, label: 'Customers' },
    { path: '/contacts', icon: <FaAddressBook />, label: 'Messages' },
  ] },
  { label: 'Supply & insights', items: [
    { path: '/materials', icon: <FaBoxes />, label: 'Raw materials' },
    { path: '/batches', icon: <FaClipboardList />, label: 'Production batches' },
    { path: '/warehouses', icon: <FaMapMarkedAlt />, label: 'Storage map' },
    { path: '/purchasing', icon: <FaTruck />, label: 'Purchasing' },
    { path: '/reports', icon: <FaChartLine />, label: 'Reports' },
  ] },
  { label: 'Administration', items: [
    { path: '/settings', icon: <FaCog />, label: 'Settings' },
  ] },
];
const menuItems = menuSections.flatMap(section => section.items);

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
  const [theme, setTheme] = useState(() => window.localStorage.getItem('scnt-admin-theme') || 'light');
  const isMobile = useIsMobile();
  const { currentUser, userRole, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => { setMobileOpen(false); }, [location.pathname]);
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    window.localStorage.setItem('scnt-admin-theme', theme);
  }, [theme]);

  const handleLogout = async () => {
    try { await signOut(); navigate('/login'); }
    catch (e) { console.error(e); }
  };

  const sideW = collapsed ? 72 : 252;
  const pageLabel = menuItems.find(m => m.path === location.pathname)?.label
    || location.pathname.replace('/', '').replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
    || 'Dashboard';

  const Brand = ({ showText }) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <div style={{
        width: 30, height: 30, borderRadius: 9, background: '#b86646',
        display: 'grid', placeItems: 'center', color: '#fff',
        fontWeight: 800, fontSize: 11, letterSpacing: '.5px', flexShrink: 0,
      }}>SC</div>
      {showText && (
        <div style={{ lineHeight: 1.15 }}>
          <div style={{ color: '#14181f', fontWeight: 800, fontSize: 14, letterSpacing: 1.2 }}>SCNT</div>
          <div style={{ color: '#9aa3af', fontSize: 9.5, textTransform: 'uppercase', letterSpacing: '.6px' }}>Admin</div>
        </div>
      )}
    </div>
  );

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#f3f5ef' }}>
      <style>{`
        body { margin: 0; font-family: 'Urbanist', 'Avenir Next', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #f3f5ef; color: #252720; }
      `}</style>

      {isMobile && mobileOpen && (
        <div onClick={() => setMobileOpen(false)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(16,24,40,0.35)', zIndex: 150 }} />
      )}

      {/* Sidebar */}
      <aside className={`admin-sidebar${mobileOpen ? ' is-open' : ''}`} style={{
        width: isMobile ? 252 : sideW,
        minWidth: isMobile ? 252 : sideW,
        background: '#ffffff',
        display: 'flex', flexDirection: 'column',
        position: 'fixed', height: '100vh', zIndex: isMobile ? 200 : 100,
        transition: isMobile ? 'transform 0.25s ease' : 'width 0.25s ease, min-width 0.25s ease',
        overflow: 'hidden',
        borderRight: '1px solid #e6e8ec',
        boxShadow: isMobile && mobileOpen ? '4px 0 24px rgba(16,24,40,0.10)' : 'none',
        transform: isMobile
          ? mobileOpen ? 'translateX(0)' : 'translateX(-100%)'
          : 'translateX(0)',
      }}>
        {/* Logo */}
        <div style={{
          padding: collapsed && !isMobile ? '18px 0' : '18px 18px',
          display: 'flex', alignItems: 'center',
          justifyContent: collapsed && !isMobile ? 'center' : 'space-between',
          borderBottom: '1px solid #eff1f4',
          minHeight: 60,
        }}>
          <Brand showText={!collapsed || isMobile} />
          {isMobile && (
            <button onClick={() => setMobileOpen(false)}
              style={{ background: '#f5f6f8', border: 'none', borderRadius: 8,
                color: '#6b7280', cursor: 'pointer', width: 30, height: 30,
                display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <FaTimes />
            </button>
          )}
        </div>

        {/* Nav */}
        <nav className="admin-navigation" aria-label="Main navigation" style={{ flex: 1, padding: '12px 10px', overflowY: 'auto', overflowX: 'hidden' }}>
          {menuSections.map(section => (
            <div className="admin-nav-section" key={section.label}>
              {(!collapsed || isMobile) && <p className="admin-nav-heading">{section.label}</p>}
              {section.items.map(item => {
                const active = location.pathname === item.path;
                return (
                  <Link key={item.path} to={item.path}
                title={collapsed && !isMobile ? item.label : undefined} className={`admin-nav-link${active ? ' is-active' : ''}`} style={{
                  display: 'flex', alignItems: 'center',
                  gap: collapsed && !isMobile ? 0 : 11,
                  justifyContent: collapsed && !isMobile ? 'center' : 'flex-start',
                  padding: collapsed && !isMobile ? '11px 0' : '9px 12px',
                  borderRadius: 8, marginBottom: 2, textDecoration: 'none',
                  color: active ? '#975238' : '#6b7068',
                  background: active ? '#f7ece7' : 'transparent',
                  fontWeight: active ? 600 : 500, fontSize: 13,
                  transition: 'background 0.15s, color 0.15s', whiteSpace: 'nowrap',
                }}
                onMouseEnter={e => { if (!active) { e.currentTarget.style.background = '#f6f6f1'; e.currentTarget.style.color = '#252720'; } }}
                onMouseLeave={e => { if (!active) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#6b7068'; } }}
              >
                <span style={{ fontSize: 15, flexShrink: 0 }}>{item.icon}</span>
                    {!collapsed || isMobile ? <span>{item.label}</span> : null}
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>

        {!collapsed && !isMobile && (
          <div className="admin-sidebar-note">
            <span className="admin-sidebar-note-mark"><FaShieldAlt /></span>
            <div><strong>SCNT Vault</strong><small>Store operations</small></div>
          </div>
        )}

        {/* Collapse toggle */}
        {!isMobile && (
          <button onClick={() => setCollapsed(c => !c)} style={{
            margin: '8px', padding: 9, background: '#f5f6f8',
            border: '1px solid #e6e8ec', borderRadius: 8, color: '#6b7280',
            cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
            gap: 8, fontSize: 12.5, transition: 'background 0.15s',
          }}
          onMouseEnter={e => e.currentTarget.style.background = '#eef0f3'}
          onMouseLeave={e => e.currentTarget.style.background = '#f5f6f8'}
          >
            <FaChevronLeft style={{ transform: collapsed ? 'rotate(180deg)' : 'none', transition: 'transform 0.25s' }} />
            {!collapsed && <span>Collapse</span>}
          </button>
        )}
      </aside>

      {/* Main */}
      <div className="admin-main-column" style={{ flex: 1, marginLeft: isMobile ? 0 : sideW, transition: 'margin-left 0.25s ease', display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
        {/* Header */}
        <header style={{
          background: 'rgba(255,255,255,0.88)', backdropFilter: 'blur(8px)', padding: '0 20px', height: 58,
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          gap: 16, position: 'sticky', top: 0, zIndex: 50,
          borderBottom: '1px solid #e6e8ec',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            {isMobile && (
              <button onClick={() => setMobileOpen(true)} style={{
                background: 'none', border: 'none', color: '#14181f', cursor: 'pointer',
                fontSize: 18, padding: 4,
              }}>
                <FaBars />
              </button>
            )}
            <span style={{ color: '#14181f', fontWeight: 700, fontSize: 15.5, letterSpacing: '-.2px' }}>{pageLabel}</span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <button className="theme-toggle" onClick={() => setTheme(value => value === 'light' ? 'dark' : 'light')} aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} theme`} title={`Switch to ${theme === 'light' ? 'dark' : 'light'} theme`}>
              {theme === 'light' ? <FaMoon /> : <FaSun />}
            </button>
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 10px',
              borderRadius: 20, fontSize: 10, fontWeight: 700, textTransform: 'uppercase',
              background: '#f7ece7', color: '#975238',
            }}>
              <FaShieldAlt style={{ fontSize: 10 }} /> {userRole || 'user'}
            </span>
            {!isMobile && <span style={{ fontSize: 12.5, color: '#6b7280' }}>{currentUser?.email}</span>}
            <button onClick={handleLogout} style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '6px 12px',
              background: '#ffffff', color: '#dc2626',
              border: '1px solid #f0d5d5', borderRadius: 8,
              fontSize: 12.5, fontWeight: 600, cursor: 'pointer', transition: 'background 0.15s',
            }}
            onMouseEnter={e => e.currentTarget.style.background = '#fdf2f2'}
            onMouseLeave={e => e.currentTarget.style.background = '#ffffff'}
            >
              <FaSignOutAlt /> Logout
            </button>
          </div>
        </header>

        {/* Page */}
        <main className="admin-main" style={{
          flex: 1, padding: isMobile ? '18px 14px 72px' : '24px 24px 72px',
          background: '#f3f5ef', minHeight: 'calc(100vh - 58px)',
        }}>
          <div className="admin-route" key={location.pathname}>
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
