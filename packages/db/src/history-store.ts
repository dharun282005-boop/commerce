import type { HistoryStore, PricePoint } from '@cuc/core';
import type pg from 'pg';

/** Reads the append-only price_observations table. */
export class PgHistoryStore implements HistoryStore {
  constructor(private pool: pg.Pool) {}

  async getHistory(offerId: string, sinceDays: number, now: Date): Promise<PricePoint[]> {
    const since = new Date(now.getTime() - sinceDays * 86_400_000);
    const { rows } = await this.pool.query(
      `select observed_at, price_paise, source_id, is_sample
         from price_observations
        where offer_id = $1 and observed_at >= $2
        order by observed_at`,
      [offerId, since],
    );
    return rows.map((r) => ({
      observedAt: new Date(r.observed_at).toISOString(),
      pricePaise: Number(r.price_paise),
      sourceId: r.source_id,
      isSample: r.is_sample,
    }));
  }
}
