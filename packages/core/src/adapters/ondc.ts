import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { LOCALITIES } from '../localities.ts';
import { rupeesToPaise } from '../money.ts';
import type { SearchQuery } from '../schemas.ts';
import { matchesAll, queryTokens } from '../text.ts';
import {
  SourceError,
  type Compliance,
  type RawOffer,
  type SearchContext,
  type SourceAdapter,
} from './types.ts';

/**
 * Tier 2: ONDC buyer-side search over the Beckn protocol, retail grocery domain (ONDC:RET10).
 *
 * Real ONDC is ASYNCHRONOUS and SIGNED: the buyer app sends a signed `search` to a gateway and
 * sellers call back the buyer app's `/on_search` endpoint. That needs registry onboarding (docs/06).
 * This client implements the request/response shapes against a MOCK gateway that answers
 * `on_search` synchronously. Field names follow the ONDC retail v1.2 contract [VERIFY in Phase D review].
 * Only `search` is implemented: never `select`, `init` or `confirm` (rule 2: no purchases).
 */
export const OnSearchResponse = z.object({
  context: z
    .object({ action: z.literal('on_search'), transaction_id: z.string(), timestamp: z.string() })
    .loose(),
  message: z.object({
    catalog: z.object({
      'bpp/descriptor': z.object({ name: z.string() }).loose(),
      'bpp/providers': z.array(
        z
          .object({
            id: z.string(),
            descriptor: z.object({ name: z.string() }).loose(),
            locations: z.array(
              z
                .object({
                  id: z.string(),
                  gps: z.string(),
                  address: z.object({ area_code: z.string() }).loose(),
                })
                .loose(),
            ),
            items: z.array(
              z
                .object({
                  id: z.string(),
                  descriptor: z.object({ name: z.string() }).loose(),
                  price: z
                    .object({
                      currency: z.literal('INR'),
                      value: z.string(),
                      maximum_value: z.string().optional(),
                    })
                    .loose(),
                  quantity: z
                    .object({
                      unitized: z.object({ measure: z.object({ unit: z.string(), value: z.string() }) }),
                    })
                    .loose(),
                  category_id: z.string(),
                  '@ondc/org/time_to_ship': z.string().optional(),
                })
                .loose(),
            ),
          })
          .loose(),
      ),
    }),
  }),
});
export type OnSearchResponse = z.infer<typeof OnSearchResponse>;

const UNIT: Record<string, { unit: 'g' | 'ml' | 'pc'; factor: number }> = {
  gram: { unit: 'g', factor: 1 },
  kilogram: { unit: 'g', factor: 1000 },
  millilitre: { unit: 'ml', factor: 1 },
  litre: { unit: 'ml', factor: 1000 },
  unit: { unit: 'pc', factor: 1 },
  dozen: { unit: 'pc', factor: 12 },
};

/** ISO-8601 duration like "PT45M" or "PT1H" → minutes. */
export function isoDurationMinutes(d: string | undefined): number | null {
  const m = d?.match(/^PT(?:(\d+)H)?(?:(\d+)M)?$/);
  if (!m) return null;
  return Number(m[1] ?? 0) * 60 + Number(m[2] ?? 0);
}

export class OndcAdapter implements SourceAdapter {
  readonly id = 'ondc-mock';
  readonly name = 'ONDC network (mock gateway)';
  readonly capabilities = {
    verticals: ['grocery'] as SourceAdapter['capabilities']['verticals'],
    supportsGetOffer: false,
    requiresCredentials: true,
  };
  readonly compliance: Compliance = {
    tier: 2,
    termsUrl: 'https://ondc.org',
    robotsAllowed: null,
    lastReviewed: '2026-10-29',
    enabledByDefault: false,
    notes:
      'Beckn search against a MOCK gateway. Real ONDC needs network-participant onboarding (legal entity, keys, registry). Enable with ENABLED_SOURCES=ondc-mock.',
  };

  constructor(
    private gatewayUrl: string | null,
    private bapId = 'chennai-commerce.local',
    private fetchImpl: typeof fetch = fetch,
  ) {}

  buildSearchRequest(query: SearchQuery, now: Date) {
    const loc = LOCALITIES.find((l) => l.pincode === query.pincodes[0]);
    return {
      context: {
        domain: 'ONDC:RET10',
        action: 'search',
        country: 'IND',
        city: 'std:044', // Chennai STD code
        core_version: '1.2.0',
        bap_id: this.bapId,
        bap_uri: `https://${this.bapId}/ondc`,
        transaction_id: randomUUID(),
        message_id: randomUUID(),
        timestamp: now.toISOString(),
        ttl: 'PT30S',
      },
      message: {
        intent: {
          item: { descriptor: { name: query.q } },
          fulfillment: {
            type: 'Delivery',
            end: {
              location: {
                gps: loc ? `${loc.lat},${loc.lng}` : undefined,
                address: { area_code: query.pincodes[0] },
              },
            },
          },
        },
      },
    };
  }

