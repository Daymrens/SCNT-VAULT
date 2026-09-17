import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import ConfirmDialog from '../ConfirmDialog';

describe('ConfirmDialog', () => {
  it('does not render when isOpen is false', () => {
    render(<ConfirmDialog isOpen={false} onConfirm={() => {}} onClose={() => {}} />);
    expect(screen.queryByText('Cancel')).not.toBeInTheDocument();
  });

  it('renders with default title and confirm label', () => {
    render(<ConfirmDialog isOpen={true} onConfirm={() => {}} onClose={() => {}} />);
    expect(screen.getByText('Are you sure?')).toBeInTheDocument();
    expect(screen.getByText('Yes, Delete')).toBeInTheDocument();
    expect(screen.getByText('Cancel')).toBeInTheDocument();
  });

  it('renders custom title and message', () => {
    render(
      <ConfirmDialog isOpen={true} title="Delete?" message="Are you sure?"
        confirmLabel="Yes, delete" onConfirm={() => {}} onClose={() => {}} />
    );
    expect(screen.getByText('Delete?')).toBeInTheDocument();
    expect(screen.getByText('Are you sure?')).toBeInTheDocument();
    expect(screen.getByText('Yes, delete')).toBeInTheDocument();
  });

  it('calls onConfirm when danger button clicked', () => {
    const onConfirm = vi.fn();
    render(<ConfirmDialog isOpen={true} onConfirm={onConfirm} onClose={() => {}} />);
    fireEvent.click(screen.getByText('Yes, Delete'));
    expect(onConfirm).toHaveBeenCalled();
  });

  it('calls onClose when cancel button clicked', () => {
    const onClose = vi.fn();
    render(<ConfirmDialog isOpen={true} onConfirm={() => {}} onClose={onClose} />);
    fireEvent.click(screen.getByText('Cancel'));
    expect(onClose).toHaveBeenCalled();
  });

  it('calls onClose when overlay is clicked', () => {
    const onClose = vi.fn();
    render(<ConfirmDialog isOpen={true} onConfirm={() => {}} onClose={onClose} />);
    fireEvent.click(screen.getByText('Cancel').closest('div').parentElement.parentElement.parentElement.parentElement);
    expect(onClose).toHaveBeenCalled();
  });
});
