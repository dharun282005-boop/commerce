import { describe, expect, it } from 'vitest';
import { Offer, PropertyOffer, SearchQuery } from '../src/schemas.ts';

const provenance = { sourceId: 's', sourceName: 'S (sample)', tier: 'fixture', observedAt: '2026-10-28T10:00:00.000Z', confidence: 1, isSample: true };
const fees = { deliveryPaise: 0, handlingPaise: null, platformPaise: null, packagingPaise: null, taxesNotIncludedPaise: null };
const trust = { fulfilledByPlatform: null, returnPolicyDays: null, sellerRating: null };

const product = {
  id: 's:1', vertical: 'shopping', title: 'Phone', url: 'https://example.com/p', pricePaise: 100, mrpPaise: null, fees, coupons: [],
  rating: null, etaMinutes: null, trust, affiliate: false, provenance, brand: 'B', model: 'M', category: 'mobiles', seller: null,
  variant: { storageGb: 128, ramGb: 8, colour: null, size: null }, identifiers: { gtin: null, asin: null, mpn: null, modelNumber: null }, deliversTo: null,
};

describe('schemas', () => {
  it('accepts a valid product offer', () => {
    expect(Offer.parse(product).vertical).toBe('shopping');
  });
  it('rejects money that is not whole paise', () => {
    expect(Offer.safeParse({ ...product, pricePaise: 99.5 }).success).toBe(false);
    expect(Offer.safeParse({ ...product, pricePaise: -1 }).success).toBe(false);
  });
  it('requires provenance on every offer (rule 3)', () => {
    const { provenance: _p, ...noProv } = product;
    expect(Offer.safeParse(noProv).success).toBe(false);
  });
  it('property offers have no contact/phone field', () => {
    expect(Object.keys(PropertyOffer.shape)).not.toContain('phone');
    expect(Object.keys(PropertyOffer.shape)).not.toContain('contact');
  });
  it('validates search queries', () => {
    expect(SearchQuery.safeParse({ vertical: 'food', q: 'biryani', pincodes: ['600020'], localityIds: ['adyar'] }).success).toBe(true);
    expect(SearchQuery.safeParse({ vertical: 'food', q: '', pincodes: ['600020'], localityIds: ['adyar'] }).success).toBe(false);
    expect(SearchQuery.safeParse({ vertical: 'cars', q: 'x', pincodes: ['600020'], localityIds: ['adyar'] }).success).toBe(false);
  });
});
