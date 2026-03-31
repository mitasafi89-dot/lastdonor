import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ProgressBar } from '@/components/campaign/ProgressBar';

describe('ProgressBar', () => {
  it('renders a progressbar role', () => {
    render(<ProgressBar raisedAmount={2500} goalAmount={10000} />);
    expect(screen.getByRole('progressbar')).toBeInTheDocument();
  });

  it('sets correct aria-valuenow', () => {
    render(<ProgressBar raisedAmount={2500} goalAmount={10000} />);
    const bar = screen.getByRole('progressbar');
    expect(bar).toHaveAttribute('aria-valuenow', '2500');
  });

  it('sets correct aria-valuemin', () => {
    render(<ProgressBar raisedAmount={2500} goalAmount={10000} />);
    const bar = screen.getByRole('progressbar');
    expect(bar).toHaveAttribute('aria-valuemin', '0');
  });

  it('sets correct aria-valuemax', () => {
    render(<ProgressBar raisedAmount={2500} goalAmount={10000} />);
    const bar = screen.getByRole('progressbar');
    expect(bar).toHaveAttribute('aria-valuemax', '10000');
  });

  it('sets correct aria-label with percentage', () => {
    render(<ProgressBar raisedAmount={5000} goalAmount={10000} />);
    const bar = screen.getByRole('progressbar');
    expect(bar).toHaveAttribute('aria-label', 'Campaign progress: 50% funded');
  });

  it('shows 0% when goalAmount is 0', () => {
    render(<ProgressBar raisedAmount={5000} goalAmount={0} />);
    const bar = screen.getByRole('progressbar');
    expect(bar).toHaveAttribute('aria-label', 'Campaign progress: 0% funded');
  });

  it('caps percentage at 100%', () => {
    render(<ProgressBar raisedAmount={15000} goalAmount={10000} />);
    const bar = screen.getByRole('progressbar');
    expect(bar).toHaveAttribute('aria-label', 'Campaign progress: 100% funded');
  });

  it('applies compact height class when compact prop is true', () => {
    render(<ProgressBar raisedAmount={5000} goalAmount={10000} compact />);
    const bar = screen.getByRole('progressbar');
    expect(bar.className).toContain('h-1.5');
  });

  it('applies standard height class when compact is false', () => {
    render(<ProgressBar raisedAmount={5000} goalAmount={10000} />);
    const bar = screen.getByRole('progressbar');
    expect(bar.className).toContain('h-2');
  });
});
