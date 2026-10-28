import { describe, expect, it } from 'vitest';
import { createFixtureAdapters, parseFixtureFailures } from '../src/adapters/fixture.ts';
import { GuardedAdapter, policyFromEnv } from '../src/adapters/guarded.ts';
import { MemoryCache } from '../src/adapters/resilience.ts';
import { resolveArea } from '../src/localities.ts';
import { searchAll } from '../src/search.ts';
import type { SearchFilters, SearchQuery } from '../src/schemas.ts';
import { ctx } from './helpers.ts';

function guarded(env: Record<string, string> = {}) {
  const failures = parseFixtureFailures(env.FIXTURE_FAIL);
  return createFixtureAdapters({ failures }).map(
    (a) => new GuardedAdapter(a, { policy: policyFromEnv(env), cache: new MemoryCache(), timeoutMs: 50, retries: 0 }),
  );
}

function q(vertical: SearchQuery['vertical'], text: string, area: string, filters: SearchFilters = {}): SearchQuery {
  const a = resolveArea(area)!;
  return { vertical, q: text, pincodes: a.pincodes, localityIds: a.localities.map((l) => l.id), filters };
}

describe('fixture data: headline user stories', () => {
  it('US-1: S24 FE 128GB in Velachery returns only 128 GB offers from several sources', async () => {
    const out = await searchAll(guarded(), q('shopping', 'Samsung Galaxy S24 FE 128GB', 'Velachery'), ctx());
    expect(out.offers.length).toBeGreaterThanOrEqual(4);
    const sources = new Set(out.offers.map((o) => o.provenance.sourceId));
    expect(sources.size).toBeGreaterThanOrEqual(3);
    for (const o of out.offers) {
      expect(o.vertical).toBe('shopping');
      if (o.vertical === 'shopping') expect(o.variant.storageGb).toBe(128);
    }
  });

  it('US-2: veg biryani for 2 under ₹300 within 40 min in Adyar', async () => {
    const out = await searchAll(
      guarded(),
      q('food', 'veg biryani', 'Adyar', { vegOnly: true, minServings: 2, maxPricePaise: 30000, maxEtaMinutes: 40 }),
      ctx(),
    );
    expect(out.offers.length).toBeGreaterThanOrEqual(2);
    for (const o of out.offers) {
      if (o.vertical !== 'food') throw new Error('wrong vertical');
      expect(o.isVeg).toBe(true);
      expect(o.servings).toBeGreaterThanOrEqual(2);
      expect(o.etaMinutes!).toBeLessThanOrEqual(40);
      expect(o.deliversTo).toContain('600020');
    }
  });

  it('US-3: each grocery item is available on several platforms in T Nagar', async () => {
    for (const item of ['rice', 'milk', 'eggs']) {
      const out = await searchAll(guarded(), q('grocery', item, 'T Nagar'), ctx());
      expect(new Set(out.offers.map((o) => o.provenance.sourceId)).size, item).toBeGreaterThanOrEqual(3);
    }
  });

  it('US-4: 2 BHK semi-furnished rentals in the OMR corridor up to ₹30,000', async () => {
    const out = await searchAll(
      guarded(),
      q('property', '2 BHK', 'OMR', { bhk: 2, listingType: 'rent', furnishing: 'semi-furnished', maxPricePaise: 3_000_000 }),
      ctx(),
    );
    expect(out.offers.length).toBeGreaterThanOrEqual(5);
    const omr = new Set(resolveArea('OMR')!.localities.map((l) => l.id));
    for (const o of out.offers) {
      if (o.vertical !== 'property') throw new Error('wrong vertical');
      expect(omr.has(o.localityId)).toBe(true);
      expect(o.pricePaise).toBeLessThanOrEqual(3_000_000);
    }
  });
});

describe('fixture data: honesty rules', () => {
  it('every offer is labelled as sample data with source and timestamp', async () => {
    for (const [v, text, area] of [['shopping', 'phone', 'Adyar'], ['food', 'biryani', 'Adyar'], ['grocery', 'milk', 'Adyar'], ['property', 'bhk', 'OMR']] as const) {
      const out = await searchAll(guarded(), q(v, text, area), ctx());
      expect(out.offers.length, v).toBeGreaterThan(0);
      for (const o of out.offers) {
        expect(o.provenance.isSample).toBe(true);
        expect(o.provenance.sourceName).toMatch(/\(sample\)$/);
        expect(Date.parse(o.provenance.observedAt)).toBeLessThanOrEqual(ctx().now().getTime());
      }
      expect(out.sources.every((s) => s.droppedInvalid === 0)).toBe(true);
    }
  });

  it('property output contains no phone numbers', async () => {
    const out = await searchAll(guarded(), q('property', 'bhk', 'OMR'), ctx());
    expect(JSON.stringify(out.offers)).not.toMatch(/\b[6-9]\d{9}\b/);
  });
});

describe('failure isolation (FR-ADP-04)', () => {
  it('one source timing out and one switched off do not fail the search', async () => {
    const out = await searchAll(
      guarded({ FIXTURE_FAIL: 'fixture-zomato:timeout', DISABLED_SOURCES: 'fixture-ondc-food' }),
      q('food', 'biryani', 'Adyar'),
      ctx(),
    );
    const byId = Object.fromEntries(out.sources.map((s) => [s.sourceId, s]));
    expect(byId['fixture-zomato']?.status).toBe('unavailable');
    expect(byId['fixture-zomato']?.error?.kind).toBe('timeout');
    expect(byId['fixture-ondc-food']?.status).toBe('disabled');
    expect(byId['fixture-swiggy']?.status).toBe('ok');
    expect(out.offers.length).toBeGreaterThan(0);
    expect(out.offers.every((o) => o.provenance.sourceId === 'fixture-swiggy')).toBe(true);
  });
});
