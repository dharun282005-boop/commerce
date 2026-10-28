import { LOCALITIES } from '../localities.ts';
import type { PropertyOffer } from '../schemas.ts';
import { looksLikeInjection, looksLikeScamText } from '../safety.ts';

export const DEDUPE_RADIUS_M = 50;
export const DEDUPE_TOLERANCE = 0.05;
export const STALE_DAYS = 45;
export const SCAM_MEDIAN_RATIO = 0.6;
export const MIN_MEDIAN_SAMPLE = 5;

/** Great-circle distance in metres. */
export function haversineM(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6_371_000;
  const rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

const within = (x: number, y: number, tol: number) => Math.abs(x - y) / Math.max(x, y) <= tol;

/** docs/07 §6: same BHK and type, ≤ 50 m apart, area and price within 5%. */
export function sameProperty(a: PropertyOffer, b: PropertyOffer): { same: boolean; reason: string } {
  if (a.bhk !== b.bhk || a.listingType !== b.listingType)
    return { same: false, reason: 'BHK or listing type differ' };
  const d = haversineM(a.geo, b.geo);
  if (d > DEDUPE_RADIUS_M) return { same: false, reason: `${Math.round(d)} m apart` };
  if (!within(a.areaSqft, b.areaSqft, DEDUPE_TOLERANCE))
    return { same: false, reason: 'area differs by more than 5%' };
  if (!within(a.pricePaise, b.pricePaise, DEDUPE_TOLERANCE))
    return { same: false, reason: 'price differs by more than 5%' };
  return { same: true, reason: `${Math.round(d)} m apart, area and price within 5%` };
}

/** Groups duplicate listings across portals. Returns groups of offer ids (first = representative). */
export function dedupeProperties(offers: PropertyOffer[]): { ids: string[]; reason: string | null }[] {
  const parent = offers.map((_, i) => i);
  const find = (i: number): number => (parent[i] === i ? i : (parent[i] = find(parent[i]!)));
  const reason = new Map<number, string>();
  for (let i = 0; i < offers.length; i++) {
    for (let j = i + 1; j < offers.length; j++) {
      const r = sameProperty(offers[i]!, offers[j]!);
      if (r.same) {
        parent[find(i)] = find(j);
        reason.set(find(j), r.reason);
      }
    }
  }
  const groups = new Map<number, number[]>();
  offers.forEach((_, i) => groups.set(find(i), [...(groups.get(find(i)) ?? []), i]));
  return [...groups.entries()].map(([root, members]) => ({
    ids: members.map((i) => offers[i]!.id),
    reason: members.length > 1 ? (reason.get(root) ?? null) : null,
  }));
}

export const median = (xs: number[]): number | null => {
  if (xs.length === 0) return null;
  const s = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid]! : (s[mid - 1]! + s[mid]!) / 2;
};

export type PropertyFlag =
  'stale' | 'below_market' | 'no_photos' | 'asks_for_payment_or_id' | 'suspicious_text';

export interface PropertyInsight {
  pricePerSqftPaise: number;
  /** Median of the comparison set used, with what it was (locality, or the zone when too few). */
  medianPerSqftPaise: number | null;
  medianBasis: string | null;
  ratioToMedian: number | null;
  ageDays: number;
  flags: PropertyFlag[];
}

/**
 * Price per sqft against the locality median (falls back to the zone when a locality has fewer than
 * 5 listings of the same type), staleness and scam signals.
 */
export function propertyInsights(offers: PropertyOffer[], now: Date): Map<string, PropertyInsight> {
  const zoneOf = new Map(LOCALITIES.map((l) => [l.id, l.zone]));
  const ppsf = (o: PropertyOffer) => o.pricePaise / o.areaSqft;
  const out = new Map<string, PropertyInsight>();
  for (const o of offers) {
    const sameType = offers.filter((x) => x.listingType === o.listingType);
    let pool = sameType.filter((x) => x.localityId === o.localityId);
    let basis = `${o.localityId} (${pool.length} listings)`;
    if (pool.length < MIN_MEDIAN_SAMPLE) {
      pool = sameType.filter((x) => zoneOf.get(x.localityId) === zoneOf.get(o.localityId));
      basis = `${zoneOf.get(o.localityId)} zone (${pool.length} listings)`;
    }
    const med = pool.length >= MIN_MEDIAN_SAMPLE ? median(pool.map(ppsf)) : null;
    const ratio = med ? ppsf(o) / med : null;
    const ageDays = Math.floor((now.getTime() - Date.parse(o.postedAt)) / 86_400_000);
    const flags: PropertyFlag[] = [];
    if (ageDays > STALE_DAYS) flags.push('stale');
    if (ratio !== null && ratio < SCAM_MEDIAN_RATIO) flags.push('below_market');
    if (o.photoCount === 0) flags.push('no_photos');
    if (looksLikeScamText(o.description)) flags.push('asks_for_payment_or_id');
    if (looksLikeInjection(o.description) || looksLikeInjection(o.title)) flags.push('suspicious_text');
    out.set(o.id, {
      pricePerSqftPaise: Math.round(ppsf(o)),
      medianPerSqftPaise: med === null ? null : Math.round(med),
      medianBasis: med === null ? null : basis,
      ratioToMedian: ratio === null ? null : Math.round(ratio * 100) / 100,
      ageDays,
      flags,
    });
  }
  return out;
}
