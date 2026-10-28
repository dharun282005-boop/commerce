import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { resolveArea } from '../localities.ts';
import { rupeesToPaise } from '../money.ts';
import { Offer, type SearchQuery } from '../schemas.ts';
import { parseQuantity } from '../units.ts';
import { checkSubmittedUrl, dnsResolver, type Resolver } from '../net/url-guard.ts';
import { sanitizeUntrusted } from '../safety.ts';
import { offerMatchesQuery } from './offer-query.ts';
import type { Compliance, RawOffer, SourceAdapter } from './types.ts';

/** What a user may submit: the price they saw, in their own session, with a link to the listing. */
export const Submission = z.object({
  vertical: z.enum(['shopping', 'grocery']),
  url: z.string().max(500),
  title: z.string().trim().min(3).max(200),
  priceRs: z.number().positive().max(10_000_000),
  deliveryRs: z.number().min(0).max(10_000).optional(),
  locality: z.string().trim().min(1).max(60),
  brand: z.string().trim().max(60).optional(),
  quantity: z.string().trim().max(30).optional().describe('grocery pack size, e.g. "1 kg"'),
});
export type Submission = z.infer<typeof Submission>;

/** How long a user-reported price is shown before it is considered too old. */
export const SUBMISSION_TTL_MS = { shopping: 3 * 86_400_000, grocery: 86_400_000 } as const;

export interface StoredSubmission {
  externalId: string;
  submittedAt: string;
  platform: string;
  offer: Offer;
}

export interface SubmissionStore {
  add(s: StoredSubmission): Promise<void>;
  list(): Promise<StoredSubmission[]>;
}

export class MemorySubmissionStore implements SubmissionStore {
  private items: StoredSubmission[] = [];
  async add(s: StoredSubmission) {
    this.items.push(s);
  }
  async list() {
    return [...this.items];
  }
}

/**
 * Tier 3: prices that users saw themselves and reported. Shown with confidence 0.5 and a
 * "user-reported, unverified" label. URLs pass the SSRF guard and the platform allow-list.
 */
export class UserSubmittedAdapter implements SourceAdapter {
  readonly id = 'user-submitted';
  readonly name = 'User-reported prices';
  readonly capabilities = {
    verticals: ['shopping', 'grocery'] as SourceAdapter['capabilities']['verticals'],
    supportsGetOffer: true,
    requiresCredentials: false,
  };
  readonly compliance: Compliance = {
    tier: 3,
    termsUrl: null,
    robotsAllowed: null,
    lastReviewed: '2026-10-29',
    enabledByDefault: true,
    notes:
      'Prices users report from their own sessions. The app never fetches the submitted link. Unverified; confidence 0.5.',
  };

  constructor(
    private store: SubmissionStore = new MemorySubmissionStore(),
    private resolver: Resolver = dnsResolver,
    private now: () => Date = () => new Date(),
  ) {}

  async submit(input: unknown): Promise<{ ok: true; offer: Offer } | { ok: false; error: string }> {
    const parsed = Submission.safeParse(input);
    if (!parsed.success) return { ok: false, error: z.prettifyError(parsed.error).slice(0, 300) };
    const s = parsed.data;
    const check = await checkSubmittedUrl(s.url, this.resolver);
    if (!check.ok) return { ok: false, error: check.reason };
    const area = resolveArea(s.locality);
    if (!area) return { ok: false, error: 'locality must be in Chennai' };
    const externalId = randomUUID();
    const observedAt = this.now().toISOString();
    const title = sanitizeUntrusted(s.title, 200);
    const base = {
      id: `${this.id}:${externalId}`,
      title,
      url: check.url.toString(),
      pricePaise: rupeesToPaise(s.priceRs),
      mrpPaise: null,
      fees: {
        deliveryPaise: s.deliveryRs === undefined ? null : rupeesToPaise(s.deliveryRs),
        handlingPaise: null,
        platformPaise: null,
        packagingPaise: null,
        taxesNotIncludedPaise: null,
      },
      coupons: [],
      rating: null,
      etaMinutes: null,
      trust: { fulfilledByPlatform: null, returnPolicyDays: null, sellerRating: null },
      affiliate: false,
      provenance: {
        sourceId: this.id,
        sourceName: `User-reported (${check.platform})`,
        tier: 3,
        observedAt,
        confidence: 0.5,
        isSample: false,
      },
    };
    const raw =
      s.vertical === 'grocery'
        ? {
            ...base,
            vertical: 'grocery',
            brand: s.brand ?? null,
            product: title,
            category: 'grocery',
            quantity: parseQuantity(s.quantity ?? '') ?? { value: 1, unit: 'pc' },
            packCount: 1,
            deliversTo: area.pincodes,
            order: { minOrderPaise: null, freeDeliveryAbovePaise: null },
          }
        : {
            ...base,
            vertical: 'shopping',
            brand: s.brand ?? title.split(' ')[0]!,
            model: '',
            category: 'user-reported',
            seller: null,
            variant: { storageGb: null, ramGb: null, colour: null, size: null },
            identifiers: { gtin: null, asin: null, mpn: null, modelNumber: null },
            deliversTo: area.pincodes,
          };
    const offer = Offer.parse(raw);
    await this.store.add({ externalId, submittedAt: observedAt, platform: check.platform, offer });
    return { ok: true, offer };
  }

  private async fresh(): Promise<StoredSubmission[]> {
    const t = this.now().getTime();
    return (await this.store.list()).filter(
      (s) => t - Date.parse(s.submittedAt) <= SUBMISSION_TTL_MS[s.offer.vertical as 'shopping' | 'grocery'],
    );
  }

  async search(query: SearchQuery): Promise<RawOffer[]> {
    return (await this.fresh())
      .filter((s) => offerMatchesQuery(s.offer, query))
      .map((s) => ({ externalId: s.externalId, payload: s.offer }));
  }

  async getOffer(externalId: string): Promise<RawOffer | null> {
    const s = (await this.store.list()).find((x) => x.externalId === externalId);
    return s ? { externalId, payload: s.offer } : null;
  }

  normalise(raw: RawOffer): unknown {
    return raw.payload;
  }

  async health() {
    return { ok: true, detail: `${(await this.fresh()).length} recent user reports` };
  }
}
