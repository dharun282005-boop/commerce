import { describe, expect, it } from 'vitest';
import { matchesAll, queryTokens, tokenize } from '../src/text.ts';

describe('text', () => {
  it('joins numbers with units and keeps the unit', () => {
    expect(tokenize('128 GB')).toEqual(['128gb', 'gb']);
    expect(tokenize('2 BHK flat')).toEqual(['2bhk', 'bhk', 'flat']);
  });
  it('drops request words, bare numbers and locality names from queries', () => {
    expect(queryTokens('Best price for Samsung Galaxy S24 FE 128GB delivered to Velachery')).toEqual([
      'samsung', 'galaxy', 's24', 'fe', '128gb',
    ]);
    expect(queryTokens('12 eggs')).toEqual(['egg']);
  });
  it('does not match 256 GB when 128 GB was asked for', () => {
    const t = queryTokens('S24 FE 128GB');
    expect(matchesAll(t, 'Samsung Galaxy S24 FE 5G (Mint, 8GB RAM, 128GB Storage)')).toBe(true);
    expect(matchesAll(t, 'Samsung Galaxy S24 FE 5G (Mint, 8GB RAM, 256GB Storage)')).toBe(false);
  });
});
