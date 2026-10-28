import {
  buildCartInputs,
  compareOffers,
  DEMOTING_FLAGS,
  LOCALITIES,
  MemoryHistoryStore,
  mrpCheck,
  parseGroceryList,
  resolveArea,
  sampleHistory,
  searchAll,
  solveCart,
  type CompareResult,
  type GroceryOffer,
  type GuardedAdapter,
  type HistoryStore,
  type Offer,
  type PresetName,
  type ResolvedArea,
  type SearchFilters,
  type SearchOutcome,
  type Vertical,
  type Weights,
} from '@cuc/core';

/**
 * Everything the HTTP routes and the agent tools can do, in one place, so both use exactly the
 * same logic. All functions are read-only: nothing here can buy, log in or contact a platform user.
 */
export interface Services {
  search(input: SearchInput, requestId: string): Promise<SearchResult>;
  planCart(input: { list: string; locality: string }, requestId: string): Promise<CartResult>;
  offerDetail(offerId: string, requestId: string): Promise<OfferDetail | null>;
  history(offerId: string, days: number): Promise<HistoryResult>;
  getOffers(ids: string[], requestId: string): Promise<Offer[]>;
  resolve(locality: string): ResolvedArea | null;
  sources: GuardedAdapter[];
}

export interface SearchInput {
  vertical: Vertical;
  q: string;
  locality: string;
  filters?: SearchFilters;
  preset?: PresetName;
  weights?: Weights;
}

export class UnknownLocalityError extends Error {
  constructor(readonly locality: string) {
    super(`"${locality}" is not a Chennai locality we know. This app covers Chennai only.`);
  }
}

export type SearchResult = CompareResult & {
  vertical: Vertical;
  area: { label: string; localityIds: string[]; pincodes: string[] };
  sampleData: boolean;
  sources: SearchOutcome['sources'];
  generatedAt: string;
};

export interface CartResult {
  area: { label: string; pincodes: string[] };
  needs: ReturnType<typeof parseGroceryList>;
  plan: ReturnType<typeof solveCart>;
  sources: SearchOutcome['sources'];
  sampleData: boolean;
  generatedAt: string;
}

export interface OfferDetail {
  offer: Offer;
  /** Ranked offers for the same item across platforms (or duplicates of the same property). */
  sameItem: CompareResult['results'];
  similar: CompareResult['results'];
  mrp: ReturnType<typeof mrpCheck>;
}

export interface HistoryResult {
  offerId: string;
  days: number;
  points: { observedAt: string; pricePaise: number; sourceId: string; isSample: boolean }[];
  minPaise: number | null;
  maxPaise: number | null;
}

export interface ServiceDeps {
  sources: GuardedAdapter[];
  history?: HistoryStore;
  recordObservations?: (offers: Offer[]) => Promise<unknown>;
  now: () => Date;
  onWarn?: (msg: string, err: unknown) => void;
  /** Called with freshly fetched offers (e.g. to check price alerts). */
  onObserved?: (offers: Offer[]) => Promise<unknown>;
}

