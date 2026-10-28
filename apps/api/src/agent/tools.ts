import {
  compareOffers,
  explainRanking,
  LOCALITIES,
  resolveArea,
  sanitizeUntrusted,
  type Offer,
  type ResultItem,
} from '@cuc/core';
import type Anthropic from '@anthropic-ai/sdk';
import { z } from 'zod';
import { UnknownLocalityError, type SearchResult, type Services } from '../services.ts';

/**
 * The agent's tools. All are READ-ONLY: search, compare, explain, history, cart planning,
 * locality lookup. There is no tool to buy, log in, send messages or fetch URLs (rules 2 and 4).
 */

const rs = (paise: number | null | undefined) =>
  paise === null || paise === undefined ? null : Math.round(paise) / 100;
/** Third-party text is wrapped so the model can see it is data, not instructions (rule 4). */
export const untrusted = (s: string) => ({ untrusted_text: sanitizeUntrusted(s) });

const Preset = z.enum(['cheapest', 'best_rated', 'fastest', 'balanced']).optional();
const Locality = z.string().trim().min(1).max(60);

export const ToolInputs = {
  search_products: z.object({
    query: z.string().min(1).max(200),
    locality: Locality,
    max_price_rs: z.number().positive().optional(),
    preset: Preset,
  }),
  search_food: z.object({
    query: z.string().min(1).max(200),
    locality: Locality,
    max_price_rs: z.number().positive().optional(),
    veg_only: z.boolean().optional(),
    min_servings: z.number().int().min(1).max(20).optional(),
    max_eta_minutes: z.number().int().min(5).max(240).optional(),
    preset: Preset,
  }),
  search_grocery: z.object({ query: z.string().min(1).max(200), locality: Locality, preset: Preset }),
  search_properties: z.object({
    locality: Locality,
    bhk: z.number().int().min(1).max(10).optional(),
    listing_type: z.enum(['rent', 'buy']).optional(),
    max_price_rs: z.number().positive().optional(),
    furnishing: z.enum(['unfurnished', 'semi-furnished', 'furnished']).optional(),
    preset: Preset,
  }),
  compare_offers: z.object({ offer_ids: z.array(z.string().min(3).max(200)).min(2).max(10), preset: Preset }),
  get_price_history: z.object({
    offer_id: z.string().min(3).max(200),
    days: z.union([z.literal(30), z.literal(90)]).optional(),
  }),
  plan_cart: z.object({ list: z.string().min(1).max(1000), locality: Locality }),
  explain_ranking: z.object({
    vertical: z.enum(['shopping', 'food', 'grocery', 'property']),
    query: z.string().min(1).max(200),
    locality: Locality,
    offer_id: z.string().min(3).max(200),
    preset: Preset,
  }),
  get_locality_info: z.object({ name_or_pincode: z.string().min(1).max(60) }),
} as const;
export type ToolName = keyof typeof ToolInputs;

const DESCRIPTIONS: Record<ToolName, string> = {
  search_products:
    'Search shopping offers (phones, electronics, fashion) across sources for a Chennai locality. Returns ranked results with landed cost, adjusted rating, delivery time, flags, source and freshness.',
  search_food:
    'Search dishes on food delivery sources that deliver to a Chennai locality. Use veg_only, min_servings, max_eta_minutes and max_price_rs (checked against the landed cost) when the user gives them.',
  search_grocery:
    'Search one grocery item across quick-commerce sources for a Chennai locality. For a whole shopping list use plan_cart instead.',
  search_properties:
    'Search rental or sale listings in a Chennai locality or corridor (e.g. "OMR"). Duplicates across portals are merged; scam and stale flags included. Never returns contact details.',
  compare_offers:
    'Rank specific offers (by offer_id from earlier results) side by side with a full score breakdown.',
  get_price_history: 'Price history (30 or 90 days) for one offer_id, with min and max.',
  plan_cart:
    'Split a grocery list (e.g. "2 kg rice, 1 L milk, 12 eggs") across platforms to minimise total cost including per-order delivery/handling fees and minimum orders.',
  explain_ranking:
    'Explain why one offer is ranked where it is in a search: each score component and its weight.',
  get_locality_info:
    'Look up a Chennai locality, corridor or pincode. Returns pincodes and coordinates, or not-found for places outside Chennai.',
};

