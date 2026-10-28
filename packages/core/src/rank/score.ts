import type { Offer, Vertical } from '../schemas.ts';
import { looksLikeInjection } from '../safety.ts';
import { median } from '../property/property.ts';
import { landedCost, type LandedCost } from './landed.ts';
import { bayesianRating, DEFAULT_PRIOR, type RatingPrior } from './rating.ts';

export interface Weights {
  cost: number;
  rating: number;
  speed: number;
  trust: number;
}
export type PresetName = 'cheapest' | 'best_rated' | 'fastest' | 'balanced';

export const PRESETS: Record<PresetName, Weights> = {
  cheapest: { cost: 0.7, rating: 0.1, speed: 0.1, trust: 0.1 },
  best_rated: { cost: 0.15, rating: 0.6, speed: 0.05, trust: 0.2 },
  fastest: { cost: 0.15, rating: 0.1, speed: 0.65, trust: 0.1 },
  balanced: { cost: 0.4, rating: 0.25, speed: 0.2, trust: 0.15 },
};

export const ANOMALY_RATIO = 0.6;
export const ANOMALY_MIN_GROUP = 3;

type Component = keyof Weights;
export type OfferFlag =
  | 'price_anomaly'
  | 'suspicious_text'
  | 'fees_unknown'
  | 'stale'
  | 'below_market'
  | 'no_photos'
  | 'asks_for_payment_or_id';

/** Flags that push an offer below unflagged ones (it stays visible, with a warning). */
export const DEMOTING_FLAGS: OfferFlag[] = [
  'price_anomaly',
  'suspicious_text',
  'below_market',
  'asks_for_payment_or_id',
];

export interface RankedOffer {
  offer: Offer;
  rank: number;
  score: number;
  landed: LandedCost;
  adjustedRating: number | null;
  /** Each component scaled to 0..1 within the comparable set (null = missing; counted as 0). */
  components: Record<Component, number | null>;
  /** w·s / Σw for each component. These add up to `score` exactly. */
  contributions: Record<Component, number>;
  groupId: string | null;
  flags: OfferFlag[];
  notes: string[];
}

export interface RankOptions {
  weights?: Weights;
  prior?: Partial<Record<Vertical, RatingPrior>>;
  /** Offers in the same group are the same item; anomaly checks use the group's median. */
  groupOf?: (offerId: string) => string | null;
}

/** Trust signals that exist for this offer, each 0..1. Mean of available ones, or null. */
function trustOf(o: Offer): number | null {
  const s: number[] = [];
  if (o.trust.fulfilledByPlatform !== null) s.push(o.trust.fulfilledByPlatform ? 1 : 0);
  if (o.trust.returnPolicyDays !== null) s.push(o.trust.returnPolicyDays >= 7 ? 1 : 0);
  if (o.trust.sellerRating !== null) s.push(o.trust.sellerRating / 5);
  if (o.vertical === 'property') {
    s.push(o.photoCount > 0 ? 1 : 0);
    s.push(o.postedBy === 'owner' ? 1 : 0.5); // no brokerage fee
  }
  return s.length ? s.reduce((a, b) => a + b, 0) / s.length : null;
}

function ratingOf(o: Offer): { average: number; count: number } | null {
  if (o.vertical === 'food') return o.restaurant.rating ?? o.rating;
  return o.rating;
}

/**
 * Transparent best-value score (docs/07 §3). `affiliate` is deliberately never read here,
 * so it cannot change the order (FR-RNK-05).
 *
 * Offers flagged as a price anomaly or carrying suspicious text keep their score (so the
 * breakdown stays honest) but are listed after unflagged offers.
 */
