import type { Offer, SearchQuery } from '../schemas.ts';
import { matchesAll, queryTokens } from '../text.ts';

/** Text used to match a canonical offer against a query. */
export function searchTextOf(o: Offer): string {
  switch (o.vertical) {
    case 'shopping':
      return `${o.title} ${o.brand} ${o.model} ${o.category}`;
    case 'grocery':
      return `${o.title} ${o.brand ?? ''} ${o.product} ${o.category}`;
    case 'food':
      return `${o.title} ${o.dish} ${o.dietaryTags.join(' ')} ${o.restaurant.name} ${o.isVeg ? 'veg vegetarian' : 'nonveg'}`;
    case 'property':
      return `${o.bhk} bhk ${o.title} ${o.furnishing} ${o.amenities.join(' ')}`;
  }
}

/** Same matching rules every adapter uses: vertical, text tokens, and area. */
export function offerMatchesQuery(o: Offer, q: SearchQuery): boolean {
  if (o.vertical !== q.vertical) return false;
  if (!matchesAll(queryTokens(q.q), searchTextOf(o))) return false;
  if (o.vertical === 'property') return q.localityIds.includes(o.localityId);
  const delivers = o.vertical === 'shopping' ? o.deliversTo : o.deliversTo;
  return delivers === null || delivers.length === 0 || delivers.some((p) => q.pincodes.includes(p));
}
