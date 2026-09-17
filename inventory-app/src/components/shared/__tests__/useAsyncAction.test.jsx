import React, { useState } from 'react';
import { render, screen, act, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import useAsyncAction from '../useAsyncAction';

function TestComponent() {
  const [result, setResult] = useState(null);
  const [run, busy] = useAsyncAction(async (val) => {
    await new Promise(r => setTimeout(r, 100));
    return val * 2;
  });
  return (
    <div>
      <span data-testid="busy">{busy ? 'busy' : 'idle'}</span>
      <span data-testid="result">{result}</span>
      <button onClick={async () => { const r = await run(5); setResult(r); }}>Run</button>
    </div>
  );
}

function TestErrorComponent() {
  const [error, setError] = useState(null);
  const [run, busy] = useAsyncAction(async () => {
    throw new Error('fail');
  });
  return (
    <div>
      <span data-testid="busy">{busy ? 'busy' : 'idle'}</span>
      <span data-testid="error">{error}</span>
      <button onClick={async () => { try { await run(); } catch(e) { setError(e.message); } }}>Run</button>
    </div>
  );
}

describe('useAsyncAction', () => {
  it('is idle initially', () => {
    render(<TestComponent />);
    expect(screen.getByTestId('busy').textContent).toBe('idle');
  });

  it('sets busy to true during async operation', async () => {
    render(<TestComponent />);
    act(() => { fireEvent.click(screen.getByText('Run')); });
    expect(screen.getByTestId('busy').textContent).toBe('busy');
    await waitFor(() => expect(screen.getByTestId('busy').textContent).toBe('idle'));
  });

  it('returns result from async function', async () => {
    render(<TestComponent />);
    act(() => { fireEvent.click(screen.getByText('Run')); });
    await waitFor(() => expect(screen.getByTestId('result').textContent).toBe('10'));
  });

  it('returns to idle after error', async () => {
    render(<TestErrorComponent />);
    act(() => { fireEvent.click(screen.getByText('Run')); });
    await waitFor(() => expect(screen.getByTestId('error').textContent).toBe('fail'));
    expect(screen.getByTestId('busy').textContent).toBe('idle');
  });
});