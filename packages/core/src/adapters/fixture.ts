import { createHash } from 'node:crypto';
import { LOCALITIES } from '../localities.ts';
import { rupeesToPaise } from '../money.ts';
import type { SearchQuery, Vertical } from '../schemas.ts';
import { matchesAll, queryTokens } from '../text.ts';
import { parseQuantity } from '../units.ts';
import { DISHES, RESTAURANTS } from '../fixtures/food.ts';
import { GROCERY_PLATFORMS, GROCERY_PRODUCTS } from '../fixtures/grocery.ts';
import { PROPERTY_LISTINGS } from '../fixtures/property.ts';
import { SHOPPING_ITEMS } from '../fixtures/shopping.ts';
import { FIXTURE_SOURCES, type FixtureSourceDef } from '../fixtures/sources.ts';
import { SourceError, type Compliance, type RawOffer, type SearchContext, type SourceAdapter } from './types.ts';

/** A fixture record: the canonical offer minus provenance, plus text to search and where it delivers. */
interface FixtureRecord {
  externalId: string;
  vertical: Vertical;
  searchText: string;
  /** null = deliverable anywhere in Chennai. */
  pincodes: string[] | null;
  localityId?: string;
  /** Minutes before "now" that this sample price was "checked", to make freshness realistic. */
  ageMinutes: number;
  offer: Record<string, unknown>;
}

export type FixtureFailure = 'timeout' | 'error' | null;

export interface FixtureAdapterOptions {
  latencyMs?: number;
  fail?: FixtureFailure;
}

const localityById = new Map(LOCALITIES.map((l) => [l.id, l]));
const pincodesFor = (ids: string[]) => [...new Set(ids.map((id) => localityById.get(id)!.pincode))];
const allPincodes = [...new Set(LOCALITIES.map((l) => l.pincode))];
const r = rupeesToPaise;

const noFees = { deliveryPaise: null, handlingPaise: null, platformPaise: null, packagingPaise: null, taxesNotIncludedPaise: null };

/** Deterministic pseudo-age between 1 and `max` minutes, so tests are stable. */
function ageFor(id: string, max: number): number {
  const n = createHash('sha1').update(id).digest().readUInt16BE(0);
  return 1 + (n % max);
}

export class FixtureAdapter implements SourceAdapter {
  readonly id: string;
  readonly name: string;
  readonly capabilities;
  readonly compliance: Compliance;
  private records: FixtureRecord[];

  constructor(
    private def: FixtureSourceDef,
    private opts: FixtureAdapterOptions = {},
  ) {
    this.id = def.id;
    this.name = def.name;
    this.capabilities = { verticals: def.verticals, supportsGetOffer: true, requiresCredentials: false };
    this.compliance = {
      tier: 'fixture',
      termsUrl: null,
      robotsAllowed: null,
      lastReviewed: '2026-10-28',
      enabledByDefault: true,
      notes: `Made-up sample data that imitates ${def.platform}. No data is fetched from ${def.platform}.`,
    };
    this.records = buildRecords(def);
  }

  async search(query: SearchQuery, ctx: SearchContext): Promise<RawOffer[]> {
    await this.simulate(ctx);
    if (!this.capabilities.verticals.includes(query.vertical)) return [];
    const tokens = queryTokens(query.q);
    const want = new Set(query.pincodes);
    return this.records
      .filter((rec) => rec.vertical === query.vertical)
      .filter((rec) =>
        rec.vertical === 'property'
          ? query.localityIds.includes(rec.localityId!)
          : rec.pincodes === null || rec.pincodes.some((p) => want.has(p)),
      )
      .filter((rec) => matchesAll(tokens, rec.searchText))
      .map((rec) => ({ externalId: rec.externalId, payload: rec }));
  }

  async getOffer(externalId: string, ctx: SearchContext): Promise<RawOffer | null> {
    await this.simulate(ctx);
    const rec = this.records.find((x) => x.externalId === externalId);
    return rec ? { externalId, payload: rec } : null;
  }

  normalise(raw: RawOffer, ctx: SearchContext): unknown {
    const rec = raw.payload as FixtureRecord;
    const observedAt = new Date(ctx.now().getTime() - rec.ageMinutes * 60_000).toISOString();
    return {
      ...rec.offer,
      id: `${this.id}:${rec.externalId}`,
      provenance: {
        sourceId: this.id,
        sourceName: this.name,
        tier: 'fixture',
        observedAt,
        confidence: 1,
        isSample: true,
      },
    };
  }

