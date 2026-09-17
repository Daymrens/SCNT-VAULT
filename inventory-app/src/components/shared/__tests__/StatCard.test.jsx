import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import StatCard from '../StatCard';

describe('StatCard', () => {
  it('renders label and value', () => {
    render(<StatCard label="Products" value={42} />);
    expect(screen.getByText('Products')).toBeInTheDocument();
    expect(screen.getByText('42')).toBeInTheDocument();
  });

  it('renders string value', () => {
    render(<StatCard label="Total" value="₱1,234" />);
    expect(screen.getByText('₱1,234')).toBeInTheDocument();
  });

  it('applies custom color as border', () => {
    render(<StatCard label="Test" value={1} color="#6366f1" />);
    const card = screen.getByText('Test').parentElement;
    expect(card).toHaveStyle({ borderLeft: '4px solid #6366f1' });
  });

  it('renders icon when provided', () => {
    render(<StatCard label="Test" value={1} color="#000" icon={<span data-testid="icon">X</span>} />);
    expect(screen.getByTestId('icon')).toBeInTheDocument();
  });

  it('does not render icon when not provided', () => {
    const { container } = render(<StatCard label="X" value={0} />);
    expect(container.querySelector('span[data-testid]')).toBeNull();
  });
});
