import React, { createContext, useContext, useState, useEffect } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase/firebase';

const SettingsContext = createContext();

const DEFAULT_SETTINGS = {
  defaultPrices: {
    CostPrice: 145,
    SellingPrice: 220,
    ResellerPrice: 195,
    Price60ml: 175,
    Cost60ml: 125,
  },
  lowStockThreshold: 10,
  testerKit: {
    pcs: 100,
    price: 0,
  },
  paymentMethods: ['Cash', 'GCash', 'PayMaya', 'Credit Card', 'Debit Card', 'Bank Transfer'],
  loyaltyTiers: {
    VIP: 200,
    Gold: 100,
    Silver: 50,
  },
};

export function useSettings() {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error('useSettings must be used within SettingsProvider');
  return ctx;
}

export function SettingsProvider({ children }) {
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const unsub = onSnapshot(
      doc(db, 'settings', 'business'),
      (snap) => {
        if (snap.exists()) {
          const data = snap.data();
          setSettings(prev => ({
            ...prev,
            ...(data.defaultPrices ? { defaultPrices: { ...prev.defaultPrices, ...data.defaultPrices } } : {}),
            ...(data.lowStockThreshold != null ? { lowStockThreshold: data.lowStockThreshold } : {}),
            ...(data.testerKit ? { testerKit: { ...prev.testerKit, ...data.testerKit } } : {}),
            ...(data.paymentMethods ? { paymentMethods: data.paymentMethods } : {}),
            ...(data.loyaltyTiers ? { loyaltyTiers: { ...prev.loyaltyTiers, ...data.loyaltyTiers } } : {}),
          }));
        }
        setLoaded(true);
      },
      (error) => {
        console.error('Error loading settings:', error);
        setLoaded(true);
      }
    );
    return () => unsub();
  }, []);

  return (
    <SettingsContext.Provider value={{ settings, loaded }}>
      {children}
    </SettingsContext.Provider>
  );
}