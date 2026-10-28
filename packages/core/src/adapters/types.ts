import type { Offer, SearchQuery, Tier, Vertical } from '../schemas.ts';

/** Every adapter must say how it gets its data (rule 1). */
export interface Compliance {
  tier: Tier;
  termsUrl: string | null;
  /** true = robots.txt permits our use; false = it forbids it; null = not reviewed / not applicable. */
  robotsAllowed: boolean | null;
  lastReviewed: string | null;
  enabledByDefault: boolean;
  notes: string;
}

export interface Capabilities {
  verticals: Vertical[];
  supportsGetOffer: boolean;
  requiresCredentials: boolean;
}

/** What an adapter returns before normalisation. `payload` is untrusted. */
export interface RawOffer {
  externalId: string;
  payload: unknown;
}

export interface SearchContext {
  requestId: string;
  now: () => Date;
  signal?: AbortSignal;
}

export interface AdapterHealth {
  ok: boolean;
  detail?: string;
}

export interface SourceAdapter {
  readonly id: string;
  readonly name: string;
  readonly capabilities: Capabilities;
  readonly compliance: Compliance;
  search(query: SearchQuery, ctx: SearchContext): Promise<RawOffer[]>;
  getOffer(externalId: string, ctx: SearchContext): Promise<RawOffer | null>;
  /** Turns a raw record into a canonical offer. The wrapper validates the result with Zod. */
  normalise(raw: RawOffer, ctx: SearchContext): unknown;
  health(): Promise<AdapterHealth>;
}

export type SourceErrorKind =
  'disabled' | 'rate_limited' | 'circuit_open' | 'timeout' | 'upstream_error' | 'invalid_data';

export class SourceError extends Error {
  constructor(
    readonly kind: SourceErrorKind,
    message: string,
    readonly retryable = false,
  ) {
    super(message);
    this.name = 'SourceError';
  }
}

export type SourceStatus = 'ok' | 'disabled' | 'unavailable';

export interface SourceResult {
  sourceId: string;
  sourceName: string;
  tier: Tier;
  status: SourceStatus;
  offers: Offer[];
  fromCache: boolean;
  /** When the data was fetched from the source (older than "now" when served from cache). */
  fetchedAt: string | null;
  latencyMs: number;
  /** Records the adapter returned that failed validation and were dropped. */
  droppedInvalid: number;
  error?: { kind: SourceErrorKind; message: string };
}
