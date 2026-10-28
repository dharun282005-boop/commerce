import type { FoodOffer, GroceryOffer, Offer, ProductOffer } from '../schemas.ts';
import { formatQuantity } from '../units.ts';

/** Three-way decision, after Fellegi & Sunter: same / possible match / different. */
export type MatchDecision = 'same' | 'possible' | 'different';

export interface MatchResult {
  decision: MatchDecision;
  confidence: number;
  layer: 'veto' | 'identifier' | 'rule' | 'fuzzy' | 'n/a';
  reason: string;
}

export const SAME_THRESHOLD = 0.9;
export const POSSIBLE_THRESHOLD = 0.7;

// ---------- text helpers ----------

const NOISE = new Set([
  '5g',
  '4g',
  'mobile',
  'phone',
  'smartphone',
  'with',
  'and',
  'the',
  'storage',
  'ram',
  'for',
  'men',
  'women',
  'wireless',
  'bluetooth',
  'headset',
  'headphone',
  'size',
  'pack',
  'of',
  'new',
  'earbud',
  'tw',
  'true',
  'on',
  'ear',
  'over',
  'in',
]);

/** Words that name a different model when only one side has them ("Pro" vs "Pro Max"). */
export const VARIANT_WORDS = new Set([
  'pro',
  'max',
  'plu',
  'ultra',
  'mini',
  'lite',
  'anc',
  'fe',
  'neo',
  'se',
  'air',
  'signature',
  'edge',
]);

function stem(w: string): string {
  return w.length > 3 && w.endsWith('s') && !w.endsWith('ss') && !/\d/.test(w) ? w.slice(0, -1) : w;
}

