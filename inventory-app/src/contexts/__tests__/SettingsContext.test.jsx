import React from 'react';
import { render, screen, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SettingsProvider, useSettings } from '../SettingsContext';

// Mock firebase
vi.mock('../../firebase/firebase', () => ({
  db: {},
}));

vi.mock('firebase/firestore', () => ({
  doc: vi.fn(() => ({})),
  onSnapshot: vi.fn((ref, onNext, onError) => {
    onNext({ exists: () => false, data: () => null });
    return vi.fn();
  }),
}));

function TestComponent({ onSettings }) {
  const { settings, loaded } = useSettings();
  React.useEffect(() => { if (onSettings) onSettings({ settings, loaded }); }, [settings, loaded, onSettings]);
  return <div>loaded:{loaded ? 'yes' : 'no'}</div>;
}

describe('SettingsContext', () => {
  it('provides default settings when no Firestore doc', () => {
    let captured;
    render(
      <SettingsProvider>
        <TestComponent onSettings={s => { captured = s; }} />
      </SettingsProvider>
    );
    expect(captured).toBeDefined();
    expect(captured.settings.defaultPrices.CostPrice).toBe(145);
    expect(captured.settings.defaultPrices.SellingPrice).toBe(220);
    expect(captured.settings.defaultPrices.ResellerPrice).toBe(195);
    expect(captured.settings.defaultPrices.Price60ml).toBe(175);
    expect(captured.settings.defaultPrices.Cost60ml).toBe(125);
  });

  it('provides default lowStockThreshold', () => {
    let captured;
    render(
      <SettingsProvider>
        <TestComponent onSettings={s => { captured = s; }} />
      </SettingsProvider>
    );
    expect(captured.settings.lowStockThreshold).toBe(10);
  });

  it('provides default paymentMethods', () => {
    let captured;
    render(
      <SettingsProvider>
        <TestComponent onSettings={s => { captured = s; }} />
      </SettingsProvider>
    );
    expect(captured.settings.paymentMethods).toEqual([
      'Cash', 'GCash', 'PayMaya', 'Credit Card', 'Debit Card', 'Bank Transfer'
    ]);
  });

  it('provides default loyaltyTiers', () => {
    let captured;
    render(
      <SettingsProvider>
        <TestComponent onSettings={s => { captured = s; }} />
      </SettingsProvider>
    );
    expect(captured.settings.loyaltyTiers).toEqual({ VIP: 200, Gold: 100, Silver: 50 });
  });

  it('provides default testerKit', () => {
    let captured;
    render(
      <SettingsProvider>
        <TestComponent onSettings={s => { captured = s; }} />
      </SettingsProvider>
    );
    expect(captured.settings.testerKit.pcs).toBe(100);
    expect(captured.settings.testerKit.price).toBe(0);
  });

  it('marks loaded after snapshot resolves', async () => {
    let captured;
    render(
      <SettingsProvider>
        <TestComponent onSettings={s => { captured = s; }} />
      </SettingsProvider>
    );
    expect(captured.loaded).toBe(true);
  });

  it('useSettings throws outside provider', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    function Bad() { useSettings(); return null; }
    expect(() => render(<Bad />)).toThrow();
    spy.mockRestore();
  });
});