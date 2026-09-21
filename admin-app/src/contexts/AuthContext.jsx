import React, { createContext, useContext, useState, useEffect } from 'react';
import {
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  sendPasswordResetEmail
} from 'firebase/auth';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../firebase/firebase';

const AuthContext = createContext();

export function useAuth() {
  return useContext(AuthContext);
}

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null);
  const [userRole, setUserRole] = useState(null);
  const [loading, setLoading] = useState(true);

  async function signIn(email, password) {
    return signInWithEmailAndPassword(auth, email, password);
  }

  async function signOut() {
    return firebaseSignOut(auth);
  }

  function resetPassword(email) {
    return sendPasswordResetEmail(auth, email);
  }

  async function fetchUserRole(uid) {
    try {
      // UID-based role detection: enforce correct role regardless of stored value
      if (uid === '6aOu6pgtNuOWfxbKGMP4UMUCcb') {
        setUserRole('owner');
        return 'owner';
      }
      if (uid === 'qS5tyNyVFehRVleY7Y4HHScqKPu1') {
        setUserRole('manager');
        return 'manager';
      }

      const userDoc = await getDoc(doc(db, 'users', uid));
      if (userDoc.exists()) {
        const role = userDoc.data().role;
        setUserRole(role);
        return role;
      }
      // UID-based role detection for new users
      let defaultRole = 'employee';
      if (uid === '6aOu6pgtNuOWfxbKGMP4UMUCcb') defaultRole = 'owner';
      else if (uid === 'qS5tyNyVFehRVleY7Y4HHScqKPu1') defaultRole = 'manager';
      await setDoc(doc(db, 'users', uid), {
        role: defaultRole,
        email: auth.currentUser?.email || '',
        createdAt: serverTimestamp()
      });
      setUserRole(defaultRole);
      return defaultRole;
    } catch (err) {
      console.error('Failed to fetch user role:', err);
      setUserRole(null);
      return null;
    }
  }

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user);
      if (user) {
        await fetchUserRole(user.uid);
      } else {
        setUserRole(null);
      }
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  const value = {
    currentUser,
    userRole,
    signIn,
    signOut,
    resetPassword,
    fetchUserRole
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
}
