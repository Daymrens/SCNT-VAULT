import { useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';

const TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes

export default function useSessionTimeout() {
  const { currentUser, signOut } = useAuth();
  const timerRef = useRef(null);

  useEffect(() => {
    if (!currentUser) return;

    const resetTimer = () => {
      clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        signOut();
      }, TIMEOUT_MS);
    };

    const events = ['mousedown', 'keydown', 'scroll', 'touchstart'];
    events.forEach(e => document.addEventListener(e, resetTimer, { passive: true }));
    resetTimer();

    return () => {
      clearTimeout(timerRef.current);
      events.forEach(e => document.removeEventListener(e, resetTimer));
    };
  }, [currentUser, signOut]);
}
