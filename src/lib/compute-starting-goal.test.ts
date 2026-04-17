import { describe, it, expect } from 'vitest';
import { computeStartingGoal } from './compute-starting-goal';

describe('computeStartingGoal', () => {
  // ── Exact anchor points from GoFundMe ──────────────────────────────
  it.each([
    [100, 100],
    [1_000, 300],
    [10_000, 600],
    [100_000, 1_200],
    [1_000_000, 2_600],
  ])('anchor: $%d → $%d', (input, expected) => {
    expect(computeStartingGoal(input)).toBe(expected);
  });

  // ── Boundary: minimum $1 ───────────────────────────────────────────
  it('$1 returns $1', () => {
    expect(computeStartingGoal(1)).toBe(1);
  });

  // ── Boundary: maximum $1,000,000,000 (1 billion) ───────────────────
  it('$1B returns capped $2,600', () => {
    expect(computeStartingGoal(1_000_000_000)).toBe(2600);
  });

  // ── Edge: zero and negative ────────────────────────────────────────
  it('$0 returns $0', () => {
    expect(computeStartingGoal(0)).toBe(0);
  });

  it('negative returns $0', () => {
    expect(computeStartingGoal(-500)).toBe(0);
  });

  // ── Small values ($1–$100) return themselves ───────────────────────
  it.each([1, 10, 25, 50, 99, 100])(
    '$%d returns itself (no reduction below $100)',
    (val) => {
      expect(computeStartingGoal(val)).toBe(val);
    },
  );

  // ── Interpolation: mid-tier values ─────────────────────────────────
  it('$500 is between $100 and $300', () => {
    const result = computeStartingGoal(500);
    expect(result).toBeGreaterThan(100);
    expect(result).toBeLessThan(300);
  });

  it('$5,000 is between $300 and $600', () => {
    const result = computeStartingGoal(5_000);
    expect(result).toBeGreaterThan(300);
    expect(result).toBeLessThan(600);
  });

  it('$50,000 is between $600 and $1,200', () => {
    const result = computeStartingGoal(50_000);
    expect(result).toBeGreaterThan(600);
    expect(result).toBeLessThan(1_200);
  });

  it('$500,000 is between $1,200 and $2,600', () => {
    const result = computeStartingGoal(500_000);
    expect(result).toBeGreaterThan(1_200);
    expect(result).toBeLessThan(2_600);
  });

  // ── Cap: anything >= $1M returns $2,600 ────────────────────────────
  it.each([1_000_000, 5_000_000, 10_000_000, 1_000_000_000])(
    '$%d returns capped $2,600',
    (val) => {
      expect(computeStartingGoal(val)).toBe(2600);
    },
  );

  // ── Monotonically increasing ───────────────────────────────────────
  it('output never decreases as input grows', () => {
    const inputs = [1, 10, 50, 100, 500, 1_000, 5_000, 10_000, 50_000, 100_000, 500_000, 1_000_000, 1_000_000_000];
    for (let i = 1; i < inputs.length; i++) {
      expect(computeStartingGoal(inputs[i])).toBeGreaterThanOrEqual(computeStartingGoal(inputs[i - 1]));
    }
  });

  // ── Always returns an integer ──────────────────────────────────────
  it('returns integers for arbitrary inputs', () => {
    const inputs = [1, 7, 33, 101, 777, 1234, 9999, 55555, 123456, 999999];
    for (const val of inputs) {
      expect(Number.isInteger(computeStartingGoal(val))).toBe(true);
    }
  });

  // ── Starting goal is always <= input ───────────────────────────────
  it('starting goal never exceeds the input amount', () => {
    const inputs = [1, 50, 100, 500, 1_000, 5_000, 10_000, 100_000, 1_000_000, 1_000_000_000];
    for (const val of inputs) {
      expect(computeStartingGoal(val)).toBeLessThanOrEqual(val);
    }
  });
});
