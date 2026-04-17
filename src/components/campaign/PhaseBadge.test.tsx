import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PhaseBadge } from '@/components/campaign/PhaseBadge';

describe('PhaseBadge', () => {
  it('renders "First Believers" for first_believers phase', () => {
    render(<PhaseBadge phase="first_believers" />);
    expect(screen.getByText('First Believers')).toBeInTheDocument();
  });

  it('renders "The Push" for the_push phase', () => {
    render(<PhaseBadge phase="the_push" />);
    expect(screen.getByText('The Push')).toBeInTheDocument();
  });

  it('renders "Closing In" for closing_in phase', () => {
    render(<PhaseBadge phase="closing_in" />);
    expect(screen.getByText('Closing In')).toBeInTheDocument();
  });

  it('renders "Last Donor Zone" for last_donor_zone phase', () => {
    render(<PhaseBadge phase="last_donor_zone" />);
    expect(screen.getByText('Last Donor Zone')).toBeInTheDocument();
  });

  it('sets correct aria-label for first_believers', () => {
    render(<PhaseBadge phase="first_believers" />);
    const badge = screen.getByText('First Believers');
    expect(badge).toHaveAttribute(
      'aria-label',
      'Campaign phase: First Believers - 0 to 25% funded',
    );
  });

  it('sets correct aria-label for last_donor_zone', () => {
    render(<PhaseBadge phase="last_donor_zone" />);
    const badge = screen.getByText('Last Donor Zone');
    expect(badge).toHaveAttribute(
      'aria-label',
      'Campaign phase: Last Donor Zone - 91 to 100% funded',
    );
  });

  it('applies custom className', () => {
    render(<PhaseBadge phase="the_push" className="custom-class" />);
    const badge = screen.getByText('The Push');
    expect(badge.className).toContain('custom-class');
  });
});
