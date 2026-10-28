import { describe, expect, it } from 'vitest';
import { formatQuantity, parseQuantity, unitPricePaise } from '../src/units.ts';

describe('units', () => {
  it.each([
    ['2 kg', { value: 2000, unit: 'g' }],
    ['500g', { value: 500, unit: 'g' }],
    ['1 L', { value: 1000, unit: 'ml' }],
    ['6 x 200 ml', { value: 1200, unit: 'ml' }],
    ['12 pcs', { value: 12, unit: 'pc' }],
  ])('parses %s', (input, expected) => {
    expect(parseQuantity(input)).toEqual(expected);
  });
  it('returns null instead of guessing', () => {
    expect(parseQuantity('a big bag')).toBeNull();
    expect(parseQuantity('2 bunches')).toBeNull();
  });
  it('computes price per 100 g', () => {
    // ₹78 for 1 kg -> ₹7.80 per 100 g
    expect(unitPricePaise(7800, { value: 1000, unit: 'g' })).toBe(780);
    expect(unitPricePaise(9200, { value: 12, unit: 'pc' })).toBe(767);
    expect(unitPricePaise(100, null)).toBeNull();
  });
  it('formats quantities', () => {
    expect(formatQuantity({ value: 2000, unit: 'g' })).toBe('2 kg');
    expect(formatQuantity({ value: 500, unit: 'ml' })).toBe('500 ml');
  });
});