  async health() {
    if (this.opts.fail) return { ok: false, detail: `simulated failure: ${this.opts.fail}` };
    return { ok: true, detail: `${this.records.length} sample records` };
  }

  private async simulate(ctx: SearchContext): Promise<void> {
    if (this.opts.fail === 'error') throw new SourceError('upstream_error', 'simulated upstream error', true);
    if (this.opts.fail === 'timeout') {
      // Never resolves on its own; the wrapper's timeout aborts it.
      await new Promise<void>((_, reject) => ctx.signal?.addEventListener('abort', () => reject(new Error('aborted'))));
    }
    if (this.opts.latencyMs) await new Promise((res) => setTimeout(res, this.opts.latencyMs));
  }
}

function buildRecords(def: FixtureSourceDef): FixtureRecord[] {
  const out: FixtureRecord[] = [];

  for (const item of SHOPPING_ITEMS) {
    item.listings.forEach((l, i) => {
      if (l.source !== def.id) return;
      const externalId = `${item.key}-${i}`;
      out.push({
        externalId,
        vertical: 'shopping',
        searchText: `${l.title} ${item.brand} ${item.model} ${item.category}`,
        pincodes: null,
        ageMinutes: ageFor(def.id + externalId, 25),
        offer: {
          vertical: 'shopping',
          title: l.title,
          url: def.searchUrl(l.title),
          pricePaise: r(l.price),
          mrpPaise: l.mrp === null ? null : r(l.mrp),
          fees: { ...noFees, deliveryPaise: l.delivery === null ? null : r(l.delivery), platformPaise: 0, handlingPaise: 0, packagingPaise: 0, taxesNotIncludedPaise: 0 },
          coupons: l.coupon ? [{ code: l.coupon.code, description: l.coupon.description, savingPaise: r(l.coupon.saving), verifiable: l.coupon.verifiable }] : [],
          rating: l.rating ? { average: l.rating[0], count: l.rating[1] } : null,
          etaMinutes: l.eta,
          trust: { fulfilledByPlatform: l.fulfilled, returnPolicyDays: l.returnDays, sellerRating: l.sellerRating },
          affiliate: l.affiliate ?? false,
          brand: item.brand,
          model: item.model,
          category: item.category,
          seller: l.seller,
          variant: item.variant,
          identifiers: { gtin: item.gtin, asin: l.asin ?? null, mpn: null, modelNumber: item.modelNumber },
          deliversTo: null,
        },
      });
    });
  }

  for (const d of DISHES) {
    const rest = RESTAURANTS.find((x) => x.id === d.restaurantId)!;
    d.listings.forEach((l) => {
      if (l.source !== def.id) return;
      const externalId = d.key;
      const pins = pincodesFor(rest.deliversToLocalities);
      out.push({
        externalId,
        vertical: 'food',
        searchText: `${d.dish} ${d.tags.join(' ')} ${rest.name} ${d.isVeg ? 'veg vegetarian' : 'nonveg'}`,
        pincodes: pins,
        ageMinutes: ageFor(def.id + externalId, 4),
        offer: {
          vertical: 'food',
          title: `${d.dish} · ${rest.name}`,
          url: def.searchUrl(`${rest.name} ${d.dish}`),
          pricePaise: r(l.price),
          mrpPaise: null,
          fees: {
            deliveryPaise: l.delivery === null ? null : r(l.delivery),
            handlingPaise: 0,
            platformPaise: l.platform === null ? null : r(l.platform),
            packagingPaise: l.packaging === null ? null : r(l.packaging),
            taxesNotIncludedPaise: Math.round(r(l.price) * 0.05), // 5% GST on restaurant food
          },
          coupons: l.coupon ? [{ code: l.coupon.code, description: l.coupon.description, savingPaise: r(l.coupon.saving), verifiable: l.coupon.verifiable }] : [],
          rating: l.restaurantRating ? { average: l.restaurantRating[0], count: l.restaurantRating[1] } : null,
          etaMinutes: l.eta,
          trust: { fulfilledByPlatform: null, returnPolicyDays: null, sellerRating: null },
          affiliate: false,
          restaurant: {
            id: rest.id,
            name: rest.name,
            localityId: rest.localityId,
            rating: l.restaurantRating ? { average: l.restaurantRating[0], count: l.restaurantRating[1] } : null,
          },
          dish: d.dish,
          servings: d.servings,
          isVeg: d.isVeg,
          dietaryTags: d.tags,
          deliversTo: pins,
        },
      });
    });
  }

  const rules = GROCERY_PLATFORMS.find((p) => p.source === def.id);
  if (rules) {
    const pins = pincodesFor(LOCALITIES.map((l) => l.id).filter((id) => !rules.notDeliveringTo.includes(id)));
    for (const p of GROCERY_PRODUCTS) {
      const price = p.prices[def.id];
      if (price === undefined) continue;
      const qty = parseQuantity(p.quantity);
      if (!qty) throw new Error(`fixture quantity not parseable: ${p.key}`);
      const title = `${p.brand ? p.brand + ' ' : ''}${p.product} ${p.quantity}`;
      out.push({
        externalId: p.key,
        vertical: 'grocery',
        searchText: `${title} ${p.category}`,
        pincodes: pins,
        ageMinutes: ageFor(def.id + p.key, 10),
        offer: {
          vertical: 'grocery',
          title,
          url: def.searchUrl(title),
          pricePaise: r(price),
          mrpPaise: p.mrp === null ? null : r(p.mrp),
          fees: {
            deliveryPaise: r(rules.delivery),
            handlingPaise: r(rules.handling),
            platformPaise: r(rules.platform),
            packagingPaise: 0,
            taxesNotIncludedPaise: 0,
          },
          coupons: [],
          rating: null,
          etaMinutes: rules.eta,
          trust: { fulfilledByPlatform: true, returnPolicyDays: null, sellerRating: null },
          affiliate: false,
          brand: p.brand,
          product: p.product,
          category: p.category,
          quantity: qty,
          packCount: p.packCount,
          deliversTo: pins,
          order: {
            minOrderPaise: rules.minOrder === null ? null : r(rules.minOrder),
            freeDeliveryAbovePaise: rules.freeDeliveryAbove === null ? null : r(rules.freeDeliveryAbove),
          },
        },
      });
    }
  }

  for (const p of PROPERTY_LISTINGS) {
    if (p.source !== def.id) continue;
    const loc = localityById.get(p.localityId)!;
    const lat = loc.lat + p.offsetM[0] / 111_320;
    const lng = loc.lng + p.offsetM[1] / (111_320 * Math.cos((loc.lat * Math.PI) / 180));
    out.push({
      externalId: p.key,
      vertical: 'property',
      searchText: `${p.bhk} bhk ${p.title} ${p.furnishing} ${p.amenities.join(' ')} ${loc.name}`,
      pincodes: [loc.pincode],
      localityId: loc.id,
      ageMinutes: ageFor(def.id + p.key, 180),
      offer: {
        vertical: 'property',
        title: p.title,
        url: def.searchUrl(`${p.bhk} bhk ${loc.name}`),
        pricePaise: r(p.price),
        mrpPaise: null,
        fees: noFees,
        coupons: [],
        rating: null,
        etaMinutes: null,
        trust: { fulfilledByPlatform: null, returnPolicyDays: null, sellerRating: null },
        affiliate: false,
        listingType: p.listingType,
        bhk: p.bhk,
        areaSqft: p.areaSqft,
        depositPaise: p.deposit === null ? null : r(p.deposit),
        furnishing: p.furnishing,
        floor: p.floor,
        totalFloors: p.totalFloors,
        ageYears: p.ageYears,
        localityId: loc.id,
        pincode: loc.pincode,
        geo: { lat: Math.round(lat * 1e6) / 1e6, lng: Math.round(lng * 1e6) / 1e6 },
        amenities: p.amenities,
        postedBy: p.postedBy,
        // Fixed reference date so fixtures are stable; listing age is relative to it.
        postedAt: new Date(Date.UTC(2026, 9, 28) - p.postedDaysAgo * 86_400_000).toISOString(),
        photoCount: p.photoCount,
        nearTransit: p.nearTransit,
        description: p.description,
      },
    });
  }

  return out;
}

/** Parses FIXTURE_FAIL like "fixture-zomato:timeout,fixture-croma:error". */
export function parseFixtureFailures(spec: string | undefined): Map<string, FixtureFailure> {
  const m = new Map<string, FixtureFailure>();
  for (const part of (spec ?? '').split(',').map((s) => s.trim()).filter(Boolean)) {
    const [id, kind] = part.split(':');
    if (id && (kind === 'timeout' || kind === 'error')) m.set(id, kind);
  }
  return m;
}

export function createFixtureAdapters(opts: { failures?: Map<string, FixtureFailure>; latencyMs?: number } = {}) {
  return FIXTURE_SOURCES.map(
    (def) => new FixtureAdapter(def, { fail: opts.failures?.get(def.id) ?? null, latencyMs: opts.latencyMs }),
  );
}

export { allPincodes as ALL_CHENNAI_PINCODES };
