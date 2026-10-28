import type { GuardedAdapter } from './adapters/guarded.ts';
import type { SearchContext, SourceResult } from './adapters/types.ts';
import { landedCost } from './rank/landed.ts';
import type { Offer, SearchFilters, SearchQuery } from './schemas.ts';

export interface SearchOutcome {
  offers: Offer[];
  sources: (Omit<SourceResult, 'offers'> & { offerCount: number })[];
}

/**
 * Asks every source that supports the vertical, in parallel, and keeps going when some fail.
 * GuardedAdapter never throws, and allSettled guards against bugs, so a single source can
 * never fail the whole search (FR-ADP-04).
 *
 * Offers come back filtered and sorted by item price; use compareOffers() to rank them.
 */
export async function searchAll(
  sources: GuardedAdapter[],
  query: SearchQuery,
  ctx: SearchContext,
): Promise<SearchOutcome> {
  const relevant = sources.filter((s) => s.adapter.capabilities.verticals.includes(query.vertical));
  const settled = await Promise.allSettled(relevant.map((s) => s.search(query, ctx)));

  const results: SourceResult[] = settled.map((res, i) => {
    if (res.status === 'fulfilled') return res.value;
    const s = relevant[i]!;
    return {
      sourceId: s.adapter.id,
      sourceName: s.adapter.name,
      tier: s.adapter.compliance.tier,
      status: 'unavailable',
      offers: [],
      fromCache: false,
      fetchedAt: null,
      latencyMs: 0,
      droppedInvalid: 0,
      error: { kind: 'upstream_error', message: 'unexpected error' },
    };
  });

  const offers = results
    .flatMap((r) => r.offers)
    .filter((o) => passesFilters(o, query.filters))
    .sort((a, b) => a.pricePaise - b.pricePaise || a.id.localeCompare(b.id));

  return { offers, sources: results.map(({ offers: _o, ...rest }) => ({ ...rest, offerCount: _o.length })) };
}

/** Filters apply the same way to every source. `maxPricePaise` is checked against the landed cost. */
export function passesFilters(o: Offer, f: SearchFilters): boolean {
  if (f.maxPricePaise !== undefined && landedCost(o).totalPaise > f.maxPricePaise) return false;
  if (f.maxEtaMinutes !== undefined && (o.etaMinutes === null || o.etaMinutes > f.maxEtaMinutes))
    return false;
  if (o.vertical === 'food') {
    if (f.vegOnly && !o.isVeg) return false;
    if (f.minServings !== undefined && o.servings < f.minServings) return false;
  }
  if (o.vertical === 'property') {
    if (f.bhk !== undefined && o.bhk !== f.bhk) return false;
    if (f.listingType !== undefined && o.listingType !== f.listingType) return false;
    if (f.furnishing !== undefined && o.furnishing !== f.furnishing) return false;
  }
  return true;
}
