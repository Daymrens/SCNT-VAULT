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

const pageLabels = {
  '/': 'Dashboard',
  '/products': 'Products',
  '/orders': 'Orders',
  '/contacts': 'Contacts',
  '/customers': 'Customers',
  '/settings': 'Settings',
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
  const { currentUser, userRole, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => { setMobileOpen(false); }, [location.pathname]);

  const handleLogout = async () => {
    try { await signOut(); navigate('/login'); }
    catch (e) { console.error(e); }
  };

  const sideW = collapsed ? 68 : 240;
  const pageLabel = menuItems.find(m => m.path === location.pathname)?.label
    || location.pathname.replace('/', '').replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
    || 'Dashboard';

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#0f172a' }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
        body { margin: 0; font-family: 'Inter', 'Segoe UI', sans-serif; background: #0f172a; }
      `}</style>

      {isMobile && mobileOpen && (
        <div onClick={() => setMobileOpen(false)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 150 }} />
      )}

      {/* Sidebar */}
      <aside style={{
        width: isMobile ? 240 : sideW,
        minWidth: isMobile ? 240 : sideW,
        background: '#0f172a',
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
        borderRight: '1px solid #334155',
      }}>
        {/* Logo */}
        <div style={{
          padding: collapsed && !isMobile ? '20px 0' : '20px 20px',
          display: 'flex', alignItems: 'center',
          justifyContent: collapsed && !isMobile ? 'center' : 'space-between',
          borderBottom: '1px solid #334155',
          minHeight: 64,
        }}>
          {!collapsed && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <svg viewBox="0 0 32 32" width="26" height="26" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M16 3C16 3 8 9 8 18c0 4.418 3.582 8 8 8s8-3.582 8-8C24 9 16 3 16 3z" fill="#f1f5f9"/>
                <ellipse cx="16" cy="18" rx="4.5" ry="5.5" fill="#94a3b8" opacity="0.5"/>
                <rect x="14" y="2" width="4" height="4" rx="2" fill="#f1f5f9"/>
              </svg>
              <span style={{ color: '#f1f5f9', fontWeight: 800, fontSize: 18, letterSpacing: 2 }}>SCNT</span>
              <span style={{ color: '#94a3b8', fontSize: 11, fontWeight: 400, marginTop: 2 }}>Admin</span>
            </div>
          )}
          {collapsed && !isMobile && (
            <svg viewBox="0 0 32 32" width="26" height="26" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M16 3C16 3 8 9 8 18c0 4.418 3.582 8 8 8s8-3.582 8-8C24 9 16 3 16 3z" fill="#f1f5f9"/>
              <ellipse cx="16" cy="18" rx="4.5" ry="5.5" fill="#94a3b8" opacity="0.5"/>
              <rect x="14" y="2" width="4" height="4" rx="2" fill="#f1f5f9"/>
            </svg>
          )}
          {isMobile && (
            <button onClick={() => setMobileOpen(false)}
              style={{ background: 'rgba(255,255,255,0.07)', border: 'none', borderRadius: 8,
                color: '#94a3b8', cursor: 'pointer', width: 32, height: 32,
                display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <FaTimes />
            </button>
          )}
        </div>

        {/* Nav */}
        <nav style={{ flex: 1, padding: '12px 8px', overflowY: 'auto', overflowX: 'hidden' }}>
          {menuItems.map(item => {
            const active = location.pathname === item.path;
            return (
              <Link key={item.path} to={item.path}
                title={collapsed && !isMobile ? item.label : undefined} style={{
                  display: 'flex', alignItems: 'center',
                  gap: collapsed && !isMobile ? 0 : 12,
                  justifyContent: collapsed && !isMobile ? 'center' : 'flex-start',
                  padding: collapsed && !isMobile ? '12px 0' : '10px 14px',
                  borderRadius: 10, marginBottom: 4, textDecoration: 'none',
                  color: active ? '#2dd4bf' : '#94a3b8',
                  background: active ? 'rgba(45,212,191,0.1)' : 'transparent',
                  fontWeight: active ? 700 : 400, fontSize: 13,
                  transition: 'all 0.2s', whiteSpace: 'nowrap',
                  borderLeft: active ? '3px solid #2dd4bf' : '3px solid transparent',
                }}
                onMouseEnter={e => { if (!active) e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; }}
                onMouseLeave={e => { if (!active) e.currentTarget.style.background = 'transparent'; }}
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
            margin: '12px 8px', padding: 10, background: 'rgba(255,255,255,0.07)',
            border: 'none', borderRadius: 10, color: '#94a3b8',
            cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
            gap: 8, fontSize: 13, transition: 'background 0.2s',
          }}
          onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.12)'}
          onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.07)'}
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
          background: '#0f172a', padding: '0 24px', height: 64,
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          gap: 16, position: 'sticky', top: 0, zIndex: 50,
          borderBottom: '1px solid #334155',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            {isMobile && (
              <button onClick={() => setMobileOpen(true)} style={{
                background: 'none', border: 'none', color: '#f1f5f9', cursor: 'pointer',
                fontSize: 20, padding: 4,
              }}>
                <FaBars />
              </button>
            )}
            <span style={{ color: '#f1f5f9', fontWeight: 700, fontSize: 16 }}>{pageLabel}</span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 10px',
              borderRadius: 20, fontSize: 10, fontWeight: 700, textTransform: 'uppercase',
              background: 'rgba(45,212,191,0.1)', color: '#2dd4bf',
            }}>
              <FaShieldAlt style={{ fontSize: 10 }} /> {userRole || 'user'}
            </span>
            <span style={{ fontSize: 13, color: '#94a3b8' }}>{currentUser?.email}</span>
            <button onClick={handleLogout} style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '7px 14px',
              background: 'rgba(239,68,68,0.12)', color: '#ef4444',
              border: '1px solid rgba(239,68,68,0.25)', borderRadius: 8,
              fontSize: 13, fontWeight: 600, cursor: 'pointer', transition: 'background 0.2s',
            }}
            onMouseEnter={e => e.currentTarget.style.background = 'rgba(239,68,68,0.2)'}
            onMouseLeave={e => e.currentTarget.style.background = 'rgba(239,68,68,0.12)'}
            >
              <FaSignOutAlt /> Logout
            </button>
          </div>
        </header>

        {/* Page */}
        <main style={{
          flex: 1, padding: isMobile ? '20px 16px 80px' : '28px 28px 80px',
          background: '#0f172a', minHeight: 'calc(100vh - 64px)',
        }}>
          <Outlet />
        </main>
      </div>
    </div>
  );
}
