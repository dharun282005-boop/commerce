import { z } from 'zod';

/** The four verticals the product compares. */
export const Vertical = z.enum(['shopping', 'food', 'grocery', 'property']);
export type Vertical = z.infer<typeof Vertical>;

const paise = z.int().min(0);
const nullablePaise = paise.nullable();

export const Tier = z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal('fixture')]);
export type Tier = z.infer<typeof Tier>;

/** Where a price came from and how fresh it is. Required on every offer (rule 3). */
export const Provenance = z.object({
  sourceId: z.string().min(1),
  sourceName: z.string().min(1),
  tier: Tier,
  observedAt: z.iso.datetime(),
  confidence: z.number().min(0).max(1),
  isSample: z.boolean(),
});
export type Provenance = z.infer<typeof Provenance>;

export const Fees = z.object({
  deliveryPaise: nullablePaise,
  handlingPaise: nullablePaise,
  platformPaise: nullablePaise,
  packagingPaise: nullablePaise,
  taxesNotIncludedPaise: nullablePaise,
});
export type Fees = z.infer<typeof Fees>;

export const Coupon = z.object({
  code: z.string().nullable(),
  description: z.string(),
  savingPaise: paise,
  /** Only verifiable coupons reduce landed cost; others are "possible savings". */
  verifiable: z.boolean(),
});

export const Rating = z.object({
  average: z.number().min(0).max(5),
  count: z.int().min(0),
});

export const Trust = z.object({
  fulfilledByPlatform: z.boolean().nullable(),
  returnPolicyDays: z.int().min(0).nullable(),
  sellerRating: z.number().min(0).max(5).nullable(),
});

const pincode = z.string().regex(/^6\d{5}$/, 'Tamil Nadu pincodes start with 6');

const base = {
  id: z.string().min(1),
  title: z.string().min(1).max(500),
  url: z.url(),
  pricePaise: paise,
  mrpPaise: nullablePaise,
  fees: Fees,
  coupons: z.array(Coupon),
  rating: Rating.nullable(),
  etaMinutes: z.int().min(0).nullable(),
  trust: Trust,
  affiliate: z.boolean(),
  provenance: Provenance,
};

export const ProductOffer = z.object({
  ...base,
  vertical: z.literal('shopping'),
  brand: z.string(),
  model: z.string(),
  category: z.string(),
  seller: z.string().nullable(),
  variant: z.object({
    storageGb: z.int().nullable(),
    ramGb: z.int().nullable(),
    colour: z.string().nullable(),
    size: z.string().nullable(),
  }),
  identifiers: z.object({
    gtin: z.string().nullable(),
    asin: z.string().nullable(),
    mpn: z.string().nullable(),
    modelNumber: z.string().nullable(),
  }),
  deliversTo: z.array(pincode).nullable(),
});

export const FoodOffer = z.object({
  ...base,
  vertical: z.literal('food'),
  restaurant: z.object({
    id: z.string(),
    name: z.string(),
    localityId: z.string(),
    rating: Rating.nullable(),
  }),
  dish: z.string(),
  servings: z.int().min(1),
  isVeg: z.boolean(),
  dietaryTags: z.array(z.string()),
  deliversTo: z.array(pincode),
});

export const GroceryOffer = z.object({
  ...base,
  vertical: z.literal('grocery'),
  brand: z.string().nullable(),
  product: z.string(),
  category: z.string(),
  quantity: z.object({ value: z.number().positive(), unit: z.enum(['g', 'ml', 'pc']) }),
  packCount: z.int().min(1),
  deliversTo: z.array(pincode),
  /** Per-order rules for cart splitting (Phase C). */
  order: z.object({
    minOrderPaise: nullablePaise,
    freeDeliveryAbovePaise: nullablePaise,
  }),
});

export const PropertyOffer = z.object({
  ...base,
  vertical: z.literal('property'),
  listingType: z.enum(['rent', 'buy']),
  bhk: z.int().min(1).max(10),
  areaSqft: z.int().positive(),
  depositPaise: nullablePaise,
  furnishing: z.enum(['unfurnished', 'semi-furnished', 'furnished']),
  floor: z.int().nullable(),
  totalFloors: z.int().nullable(),
  ageYears: z.int().min(0).nullable(),
  localityId: z.string(),
  pincode,
  geo: z.object({ lat: z.number(), lng: z.number() }),
  amenities: z.array(z.string()),
  postedBy: z.enum(['owner', 'broker']),
  postedAt: z.iso.datetime(),
  photoCount: z.int().min(0),
  nearTransit: z.array(z.string()),
  /** Untrusted free text from the listing. Data only, never instructions (rule 4). */
  description: z.string().max(2000),
  // Deliberately no phone or contact field (FR-PRP-03).
});

export const Offer = z.discriminatedUnion('vertical', [ProductOffer, FoodOffer, GroceryOffer, PropertyOffer]);

export type ProductOffer = z.infer<typeof ProductOffer>;
export type FoodOffer = z.infer<typeof FoodOffer>;
export type GroceryOffer = z.infer<typeof GroceryOffer>;
export type PropertyOffer = z.infer<typeof PropertyOffer>;
export type Offer = z.infer<typeof Offer>;

/** Filters accepted by search. All optional. */
export const SearchFilters = z.object({
  maxPricePaise: paise.optional(),
  vegOnly: z.boolean().optional(),
  maxEtaMinutes: z.int().min(1).optional(),
  minServings: z.int().min(1).optional(),
  bhk: z.int().min(1).max(10).optional(),
  listingType: z.enum(['rent', 'buy']).optional(),
  furnishing: z.enum(['unfurnished', 'semi-furnished', 'furnished']).optional(),
});
export type SearchFilters = z.infer<typeof SearchFilters>;

export const SearchQuery = z.object({
  vertical: Vertical,
  q: z.string().trim().min(1).max(200),
  /** Pincodes the user cares about (a locality, or a corridor such as OMR, can map to several). */
  pincodes: z.array(pincode).min(1),
  localityIds: z.array(z.string()).min(1),
  filters: SearchFilters.default({}),
});
export type SearchQuery = z.infer<typeof SearchQuery>;