export function createServices(deps: ServiceDeps): Services {
  const { sources, now } = deps;
  // Without a database, sample history is generated on demand for fixture offers.
  const memHistory = new MemoryHistoryStore();
  const lastSeen = new Map<string, Offer>();

  const history: HistoryStore = deps.history ?? {
    async getHistory(offerId, days, at) {
      const existing = await memHistory.getHistory(offerId, days, at);
      if (existing.length) return existing;
      const o = lastSeen.get(offerId);
      if (!o || !o.provenance.isSample) return [];
      for (const p of sampleHistory(o.id, o.provenance.sourceId, o.pricePaise, 90, at))
        memHistory.add(o.id, p);
      return memHistory.getHistory(offerId, days, at);
    },
  };

  const record = (outcome: SearchOutcome) => {
    for (const o of outcome.offers) lastSeen.set(o.id, o);
    const fresh = new Set(
      outcome.sources.filter((s) => s.status === 'ok' && !s.fromCache).map((s) => s.sourceId),
    );
    const toRecord = outcome.offers.filter((o) => fresh.has(o.provenance.sourceId));
    deps.recordObservations?.(toRecord).catch((err) => deps.onWarn?.('failed to record observations', err));
    deps.onObserved?.(toRecord).catch((err) => deps.onWarn?.('failed to check alerts', err));
  };

  const areaOf = (locality: string) => {
    const area = resolveArea(locality);
    if (!area) throw new UnknownLocalityError(locality);
    return area;
  };

  async function search(input: SearchInput, requestId: string): Promise<SearchResult> {
    const area = areaOf(input.locality);
    const outcome = await searchAll(
      sources,
      {
        vertical: input.vertical,
        q: input.q,
        filters: input.filters ?? {},
        pincodes: area.pincodes,
        localityIds: area.localities.map((l) => l.id),
      },
      { requestId, now },
    );
    record(outcome);
    const compared = compareOffers(outcome.offers, {
      preset: input.preset,
      weights: input.weights,
      now: now(),
    });
    return {
      ...compared,
      vertical: input.vertical,
      area: { label: area.label, localityIds: area.localities.map((l) => l.id), pincodes: area.pincodes },
      sampleData: outcome.offers.some((o) => o.provenance.isSample),
      sources: outcome.sources,
      generatedAt: now().toISOString(),
    };
  }

  async function planCart(input: { list: string; locality: string }, requestId: string): Promise<CartResult> {
    const area = areaOf(input.locality);
    const needs = parseGroceryList(input.list).slice(0, 30);
    const byNeed = new Map<string, GroceryOffer[]>();
    const sourceStatus = new Map<string, SearchOutcome['sources'][number]>();
    let sample = false;
    for (const n of needs) {
      const outcome = await searchAll(
        sources,
        {
          vertical: 'grocery',
          q: n.query,
          filters: {},
          pincodes: area.pincodes,
          localityIds: area.localities.map((l) => l.id),
        },
        { requestId, now },
      );
      record(outcome);
      // Never put flagged offers (price anomaly, instruction-like text) into a cart plan.
      const ranked = compareOffers(outcome.offers, { now: now() }).results;
      const safe = ranked.filter((r) => !r.flags.some((f) => DEMOTING_FLAGS.includes(f))).map((r) => r.offer);
      byNeed.set(n.id, safe as GroceryOffer[]);
      sample ||= outcome.offers.some((o) => o.provenance.isSample);
      for (const s of outcome.sources)
        if (!sourceStatus.has(s.sourceId) || s.status !== 'ok') sourceStatus.set(s.sourceId, s);
    }
    const { options, rules } = buildCartInputs(needs, byNeed);
    return {
      area: { label: area.label, pincodes: area.pincodes },
      needs,
      plan: solveCart(needs, options, rules),
      sources: [...sourceStatus.values()],
      sampleData: sample,
      generatedAt: now().toISOString(),
    };
  }

  async function offerDetail(offerId: string, requestId: string): Promise<OfferDetail | null> {
    const [sourceId, ...rest] = offerId.split(':');
    const src = sources.find((s) => s.id === sourceId);
    if (!src || rest.length === 0) return null;
    const offer = await src.getOffer(rest.join(':'), { requestId, now });
    if (!offer) return null;
    lastSeen.set(offer.id, offer);

    // Look across sources for the same item, then compare.
    const locality =
      offer.vertical === 'property'
        ? offer.localityId
        : offer.vertical === 'food' || offer.vertical === 'grocery'
          ? (LOCALITIES.find((l) => offer.deliversTo.includes(l.pincode))?.id ?? 't-nagar')
          : 't-nagar';
    const q =
      offer.vertical === 'shopping'
        ? `${offer.brand} ${offer.model}`
        : offer.vertical === 'grocery'
          ? offer.product
          : offer.vertical === 'food'
            ? offer.dish
            : `${offer.bhk} bhk`;
    const res = await search({ vertical: offer.vertical, q, locality }, requestId);
    const myGroup = res.groups.find((g) => g.offerIds.includes(offer.id));
    const inGroup = new Set(myGroup?.offerIds ?? [offer.id]);
    const sameItem = res.results.filter(
      (r) => inGroup.has(r.offer.id) || r.alsoListedOn?.some((a) => a.offerId === offer.id),
    );
    const similar = res.results.filter((r) => !sameItem.includes(r)).slice(0, 6);
    const hist = await history.getHistory(offer.id, 90, now());
    return { offer, sameItem, similar, mrp: mrpCheck(offer.mrpPaise, offer.pricePaise, hist) };
  }

  async function getHistory(offerId: string, days: number): Promise<HistoryResult> {
    if (!lastSeen.has(offerId) && !deps.history) await offerDetail(offerId, 'history').catch(() => null);
    const points = await history.getHistory(offerId, days, now());
    const prices = points.map((p) => p.pricePaise);
    return {
      offerId,
      days,
      points,
      minPaise: prices.length ? Math.min(...prices) : null,
      maxPaise: prices.length ? Math.max(...prices) : null,
    };
  }

  async function getOffers(ids: string[], requestId: string): Promise<Offer[]> {
    const out: Offer[] = [];
    for (const id of ids) {
      const seen = lastSeen.get(id);
      if (seen) {
        out.push(seen);
        continue;
      }
      const [sourceId, ...rest] = id.split(':');
      const src = sources.find((s) => s.id === sourceId);
      const o = src && rest.length ? await src.getOffer(rest.join(':'), { requestId, now }) : null;
      if (o) out.push(o);
    }
    return out;
  }

  return { search, planCart, offerDetail, history: getHistory, getOffers, resolve: resolveArea, sources };
}
