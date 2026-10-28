import type { Compliance, RawOffer, SearchContext, SourceAdapter } from '../src/adapters/types.ts';
import type { SearchQuery } from '../src/schemas.ts';

export const ctx = (nowMs = Date.UTC(2026, 9, 28, 10)): SearchContext => ({
  requestId: 'test',
  now: () => new Date(nowMs),
});

export const query = (q = 'phone', vertical: SearchQuery['vertical'] = 'shopping'): SearchQuery => ({
  vertical,
  q,
  pincodes: ['600042'],
  localityIds: ['velachery'],
  filters: {},
});

export function validOffer(id: string) {
  return {
    id,
    vertical: 'shopping',
    title: 'Test phone',
    url: 'https://example.com/p',
    pricePaise: 1000,
    mrpPaise: null,
    fees: {
      deliveryPaise: 0,
      handlingPaise: 0,
      platformPaise: 0,
      packagingPaise: 0,
      taxesNotIncludedPaise: 0,
    },
    coupons: [],
    rating: null,
    etaMinutes: 60,
    trust: { fulfilledByPlatform: null, returnPolicyDays: null, sellerRating: null },
    affiliate: false,
    provenance: {
      sourceId: 'fake',
      sourceName: 'Fake',
      tier: 1,
      observedAt: '2026-10-28T10:00:00.000Z',
      confidence: 1,
      isSample: false,
    },
    brand: 'B',
    model: 'M',
    category: 'mobiles',
    seller: null,
    variant: { storageGb: null, ramGb: null, colour: null, size: null },
    identifiers: { gtin: null, asin: null, mpn: null, modelNumber: null },
    deliversTo: null,
  };
}

/** A scriptable adapter: each call to search() runs the next behaviour in the list (last one repeats). */
export class FakeAdapter implements SourceAdapter {
  readonly id: string;
  readonly name = 'Fake source';
  readonly capabilities = {
    verticals: ['shopping' as const],
    supportsGetOffer: false,
    requiresCredentials: false,
  };
  compliance: Compliance = {
    tier: 1,
    termsUrl: null,
    robotsAllowed: null,
    lastReviewed: null,
    enabledByDefault: true,
    notes: '',
  };
  calls = 0;

  constructor(
    private behaviours: Array<'ok' | 'fail' | 'hang' | 'invalid'> = ['ok'],
    id = 'fake',
  ) {
    this.id = id;
  }

  async search(_q: SearchQuery, c: SearchContext): Promise<RawOffer[]> {
    const b = this.behaviours[Math.min(this.calls, this.behaviours.length - 1)];
    this.calls++;
    if (b === 'fail') throw new Error('boom');
    if (b === 'hang')
      return new Promise((_, reject) =>
        c.signal?.addEventListener('abort', () => reject(new Error('aborted'))),
      );
    if (b === 'invalid')
      return [
        { externalId: 'ok', payload: 'ok' },
        { externalId: 'bad', payload: 'bad' },
      ];
    return [{ externalId: '1', payload: 'ok' }];
  }
  async getOffer() {
    return null;
  }
  normalise(raw: RawOffer) {
    return raw.payload === 'ok' ? validOffer(`${this.id}:${raw.externalId}`) : { broken: true };
  }
  async health() {
    return { ok: true };
  }
}
