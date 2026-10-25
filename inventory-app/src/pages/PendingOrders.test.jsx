import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { onSnapshot, where } from 'firebase/firestore';
import PendingOrders from './PendingOrders';

vi.mock('../firebase/firebase', () => ({ db: {} }));
vi.mock('firebase/firestore', () => ({
  collection: vi.fn(), query: vi.fn(), where: vi.fn(), onSnapshot: vi.fn(() => vi.fn()),
}));
afterEach(() => { cleanup(); vi.clearAllMocks(); });
const mount = () => render(<MemoryRouter><PendingOrders /></MemoryRouter>);
const deliver = orders => act(() => onSnapshot.mock.calls[0][1]({
  docs: orders.map(o => ({ id: o.id, data: () => o })),
}));

describe('Pending Orders', () => {
  it('subscribes to processing orders and links the selected order to POS', () => {
    mount();
    expect(where).toHaveBeenCalledWith('status', '==', 'processing');
    deliver([
      { id: 'online-1', orderNumber: 'SCNT-001', customerName: 'Reyah', items: [{ name: 'Eros', quantity: 2, price: 220 }] },
      { id: 'done', orderNumber: 'SCNT-002', posHandled: true },
      { id: 'fulfilled', orderNumber: 'SCNT-003', fulfilled: true },
    ]);
    expect(screen.getByText('SCNT-001')).toBeInTheDocument();
    expect(screen.queryByText('SCNT-002')).not.toBeInTheDocument();
    expect(screen.queryByText('SCNT-003')).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Open in POS' })).toHaveAttribute('href', '/pos?posOrder=online-1');
    expect(screen.getByText('₱440.00')).toBeInTheDocument();
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'missing' } });
    expect(screen.getByText('No matching orders.')).toBeInTheDocument();
    fireEvent.change(screen.getByRole('textbox'), { target: { value: '' } });
    deliver([]);
    expect(screen.getByText('No processing orders awaiting POS completion.')).toBeInTheDocument();
  });

  it('reports subscription failures instead of an empty successful result', () => {
    mount();
    act(() => onSnapshot.mock.calls[0][2](new Error('permission-denied')));
    expect(screen.getByRole('alert')).toHaveTextContent('Unable to load pending orders');
  });
});
