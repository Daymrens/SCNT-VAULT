import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Outlet, Link, useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useRole } from '../contexts/RoleContext';
import { useToast } from './shared/Toast';
import { useData } from '../contexts/DataContext';
import { useSettings } from '../contexts/SettingsContext';
import {
  FaBoxes, FaTruck, FaUsers, FaHandshake, FaShoppingCart, FaFileInvoice,
  FaFlask, FaChartBar, FaCashRegister, FaSignOutAlt, FaChevronLeft, FaBell,
  FaShieldAlt, FaSearch, FaCog, FaSun, FaMoon, FaPlus, FaQuestionCircle,
  FaThLarge, FaTimes, FaCube, FaAddressBook
} from 'react-icons/fa';

const menuItems = [
  { path: '/', icon: <FaThLarge />, label: 'Overview' },
  { path: '/inventory', icon: <FaCube />, label: 'Inventory', badge: 'stock' },
  { path: '/purchase-orders', icon: <FaFileInvoice />, label: 'Purchasing' },
  { path: '/sales', icon: <FaShoppingCart />, label: 'Sales' },
  { path: '/suppliers', icon: <FaTruck />, label: 'Suppliers' },
  { path: '/customers', icon: <FaUsers />, label: 'Customers' },
  { path: '/resellers', icon: <FaHandshake />, label: 'Resellers' },
  { path: '/testers', icon: <FaFlask />, label: 'Testers' },
  { path: '/reports', icon: <FaChartBar />, label: 'Reports' },
  { path: '/pending-orders', icon: <FaAddressBook />, label: 'Pending Orders', badge: 'orders' },
  { path: '/pos', icon: <FaCashRegister />, label: 'Point of Sale' },
];

const topTabs = [
  { path: '/', label: 'Overview' },
  { path: '/sales', label: 'Activity' },
  { path: '/pending-orders', label: 'Alerts' },
];

