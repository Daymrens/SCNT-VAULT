import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, act } from '@testing-library/react';
import React from 'react';

// ---- Shared mock state (hoisted so vi.mock can capture it) ----
const hoist = vi.hoisted(() => {
  const addDocMock = vi.fn();
  const updateDocMock = vi.fn();
  return { addDocMock, updateDocMock };
});

// ---- Mock firebase/firestore with controllable addDoc/updateDoc ----
vi.mock('firebase/firestore', () => {
  class MockTimestamp {
    constructor(seconds, nanoseconds) {
      this.seconds = seconds || 0;
      this.nanoseconds = nanoseconds || 0;
    }
    toDate() { return new Date(this.seconds * 1000); }
    static now() { return new MockTimestamp(Math.floor(Date.now() / 1000), 0); }
    static fromDate(d) { return new MockTimestamp(Math.floor((d ? d.getTime() : Date.now()) / 1000), 0); }
  }
  return {
    doc: vi.fn((...args) => ({ path: args.join('/') })),
    collection: vi.fn(),
    query: vi.fn(),
    where: vi.fn(),
    onSnapshot: vi.fn(() => () => {}),
    getDoc: vi.fn(),
    Timestamp: MockTimestamp,
    runTransaction: vi.fn(),
    addDoc: hoist.addDocMock,
    updateDoc: hoist.updateDocMock,
    deleteDoc: vi.fn(),
    increment: (n) => ({ __increment: n }),
  };
});

// ---- Mock the firebase app module so importing DataContext does not init a real app ----
vi.mock('../firebase/firebase', () => ({
  db: {},
  auth: {},
  default: {},
}));

// ---- Mock AuthContext so we can render <DataProvider> without a real auth session ----
vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({ currentUser: null }),
}));

// ---- Real source under test ----
import { enqueuePendingWrite, readPendingWrites } from './offlineQueue';
import { DataProvider } from '../contexts/DataContext';

function Probe() { return null; }

let consoleErrorSpy;

beforeEach(() => {
  localStorage.clear();
  hoist.addDocMock.mockReset();
  hoist.updateDocMock.mockReset();
  vi.useFakeTimers();
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('offlineQueue — stock delta queue round-trip', () => {
  it('round-trips stockDeltas attached to a pending sale', () => {
    enqueuePendingWrite('sale', {
      _localId: 'SCNT-LOCAL-SALE-L1',
      InvoiceNumber: 'INV-1',
      stockDeltas: [{ productId: 'p1', delta: -2 }, { productId: 'p2', delta: -1 }],
    });
    const data = readPendingWrites()[0].data;
    expect(data._localId).toBe('SCNT-LOCAL-SALE-L1');
    expect(data.stockDeltas).toEqual([
      { productId: 'p1', delta: -2 },
      { productId: 'p2', delta: -1 },
    ]);
  });
});

describe('DataContext — flush retry behavior', () => {
  it('removes a write only after the sale AND its stock deltas succeed', async () => {
    hoist.addDocMock.mockRejectedValueOnce(new Error('network temporarily unavailable'));
    enqueuePendingWrite('sale', {
      _localId: 'SCNT-LOCAL-SALE-L2',
      InvoiceNumber: 'INV-2',
      stockDeltas: [{ productId: 'p1', delta: -2 }],
    });

    render(<DataProvider><Probe /></DataProvider>);

    expect(readPendingWrites()).toHaveLength(1);

    hoist.addDocMock.mockResolvedValueOnce({ id: 'sale-2' });
    hoist.updateDocMock.mockResolvedValueOnce(undefined);

    await act(async () => { await vi.advanceTimersByTimeAsync(60000); });

    expect(readPendingWrites()).toHaveLength(0);
    expect(hoist.addDocMock).toHaveBeenCalledTimes(2);
    expect(hoist.updateDocMock).toHaveBeenCalledTimes(1);
    expect(hoist.updateDocMock).toHaveBeenCalledWith(expect.anything(), { Stock: { __increment: -2 } });
  });

  it('drops a pending sale only after 5 failed non-quota attempts, never silently', async () => {
    enqueuePendingWrite('sale', {
      _localId: 'SCNT-LOCAL-SALE-L3',
      InvoiceNumber: 'INV-3',
      stockDeltas: [{ productId: 'p1', delta: -2 }],
    });
    hoist.addDocMock.mockRejectedValue(new Error('network'));

    render(<DataProvider><Probe /></DataProvider>);

    expect(readPendingWrites()).toHaveLength(1);

    for (let i = 0; i < 4; i++) {
      await act(async () => { await vi.advanceTimersByTimeAsync(60000); });
    }

    expect(readPendingWrites()).toHaveLength(0);
    expect(hoist.updateDocMock).not.toHaveBeenCalled();
    expect(consoleErrorSpy).toHaveBeenCalled();
  });

  it('keeps retrying a quota-blocked write without consuming attempts, then flushes deltas when quota clears', async () => {
    hoist.addDocMock.mockRejectedValueOnce({ code: 'resource-exhausted', message: 'Quota exceeded' });
    enqueuePendingWrite('sale', {
      _localId: 'SCNT-LOCAL-SALE-L4',
      InvoiceNumber: 'INV-4',
      stockDeltas: [{ productId: 'p1', delta: -3 }],
    });

    render(<DataProvider><Probe /></DataProvider>);

    expect(readPendingWrites()).toHaveLength(1);

    hoist.addDocMock.mockResolvedValueOnce({ id: 'sale-4' });
    hoist.updateDocMock.mockResolvedValueOnce(undefined);

    await act(async () => { await vi.advanceTimersByTimeAsync(60000); });

    expect(readPendingWrites()).toHaveLength(0);
    expect(hoist.updateDocMock).toHaveBeenCalledWith(expect.anything(), { Stock: { __increment: -3 } });
  });

  it('retains the write when the sale inserts but a stock delta fails', async () => {
    hoist.addDocMock.mockResolvedValueOnce({ id: 'sale-5' });
    hoist.updateDocMock.mockRejectedValueOnce(new Error('delta failed'));
    enqueuePendingWrite('sale', {
      _localId: 'SCNT-LOCAL-SALE-L5',
      InvoiceNumber: 'INV-5',
      stockDeltas: [{ productId: 'p1', delta: -1 }],
    });

    render(<DataProvider><Probe /></DataProvider>);

    expect(readPendingWrites()).toHaveLength(1);

    hoist.addDocMock.mockResolvedValueOnce({ id: 'sale-5b' });
    hoist.updateDocMock.mockResolvedValueOnce(undefined);

    await act(async () => { await vi.advanceTimersByTimeAsync(60000); });

    expect(readPendingWrites()).toHaveLength(0);
    expect(hoist.updateDocMock).toHaveBeenCalledTimes(2);
  });
});