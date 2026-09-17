import { useState, useCallback } from 'react';

export default function useAsyncAction(asyncFn) {
  const [busy, setBusy] = useState(false);
  const run = useCallback(async (...args) => {
    setBusy(true);
    try {
      return await asyncFn(...args);
    } finally {
      setBusy(false);
    }
  }, [asyncFn]);
  return [run, busy];
}