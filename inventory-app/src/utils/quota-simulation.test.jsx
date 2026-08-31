import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, act } from '@testing-library/react';
import React from 'react';

// ---- Shared mock state (hoisted so vi.mock can capture it) ----
const hoist = vi.hoisted(() => {
  const saveMock = vi.fn();
  const quotaError = { code: 'resource-exhausted', message: 'Quota exceeded: writes per day' };
  return { saveMock, quotaError };
});

// ---- Mock firebase/firestore: writes reject with a Spark quota error ----
vi.mock('firebase/firestore', () => {
  const throwQuota = () => { throw hoist.quotaError; };
  return {
    doc: vi.fn(),
    collection: vi.fn(),
    query: vi.fn(),
    where: vi.fn(),
    onSnapshot: vi.fn(() => () => {}),
    getDoc: vi.fn(),
    Timestamp: { now: () => ({ toDate: () => new Date() }), fromDate: () => ({}) },
    runTransaction: vi.fn(throwQuota),
    addDoc: vi.fn(throwQuota),
    updateDoc: vi.fn(throwQuota),
    deleteDoc: vi.fn(throwQuota),
  };
});

// ---- Mock the firebase app module so importing numbers.js / DataContext does not init a real app ----
vi.mock('../firebase/firebase', () => ({
  db: {},
  auth: {},
  default: {},
}));

// ---- Mock AuthContext so we can render <DataProvider> without a real auth session ----
vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({ currentUser: null }),
}));

// ---- Mock jspdf so we can spy on .save() ----
vi.mock('jspdf', () => {
  class jsPDF {
    constructor() {}
    save(filename) { hoist.saveMock(filename); }
    setFontSize() {}
    setFont() {}
    setTextColor() {}
    setDrawColor() {}
    setFillColor() {}
    text() {}
    line() {}
    rect() {}
    addFileToVFS() {}
    addFont() {}
    addPage() {}
    splitTextToSize(s) { return [s]; }
  }
  return { jsPDF, default: jsPDF };
});

// ---- Mock the .ttf asset imports so vitest doesn't choke on binary files ----
vi.mock('../assets/DejaVuSans.ttf', () => ({ default: '/fake.ttf' }));
vi.mock('../assets/DejaVuSans-Bold.ttf', () => ({ default: '/fake-bold.ttf' }));

// ---- Real source under test ----
import { isQuotaError, getLocalNumber, getLocalSaleId, enqueuePendingWrite, readPendingWrites, removePendingWrite } from './offlineQueue';
import { nextInvoiceNumber } from './numbers';
import { DataProvider, useData } from '../contexts/DataContext';
import { generateInvoice } from './invoice';

beforeEach(() => {
  localStorage.clear();
  // invoice.js uses fetch() to load fonts; stub it so no network is required
  vi.stubGlobal('fetch', vi.fn(() => Promise.resolve({ arrayBuffer: () => Promise.resolve(new ArrayBuffer(8)) })));
});

afterEach(() => {
  vi.unstubAllGlobals();
});

// (a) pure offlineQueue logic
describe('offlineQueue — quota + local fallback primitives', () => {
  it('detects a quota error by code and by message', () => {
    expect(isQuotaError({ code: 'resource-exhausted' })).toBe(true);
    expect(isQuotaError({ message: 'Quota exceeded' })).toBe(true);
    expect(isQuotaError({ code: 'ok' })).toBe(false);
  });

  it('produces locally-namespaced numbers', () => {
    expect(getLocalNumber('SCNT-INV')).toMatch(/^SCNT-INV-LOCAL-/);
    expect(getLocalSaleId()).toMatch(/^SCNT-LOCAL-SALE-/);
  });

  it('enqueues and removes pending writes', () => {
    enqueuePendingWrite('sale', { x: 1 });
    const pending = readPendingWrites();
    expect(pending.some((w) => w.type === 'sale' && w.data.x === 1)).toBe(true);

    const ts = pending.find((w) => w.type === 'sale').ts;
    removePendingWrite(ts);
    expect(readPendingWrites().some((w) => w.ts === ts)).toBe(false);
  });
});

// (b) nextInvoiceNumber falls back to local when runTransaction is quota-blocked
describe('numbers — nextInvoiceNumber local fallback', () => {
  it('returns a LOCAL invoice number under quota', async () => {
    const num = await nextInvoiceNumber();
    expect(typeof num).toBe('string');
    expect(num).toMatch(/^SCNT-INV-LOCAL-/);
  });
});

// (c) DataProvider.addSale / updateProduct under quota
describe('DataContext — POS writes survive quota outage', () => {
  let data;
  beforeEach(() => {
    const ref = React.createRef();
    function Probe() {
      ref.current = useData();
      return null;
    }
    render(
      <DataProvider>
        <Probe />
      </DataProvider>
    );
    data = ref.current;
  });

  it('addSale returns a LOCAL sale id and enqueues a pending write', async () => {
    let id;
    await act(async () => {
      id = await data.addSale({ InvoiceNumber: 'X', Total: 1 });
    });
    expect(id).toMatch(/^SCNT-LOCAL-SALE-/);
    const pending = readPendingWrites();
    expect(pending.some((w) => w.type === 'sale' && w.data._localId === id)).toBe(true);
  });

  it('updateProduct swallows the quota error instead of throwing', async () => {
    await expect(
      act(async () => {
        await data.updateProduct('p1', { Stock: 5 });
      })
    ).resolves.not.toThrow();
  });
});

// (d) generateInvoice renders Firestore-free using the LOCAL invoice number
describe('invoice — generates under quota with local invoice number', () => {
  const baseSale = {
    InvoiceNumber: 'SCNT-INV-LOCAL-20260827-AB12',
    id: 'SCNT-LOCAL-SALE-123',
    CustomerName: 'Test',
    Items: [{ ProductName: 'A', Quantity: 1, UnitPrice: 10, Subtotal: 10 }],
    Total: 10,
    Subtotal: 10,
  };

  it('saves an invoice named after the LOCAL invoice number', async () => {
    await expect(generateInvoice(baseSale, { orderId: undefined, orderNumber: undefined })).resolves.not.toThrow();
    expect(hoist.saveMock).toHaveBeenCalledWith(
      expect.stringContaining('SCNT-INV-LOCAL-20260827-AB12')
    );
  });

  it('ignores optional order line and still uses InvoiceNumber', async () => {
    hoist.saveMock.mockClear();
    await generateInvoice(baseSale, { orderId: 'ord1', orderNumber: undefined });
    expect(hoist.saveMock).toHaveBeenCalledWith(
      expect.stringContaining('SCNT-INV-LOCAL-20260827-AB12')
    );
  });
});
