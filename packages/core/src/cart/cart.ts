import type { GroceryOffer } from '../schemas.ts';
import { parseQuantity, type Quantity } from '../units.ts';

/** One line of a shopping list, e.g. "2 kg rice". */
export interface CartNeed {
  id: string;
  text: string;
  query: string;
  quantity: Quantity | null;
}

/** Parses "2 kg rice, 1 L milk, 12 eggs" into needs. Unknown quantities stay null (no guessing). */
export function parseGroceryList(input: string): CartNeed[] {
  return input
    .split(/,|\n|;|\band\b/i)
    .map((s) => s.trim())
    .filter(Boolean)
    .map((text, i) => {
      const m = text.match(
        /^(\d+(?:\.\d+)?)\s*(kg|kgs|g|gm|gms|grams?|l|ltr|litres?|liters?|ml|pcs?|pieces?|x)?\s+(.+)$/i,
      );
      if (!m) return { id: `n${i + 1}`, text, query: text, quantity: null };
      const unit = m[2] && m[2].toLowerCase() !== 'x' ? m[2] : 'pc';
      return { id: `n${i + 1}`, text, query: m[3]!.trim(), quantity: parseQuantity(`${m[1]} ${unit}`) };
    });
}

export interface PlatformRules {
  sourceId: string;
  sourceName: string;
  deliveryPaise: number;
  handlingPaise: number;
  platformPaise: number;
  freeDeliveryAbovePaise: number | null;
  minOrderPaise: number | null;
}

/** How one platform would fill one need: which pack, how many, at what cost. */
export interface CartOption {
  needId: string;
  sourceId: string;
  offerId: string;
  title: string;
  packs: number;
  costPaise: number;
}

/**
 * The cheapest way to fill a need on one platform: for each matching pack size, buy
 * ceil(needed / pack) packs; keep the cheapest. Units must match (g with g, ml with ml, pc with pc).
 */
export function bestOption(need: CartNeed, offers: GroceryOffer[]): CartOption | null {
  let best: CartOption | null = null;
  for (const o of offers) {
    const packQty = o.quantity.value * o.packCount;
    let packs = 1;
    if (need.quantity) {
      if (need.quantity.unit !== o.quantity.unit) continue;
      packs = Math.ceil(need.quantity.value / packQty - 1e-9);
    }
    const cost = packs * o.pricePaise;
    if (!best || cost < best.costPaise) {
      best = {
        needId: need.id,
        sourceId: o.provenance.sourceId,
        offerId: o.id,
        title: o.title,
        packs,
        costPaise: cost,
      };
    }
  }
  return best;
}

export function rulesFromOffer(o: GroceryOffer): PlatformRules {
  return {
    sourceId: o.provenance.sourceId,
    sourceName: o.provenance.sourceName,
    deliveryPaise: o.fees.deliveryPaise ?? 0,
    handlingPaise: o.fees.handlingPaise ?? 0,
    platformPaise: o.fees.platformPaise ?? 0,
    freeDeliveryAbovePaise: o.order.freeDeliveryAbovePaise,
    minOrderPaise: o.order.minOrderPaise,
  };
}

export function orderFees(rules: PlatformRules, subtotal: number): number {
  const delivery =
    rules.freeDeliveryAbovePaise !== null && subtotal >= rules.freeDeliveryAbovePaise
      ? 0
      : rules.deliveryPaise;
  return delivery + rules.handlingPaise + rules.platformPaise;
}

export type Assignment = Record<string, string>; // needId -> sourceId

const INFEASIBLE = 1e12;

/** Total cost of an assignment. Orders below a platform minimum get a huge penalty that shrinks steeply as they get closer, so local search is pulled towards feasible plans. */
export function assignmentCost(
  assignment: Assignment,
  options: Map<string, Map<string, CartOption>>,
  rules: Map<string, PlatformRules>,
): number {
  const subtotals = new Map<string, number>();
  for (const [needId, sourceId] of Object.entries(assignment)) {
    const opt = options.get(needId)!.get(sourceId)!;
    subtotals.set(sourceId, (subtotals.get(sourceId) ?? 0) + opt.costPaise);
  }
  let total = 0;
  for (const [sourceId, sub] of subtotals) {
    const r = rules.get(sourceId)!;
    total += sub + orderFees(r, sub);
    if (r.minOrderPaise !== null && sub < r.minOrderPaise)
      total += INFEASIBLE + (r.minOrderPaise - sub) * 1000;
  }
  return total;
}

