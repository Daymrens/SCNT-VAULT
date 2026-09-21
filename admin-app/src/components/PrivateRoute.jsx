import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

const ALLOWED_ROLES = ['owner', 'manager'];

export default function PrivateRoute({ children }) {
  const { currentUser, userRole } = useAuth();

  if (!currentUser) {
    return <Navigate to="/login" replace />;
  }

  if (userRole && !ALLOWED_ROLES.includes(userRole)) {
    return (
      <div style={{
        minHeight: '100vh',
        background: '#0f172a',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: '#f1f5f9',
        fontFamily: "'Inter', 'Segoe UI', sans-serif",
        textAlign: 'center',
        padding: 24,
      }}>
        <div>
          <div style={{ fontSize: 48, marginBottom: 16 }}>🔒</div>
          <h1 style={{ fontSize: 24, fontWeight: 800, marginBottom: 8 }}>Access Denied</h1>
          <p style={{ color: '#94a3b8', fontSize: 14 }}>
            You don't have permission to access the admin panel.<br />
            Contact your administrator for access.
          </p>
        </div>
      </div>
    );
  }

  return children;
}