export function rankOffers(offers: Offer[], opts: RankOptions = {}): RankedOffer[] {
  const w = opts.weights ?? PRESETS.balanced;
  const wSum = w.cost + w.rating + w.speed + w.trust;
  if (!(wSum > 0)) throw new RangeError('weights must add up to more than 0');

  const base = offers.map((o) => {
    const landed = landedCost(o);
    const r = ratingOf(o);
    const prior = opts.prior?.[o.vertical] ?? DEFAULT_PRIOR;
    return {
      o,
      landed,
      raw: {
        cost: landed.totalPaise,
        rating: r ? bayesianRating(r.average, r.count, prior) : null,
        speed: o.etaMinutes,
        trust: trustOf(o),
      } as Record<Component, number | null>,
    };
  });

  const scale = (key: Component, higherIsBetter: boolean) => {
    const vals = base.map((b) => b.raw[key]).filter((v): v is number => v !== null);
    const min = Math.min(...vals);
    const max = Math.max(...vals);
    return (v: number | null): number | null => {
      if (v === null) return null;
      if (key === 'trust') return v; // already 0..1
      if (max === min) return 1;
      return higherIsBetter ? (v - min) / (max - min) : (max - v) / (max - min);
    };
  };
  const scalers: Record<Component, (v: number | null) => number | null> = {
    cost: scale('cost', false),
    rating: scale('rating', true),
    speed: scale('speed', false),
    trust: scale('trust', true),
  };

  // Group medians for the anomaly check.
  const groupOf = opts.groupOf ?? (() => null);
  const byGroup = new Map<string, number[]>();
  for (const b of base) {
    const g = groupOf(b.o.id);
    if (g) byGroup.set(g, [...(byGroup.get(g) ?? []), b.landed.totalPaise]);
  }

  const ranked: RankedOffer[] = base.map((b) => {
    const components = {} as Record<Component, number | null>;
    const contributions = {} as Record<Component, number>;
    const notes: string[] = [];
    for (const k of ['cost', 'rating', 'speed', 'trust'] as Component[]) {
      const s = scalers[k](b.raw[k]);
      components[k] = s === null ? null : round4(s);
      const c = ((s ?? 0) * w[k]) / wSum;
      contributions[k] = round4(c);
      if (
        s === null &&
        w[k] > 0 &&
        !(k === 'speed' && b.o.vertical === 'property') &&
        !(k === 'rating' && b.o.vertical === 'property')
      ) {
        notes.push(`no ${k === 'speed' ? 'delivery time' : k} data from source (counted as 0)`);
      }
    }
    const flags: OfferFlag[] = [];
    const g = groupOf(b.o.id);
    const groupPrices = g ? (byGroup.get(g) ?? []) : [];
    if (groupPrices.length >= ANOMALY_MIN_GROUP) {
      const med = median(groupPrices)!;
      if (b.landed.totalPaise < ANOMALY_RATIO * med) {
        flags.push('price_anomaly');
        notes.push(
          `price is under ${ANOMALY_RATIO * 100}% of the median for this item: possible scam or wrong variant`,
        );
      }
    }
    const text = `${b.o.title} ${b.o.vertical === 'property' ? b.o.description : ''}`;
    if (looksLikeInjection(text)) {
      flags.push('suspicious_text');
      notes.push('listing text contains instructions aimed at software; treated as data and flagged');
    }
    if (b.landed.feesUnknown) flags.push('fees_unknown');
    if (b.o.rating && b.o.rating.count < 20) {
      notes.push(`only ${b.o.rating.count} ratings: rating pulled towards the average`);
    }
    // Sum of rounded contributions, so the breakdown adds up to the score exactly.
    const exact = round4(Object.values(contributions).reduce((a, c) => a + c, 0));
    return {
      offer: b.o,
      rank: 0,
      score: exact,
      landed: b.landed,
      adjustedRating: b.raw.rating === null ? null : Math.round(b.raw.rating * 1000) / 1000,
      components,
      contributions,
      groupId: g,
      flags,
      notes,
    };
  });

  return sortRanked(ranked);
}

/** Unflagged first, then by score, then cheaper, then id (so the order is always deterministic). */
export function sortRanked<T extends RankedOffer>(ranked: T[]): T[] {
  const demoted = (r: RankedOffer) => (r.flags.some((f) => DEMOTING_FLAGS.includes(f)) ? 1 : 0);
  ranked.sort(
    (a, b) =>
      demoted(a) - demoted(b) ||
      b.score - a.score ||
      a.landed.totalPaise - b.landed.totalPaise ||
      a.offer.id.localeCompare(b.offer.id),
  );
  ranked.forEach((r, i) => (r.rank = i + 1));
  return ranked;
}

/** Plain-language "Why is this #1?" text. */
export function explainRanking(r: RankedOffer, weights: Weights): string[] {
  const names: Record<Component, string> = {
    cost: 'total cost',
    rating: 'rating',
    speed: 'delivery speed',
    trust: 'trust',
  };
  const wSum = weights.cost + weights.rating + weights.speed + weights.trust;
  const parts = (Object.keys(names) as Component[])
    .filter((k) => weights[k] > 0)
    .sort((a, b) => r.contributions[b] - r.contributions[a])
    .map(
      (k) =>
        `${names[k]}: ${r.contributions[k].toFixed(3)} (scored ${r.components[k] === null ? 'n/a' : r.components[k]!.toFixed(2)} × weight share ${(weights[k] / wSum).toFixed(2)})`,
    );
  return [`Score ${r.score.toFixed(3)} = sum of:`, ...parts, ...r.notes];
}

function round4(x: number): number {
  return Math.round(x * 10_000) / 10_000;
}
