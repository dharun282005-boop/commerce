import type { Offer } from '@cuc/core';
import { sql } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { offers, priceObservations } from './schema.ts';

/** Records what we saw: latest snapshot in `offers`, plus an append-only row per observation. */
export class ObservationStore {
  constructor(private db: NodePgDatabase<Record<string, unknown>>) {}

  async record(list: Offer[]): Promise<number> {
    if (list.length === 0) return 0;
    await this.db
      .insert(offers)
      .values(
        list.map((o) => ({
          id: o.id,
          sourceId: o.provenance.sourceId,
          vertical: o.vertical,
          title: o.title,
          url: o.url,
          pricePaise: o.pricePaise,
          data: o,
          observedAt: new Date(o.provenance.observedAt),
          isSample: o.provenance.isSample,
        })),
      )
      .onConflictDoUpdate({
        target: offers.id,
        set: {
          title: sql`excluded.title`,
          url: sql`excluded.url`,
          pricePaise: sql`excluded.price_paise`,
          data: sql`excluded.data`,
          observedAt: sql`excluded.observed_at`,
        },
      });
    await this.db.insert(priceObservations).values(
      list.map((o) => ({
        offerId: o.id,
        sourceId: o.provenance.sourceId,
        vertical: o.vertical,
        pricePaise: o.pricePaise,
        fees: o.fees,
        observedAt: new Date(o.provenance.observedAt),
        isSample: o.provenance.isSample,
      })),
    );
    return list.length;
  }
}
