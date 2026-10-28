import { groupOffers, type OfferGroup } from './match/match.ts';
import { dedupeProperties, propertyInsights, type PropertyInsight } from './property/property.ts';
import {
  PRESETS,
  rankOffers,
  sortRanked,
  type PresetName,
  type RankedOffer,
  type Weights,
} from './rank/score.ts';
import type { Offer, PropertyOffer } from './schemas.ts';

export interface ResultItem extends RankedOffer {
  /** Same property listed on other portals (collapsed into this result). */
  alsoListedOn?: { offerId: string; sourceName: string; pricePaise: number; url: string }[];
  duplicateReason?: string | null;
  property?: PropertyInsight;
}

export interface CompareResult {
  weights: Weights;
  results: ResultItem[];
  groups: OfferGroup[];
}

export function resolveWeights(input?: { preset?: PresetName; weights?: Weights }): Weights {
  if (input?.weights) return input.weights;
  return PRESETS[input?.preset ?? 'balanced'];
}

/** Groups, dedupes, ranks and flags a list of offers from one vertical. */
export function compareOffers(
  offers: Offer[],
  opts: { preset?: PresetName; weights?: Weights; now?: Date } = {},
): CompareResult {
  const weights = resolveWeights(opts);
  if (offers.length === 0) return { weights, results: [], groups: [] };

  if (offers[0]!.vertical === 'property') {
    const props = offers as PropertyOffer[];
    const insights = propertyInsights(props, opts.now ?? new Date());
    const dupes = dedupeProperties(props);
    const byId = new Map(props.map((p) => [p.id, p]));
    // Representative of each duplicate group = cheapest listing.
    const reps = dupes.map((g) => {
      const members = g.ids.map((id) => byId.get(id)!).sort((a, b) => a.pricePaise - b.pricePaise);
      return { rep: members[0]!, others: members.slice(1), reason: g.reason };
    });
    const ranked = rankOffers(
      reps.map((r) => r.rep),
      { weights },
    ) as ResultItem[];
    for (const item of ranked) {
      const g = reps.find((r) => r.rep.id === item.offer.id)!;
      const ins = insights.get(item.offer.id)!;
      item.property = ins;
      for (const f of ins.flags) if (!item.flags.includes(f)) item.flags.push(f);
      if (ins.flags.includes('below_market'))
        item.notes.push(
          `rent per sqft is ${Math.round(ins.ratioToMedian! * 100)}% of the ${ins.medianBasis} median`,
        );
      if (ins.flags.includes('asks_for_payment_or_id'))
        item.notes.push('listing asks for money or ID documents before a visit: a common scam pattern');
      if (ins.flags.includes('no_photos')) item.notes.push('no photos');
      if (ins.flags.includes('stale'))
        item.notes.push(`posted ${ins.ageDays} days ago; may no longer be available`);
      item.alsoListedOn = g.others.map((o) => ({
        offerId: o.id,
        sourceName: o.provenance.sourceName,
        pricePaise: o.pricePaise,
        url: o.url,
      }));
      item.duplicateReason = g.reason;
    }
    const groups: OfferGroup[] = reps.map((r) => ({
      id: `g:${r.rep.id}`,
      label: r.rep.title,
      offerIds: [r.rep.id, ...r.others.map((o) => o.id)],
      possibleMatches: [],
      reasons: r.reason ? [{ a: r.rep.id, b: r.others[0]!.id, reason: r.reason }] : [],
    }));
    return { weights, results: sortRanked(ranked), groups };
  }

  const groups = groupOffers(offers);
  const groupOfId = new Map<string, string>();
  for (const g of groups) for (const id of g.offerIds) groupOfId.set(id, g.id);
  const results = rankOffers(offers, { weights, groupOf: (id) => groupOfId.get(id) ?? null });
  return { weights, results, groups };
}
