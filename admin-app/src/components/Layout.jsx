import React, { useState, useEffect } from 'react';
import { Outlet, Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import {
  FaHome, FaBoxes, FaShoppingCart, FaAddressBook, FaUsers,
  FaCog, FaSignOutAlt, FaBars, FaChevronLeft, FaTimes, FaShieldAlt
} from 'react-icons/fa';

const menuItems = [
  { path: '/', icon: <FaHome />, label: 'Dashboard' },
  { path: '/products', icon: <FaBoxes />, label: 'Products' },
  { path: '/orders', icon: <FaShoppingCart />, label: 'Orders' },
  { path: '/contacts', icon: <FaAddressBook />, label: 'Contacts' },
  { path: '/customers', icon: <FaUsers />, label: 'Customers' },
  { path: '/settings', icon: <FaCog />, label: 'Settings' },
];

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
  const { currentUser, userRole, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => { setMobileOpen(false); }, [location.pathname]);

  const handleLogout = async () => {
    try { await signOut(); navigate('/login'); }
    catch (e) { console.error(e); }
  };

  const sideW = collapsed ? 68 : 236;
  const pageLabel = menuItems.find(m => m.path === location.pathname)?.label
    || location.pathname.replace('/', '').replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
    || 'Dashboard';

  const Brand = ({ showText }) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <div style={{
        width: 30, height: 30, borderRadius: 8, background: '#0d9488',
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
    <div style={{ display: 'flex', minHeight: '100vh', background: '#f6f7f9' }}>
      <style>{`
        body { margin: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, system-ui, sans-serif; background: #f6f7f9; color: #14181f; }
      `}</style>

      {isMobile && mobileOpen && (
        <div onClick={() => setMobileOpen(false)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(16,24,40,0.35)', zIndex: 150 }} />
      )}

      {/* Sidebar */}
      <aside style={{
        width: isMobile ? 236 : sideW,
        minWidth: isMobile ? 236 : sideW,
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
          padding: collapsed && !isMobile ? '18px 0' : '16px 18px',
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
        <nav style={{ flex: 1, padding: '10px 8px', overflowY: 'auto', overflowX: 'hidden' }}>
          {menuItems.map(item => {
            const active = location.pathname === item.path;
            return (
              <Link key={item.path} to={item.path}
                title={collapsed && !isMobile ? item.label : undefined} style={{
                  display: 'flex', alignItems: 'center',
                  gap: collapsed && !isMobile ? 0 : 11,
                  justifyContent: collapsed && !isMobile ? 'center' : 'flex-start',
                  padding: collapsed && !isMobile ? '11px 0' : '9px 12px',
                  borderRadius: 8, marginBottom: 2, textDecoration: 'none',
                  color: active ? '#0f766e' : '#6b7280',
                  background: active ? '#e8f6f4' : 'transparent',
                  fontWeight: active ? 600 : 500, fontSize: 13,
                  transition: 'background 0.15s, color 0.15s', whiteSpace: 'nowrap',
                }}
                onMouseEnter={e => { if (!active) { e.currentTarget.style.background = '#f5f6f8'; e.currentTarget.style.color = '#14181f'; } }}
                onMouseLeave={e => { if (!active) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#6b7280'; } }}
              >
                <span style={{ fontSize: 15, flexShrink: 0 }}>{item.icon}</span>
                {!collapsed || isMobile ? <span>{item.label}</span> : null}
              </Link>
            );
          })}
        </nav>

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
      <div style={{ flex: 1, marginLeft: isMobile ? 0 : sideW, transition: 'margin-left 0.25s ease', display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
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
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 10px',
              borderRadius: 20, fontSize: 10, fontWeight: 700, textTransform: 'uppercase',
              background: '#e8f6f4', color: '#0f766e',
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
        <main style={{
          flex: 1, padding: isMobile ? '18px 14px 72px' : '24px 24px 72px',
          background: '#f6f7f9', minHeight: 'calc(100vh - 58px)',
        }}>
          <Outlet />
        </main>
      </div>
    </div>
  );
}