/** JSON Schemas for the API, in a fixed order (stable for prompt caching). */
export function toolDefinitions(): Anthropic.Beta.BetaTool[] {
  const names = Object.keys(ToolInputs) as ToolName[];
  return names.map((name, i) => {
    const schema = z.toJSONSchema(ToolInputs[name]) as Record<string, unknown>;
    delete schema.$schema;
    return {
      name,
      description: DESCRIPTIONS[name],
      input_schema: schema as Anthropic.Beta.BetaTool.InputSchema,
      eager_input_streaming: true,
      // Cache breakpoint on the last tool: the whole tool list is cached with the system prompt.
      ...(i === names.length - 1 ? { cache_control: { type: 'ephemeral' as const } } : {}),
    };
  });
}

// ---------- result shaping ----------

export interface GroundingFacts {
  offerIds: Set<string>;
  /** Every rupee amount that appeared in tool results this turn (rounded to 2 decimals). */
  amounts: Set<number>;
  offers: Map<
    string,
    {
      title: string;
      landedRs: number;
      priceRs: number;
      sourceName: string;
      observedAt: string;
      url: string;
      isSample: boolean;
      flags: string[];
    }
  >;
  sourcesUnavailable: Set<string>;
}

export const newFacts = (): GroundingFacts => ({
  offerIds: new Set(),
  amounts: new Set(),
  offers: new Map(),
  sourcesUnavailable: new Set(),
});

const addAmount = (f: GroundingFacts, paise: number | null | undefined) => {
  if (paise !== null && paise !== undefined) f.amounts.add(Math.round(paise) / 100);
};

function minutesAgo(iso: string, now: Date) {
  return Math.max(0, Math.round((now.getTime() - Date.parse(iso)) / 60000));
}

function nameOf(o: Offer): string {
  return o.vertical === 'food' ? `${o.dish} · ${o.restaurant.name}` : o.title;
}

function shapeResult(r: ResultItem, f: GroundingFacts, now: Date) {
  const o = r.offer;
  f.offerIds.add(o.id);
  addAmount(f, r.landed.totalPaise);
  addAmount(f, o.pricePaise);
  addAmount(f, o.mrpPaise);
  for (const l of r.landed.lines) addAmount(f, Math.abs(l.paise));
  if (r.landed.possibleSavingsPaise) addAmount(f, r.landed.possibleSavingsPaise);
  f.offers.set(o.id, {
    title: nameOf(o),
    landedRs: rs(r.landed.totalPaise)!,
    priceRs: rs(o.pricePaise)!,
    sourceName: o.provenance.sourceName,
    observedAt: o.provenance.observedAt,
    url: o.url,
    isSample: o.provenance.isSample,
    flags: r.flags,
  });
  const base = {
    offer_id: o.id,
    rank: r.rank,
    name: untrusted(nameOf(o)),
    source: o.provenance.sourceName,
    sample_data: o.provenance.isSample,
    checked_minutes_ago: minutesAgo(o.provenance.observedAt, now),
    confidence: o.provenance.confidence,
    price_rs: rs(o.pricePaise),
    landed_total_rs: rs(r.landed.totalPaise),
    fees_unknown: r.landed.feesUnknown,
    possible_savings_rs: r.landed.possibleSavingsPaise ? rs(r.landed.possibleSavingsPaise) : undefined,
    score: r.score,
    adjusted_rating: r.adjustedRating,
    eta_minutes: o.etaMinutes,
    flags: r.flags,
    notes: r.notes,
  };
  if (o.vertical === 'property') {
    addAmount(f, o.depositPaise);
    return {
      ...base,
      bhk: o.bhk,
      area_sqft: o.areaSqft,
      deposit_rs: rs(o.depositPaise),
      furnishing: o.furnishing,
      locality: o.localityId,
      posted_by: o.postedBy,
      price_per_sqft_rs: r.property ? rs(r.property.pricePerSqftPaise) : null,
      median_per_sqft_rs: r.property ? rs(r.property.medianPerSqftPaise) : null,
      also_listed_on: r.alsoListedOn?.map((a) => a.sourceName),
      description: untrusted(o.description),
    };
  }
  if (o.vertical === 'food') return { ...base, veg: o.isVeg, servings: o.servings };
  if (o.vertical === 'grocery') return { ...base, pack: `${o.quantity.value}${o.quantity.unit}` };
  return base;
}

