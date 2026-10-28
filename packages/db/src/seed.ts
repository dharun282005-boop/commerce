import {
  ALL_CHENNAI_PINCODES,
  createFixtureAdapters,
  LOCALITIES,
  Offer,
  sampleHistory,
  type SearchContext,
} from '@cuc/core';
import { sql } from 'drizzle-orm';
import { createDb } from './client.ts';
import { ObservationStore } from './observations.ts';
import { localities, priceObservations, sources } from './schema.ts';

/** Loads localities, the source registry and one snapshot of every fixture offer. Safe to re-run. */
export async function seed(url: string) {
  const { pool, db } = createDb(url);
  try {
    await db
      .insert(localities)
      .values(LOCALITIES.map((l) => ({ ...l, aliases: [...l.aliases] })))
      .onConflictDoUpdate({
        target: localities.id,
        set: {
          name: sql`excluded.name`,
          nameTa: sql`excluded.name_ta`,
          pincode: sql`excluded.pincode`,
          lat: sql`excluded.lat`,
          lng: sql`excluded.lng`,
          zone: sql`excluded.zone`,
          aliases: sql`excluded.aliases`,
        },
      });

    const adapters = createFixtureAdapters();
    await db
      .insert(sources)
      .values(
        adapters.map((a) => ({
          id: a.id,
          name: a.name,
          verticals: a.capabilities.verticals,
          tier: a.compliance.tier === 'fixture' ? 0 : a.compliance.tier,
          enabledByDefault: a.compliance.enabledByDefault,
          termsUrl: a.compliance.termsUrl,
          robotsAllowed: a.compliance.robotsAllowed,
          lastReviewed: a.compliance.lastReviewed,
          isSample: true,
          notes: a.compliance.notes,
        })),
      )
      .onConflictDoUpdate({
        target: sources.id,
        set: { name: sql`excluded.name`, notes: sql`excluded.notes` },
      });

    // A query with no meaningful words matches every record a fixture source has.
    const ctx: SearchContext = { requestId: 'seed', now: () => new Date() };
    const store = new ObservationStore(db);
    let count = 0;
    let historyRows = 0;
    // 90 days of SAMPLE price history per fixture offer (is_sample = true), once per offer.
    const seedHistory = async (offers: Offer[]) => {
      const { rows } = await pool.query(
        "select distinct offer_id from price_observations where observed_at < now() - interval '2 days'",
      );
      const done = new Set(rows.map((r) => r.offer_id as string));
      const values = offers
        .filter((o) => !done.has(o.id))
        .flatMap((o) =>
          sampleHistory(o.id, o.provenance.sourceId, o.pricePaise, 90, new Date()).map((p) => ({
            offerId: o.id,
            sourceId: p.sourceId,
            vertical: o.vertical,
            pricePaise: p.pricePaise,
            fees: o.fees,
            observedAt: new Date(p.observedAt),
            isSample: true,
          })),
        );
      for (let i = 0; i < values.length; i += 1000)
        await db.insert(priceObservations).values(values.slice(i, i + 1000));
      return values.length;
    };
    for (const a of adapters) {
      for (const vertical of a.capabilities.verticals) {
        const raws = await a.search(
          {
            vertical,
            q: '*',
            pincodes: ALL_CHENNAI_PINCODES,
            localityIds: LOCALITIES.map((l) => l.id),
            filters: {},
          },
          ctx,
        );
        const offers = raws.map((r) => Offer.parse(a.normalise(r, ctx)));
        count += await store.record(offers);
        historyRows += await seedHistory(offers);
      }
    }
    return { localities: LOCALITIES.length, sources: adapters.length, offers: count, historyRows };
  } finally {
    await pool.end();
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL is not set');
  console.log('seeded', await seed(url));
}
