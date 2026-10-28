import { describe, expect, it } from 'vitest';
import { LOCALITIES, resolveArea, searchLocalities } from '../src/localities.ts';

describe('localities', () => {
  it('has at least 20 seeded localities with valid pincodes and Chennai coordinates', () => {
    expect(LOCALITIES.length).toBeGreaterThanOrEqual(20);
    for (const l of LOCALITIES) {
      expect(l.pincode).toMatch(/^60\d{4}$/);
      expect(l.lat).toBeGreaterThan(12.8);
      expect(l.lat).toBeLessThan(13.2);
      expect(l.lng).toBeGreaterThan(80.0);
      expect(l.lng).toBeLessThan(80.35);
    }
    expect(new Set(LOCALITIES.map((l) => l.id)).size).toBe(LOCALITIES.length);
  });
  it('resolves names, aliases and pincodes', () => {
    expect(resolveArea('Velachery')?.pincodes).toEqual(['600042']);
    expect(resolveArea('t. nagar')?.localities[0]?.id).toBe('t-nagar');
    expect(resolveArea('600020')?.label).toBe('Adyar');
  });
  it('resolves the OMR corridor to several localities', () => {
    const omr = resolveArea('OMR');
    expect(omr?.localities.map((l) => l.id)).toEqual(['perungudi', 'thoraipakkam', 'karapakkam', 'sholinganallur', 'navalur']);
    expect(omr?.pincodes).toContain('600119');
  });
  it('returns null for places outside the seeded list', () => {
    expect(resolveArea('Bengaluru')).toBeNull();
    expect(resolveArea('560001')).toBeNull();
  });
  it('searches by prefix and Tamil name', () => {
    expect(searchLocalities('anna').map((l) => l.id)).toContain('anna-nagar');
    expect(searchLocalities('அடையாறு').map((l) => l.id)).toEqual(['adyar']);
  });
});
