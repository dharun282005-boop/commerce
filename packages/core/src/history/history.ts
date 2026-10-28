import { median } from '../property/property.ts';

export interface PricePoint {
  observedAt: string;
  pricePaise: number;
  sourceId: string;
  isSample: boolean;
}

export interface HistoryStore {
  getHistory(offerId: string, sinceDays: number, now: Date): Promise<PricePoint[]>;
}

export interface MrpCheck {
  claimedDiscountPct: number;
  /** Discount against the median of observed prices over the window. */
  observedMedianPaise: number | null;
  realDiscountPct: number | null;
  inflated: boolean;
  explanation: string;
}

/**
 * Fake-discount check (brief §6). A "discount" off MRP means little if the item has sold near the
 * current price all along. Flags when the claimed discount is ≥ 30% but the price is within 10% of
 * the observed median (needs ≥ 5 observations).
 */
export function mrpCheck(
  mrpPaise: number | null,
  pricePaise: number,
  history: PricePoint[],
): MrpCheck | null {
  if (mrpPaise === null || mrpPaise <= pricePaise) return null;
  const claimed = Math.round(((mrpPaise - pricePaise) / mrpPaise) * 100);
  const med = history.length >= 5 ? median(history.map((h) => h.pricePaise)) : null;
  const real = med === null ? null : Math.round(((med - pricePaise) / med) * 100);
  const inflated = med !== null && claimed >= 30 && Math.abs(real!) <= 10;
  return {
    claimedDiscountPct: claimed,
    observedMedianPaise: med === null ? null : Math.round(med),
    realDiscountPct: real,
    inflated,
    explanation:
      med === null
        ? `Claims ${claimed}% off MRP; not enough price history to check.`
        : inflated
          ? `Claims ${claimed}% off MRP, but it has usually sold around this price (${real}% below its usual price). The MRP looks inflated.`
          : `Claims ${claimed}% off MRP; ${real}% below its usual observed price.`,
  };
}

/** Deterministic sample history for fixture offers: one point a day, ±6% around the current price. */
export function sampleHistory(
  offerId: string,
  sourceId: string,
  pricePaise: number,
  days: number,
  now: Date,
): PricePoint[] {
  let seed = [...offerId].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);
  const rand = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 2 ** 32;
  };
  const out: PricePoint[] = [];
  for (let d = days; d >= 1; d--) {
    const wiggle = 1 + (rand() - 0.5) * 0.12;
    out.push({
      observedAt: new Date(now.getTime() - d * 86_400_000).toISOString(),
      pricePaise: Math.round((pricePaise * wiggle) / 100) * 100,
      sourceId,
      isSample: true,
    });
  }
  return out;
}

/** In-memory history (used when no database is configured). */
export class MemoryHistoryStore implements HistoryStore {
  private points = new Map<string, PricePoint[]>();
  add(offerId: string, p: PricePoint) {
    this.points.set(offerId, [...(this.points.get(offerId) ?? []), p]);
  }
  async getHistory(offerId: string, sinceDays: number, now: Date): Promise<PricePoint[]> {
    const since = now.getTime() - sinceDays * 86_400_000;
    return (this.points.get(offerId) ?? []).filter((p) => Date.parse(p.observedAt) >= since);
  }
}
