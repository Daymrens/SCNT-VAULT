import React, { createContext, useContext, useState, useEffect } from 'react';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../firebase/firebase';
import { useAuth } from './AuthContext';

const OWNER_UID = 'wzlPqoM7Z2Tc8H6nMxPfXl0fKu43';

const ROLE_PERMISSIONS = {
  owner: {
    pages: ['/', '/inventory', '/suppliers', '/customers', '/resellers', '/sales', '/purchase-orders', '/testers', '/reports', '/pos'],
    canDeleteProducts: true,
    canEditProducts: true,
    canProcessOrders: true,
    canManageCustomers: true,
    canManageSuppliers: true,
    canExportReports: true,
    canAccessSettings: true,
    canManageStock: true,
  },
  manager: {
    pages: ['/', '/inventory', '/suppliers', '/customers', '/resellers', '/sales', '/purchase-orders', '/testers', '/pos'],
    canDeleteProducts: false,
    canEditProducts: true,
    canProcessOrders: true,
    canManageCustomers: true,
    canManageSuppliers: true,
    canExportReports: false,
    canAccessSettings: false,
    canManageStock: true,
  },
  employee: {
    pages: ['/', '/pos', '/inventory', '/customers'],
    canDeleteProducts: false,
    canEditProducts: false,
    canProcessOrders: true,
    canManageCustomers: false,
    canManageSuppliers: false,
    canExportReports: false,
    canAccessSettings: false,
    canManageStock: true,
  },
};

const RoleContext = createContext();

export function useRole() {
  return useContext(RoleContext);
}

export function RoleProvider({ children }) {
  const { currentUser } = useAuth();
  const [role, setRole] = useState('employee');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!currentUser) {
      setRole('employee');
      setLoading(false);
      return;
    }

    const isOwner = currentUser.uid === OWNER_UID;

    const loadRole = async () => {
      try {
        const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
        if (userDoc.exists()) {
          const data = userDoc.data();
          setRole(data.role || 'employee');
        } else if (isOwner) {
          await setDoc(doc(db, 'users', currentUser.uid), { role: 'owner' }, { merge: true });
          setRole('owner');
        } else {
          await setDoc(doc(db, 'users', currentUser.uid), { role: 'employee' }, { merge: true });
          setRole('employee');
        }
      } catch (err) {
        console.error('Error loading role:', err);
        setRole(isOwner ? 'owner' : 'employee');
      } finally {
        setLoading(false);
      }
    };

    loadRole();
  }, [currentUser]);

  const effectiveRole = currentUser?.uid === OWNER_UID ? 'owner' : role;
  const permissions = ROLE_PERMISSIONS[effectiveRole] || ROLE_PERMISSIONS.employee;

  const canAccessPage = (path) => {
    if (currentUser?.uid === OWNER_UID) return true;
    return permissions.pages.includes(path);
  };

  const value = {
    role: effectiveRole,
    permissions,
    loading,
    canAccessPage,
    isOwner: currentUser?.uid === OWNER_UID,
  };

  return (
    <RoleContext.Provider value={value}>
      {children}
    </RoleContext.Provider>
  );
}
