import React, { Suspense, lazy } from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import PrivateRoute from './components/PrivateRoute';
import Layout from './components/Layout';
import Login from './pages/Login';

const Dashboard = lazy(() => import('./pages/Dashboard'));
const Products = lazy(() => import('./pages/Products'));
const Orders = lazy(() => import('./pages/Orders'));
const Contacts = lazy(() => import('./pages/Contacts'));
const Customers = lazy(() => import('./pages/Customers'));
const Settings = lazy(() => import('./pages/Settings'));
const Purchasing = lazy(() => import('./pages/Purchasing'));
const Reports = lazy(() => import('./pages/Reports'));
const SupplyRecords = lazy(() => import('./pages/SupplyRecords'));
const Batches = lazy(() => import('./pages/Batches'));

function PageLoader() {
  return (
    <div className="page-loader" role="status" aria-label="Loading">
      <div className="spinner" />
    </div>
  );
}

function Lazy({ children }) {
  return <Suspense fallback={<PageLoader />}>{children}</Suspense>;
}

export default function App() {
  return (
    <HashRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/" element={
            <PrivateRoute>
              <Layout />
            </PrivateRoute>
          }>
            <Route index element={<Lazy><Dashboard /></Lazy>} />
            <Route path="products" element={<Lazy><Products /></Lazy>} />
            <Route path="orders" element={<Lazy><Orders /></Lazy>} />
            <Route path="contacts" element={<Lazy><Contacts /></Lazy>} />
            <Route path="customers" element={<Lazy><Customers /></Lazy>} />
            <Route path="purchasing" element={<Lazy><Purchasing /></Lazy>} />
            <Route path="reports" element={<Lazy><Reports /></Lazy>} />
            <Route path="materials" element={<Lazy><SupplyRecords /></Lazy>} />
            <Route path="warehouses" element={<Lazy><SupplyRecords /></Lazy>} />
            <Route path="batches" element={<Lazy><Batches /></Lazy>} />
            <Route path="settings" element={<Lazy><Settings /></Lazy>} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </HashRouter>
  );
}