  async search(query: SearchQuery, ctx: SearchContext): Promise<RawOffer[]> {
    if (!this.gatewayUrl) throw new SourceError('disabled', 'ONDC gateway URL not configured');
    const res = await this.fetchImpl(`${this.gatewayUrl.replace(/\/$/, '')}/search`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(this.buildSearchRequest(query, ctx.now())),
      signal: ctx.signal,
    });
    if (!res.ok) throw new SourceError('upstream_error', `gateway answered ${res.status}`, res.status >= 500);
    const parsed = OnSearchResponse.safeParse(await res.json());
    if (!parsed.success)
      throw new SourceError('invalid_data', 'on_search response did not match the expected schema');
    const tokens = queryTokens(query.q);
    const out: RawOffer[] = [];
    for (const p of parsed.data.message.catalog['bpp/providers']) {
      const pins = [...new Set(p.locations.map((l) => l.address.area_code))];
      if (!pins.some((x) => query.pincodes.includes(x))) continue;
      for (const item of p.items) {
        if (!matchesAll(tokens, `${item.descriptor.name} ${item.category_id}`)) continue;
        out.push({
          externalId: `${p.id}.${item.id}`,
          payload: {
            provider: { id: p.id, name: p.descriptor.name, pincodes: pins },
            item,
            observedAt: parsed.data.context.timestamp,
          },
        });
      }
    }
    return out;
  }

  async getOffer(): Promise<RawOffer | null> {
    return null;
  }

  normalise(raw: RawOffer): unknown {
    const { provider, item, observedAt } = raw.payload as {
      provider: { id: string; name: string; pincodes: string[] };
      item: OnSearchResponse['message']['catalog']['bpp/providers'][number]['items'][number];
      observedAt: string;
    };
    const m = item.quantity.unitized.measure;
    const u = UNIT[m.unit.toLowerCase()];
    const price = rupeesToPaise(Number(item.price.value));
    return {
      id: `${this.id}:${raw.externalId}`,
      vertical: 'grocery',
      title: `${item.descriptor.name} · ${provider.name}`,
      url: 'https://ondc.org',
      pricePaise: price,
      mrpPaise: item.price.maximum_value ? rupeesToPaise(Number(item.price.maximum_value)) : null,
      // Delivery charges arrive later in ONDC (on_select quote), so they are unknown at search time.
      fees: {
        deliveryPaise: null,
        handlingPaise: null,
        platformPaise: null,
        packagingPaise: null,
        taxesNotIncludedPaise: 0,
      },
      coupons: [],
      rating: null,
      etaMinutes: isoDurationMinutes(item['@ondc/org/time_to_ship']),
      trust: { fulfilledByPlatform: null, returnPolicyDays: null, sellerRating: null },
      affiliate: false,
      provenance: {
        sourceId: this.id,
        sourceName: `${provider.name} via ONDC (mock)`,
        tier: 2,
        observedAt,
        confidence: 0.8,
        isSample: true,
      },
      brand: null,
      product: item.descriptor.name,
      category: item.category_id.toLowerCase(),
      quantity: u
        ? { value: Number(m.value) * u.factor, unit: u.unit }
        : { value: Number(m.value), unit: 'pc' },
      packCount: 1,
      deliversTo: provider.pincodes,
      order: { minOrderPaise: null, freeDeliveryAbovePaise: null },
    };
  }

  async health() {
    if (!this.gatewayUrl) return { ok: false, detail: 'not configured (ONDC_GATEWAY_URL)' };
    try {
      const r = await this.fetchImpl(`${this.gatewayUrl.replace(/\/$/, '')}/health`);
      return { ok: r.ok, detail: `mock gateway ${r.status}` };
    } catch (e) {
      return { ok: false, detail: e instanceof Error ? e.message : String(e) };
    }
  }
}

/** A tiny mock ONDC gateway catalogue: FICTIONAL sellers with made-up prices. */
export function mockOnSearch(
  request: { context?: { transaction_id?: string } },
  now: Date,
): OnSearchResponse {
  const item = (
    id: string,
    name: string,
    price: string,
    mrp: string,
    unit: string,
    value: string,
    cat: string,
  ) => ({
    id,
    descriptor: { name },
    price: { currency: 'INR' as const, value: price, maximum_value: mrp },
    quantity: { unitized: { measure: { unit, value } } },
    category_id: cat,
    '@ondc/org/time_to_ship': 'PT45M',
  });
  const loc = (id: string, localityId: string) => {
    const l = LOCALITIES.find((x) => x.id === localityId)!;
    return { id, gps: `${l.lat},${l.lng}`, address: { area_code: l.pincode } };
  };
  return {
    context: {
      action: 'on_search',
      transaction_id: request.context?.transaction_id ?? 'mock',
      timestamp: now.toISOString(),
    },
    message: {
      catalog: {
        'bpp/descriptor': { name: 'Mock ONDC seller network' },
        'bpp/providers': [
          {
            id: 'mylapore-kirana',
            descriptor: { name: 'Mylapore Kirana Store' },
            locations: [loc('l1', 'mylapore'), loc('l2', 't-nagar'), loc('l3', 'adyar')],
            items: [
              item('rice-1kg', 'Sona Masoori Raw Rice', '69.00', '90.00', 'kilogram', '1', 'Foodgrains'),
              item('milk-500', 'Aavin Toned Milk', '24.00', '24.00', 'millilitre', '500', 'Dairy'),
              item('eggs-12', 'Farm Fresh White Eggs', '80.00', '105.00', 'unit', '12', 'Eggs'),
            ],
          },
          {
            id: 'omr-fresh',
            descriptor: { name: 'OMR Fresh Mart' },
            locations: [loc('l1', 'sholinganallur'), loc('l2', 'perungudi'), loc('l3', 'velachery')],
            items: [
              item('rice-5kg', 'Sona Masoori Raw Rice', '330.00', '420.00', 'kilogram', '5', 'Foodgrains'),
              item('onion-1kg', 'Onion', '34.00', '40.00', 'kilogram', '1', 'Vegetables'),
            ],
          },
        ],
      },
    },
  };
}
