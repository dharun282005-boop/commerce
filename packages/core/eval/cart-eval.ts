import {
  exhaustiveCart,
  heuristicCart,
  type CartNeed,
  type CartOption,
  type PlatformRules,
} from '../src/cart/cart.ts';

/** Compares the greedy + local-search cart solver with exhaustive search on random small instances. */
export function cartBenchmark(n = 1000, seed = 2026) {
  const rand = () => (seed = (seed * 1103515245 + 12345) % 2 ** 31) / 2 ** 31;
  let compared = 0,
    optimal = 0,
    gapSum = 0,
    worst = 0,
    heuristicMs = 0,
    exhaustiveMs = 0,
    infeasibleHeuristic = 0;
  for (let t = 0; t < n; t++) {
    const nNeeds = 2 + Math.floor(rand() * 5);
    const nPlat = 2 + Math.floor(rand() * 3);
    const needs: CartNeed[] = Array.from({ length: nNeeds }, (_, i) => ({
      id: `n${i}`,
      text: '',
      query: '',
      quantity: null,
    }));
    const rules = new Map<string, PlatformRules>();
    for (let p = 0; p < nPlat; p++)
      rules.set(`p${p}`, {
        sourceId: `p${p}`,
        sourceName: `p${p}`,
        deliveryPaise: Math.round(rand() * 5000),
        handlingPaise: Math.round(rand() * 800),
        platformPaise: 0,
        freeDeliveryAbovePaise: rand() < 0.5 ? 20000 : null,
        minOrderPaise: rand() < 0.3 ? 10000 : null,
      });
    const options = new Map<string, Map<string, CartOption>>();
    for (const nd of needs) {
      const m = new Map<string, CartOption>();
      for (let p = 0; p < nPlat; p++)
        if (rand() < 0.8 || m.size === 0)
          m.set(`p${p}`, {
            needId: nd.id,
            sourceId: `p${p}`,
            offerId: '',
            title: '',
            packs: 1,
            costPaise: 2000 + Math.round(rand() * 20000),
          });
      options.set(nd.id, m);
    }
    let t0 = performance.now();
    const h = heuristicCart(needs, options, rules);
    heuristicMs += performance.now() - t0;
    t0 = performance.now();
    const e = exhaustiveCart(needs, options, rules);
    exhaustiveMs += performance.now() - t0;
    if (!e.feasible) continue;
    compared++;
    if (!h.feasible) {
      infeasibleHeuristic++;
      continue;
    }
    const gap = (h.totalPaise - e.totalPaise) / e.totalPaise;
    if (gap < 1e-12) optimal++;
    gapSum += gap;
    worst = Math.max(worst, gap);
  }
  return {
    instances: n,
    compared,
    optimal,
    optimalPct: (100 * optimal) / compared,
    meanGapPct: (100 * gapSum) / compared,
    worstGapPct: 100 * worst,
    infeasibleHeuristic,
    heuristicMsAvg: heuristicMs / n,
    exhaustiveMsAvg: exhaustiveMs / n,
  };
}

if (import.meta.url === `file://${process.argv[1]}`) console.log(cartBenchmark());