const pageLabels = {
  '/': 'Overview', '/inventory': 'Inventory', '/suppliers': 'Suppliers',
  '/customers': 'Customers', '/resellers': 'Resellers', '/sales': 'Sales',
  '/purchase-orders': 'Purchasing', '/testers': 'Testers',
  '/reports': 'Reports', '/pos': 'Point of Sale', '/pending-orders': 'Alerts',
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

function getDisplayName(user) {
  return user?.displayName || user?.email?.split('@')[0] || 'Team member';
}

function getFirstName(user) {
  return getDisplayName(user).trim().split(/\s+/)[0] || 'there';
}

function greeting() {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

export default function Layout() {
  const [collapsed, setCollapsed] = useState(true);
  const [theme, setTheme] = useState(() => window.localStorage.getItem('scnt-inventory-theme') || 'light');
  const [searchOpen, setSearchOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [profileOpen, setProfileOpen] = useState(false);
  const [preferencesOpen, setPreferencesOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const searchRef = useRef(null);
  const isMobile = useIsMobile();
  const { currentUser, signOut } = useAuth();
  const { role, canAccessPage } = useRole();
  const { showToast } = useToast();
  const { readyOrders, products } = useData();
  const { settings } = useSettings();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();

  useEffect(() => {
    document.documentElement.dataset.inventoryTheme = theme;
    window.localStorage.setItem('scnt-inventory-theme', theme);
  }, [theme]);

  useEffect(() => {
    if (location.pathname && !canAccessPage(location.pathname)) {
      showToast('Permission denied — contact your admin for access', 'error');
      navigate('/', { replace: true });
    }
    setSearchOpen(false);
    setProfileOpen(false);
    setPreferencesOpen(false);
  }, [location.pathname, canAccessPage, navigate, showToast]);

  const posOrderParam = searchParams.get('posOrder');
  useEffect(() => {
    if (posOrderParam) navigate('/pos?posOrder=' + encodeURIComponent(posOrderParam), { replace: true });
  }, [posOrderParam, navigate]);

  useEffect(() => {
    const onKeyDown = event => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setSearchOpen(value => !value);
      }
      if (event.key === 'Escape') {
        setSearchOpen(false);
        setProfileOpen(false);
        setPreferencesOpen(false);
        setHelpOpen(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  useEffect(() => {
    if (searchOpen) searchRef.current?.focus();
    else setSearch('');
  }, [searchOpen]);

  const openReadyOrder = order => navigate('/pos?posOrder=' + encodeURIComponent(order.id));

  const handleLogout = async () => {
    try { await signOut(); navigate('/login'); }
    catch (error) { console.error(error); }
  };

  const accessibleItems = useMemo(() => menuItems.filter(item => canAccessPage(item.path)), [canAccessPage]);
  const searchItems = accessibleItems.filter(item => item.label.toLowerCase().includes(search.trim().toLowerCase()));
  const lowStockCount = products.filter(product => Number(product.Stock ?? product.StockQty ?? product.stockQty ?? 0) <= Number(product.LowStockThreshold ?? settings.lowStockThreshold ?? 10)).length;
  const pageLabel = pageLabels[location.pathname] || location.pathname.replace('/', '').replace(/-/g, ' ').replace(/\b\w/g, char => char.toUpperCase());
  const userInitials = getDisplayName(currentUser).split(/\s+/).filter(Boolean).slice(0, 2).map(part => part[0]).join('').toUpperCase();

  const badgeFor = item => item.badge === 'stock' ? lowStockCount : item.badge === 'orders' ? readyOrders.length : 0;
  const isRouteActive = path => location.pathname === path || (path !== '/' && location.pathname.startsWith(path + '/'));
  const setLightTheme = value => setTheme(value);

  return (
    <div className="inventory-app-shell">
      <header className="vessa-topbar">
        <Link className="vessa-brand" to="/" aria-label="SCNT Vault overview">
          <span className="vessa-brand-mark"><FaBoxes /></span>
          <span className="vessa-brand-copy"><strong>SCNT Vault</strong><small>Inventory &amp; Operations</small></span>
        </Link>

        <nav className="vessa-top-tabs" aria-label="Primary sections">
          {topTabs.filter(tab => canAccessPage(tab.path)).map(tab => (
            <Link key={tab.path} to={tab.path} className={'vessa-top-tab' + (isRouteActive(tab.path) ? ' is-active' : '')}>
              {tab.label}
              {tab.path === '/pending-orders' && readyOrders.length > 0 && <span className="vessa-tab-count">{readyOrders.length}</span>}
            </Link>
          ))}
        </nav>

        <div className="vessa-top-actions">
          <div className="vessa-action-anchor">
            <button className={'vessa-search-trigger' + (searchOpen ? ' is-open' : '')} onClick={() => setSearchOpen(value => !value)} aria-expanded={searchOpen} aria-label="Search pages">
              <FaSearch /><span>Search</span><kbd>⌘K</kbd>
            </button>
            {searchOpen && (
              <div className="vessa-popover vessa-search-popover">
                <label htmlFor="vessa-route-search">Jump to a page</label>
                <div className="vessa-search-field"><FaSearch /><input id="vessa-route-search" ref={searchRef} value={search} onChange={event => setSearch(event.target.value)} placeholder="Search inventory, sales…" /></div>
                <div className="vessa-search-results">
                  {searchItems.length ? searchItems.map(item => (
                    <Link key={item.path} to={item.path} onClick={() => setSearchOpen(false)}>
                      <span>{item.icon}</span><span>{item.label}</span><kbd>↵</kbd>
                    </Link>
                  )) : <p>No matching pages</p>}
                </div>
              </div>
            )}
          </div>

          <div className="vessa-action-anchor">
            <button className="vessa-icon-button" onClick={() => setPreferencesOpen(value => !value)} aria-label="Appearance settings" title="Appearance settings"><FaCog /></button>
            {preferencesOpen && (
              <div className="vessa-popover vessa-preferences-popover">
                <strong>Appearance</strong>
                <p>Choose the workspace theme.</p>
                <div className="vessa-theme-options">
                  <button className={theme === 'light' ? 'is-active' : ''} onClick={() => setLightTheme('light')}><FaSun /> Light</button>
                  <button className={theme === 'dark' ? 'is-active' : ''} onClick={() => setLightTheme('dark')}><FaMoon /> Dark</button>
                </div>
              </div>
            )}
          </div>

          <button className={'vessa-icon-button vessa-notification-button' + (readyOrders.length ? ' has-alerts' : '')} onClick={() => navigate('/pending-orders')} aria-label={readyOrders.length ? readyOrders.length + ' ready orders' : 'Alerts'} title="Alerts">
            <FaBell />{readyOrders.length > 0 && <span className="vessa-notification-count">{readyOrders.length}</span>}
          </button>
          <button className="vessa-new-button" onClick={() => navigate('/pos')}><FaPlus /><span>New sale</span></button>

          <div className="vessa-action-anchor vessa-profile-anchor">
            <button className="vessa-profile-button" onClick={() => setProfileOpen(value => !value)} aria-expanded={profileOpen}>
              <span className="vessa-avatar">{userInitials || 'SC'}</span>
              <span className="vessa-profile-copy"><small>{greeting()}</small><strong>{getFirstName(currentUser)}</strong></span>
              <span className="vessa-profile-chevron">⌄</span>
            </button>
            {profileOpen && (
              <div className="vessa-popover vessa-profile-popover">
                <div className="vessa-profile-summary"><span className="vessa-avatar">{userInitials || 'SC'}</span><span><strong>{getDisplayName(currentUser)}</strong><small>{currentUser?.email}</small></span></div>
                <span className="vessa-role"><FaShieldAlt /> {role || 'team member'}</span>
                <button className="vessa-logout-button" onClick={handleLogout}><FaSignOutAlt /> Sign out</button>
              </div>
            )}
          </div>
        </div>
      </header>

      <aside className={'vessa-rail' + (collapsed ? ' is-collapsed' : '')} aria-label="Inventory navigation">
        <div className="vessa-rail-theme" role="group" aria-label="Theme">
          <button className={theme === 'light' ? 'is-selected' : ''} onClick={() => setTheme('light')} aria-label="Use light appearance" title="Light appearance"><FaSun /></button>
          <button className={theme === 'dark' ? 'is-selected' : ''} onClick={() => setTheme('dark')} aria-label="Use dark appearance" title="Dark appearance"><FaMoon /></button>
        </div>
        <nav className="vessa-rail-navigation">
          {accessibleItems.filter(item => item.path !== '/').map(item => {
            const active = isRouteActive(item.path);
            const count = badgeFor(item);
            return (
              <Link key={item.path} to={item.path} className={'vessa-rail-link' + (active ? ' is-active' : '')} title={item.label} aria-label={item.label + (count ? ', ' + count + ' alerts' : '')}>
                <span className="vessa-rail-icon">{item.icon}</span>
                {!collapsed && <span className="vessa-rail-label">{item.label}</span>}
                {count > 0 && <span className="vessa-rail-badge">{count > 99 ? '99+' : count}</span>}
              </Link>
            );
          })}
        </nav>
        <div className="vessa-rail-footer">
          <button className="vessa-rail-link" onClick={() => setHelpOpen(value => !value)} title="Help and shortcuts" aria-label="Help and shortcuts"><span className="vessa-rail-icon"><FaQuestionCircle /></span>{!collapsed && <span className="vessa-rail-label">Help</span>}</button>
          {helpOpen && <div className="vessa-help-card"><button aria-label="Close help" onClick={() => setHelpOpen(false)}><FaTimes /></button><strong>Quick help</strong><span>Press Ctrl/⌘ + K to find a page.</span><span>Use New sale to open the point of sale.</span></div>}
          <button className="vessa-rail-link" onClick={handleLogout} title="Sign out" aria-label="Sign out"><span className="vessa-rail-icon"><FaSignOutAlt /></span>{!collapsed && <span className="vessa-rail-label">Sign out</span>}</button>
          <button className="vessa-rail-link vessa-collapse-button" onClick={() => setCollapsed(value => !value)} title={collapsed ? 'Expand navigation' : 'Collapse navigation'} aria-label={collapsed ? 'Expand navigation' : 'Collapse navigation'}><span className="vessa-rail-icon"><FaChevronLeft /></span>{!collapsed && <span className="vessa-rail-label">Collapse</span>}</button>
        </div>
      </aside>

      {readyOrders.length > 0 && (
        <button className="vessa-ready-toast" onClick={() => openReadyOrder(readyOrders[0])} title="Open first ready order">
          <FaBell /><span>Order {readyOrders[0].OrderNumber || readyOrders[0].id.slice(0, 8)} ready{readyOrders.length > 1 ? ' · +' + (readyOrders.length - 1) + ' more' : ''}</span>
        </button>
      )}

      <main className="vessa-main">
        <div className="vessa-route" key={location.pathname}><Outlet /></div>
      </main>

      <nav className="vessa-mobile-nav" aria-label="Mobile navigation">
        {[{ path: '/', icon: <FaThLarge />, label: 'Overview' }, { path: '/inventory', icon: <FaCube />, label: 'Stock' }, { path: '/sales', icon: <FaShoppingCart />, label: 'Sales' }, { path: '/pos', icon: <FaCashRegister />, label: 'POS' }, { path: '/pending-orders', icon: <FaBell />, label: 'Alerts' }].filter(item => canAccessPage(item.path)).map(item => (
          <Link key={item.path} to={item.path} className={'vessa-mobile-link' + (isRouteActive(item.path) ? ' is-active' : '')} aria-label={item.label}>
            <span>{item.icon}</span><small>{item.label}</small>
            {item.path === '/pending-orders' && readyOrders.length > 0 && <i>{readyOrders.length}</i>}
          </Link>
        ))}
      </nav>
    </div>
  );
}
