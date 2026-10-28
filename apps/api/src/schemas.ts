import { Offer, SearchFilters, Vertical } from '@cuc/core';
import { z } from 'zod';

export const Preset = z.enum(['cheapest', 'best_rated', 'fastest', 'balanced']);
export const WeightsSchema = z.object({
  cost: z.number().min(0).max(1),
  rating: z.number().min(0).max(1),
  speed: z.number().min(0).max(1),
  trust: z.number().min(0).max(1),
});

export const SearchBody = z.object({
  vertical: Vertical,
  q: z.string().trim().min(1).max(200).describe('What to look for, e.g. "veg biryani"'),
  locality: z
    .string()
    .trim()
    .min(1)
    .max(60)
    .describe('Chennai locality name, alias, corridor (OMR) or pincode'),
  filters: SearchFilters.default({}),
  preset: Preset.optional(),
  weights: WeightsSchema.optional().describe('Custom weights; overrides preset'),
});

export const SourceStatus = z.object({
  sourceId: z.string(),
  sourceName: z.string(),
  tier: z.union([z.number(), z.literal('fixture')]),
  status: z.enum(['ok', 'disabled', 'unavailable']),
  offerCount: z.number(),
  fromCache: z.boolean(),
  fetchedAt: z.string().nullable(),
  latencyMs: z.number(),
  droppedInvalid: z.number(),
  error: z.object({ kind: z.string(), message: z.string() }).optional(),
});

const Contrib = z.object({ cost: z.number(), rating: z.number(), speed: z.number(), trust: z.number() });

export const Landed = z.object({
  itemPaise: z.number(),
  feesPaise: z.number(),
  couponSavingsPaise: z.number(),
  possibleSavingsPaise: z.number(),
  totalPaise: z.number(),
  feesUnknown: z.boolean(),
  lines: z.array(z.object({ label: z.string(), paise: z.number() })),
});

export const ResultItem = z.object({
  offer: Offer,
  rank: z.number(),
  score: z.number(),
  landed: Landed,
  adjustedRating: z.number().nullable(),
  components: z.object({
    cost: z.number().nullable(),
    rating: z.number().nullable(),
    speed: z.number().nullable(),
    trust: z.number().nullable(),
  }),
  contributions: Contrib,
  groupId: z.string().nullable(),
  flags: z.array(z.string()),
  notes: z.array(z.string()),
  alsoListedOn: z
    .array(z.object({ offerId: z.string(), sourceName: z.string(), pricePaise: z.number(), url: z.string() }))
    .optional(),
  duplicateReason: z.string().nullable().optional(),
  property: z
    .object({
      pricePerSqftPaise: z.number(),
      medianPerSqftPaise: z.number().nullable(),
      medianBasis: z.string().nullable(),
      ratioToMedian: z.number().nullable(),
      ageDays: z.number(),
      flags: z.array(z.string()),
    })
    .optional(),
});

export const Group = z.object({
  id: z.string(),
  label: z.string(),
  offerIds: z.array(z.string()),
  possibleMatches: z.array(
    z.object({ a: z.string(), b: z.string(), confidence: z.number(), reason: z.string() }),
  ),
  reasons: z.array(z.object({ a: z.string(), b: z.string(), reason: z.string() })),
});

export const SearchResponse = z.object({
  requestId: z.string(),
  vertical: Vertical,
  area: z.object({ label: z.string(), localityIds: z.array(z.string()), pincodes: z.array(z.string()) }),
  sampleData: z.boolean().describe('True when any offer comes from sample (fixture) data'),
  weights: Contrib,
  results: z.array(ResultItem),
  groups: z.array(Group),
  sources: z.array(SourceStatus),
  generatedAt: z.string(),
});

export const ErrorResponse = z.object({ error: z.string(), message: z.string() });
