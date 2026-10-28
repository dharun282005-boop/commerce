import { describe, expect, it } from 'vitest';
import { assertPaise, formatINR, rupeesToPaise } from '../src/money.ts';

describe('money', () => {
  it('converts rupees to integer paise without float drift', () => {
    expect(rupeesToPaise(0.1 + 0.2)).toBe(30);
    expect(rupeesToPaise(34999)).toBe(3499900);
  });
  it('formats with Indian digit grouping', () => {
    expect(formatINR(12345678)).toBe('₹1,23,456.78');
    expect(formatINR(3499900)).toBe('₹34,999');
  });
  it('rejects non-integer or negative paise', () => {
    expect(() => assertPaise(1.5)).toThrow();
    expect(() => assertPaise(-1)).toThrow();
  });
});
