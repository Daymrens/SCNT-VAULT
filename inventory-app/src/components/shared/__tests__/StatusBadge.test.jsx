import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import StatusBadge from '../StatusBadge';

describe('StatusBadge', () => {
  it('renders the status as label by default', () => {
    render(<StatusBadge status="Completed" />);
    expect(screen.getByText('Completed')).toBeInTheDocument();
    expect(screen.getByText('Completed')).toHaveClass('badge');
  });

  it('renders a custom label when provided', () => {
    render(<StatusBadge status="available" label="In Stock" />);
    expect(screen.getByText('In Stock')).toBeInTheDocument();
  });

  it('maps success statuses to teal styling', () => {
    render(<StatusBadge status="received" />);
    expect(screen.getByText('received').getAttribute('style')).toContain('var(--accent)');
  });

  it('maps warning statuses to amber styling', () => {
    render(<StatusBadge status="LOW STOCK" />);
    expect(screen.getByText('LOW STOCK').getAttribute('style')).toContain('var(--warning)');
  });

  it('maps danger statuses to red styling', () => {
    render(<StatusBadge status="overdue" />);
    expect(screen.getByText('overdue').getAttribute('style')).toContain('var(--danger)');
  });

  it('maps info statuses to blue styling', () => {
    render(<StatusBadge status="retail" />);
    expect(screen.getByText('retail').getAttribute('style')).toContain('var(--info)');
  });

  it('falls back to gray for unknown statuses', () => {
    render(<StatusBadge status="unknown-status" />);
    expect(screen.getByText('unknown-status').getAttribute('style')).toContain('var(--text-secondary)');
  });
});