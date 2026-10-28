/** Thin typed client for the API. */
/** Same-origin /api by default (embedded API, e.g. on Vercel); set NEXT_PUBLIC_API_URL to use a separate API. */
export const API_URL = process.env.NEXT_PUBLIC_API_URL || '/api';

export type Vertical = 'shopping' | 'food' | 'grocery' | 'property';
export type Preset = 'cheapest' | 'best_rated' | 'fastest' | 'balanced';
export interface Weights {
  cost: number;
  rating: number;
  speed: number;
  trust: number;
}

export interface Provenance {
  sourceId: string;
  sourceName: string;
  tier: number | 'fixture';
  observedAt: string;
  confidence: number;
  isSample: boolean;
}

export interface Offer {
  id: string;
  vertical: Vertical;
  title: string;
  url: string;
  pricePaise: number;
  mrpPaise: number | null;
  rating: { average: number; count: number } | null;
  etaMinutes: number | null;
  affiliate: boolean;
  provenance: Provenance;
  // vertical-specific (optional here)
  brand?: string | null;
  dish?: string;
  restaurant?: { name: string };
  servings?: number;
  isVeg?: boolean;
  quantity?: { value: number; unit: string };
  bhk?: number;
  areaSqft?: number;
  depositPaise?: number | null;
  furnishing?: string;
  floor?: number | null;
  totalFloors?: number | null;
  ageYears?: number | null;
  localityId?: string;
  amenities?: string[];
  postedBy?: 'owner' | 'broker';
  postedAt?: string;
  photoCount?: number;
  nearTransit?: string[];
  description?: string;
  listingType?: 'rent' | 'buy';
}

export interface ResultItem {
  offer: Offer;
  rank: number;
  score: number;
  landed: {
    itemPaise: number;
    feesPaise: number;
    totalPaise: number;
    feesUnknown: boolean;
    possibleSavingsPaise: number;
    lines: { label: string; paise: number }[];
  };
  adjustedRating: number | null;
  components: Record<keyof Weights, number | null>;
  contributions: Record<keyof Weights, number>;
  groupId: string | null;
  flags: string[];
  notes: string[];
  alsoListedOn?: { offerId: string; sourceName: string; pricePaise: number; url: string }[];
  property?: {
    pricePerSqftPaise: number;
    medianPerSqftPaise: number | null;
    medianBasis: string | null;
    ratioToMedian: number | null;
    ageDays: number;
  };
}

export interface SourceStatus {
  sourceId: string;
  sourceName: string;
  status: 'ok' | 'disabled' | 'unavailable';
  offerCount: number;
  fromCache: boolean;
  error?: { kind: string; message: string };
}

export interface SearchResponse {
  requestId: string;
  vertical: Vertical;
  area: { label: string; localityIds: string[]; pincodes: string[] };
  sampleData: boolean;
  weights: Weights;
  results: ResultItem[];
  groups: {
    id: string;
    label: string;
    offerIds: string[];
    possibleMatches: { a: string; b: string; confidence: number; reason: string }[];
  }[];
  sources: SourceStatus[];
  generatedAt: string;
}

export interface Locality {
  id: string;
  name: string;
  nameTa: string;
  pincode: string;
  zone: string;
}

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

export async function api<T>(path: string, init: RequestInit & { json?: unknown } = {}): Promise<T> {
  const { json, ...rest } = init;
  const res = await fetch(`${API_URL}${path}`, {
    ...rest,
    headers: {
      ...(json !== undefined ? { 'content-type': 'application/json' } : {}),
      ...(rest.headers ?? {}),
    },
    body: json !== undefined ? JSON.stringify(json) : rest.body,
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(res.status, body.error ?? 'error', body.message ?? res.statusText);
  return body as T;
}
