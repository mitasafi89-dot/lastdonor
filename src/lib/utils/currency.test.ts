import { describe, it, expect } from 'vitest';
import { centsToDollars, dollarsToCents } from '@/lib/utils/currency';

describe('centsToDollars', () => {
  it('formats 0 cents as $0.00', () => {
    expect(centsToDollars(0)).toBe('$0.00');
  });

  it('formats 500 cents as $5.00', () => {
    expect(centsToDollars(500)).toBe('$5.00');
  });

  it('formats 1050 cents as $10.50', () => {
    expect(centsToDollars(1050)).toBe('$10.50');
  });

  it('formats 100000 cents as $1,000.00', () => {
    expect(centsToDollars(100000)).toBe('$1,000.00');
  });

  it('formats 1 cent as $0.01', () => {
    expect(centsToDollars(1)).toBe('$0.01');
  });

  it('formats large amounts with commas', () => {
    expect(centsToDollars(10_000_000)).toBe('$100,000.00');
  });
});

describe('dollarsToCents', () => {
  it('converts $5 to 500 cents', () => {
    expect(dollarsToCents(5)).toBe(500);
  });

  it('converts $10.50 to 1050 cents', () => {
    expect(dollarsToCents(10.50)).toBe(1050);
  });

  it('converts $0.01 to 1 cent', () => {
    expect(dollarsToCents(0.01)).toBe(1);
  });

  it('converts $0 to 0 cents', () => {
    expect(dollarsToCents(0)).toBe(0);
  });

  it('rounds floating point precisely', () => {
    // 19.99 * 100 = 1998.9999... → Math.round = 1999
    expect(dollarsToCents(19.99)).toBe(1999);
  });

  it('converts $1000 to 100000 cents', () => {
    expect(dollarsToCents(1000)).toBe(100000);
  });
});
