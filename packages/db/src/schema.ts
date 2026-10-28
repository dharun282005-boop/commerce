import { sql } from 'drizzle-orm';
import {
  bigint,
  bigserial,
  boolean,
  date,
  doublePrecision,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
} from 'drizzle-orm/pg-core';

export const localities = pgTable('localities', {
  id: text().primaryKey(),
  name: text().notNull(),
  nameTa: text('name_ta').notNull(),
  pincode: text().notNull(),
  lat: doublePrecision().notNull(),
  lng: doublePrecision().notNull(),
  zone: text().notNull(),
  aliases: text()
    .array()
    .notNull()
    .default(sql`'{}'::text[]`),
});

export const sources = pgTable('sources', {
  id: text().primaryKey(),
  name: text().notNull(),
  verticals: text().array().notNull(),
  // 1–4, or 0 for fixture data
  tier: integer().notNull(),
  enabledByDefault: boolean('enabled_by_default').notNull(),
  termsUrl: text('terms_url'),
  robotsAllowed: boolean('robots_allowed'),
  lastReviewed: date('last_reviewed'),
  isSample: boolean('is_sample').notNull(),
  notes: text().notNull().default(''),
});

/** Latest snapshot of each offer. */
export const offers = pgTable(
  'offers',
  {
    id: text().primaryKey(),
    sourceId: text('source_id')
      .notNull()
      .references(() => sources.id),
    vertical: text().notNull(),
    title: text().notNull(),
    url: text().notNull(),
    pricePaise: bigint('price_paise', { mode: 'number' }).notNull(),
    data: jsonb().notNull(),
    observedAt: timestamp('observed_at', { withTimezone: true }).notNull(),
    isSample: boolean('is_sample').notNull(),
  },
  (t) => [
    index('offers_title_trgm').using('gin', sql`${t.title} gin_trgm_ops`),
    index('offers_vertical_idx').on(t.vertical),
  ],
);

/** Every observed price, append-only (a trigger blocks UPDATE and DELETE). */
export const priceObservations = pgTable(
  'price_observations',
  {
    id: bigserial({ mode: 'number' }).primaryKey(),
    offerId: text('offer_id').notNull(),
    sourceId: text('source_id').notNull(),
    vertical: text().notNull(),
    pricePaise: bigint('price_paise', { mode: 'number' }).notNull(),
    fees: jsonb().notNull(),
    observedAt: timestamp('observed_at', { withTimezone: true }).notNull(),
    recordedAt: timestamp('recorded_at', { withTimezone: true }).notNull().defaultNow(),
    isSample: boolean('is_sample').notNull(),
  },
  (t) => [index('price_obs_offer_time_idx').on(t.offerId, t.observedAt)],
);