/** Lower-cases, normalises units and decimals ("1.5 Ton" → "1p5", "5 Litre" → "5l"), removes punctuation and noise. */
export function cleanTitle(title: string): string[] {
  return title
    .toLowerCase()
    .normalize('NFKC')
    .replace(/[’']/g, '')
    .replace(/\+/g, ' plus ')
    .replace(/(\d)\.(\d)/g, '$1p$2')
    .replace(/\b(litres?|liters?|ltrs?)\b/g, 'l')
    .replace(/\bgeneration\b/g, 'gen')
    .replace(/(\d+)\s*(gb|tb|kg|g|ml|l|pcs|pc|w|mah)\b/g, '$1$2')
    .split(/[^\p{L}\p{N}]+/u)
    .map(stem)
    .filter((w) => w && !NOISE.has(w));
}

/** Tokens with a digit that identify a model ("s24", "1000xm5", "1p5"); storage/RAM sizes are handled separately. */
export function modelCodes(tokens: string[]): Set<string> {
  return new Set(
    tokens.filter((t) => /\d/.test(t) && !/^\d+(gb|tb)$/.test(t)).map((t) => t.replace(/^(\d+)w$/, '$1')),
  );
}

const isSubset = (a: Set<string>, b: Set<string>) => [...a].every((x) => b.has(x));

/** Title-level checks shared by every product pair: different variant words or conflicting model codes. */
export function titleVeto(titleA: string, titleB: string): string | null {
  const a = cleanTitle(titleA);
  const b = cleanTitle(titleB);
  const A = new Set(a);
  const B = new Set(b);
  for (const w of VARIANT_WORDS)
    if (A.has(w) !== B.has(w)) return `only one title says "${w === 'plu' ? 'plus' : w}"`;
  const ca = modelCodes(a);
  const cb = modelCodes(b);
  if (ca.size && cb.size && !isSubset(ca, cb) && !isSubset(cb, ca)) {
    return `model codes differ: ${[...ca].join(' ')} vs ${[...cb].join(' ')}`;
  }
  return null;
}

/** A shared long code with letters and digits (e.g. "FHM1207SDW", "HL7756") identifies the model. */
export function sharedModelCode(titleA: string, titleB: string): string | null {
  const cb = modelCodes(cleanTitle(titleB));
  for (const c of modelCodes(cleanTitle(titleA))) if (c.length >= 5 && /[a-z]/.test(c) && cb.has(c)) return c;
  return null;
}

function trigrams(s: string): Set<string> {
  const padded = `  ${s} `;
  const out = new Set<string>();
  for (let i = 0; i < padded.length - 2; i++) out.add(padded.slice(i, i + 3));
  return out;
}

/** Jaccard index of 3-character shingles (the idea behind Postgres pg_trgm similarity()). */
export function trigramSimilarity(a: string, b: string): number {
  const A = trigrams(a);
  const B = trigrams(b);
  let inter = 0;
  for (const x of A) if (B.has(x)) inter++;
  const union = A.size + B.size - inter;
  return union === 0 ? 1 : inter / union;
}

/**
 * Token-set ratio: compares the shared tokens with each side's full token set, so word order and
 * extra words hurt less. Returns the best of the three overlap ratios (0..1).
 */
export function tokenSetRatio(a: string[], b: string[]): number {
  const A = new Set(a);
  const B = new Set(b);
  const inter = [...A].filter((x) => B.has(x));
  if (A.size === 0 || B.size === 0) return 0;
  const common = inter.sort().join(' ');
  const restA = [...A]
    .filter((x) => !B.has(x))
    .sort()
    .join(' ');
  const restB = [...B]
    .filter((x) => !A.has(x))
    .sort()
    .join(' ');
  const s1 = common;
  const s2 = [common, restA].filter(Boolean).join(' ');
  const s3 = [common, restB].filter(Boolean).join(' ');
  return (
    Math.max(trigramSimilarity(s1, s2), trigramSimilarity(s1, s3), trigramSimilarity(s2, s3)) *
    (inter.length / Math.min(A.size, B.size))
  );
}

export function fuzzyScore(titleA: string, titleB: string): number {
  // Sorted tokens, so word order does not matter.
  const a = cleanTitle(titleA).sort();
  const b = cleanTitle(titleB).sort();
  return 0.5 * trigramSimilarity(a.join(' '), b.join(' ')) + 0.5 * tokenSetRatio(a, b);
}

// ---------- attribute extraction (used when a source gives only a title) ----------

export interface ProductAttrs {
  storageGb: number | null;
  ramGb: number | null;
  colour: string | null;
  size: string | null;
}

/** Storage is the largest "N GB/TB" ≥ 32; RAM is a value ≤ 24 GB next to the word RAM, or the smallest one. */
export function extractAttrs(title: string): ProductAttrs {
  const t = title.toLowerCase();
  const values = [...t.matchAll(/(\d+)\s*(gb|tb)/g)].map((m) => Number(m[1]) * (m[2] === 'tb' ? 1024 : 1));
  const storage = values.filter((v) => v >= 32);
  const ramMatch = t.match(/(\d+)\s*gb\s*ram/) ?? t.match(/ram\s*(\d+)\s*gb/);
  const smallValues = values.filter((v) => v <= 24);
  return {
    storageGb: storage.length ? Math.max(...storage) : null,
    ramGb: ramMatch ? Number(ramMatch[1]) : smallValues.length === 1 ? smallValues[0]! : null,
    colour: null,
    size: null,
  };
}

const norm = (s: string | null | undefined) => (s ?? '').toLowerCase().replace(/[^a-z0-9]/g, '');

// ---------- pairwise matching ----------

export function matchPair(a: Offer, b: Offer): MatchResult {
  if (a.vertical !== b.vertical)
    return { decision: 'different', confidence: 1, layer: 'n/a', reason: 'different verticals' };
  switch (a.vertical) {
    case 'shopping':
      return matchProducts(a, b as ProductOffer);
    case 'grocery':
      return matchGrocery(a, b as GroceryOffer);
    case 'food':
      return matchFood(a, b as FoodOffer);
    case 'property':
      return {
        decision: 'different',
        confidence: 0.5,
        layer: 'n/a',
        reason: 'use dedupeProperties() for listings',
      };
  }
}

function attrsOf(o: ProductOffer): ProductAttrs {
  const fromTitle = extractAttrs(o.title);
  return {
    storageGb: o.variant.storageGb ?? fromTitle.storageGb,
    ramGb: o.variant.ramGb ?? fromTitle.ramGb,
    colour: o.variant.colour,
    size: o.variant.size,
  };
}

export function matchProducts(a: ProductOffer, b: ProductOffer): MatchResult {
  // Layer 0: veto. Different variants are never the same product.
  const A = attrsOf(a);
  const B = attrsOf(b);
  for (const key of ['storageGb', 'ramGb', 'size', 'colour'] as const) {
    const x = A[key];
    const y = B[key];
    if (x !== null && y !== null && norm(String(x)) !== norm(String(y))) {
      return {
        decision: 'different',
        confidence: 0.99,
        layer: 'veto',
        reason: `variant differs: ${key} ${x} vs ${y}`,
      };
    }
  }
  if (a.brand && b.brand && norm(a.brand) !== norm(b.brand)) {
    return {
      decision: 'different',
      confidence: 0.99,
      layer: 'veto',
      reason: `brand differs: ${a.brand} vs ${b.brand}`,
    };
  }

  const veto = titleVeto(a.title, b.title);
  if (veto) return { decision: 'different', confidence: 0.95, layer: 'veto', reason: veto };

  // Layer 1: exact identifiers.
  for (const id of ['gtin', 'asin', 'mpn', 'modelNumber'] as const) {
    const x = a.identifiers[id];
    const y = b.identifiers[id];
    if (x && y && norm(x) === norm(y)) {
      return { decision: 'same', confidence: 0.99, layer: 'identifier', reason: `same ${id} (${x})` };
    }
  }

  // Layer 2: rules. Brand + model + every variant attribute known on both sides and equal.
  const variantKnown = A.storageGb !== null || A.size !== null || A.colour !== null;
  if (norm(a.brand) === norm(b.brand) && norm(a.model) === norm(b.model) && a.model && variantKnown) {
    return { decision: 'same', confidence: 0.93, layer: 'rule', reason: 'same brand, model and variant' };
  }

  const code = sharedModelCode(a.title, b.title);
  if (code)
    return { decision: 'same', confidence: 0.95, layer: 'identifier', reason: `same model code (${code})` };

  // Layer 3: fuzzy title similarity. (Layer 4, embeddings, is an optional nudge: see docs/07.)
  return fuzzyDecision(fuzzyScore(a.title, b.title));
}

export function matchGrocery(a: GroceryOffer, b: GroceryOffer): MatchResult {
  if (
    a.quantity.unit !== b.quantity.unit ||
    a.quantity.value !== b.quantity.value ||
    a.packCount !== b.packCount
  ) {
    return { decision: 'different', confidence: 0.99, layer: 'veto', reason: 'pack size differs' };
  }
  if (a.brand && b.brand && norm(a.brand) !== norm(b.brand)) {
    return {
      decision: 'different',
      confidence: 0.99,
      layer: 'veto',
      reason: `brand differs: ${a.brand} vs ${b.brand}`,
    };
  }
  if (norm(a.brand) === norm(b.brand) && norm(a.product) === norm(b.product)) {
    return { decision: 'same', confidence: 0.95, layer: 'rule', reason: 'same brand, product and pack size' };
  }
  return fuzzyDecision(fuzzyScore(`${a.brand ?? ''} ${a.product}`, `${b.brand ?? ''} ${b.product}`));
}

export function matchFood(a: FoodOffer, b: FoodOffer): MatchResult {
  if (a.restaurant.id !== b.restaurant.id) {
    return { decision: 'different', confidence: 0.95, layer: 'veto', reason: 'different restaurant' };
  }
  if (a.servings !== b.servings || a.isVeg !== b.isVeg) {
    return {
      decision: 'different',
      confidence: 0.99,
      layer: 'veto',
      reason: 'servings or veg/non-veg differ',
    };
  }
  if (norm(a.dish) === norm(b.dish))
    return { decision: 'same', confidence: 0.97, layer: 'rule', reason: 'same restaurant and dish' };
  return fuzzyDecision(fuzzyScore(a.dish, b.dish));
}

function fuzzyDecision(s: number): MatchResult {
  const confidence = Math.round(s * 1000) / 1000;
  if (s >= SAME_THRESHOLD)
    return { decision: 'same', confidence, layer: 'fuzzy', reason: `titles very similar (${confidence})` };
  if (s >= POSSIBLE_THRESHOLD)
    return {
      decision: 'possible',
      confidence,
      layer: 'fuzzy',
      reason: `titles similar (${confidence}); not merged`,
    };
  return {
    decision: 'different',
    confidence: 1 - confidence,
    layer: 'fuzzy',
    reason: `titles differ (${confidence})`,
  };
}

// ---------- grouping ----------

export interface OfferGroup {
  id: string;
  label: string;
  offerIds: string[];
  /** Pairs that look alike but were NOT merged (shown as "possible match"). */
  possibleMatches: { a: string; b: string; confidence: number; reason: string }[];
  reasons: { a: string; b: string; reason: string }[];
}

/**
 * Groups offers that are the same item. Blocking: only offers with the same brand (shopping/grocery)
 * or restaurant (food) are compared. Union-find joins "same" pairs.
 */
export function groupOffers(offers: Offer[]): OfferGroup[] {
  const parent = offers.map((_, i) => i);
  const find = (i: number): number => (parent[i] === i ? i : (parent[i] = find(parent[i]!)));
  const possible: OfferGroup['possibleMatches'] = [];
  const reasons: OfferGroup['reasons'] = [];

  const blockKey = (o: Offer) =>
    o.vertical === 'shopping'
      ? norm(o.brand)
      : o.vertical === 'grocery'
        ? norm(o.category)
        : o.vertical === 'food'
          ? o.restaurant.id
          : o.id;
  const blocks = new Map<string, number[]>();
  offers.forEach((o, i) => blocks.set(blockKey(o), [...(blocks.get(blockKey(o)) ?? []), i]));

  for (const idx of blocks.values()) {
    for (let x = 0; x < idx.length; x++) {
      for (let y = x + 1; y < idx.length; y++) {
        const i = idx[x]!;
        const j = idx[y]!;
        const r = matchPair(offers[i]!, offers[j]!);
        if (r.decision === 'same') {
          parent[find(i)] = find(j);
          reasons.push({ a: offers[i]!.id, b: offers[j]!.id, reason: r.reason });
        } else if (r.decision === 'possible') {
          possible.push({ a: offers[i]!.id, b: offers[j]!.id, confidence: r.confidence, reason: r.reason });
        }
      }
    }
  }

  const groups = new Map<number, number[]>();
  offers.forEach((_, i) => groups.set(find(i), [...(groups.get(find(i)) ?? []), i]));
  return [...groups.values()].map((members) => {
    const ids = new Set(members.map((i) => offers[i]!.id));
    const first = offers[members[0]!]!;
    return {
      id: `g:${first.id}`,
      label: groupLabel(first),
      offerIds: [...ids],
      possibleMatches: possible.filter((p) => ids.has(p.a) || ids.has(p.b)),
      reasons: reasons.filter((r) => ids.has(r.a)),
    };
  });
}

function groupLabel(o: Offer): string {
  if (o.vertical === 'shopping') {
    const v = [
      o.variant.storageGb && `${o.variant.storageGb} GB`,
      o.variant.colour,
      o.variant.size && `size ${o.variant.size}`,
    ]
      .filter(Boolean)
      .join(', ');
    return `${o.brand} ${o.model}${v ? ` (${v})` : ''}`;
  }
  if (o.vertical === 'grocery')
    return `${o.brand ? o.brand + ' ' : ''}${o.product} ${formatQuantity(o.quantity)}`;
  if (o.vertical === 'food') return `${o.dish} · ${o.restaurant.name}`;
  return o.title;
}