function shapeSearch(res: SearchResult, f: GroundingFacts, now: Date, limit = 8) {
  for (const s of res.sources) if (s.status === 'unavailable') f.sourcesUnavailable.add(s.sourceName);
  return {
    area: res.area.label,
    sample_data: res.sampleData,
    total_results: res.results.length,
    results: res.results.slice(0, limit).map((r) => shapeResult(r, f, now)),
    sources: res.sources
      .filter((s) => s.status !== 'disabled')
      .map((s) => ({
        source: s.sourceName,
        status: s.status,
        offers: s.offerCount,
        ...(s.error ? { problem: s.error.kind } : {}),
      })),
    note: res.results.length === 0 ? 'No offers matched. Say so; do not guess prices.' : undefined,
  };
}

export interface ToolContext {
  services: Services;
  requestId: string;
  now: () => Date;
  facts: GroundingFacts;
}

/** Runs one tool call after validating its input. Errors become structured tool errors. */
export async function executeTool(
  name: string,
  input: unknown,
  ctx: ToolContext,
): Promise<{ ok: boolean; result: unknown }> {
  if (!(name in ToolInputs)) return { ok: false, result: { error: `unknown tool ${name}` } };
  const parsed = ToolInputs[name as ToolName].safeParse(input);
  if (!parsed.success)
    return {
      ok: false,
      result: { error: 'invalid input', details: z.prettifyError(parsed.error).slice(0, 400) },
    };
  const { services, requestId, now, facts } = ctx;
  const a = parsed.data as Record<string, unknown>;
  const paise = (v: unknown) => (typeof v === 'number' ? Math.round(v * 100) : undefined);
  try {
    switch (name as ToolName) {
      case 'search_products':
        return {
          ok: true,
          result: shapeSearch(
            await services.search(
              {
                vertical: 'shopping',
                q: a.query as string,
                locality: a.locality as string,
                filters: { maxPricePaise: paise(a.max_price_rs) },
                preset: a.preset as never,
              },
              requestId,
            ),
            facts,
            now(),
          ),
        };
      case 'search_food':
        return {
          ok: true,
          result: shapeSearch(
            await services.search(
              {
                vertical: 'food',
                q: a.query as string,
                locality: a.locality as string,
                filters: {
                  maxPricePaise: paise(a.max_price_rs),
                  vegOnly: a.veg_only as boolean | undefined,
                  minServings: a.min_servings as number | undefined,
                  maxEtaMinutes: a.max_eta_minutes as number | undefined,
                },
                preset: a.preset as never,
              },
              requestId,
            ),
            facts,
            now(),
          ),
        };
      case 'search_grocery':
        return {
          ok: true,
          result: shapeSearch(
            await services.search(
              {
                vertical: 'grocery',
                q: a.query as string,
                locality: a.locality as string,
                preset: a.preset as never,
              },
              requestId,
            ),
            facts,
            now(),
          ),
        };
      case 'search_properties':
        return {
          ok: true,
          result: shapeSearch(
            await services.search(
              {
                vertical: 'property',
                q: a.bhk ? `${a.bhk} bhk` : 'bhk',
                locality: a.locality as string,
                filters: {
                  bhk: a.bhk as number | undefined,
                  listingType: (a.listing_type as 'rent' | 'buy' | undefined) ?? 'rent',
                  furnishing: a.furnishing as never,
                  maxPricePaise: paise(a.max_price_rs),
                },
                preset: a.preset as never,
              },
              requestId,
            ),
            facts,
            now(),
          ),
        };
      case 'compare_offers': {
        const offers = await services.getOffers(a.offer_ids as string[], requestId);
        const verticals = new Set(offers.map((o) => o.vertical));
        if (offers.length < 2 || verticals.size > 1)
          return { ok: false, result: { error: 'need at least two known offers from the same vertical' } };
        const cmp = compareOffers(offers, { preset: a.preset as never, now: now() });
        return {
          ok: true,
          result: {
            weights: cmp.weights,
            results: cmp.results.map((r) => ({
              ...shapeResult(r, facts, now()),
              contributions: r.contributions,
            })),
          },
        };
      }
      case 'get_price_history': {
        const h = await services.history(a.offer_id as string, (a.days as number | undefined) ?? 30);
        addAmount(facts, h.minPaise);
        addAmount(facts, h.maxPaise);
        const pts = h.points;
        return {
          ok: true,
          result: {
            offer_id: h.offerId,
            days: h.days,
            points: pts.length,
            sample_data: pts.some((p) => p.isSample),
            min_rs: rs(h.minPaise),
            max_rs: rs(h.maxPaise),
            first: pts[0] ? { date: pts[0].observedAt.slice(0, 10), price_rs: rs(pts[0].pricePaise) } : null,
            last: pts.at(-1)
              ? { date: pts.at(-1)!.observedAt.slice(0, 10), price_rs: rs(pts.at(-1)!.pricePaise) }
              : null,
            note: pts.length === 0 ? 'No history recorded for this offer.' : undefined,
          },
        };
      }
      case 'plan_cart': {
        const c = await services.planCart(
          { list: a.list as string, locality: a.locality as string },
          requestId,
        );
        addAmount(facts, c.plan.totalPaise);
        if (c.plan.bestSinglePlatform) addAmount(facts, c.plan.bestSinglePlatform.totalPaise);
        if (c.plan.bestSinglePlatform)
          addAmount(facts, c.plan.bestSinglePlatform.totalPaise - c.plan.totalPaise);
        for (const o of c.plan.orders) {
          addAmount(facts, o.subtotalPaise);
          addAmount(facts, o.feesPaise);
          addAmount(facts, o.totalPaise);
          for (const l of o.lines) {
            addAmount(facts, l.costPaise);
            facts.offerIds.add(l.offerId);
          }
        }
        return {
          ok: true,
          result: {
            area: c.area.label,
            sample_data: c.sampleData,
            feasible: c.plan.feasible,
            method: c.plan.method,
            total_rs: rs(c.plan.totalPaise),
            single_platform_best: c.plan.bestSinglePlatform
              ? {
                  source: c.plan.bestSinglePlatform.sourceId,
                  total_rs: rs(c.plan.bestSinglePlatform.totalPaise),
                }
              : null,
            orders: c.plan.orders.map((o) => ({
              source: o.sourceName,
              items: o.lines.map((l) => ({
                offer_id: l.offerId,
                name: untrusted(l.title),
                packs: l.packs,
                cost_rs: rs(l.costPaise),
              })),
              subtotal_rs: rs(o.subtotalPaise),
              fees_rs: rs(o.feesPaise),
              total_rs: rs(o.totalPaise),
            })),
            not_found: c.plan.unavailable.map((id) => c.needs.find((n) => n.id === id)?.text),
          },
        };
      }
      case 'explain_ranking': {
        const res = await services.search(
          {
            vertical: a.vertical as never,
            q: a.query as string,
            locality: a.locality as string,
            preset: a.preset as never,
          },
          requestId,
        );
        const item = res.results.find((r) => r.offer.id === a.offer_id);
        if (!item) return { ok: false, result: { error: 'offer not in these results' } };
        shapeResult(item, facts, now());
        return {
          ok: true,
          result: {
            offer_id: item.offer.id,
            rank: item.rank,
            of: res.results.length,
            explanation: explainRanking(item, res.weights),
          },
        };
      }
      case 'get_locality_info': {
        const area = resolveArea(a.name_or_pincode as string);
        if (!area)
          return {
            ok: true,
            result: {
              found: false,
              message: 'Not a Chennai locality in our list. This service covers Chennai only.',
              examples: LOCALITIES.slice(0, 8).map((l) => l.name),
            },
          };
        return {
          ok: true,
          result: {
            found: true,
            label: area.label,
            localities: area.localities.map((l) => ({ name: l.name, pincode: l.pincode, zone: l.zone })),
          },
        };
      }
    }
  } catch (err) {
    if (err instanceof UnknownLocalityError) return { ok: false, result: { error: err.message } };
    return { ok: false, result: { error: 'tool failed' } };
  }
}
