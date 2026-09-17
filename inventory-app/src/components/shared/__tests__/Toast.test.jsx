import React from 'react';
import { render, screen, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ToastProvider, useToast } from '../Toast';

function TestComponent({ onToast }) {
  const { showToast } = useToast();
  React.useEffect(() => { if (onToast) onToast(showToast); }, [showToast, onToast]);
  return <div>test</div>;
}

describe('ToastProvider & useToast', () => {
  it('throws if useToast used outside provider', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    function Bad() { useToast(); return null; }
    expect(() => render(<Bad />)).toThrow('useToast must be used within ToastProvider');
    spy.mockRestore();
  });

  it('renders children', () => {
    render(<ToastProvider><div>child</div></ToastProvider>);
    expect(screen.getByText('child')).toBeInTheDocument();
  });

  it('shows toast on showToast call', async () => {
    let showToast;
    render(
      <ToastProvider>
        <TestComponent onToast={fn => { showToast = fn; }} />
      </ToastProvider>
    );
    act(() => { showToast('Hello!', 'success'); });
    expect(screen.getByText('Hello!')).toBeInTheDocument();
  });

  it('auto-removes toast after 3 seconds', async () => {
    vi.useFakeTimers();
    let showToast;
    render(
      <ToastProvider>
        <TestComponent onToast={fn => { showToast = fn; }} />
      </ToastProvider>
    );
    act(() => { showToast('Gone soon', 'error'); });
    expect(screen.getByText('Gone soon')).toBeInTheDocument();
    act(() => { vi.advanceTimersByTime(3100); });
    expect(screen.queryByText('Gone soon')).not.toBeInTheDocument();
    vi.useRealTimers();
  });

  it('renders success toast with correct styling', async () => {
    let showToast;
    render(
      <ToastProvider>
        <TestComponent onToast={fn => { showToast = fn; }} />
      </ToastProvider>
    );
    act(() => { showToast('OK', 'success'); });
    const toast = screen.getByText('OK').closest('div');
    expect(toast).toHaveAttribute('style', expect.stringContaining('var(--success-bg)'));
  });

  it('renders error toast by default', async () => {
    let showToast;
    render(
      <ToastProvider>
        <TestComponent onToast={fn => { showToast = fn; }} />
      </ToastProvider>
    );
    act(() => { showToast('Oops'); });
    const toast = screen.getByText('Oops').closest('div');
    expect(toast).toHaveAttribute('style', expect.stringContaining('var(--danger-bg)'));
  });
});