export interface CartPlan {
  method: 'greedy+local-search' | 'exhaustive';
  totalPaise: number;
  feasible: boolean;
  assignment: Assignment;
  orders: {
    sourceId: string;
    sourceName: string;
    lines: CartOption[];
    subtotalPaise: number;
    feesPaise: number;
    totalPaise: number;
    minOrderPaise: number | null;
  }[];
  unavailable: string[];
  /** For comparison: cost of buying everything on the single cheapest platform that has it all. */
  bestSinglePlatform: { sourceId: string; totalPaise: number } | null;
}

/**
 * Greedy + local search, restarted from several starting points:
 *  1. start from "each need on its cheapest platform", and from "everything on platform P" for each P;
 *  2. from each start, repeat until nothing improves: move one need to another platform, or close a
 *     platform by moving all its needs to their best alternative (platforms in use first, else any);
 *  3. keep the cheapest result.
 */
export function heuristicCart(
  needs: CartNeed[],
  options: Map<string, Map<string, CartOption>>,
  rules: Map<string, PlatformRules>,
): CartPlan {
  const available = needs.filter((n) => (options.get(n.id)?.size ?? 0) > 0);
  const starts: Assignment[] = [];
  const greedy: Assignment = {};
  for (const n of available) {
    const opts = [...options.get(n.id)!.values()].sort((a, b) => a.costPaise - b.costPaise);
    greedy[n.id] = opts[0]!.sourceId;
  }
  starts.push(greedy);
  for (const src of rules.keys()) {
    const s: Assignment = { ...greedy };
    for (const n of available) if (options.get(n.id)!.has(src)) s[n.id] = src;
    starts.push(s);
  }
  let best: Assignment = greedy;
  let bestCost = Infinity;
  for (const start of starts) {
    const a = localSearch(start, available, options, rules);
    const c = assignmentCost(a, options, rules);
    if (c < bestCost) {
      bestCost = c;
      best = a;
    }
  }
  return buildPlan('greedy+local-search', needs, best, options, rules);
}

function localSearch(
  start: Assignment,
  available: CartNeed[],
  options: Map<string, Map<string, CartOption>>,
  rules: Map<string, PlatformRules>,
): Assignment {
  const assignment = { ...start };
  let cost = assignmentCost(assignment, options, rules);
  let improved = true;
  let passes = 0;
  while (improved && passes++ < 100) {
    improved = false;
    for (const n of available) {
      for (const src of options.get(n.id)!.keys()) {
        if (src === assignment[n.id]) continue;
        const trial = { ...assignment, [n.id]: src };
        const c = assignmentCost(trial, options, rules);
        if (c < cost) {
          Object.assign(assignment, trial);
          cost = c;
          improved = true;
        }
      }
    }
    const used = new Set(Object.values(assignment));
    for (const closing of used) {
      const trial = { ...assignment };
      let ok = true;
      for (const [needId, src] of Object.entries(assignment)) {
        if (src !== closing) continue;
        // Prefer platforms already in use (no extra fees); fall back to any other platform.
        const others = [...options.get(needId)!.values()].filter((o) => o.sourceId !== closing);
        const inUse = others.filter((o) => used.has(o.sourceId));
        const alts = inUse.length ? inUse : others;
        if (alts.length === 0) {
          ok = false;
          break;
        }
        trial[needId] = alts.sort((a, b) => a.costPaise - b.costPaise)[0]!.sourceId;
      }
      if (!ok) continue;
      const c = assignmentCost(trial, options, rules);
      if (c < cost) {
        Object.assign(assignment, trial);
        cost = c;
        improved = true;
        break;
      }
    }
  }
  return assignment;
}

/** Combinations exhaustive search must try for this input. */
export function combinationCount(needs: CartNeed[], options: Map<string, Map<string, CartOption>>): number {
  return needs.reduce((p, n) => p * Math.max(1, options.get(n.id)?.size ?? 0), 1);
}

export const EXACT_LIMIT = 20_000;

/**
 * Production entry point: exact (exhaustive) search when the list is small enough to be instant
 * (≤ 20,000 combinations, e.g. 6 items × 5 platforms = 15,625), otherwise the heuristic.
 */
