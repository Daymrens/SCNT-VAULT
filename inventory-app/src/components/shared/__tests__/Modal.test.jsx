import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import Modal, { CancelButton, PrimaryButton, DangerButton } from '../Modal';

describe('Modal', () => {
  it('does not render when isOpen is false', () => {
    render(<Modal isOpen={false}><div>content</div></Modal>);
    expect(screen.queryByText('content')).not.toBeInTheDocument();
  });

  it('renders children when isOpen is true', () => {
    render(<Modal isOpen={true}><div>visible</div></Modal>);
    expect(screen.getByText('visible')).toBeInTheDocument();
  });

  it('renders title when provided', () => {
    render(<Modal isOpen={true} title="My Title"><div>content</div></Modal>);
    expect(screen.getByText('My Title')).toBeInTheDocument();
  });

  it('calls onClose when overlay is clicked', () => {
    const onClose = vi.fn();
    render(<Modal isOpen={true} onClose={onClose}><div>content</div></Modal>);
    const overlay = screen.getByText('content').parentElement.parentElement.parentElement;
    fireEvent.click(overlay);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('does not close when modal body is clicked', () => {
    const onClose = vi.fn();
    render(<Modal isOpen={true} onClose={onClose}><div>content</div></Modal>);
    fireEvent.click(screen.getByText('content'));
    expect(onClose).not.toHaveBeenCalled();
  });
});

describe('Button components', () => {
  it('CancelButton renders label and onClick', () => {
    const onClick = vi.fn();
    render(<CancelButton onClick={onClick}>Cancel</CancelButton>);
    fireEvent.click(screen.getByText('Cancel'));
    expect(onClick).toHaveBeenCalled();
  });

  it('PrimaryButton renders children and onClick', () => {
    const onClick = vi.fn();
    render(<PrimaryButton onClick={onClick}>Save</PrimaryButton>);
    fireEvent.click(screen.getByText('Save'));
    expect(onClick).toHaveBeenCalled();
  });

  it('PrimaryButton is disabled when disabled prop is true', () => {
    render(<PrimaryButton disabled>Save</PrimaryButton>);
    expect(screen.getByText('Save')).toBeDisabled();
  });

  it('DangerButton renders children and onClick', () => {
    const onClick = vi.fn();
    render(<DangerButton onClick={onClick}>Delete</DangerButton>);
    fireEvent.click(screen.getByText('Delete'));
    expect(onClick).toHaveBeenCalled();
  });
});
