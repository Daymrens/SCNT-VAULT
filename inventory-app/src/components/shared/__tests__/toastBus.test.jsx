import React from 'react';
import { render, screen, act, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { ToastProvider, toastBus } from '../Toast';

function BusSubscriber({ onReady }) {
  React.useEffect(() => {
    // Delay fire until after ToastProvider's effect has subscribed
    const timer = setTimeout(() => {
      toastBus.fire('Bus message', 'info');
    }, 10);
    return () => clearTimeout(timer);
  }, []);
  return <div>sub</div>;
}

describe('toastBus', () => {
  it('fires toast via ToastProvider subscription', async () => {
    render(
      <ToastProvider>
        <BusSubscriber />
      </ToastProvider>
    );
    await waitFor(() => {
      expect(screen.queryByText('Bus message')).toBeInTheDocument();
    }, { timeout: 3000 });
  });

  it('renders info variant from toastBus.fire', async () => {
    render(
      <ToastProvider>
        <BusSubscriber />
      </ToastProvider>
    );
    await waitFor(() => {
      expect(screen.queryByText('Bus message')).toBeInTheDocument();
    }, { timeout: 3000 });
    const toast = screen.getByText('Bus message').closest('div');
    expect(toast).toHaveAttribute('style', expect.stringContaining('var(--info-bg)'));
  });
});