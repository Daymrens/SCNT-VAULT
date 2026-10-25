import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  sendPasswordResetEmail
} from 'firebase/auth';
import { auth } from '../firebase/firebase';
import { logAction, AUDIT_ACTIONS } from '../utils/auditLog';

const AuthContext = createContext();
const MAX_ATTEMPTS = 5;
const COOLDOWN_MS = 60 * 1000;

export function useAuth() {
  return useContext(AuthContext);
}

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const loginAttempts = useRef(0);
  const cooldownUntil = useRef(0);

  async function signIn(email, password) {
    const now = Date.now();
    if (now < cooldownUntil.current) {
      const sec = Math.ceil((cooldownUntil.current - now) / 1000);
      throw new Error(`Too many attempts. Try again in ${sec}s.`);
    }

    try {
      const result = await signInWithEmailAndPassword(auth, email, password);
      loginAttempts.current = 0;
      logAction(AUDIT_ACTIONS.LOGIN, { email, uid: result.user.uid });
      return result;
    } catch (err) {
      loginAttempts.current += 1;
      logAction(AUDIT_ACTIONS.LOGIN_FAILED, { email, error: err.code });
      if (loginAttempts.current >= MAX_ATTEMPTS) {
        cooldownUntil.current = Date.now() + COOLDOWN_MS;
        loginAttempts.current = 0;
      }
      throw err;
    }
  }

  function signUp(email, password) {
    return createUserWithEmailAndPassword(auth, email, password);
  }

  async function signOut() {
    if (currentUser) {
      logAction(AUDIT_ACTIONS.LOGOUT, { uid: currentUser.uid, email: currentUser.email });
    }
    return firebaseSignOut(auth);
  }

  function resetPassword(email) {
    return sendPasswordResetEmail(auth, email);
  }

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  const value = {
    currentUser,
    signIn,
    signUp,
    signOut,
    resetPassword
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
}