export function solveCart(
  needs: CartNeed[],
  options: Map<string, Map<string, CartOption>>,
  rules: Map<string, PlatformRules>,
): CartPlan {
  return combinationCount(needs, options) <= EXACT_LIMIT
    ? exhaustiveCart(needs, options, rules)
    : heuristicCart(needs, options, rules);
}

/** Tries every assignment: |platforms|^|needs|. Only for small lists (tests and checks). */
export function exhaustiveCart(
  needs: CartNeed[],
  options: Map<string, Map<string, CartOption>>,
  rules: Map<string, PlatformRules>,
  limit = 200_000,
): CartPlan {
  const available = needs.filter((n) => (options.get(n.id)?.size ?? 0) > 0);
  const choices = available.map((n) => [...options.get(n.id)!.keys()]);
  const total = choices.reduce((p, c) => p * c.length, 1);
  if (total > limit) throw new RangeError(`too many combinations for exhaustive search: ${total}`);
  let best: Assignment = {};
  let bestCost = Infinity;
  const current: Assignment = {};
  const walk = (i: number) => {
    if (i === available.length) {
      const c = assignmentCost(current, options, rules);
      if (c < bestCost) {
        bestCost = c;
        best = { ...current };
      }
      return;
    }
    for (const src of choices[i]!) {
      current[available[i]!.id] = src;
      walk(i + 1);
    }
  };
  walk(0);
  return buildPlan('exhaustive', needs, best, options, rules);
}

function buildPlan(
  method: CartPlan['method'],
  needs: CartNeed[],
  assignment: Assignment,
  options: Map<string, Map<string, CartOption>>,
  rules: Map<string, PlatformRules>,
): CartPlan {
  const bySource = new Map<string, CartOption[]>();
  for (const [needId, src] of Object.entries(assignment)) {
    bySource.set(src, [...(bySource.get(src) ?? []), options.get(needId)!.get(src)!]);
  }
  let feasible = true;
  const orders = [...bySource.entries()].map(([sourceId, lines]) => {
    const r = rules.get(sourceId)!;
    const subtotal = lines.reduce((s, l) => s + l.costPaise, 0);
    const fees = orderFees(r, subtotal);
    if (r.minOrderPaise !== null && subtotal < r.minOrderPaise) feasible = false;
    return {
      sourceId,
      sourceName: r.sourceName,
      lines,
      subtotalPaise: subtotal,
      feesPaise: fees,
      totalPaise: subtotal + fees,
      minOrderPaise: r.minOrderPaise,
    };
  });
  orders.sort((a, b) => b.totalPaise - a.totalPaise);

  // Single-platform baseline, for the "you save ₹X by splitting" message.
  let bestSingle: CartPlan['bestSinglePlatform'] = null;
  const assigned = Object.keys(assignment);
  for (const src of rules.keys()) {
    if (!assigned.every((id) => options.get(id)!.has(src))) continue;
    const single = Object.fromEntries(assigned.map((id) => [id, src]));
    const c = assignmentCost(single, options, rules);
    if (c < INFEASIBLE && (!bestSingle || c < bestSingle.totalPaise))
      bestSingle = { sourceId: src, totalPaise: c };
  }

  return {
    method,
    totalPaise: orders.reduce((s, o) => s + o.totalPaise, 0),
    feasible,
    assignment,
    orders,
    unavailable: needs.filter((n) => !assignment[n.id]).map((n) => n.id),
    bestSinglePlatform: bestSingle,
  };
}

/** Builds options and rules from grocery search results, one search result list per need. */
export function buildCartInputs(needs: CartNeed[], offersByNeed: Map<string, GroceryOffer[]>) {
  const options = new Map<string, Map<string, CartOption>>();
  const rules = new Map<string, PlatformRules>();
  for (const n of needs) {
    const perSource = new Map<string, GroceryOffer[]>();
    for (const o of offersByNeed.get(n.id) ?? []) {
      perSource.set(o.provenance.sourceId, [...(perSource.get(o.provenance.sourceId) ?? []), o]);
      if (!rules.has(o.provenance.sourceId)) rules.set(o.provenance.sourceId, rulesFromOffer(o));
    }
    const m = new Map<string, CartOption>();
    for (const [src, offers] of perSource) {
      const best = bestOption(n, offers);
      if (best) m.set(src, best);
    }
    options.set(n.id, m);
  }
  return { options, rules };
}
