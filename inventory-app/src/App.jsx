import React, { Suspense, lazy } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { DataProvider } from './contexts/DataContext';
import { SettingsProvider } from './contexts/SettingsContext';
import { RoleProvider } from './contexts/RoleContext';
import { ToastProvider } from './components/shared/Toast';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Inventory from './pages/Inventory';
import Suppliers from './pages/Suppliers';
import Customers from './pages/Customers';
import Resellers from './pages/Resellers';
import Sales from './pages/Sales';
import PurchaseOrders from './pages/PurchaseOrders';
import Testers from './pages/Testers';
import Reports from './pages/Reports';
const POS = lazy(() => import('./pages/POS'));
import Layout from './components/Layout';
import PrivateRoute from './components/PrivateRoute';

function App() {
  return (
    <Router>
      <ToastProvider>
        <AuthProvider>
          <SettingsProvider>
            <RoleProvider>
            <DataProvider>
              <Routes>
              <Route path="/login" element={<Login />} />
              <Route path="/" element={<PrivateRoute><Layout /></PrivateRoute>}>
                <Route index element={<Dashboard />} />
                <Route path="inventory" element={<Inventory />} />
                <Route path="suppliers" element={<Suppliers />} />
                <Route path="customers" element={<Customers />} />
                <Route path="resellers" element={<Resellers />} />
                <Route path="sales" element={<Sales />} />
                <Route path="purchase-orders" element={<PurchaseOrders />} />
                <Route path="testers" element={<Testers />} />
                <Route path="reports" element={<Reports />} />
                <Route path="pos" element={<Suspense fallback={<div style={{ display:'flex', justifyContent:'center', alignItems:'center', height:'60vh' }}><div className="spinner" /></div>}><POS /></Suspense>} />
              </Route>
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
            </DataProvider>
            </RoleProvider>
          </SettingsProvider>
        </AuthProvider>
      </ToastProvider>
    </Router>
  );
}

export default App;