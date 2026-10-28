import { writeFileSync } from 'node:fs';
import { createFixtureAdapters } from '../src/adapters/fixture.ts';
import { ALL_CHENNAI_PINCODES } from '../src/adapters/fixture.ts';
import { LOCALITIES } from '../src/localities.ts';
import { extractAttrs, matchPair, type MatchDecision } from '../src/match/match.ts';
import { Offer, type ProductOffer } from '../src/schemas.ts';
import { HELDOUT_PAIRS } from './heldout-pairs.ts';

export interface LabelledPair {
  a: Offer;
  b: Offer;
  same: boolean;
  set: 'fixtures-shopping' | 'fixtures-grocery' | 'fixtures-food' | 'held-out';
  hardNegative: boolean;
}

const now = new Date('2026-10-28T10:00:00Z');
const ctx = { requestId: 'eval', now: () => now };

async function fixtureOffers(vertical: 'shopping' | 'grocery' | 'food'): Promise<Offer[]> {
  const out: Offer[] = [];
  for (const a of createFixtureAdapters()) {
    if (!a.capabilities.verticals.includes(vertical)) continue;
    const raws = await a.search(
      {
        vertical,
        q: '*',
        pincodes: ALL_CHENNAI_PINCODES,
        localityIds: LOCALITIES.map((l) => l.id),
        filters: {},
      },
      ctx,
    );
    out.push(...raws.map((r) => Offer.parse(a.normalise(r, ctx))));
  }
  return out;
}

/** Ground truth for fixtures: the item key encoded in the offer id. */
function itemKey(o: Offer): string {
  const ext = o.id.split(':')[1]!;
  return o.vertical === 'shopping' ? ext.replace(/-\d+$/, '') : o.vertical === 'food' ? ext : ext;
}

function titleOnlyOffer(id: string, title: string, brand: string): ProductOffer {
  const attrs = extractAttrs(title);
  return {
    id,
    vertical: 'shopping',
    title,
    url: 'https://example.com',
    pricePaise: 100,
    mrpPaise: null,
    fees: {
      deliveryPaise: 0,
      handlingPaise: 0,
      platformPaise: 0,
      packagingPaise: 0,
      taxesNotIncludedPaise: 0,
    },
    coupons: [],
    rating: null,
    etaMinutes: null,
    trust: { fulfilledByPlatform: null, returnPolicyDays: null, sellerRating: null },
    affiliate: false,
    provenance: {
      sourceId: 'eval',
      sourceName: 'eval',
      tier: 'fixture',
      observedAt: now.toISOString(),
      confidence: 1,
      isSample: true,
    },
    brand,
    model: '',
    category: 'eval',
    seller: null,
    variant: attrs,
    identifiers: { gtin: null, asin: null, mpn: null, modelNumber: null },
    deliversTo: null,
  };
}

export async function buildEvalSet(): Promise<LabelledPair[]> {
  const pairs: LabelledPair[] = [];
  for (const vertical of ['shopping', 'grocery', 'food'] as const) {
    const offers = await fixtureOffers(vertical);
    for (let i = 0; i < offers.length; i++) {
      for (let j = i + 1; j < offers.length; j++) {
        const a = offers[i]!;
        const b = offers[j]!;
        // Only pairs a matcher would actually be asked about (same brand / category / restaurant block).
        const block = (o: Offer) =>
          o.vertical === 'shopping'
            ? o.brand
            : o.vertical === 'grocery'
              ? o.category
              : o.vertical === 'food'
                ? o.restaurant.id
                : '';
        if (block(a) !== block(b)) continue;
        const same = itemKey(a) === itemKey(b);
        pairs.push({ a, b, same, set: `fixtures-${vertical}`, hardNegative: !same });
      }
    }
  }
  HELDOUT_PAIRS.forEach((p, i) =>
    pairs.push({
      a: titleOnlyOffer(`h${i}a`, p.a, p.brand),
      b: titleOnlyOffer(`h${i}b`, p.b, p.brand),
      same: p.same,
      set: 'held-out',
      hardNegative: !p.same,
    }),
  );
  return pairs;
}

export interface EvalMetrics {
  pairs: number;
  positives: number;
  tp: number;
  fp: number;
  fn: number;
  tn: number;
  possible: number;
  precision: number;
  recall: number;
  f1: number;
}

export function score(
  pairs: LabelledPair[],
): EvalMetrics & { errors: { a: string; b: string; same: boolean; got: MatchDecision; reason: string }[] } {
  let tp = 0,
    fp = 0,
    fn = 0,
    tn = 0,
    possible = 0;
  const errors: { a: string; b: string; same: boolean; got: MatchDecision; reason: string }[] = [];
  for (const p of pairs) {
    const r = matchPair(p.a, p.b);
    if (r.decision === 'possible') possible++;
    const predicted = r.decision === 'same';
    if (predicted && p.same) tp++;
    else if (predicted && !p.same) fp++;
    else if (!predicted && p.same) fn++;
    else tn++;
    if (predicted !== p.same)
      errors.push({ a: p.a.title, b: p.b.title, same: p.same, got: r.decision, reason: r.reason });
  }
  const precision = tp + fp === 0 ? 1 : tp / (tp + fp);
  const recall = tp + fn === 0 ? 1 : tp / (tp + fn);
  const f1 = precision + recall === 0 ? 0 : (2 * precision * recall) / (precision + recall);
  return { pairs: pairs.length, positives: tp + fn, tp, fp, fn, tn, possible, precision, recall, f1, errors };
}

// CLI: writes the report used as the Phase C gate.
if (import.meta.url === `file://${process.argv[1]}`) {
  const pairs = await buildEvalSet();
  const sets = ['fixtures-shopping', 'fixtures-grocery', 'fixtures-food', 'held-out'] as const;
  const fmt = (x: number) => x.toFixed(3);
  const all = score(pairs);
  let md = `# Phase C: matching evaluation\n\nGenerated by \`npm run eval:match\` on ${new Date().toISOString()}.\n\n`;
  md += `"Same" decisions count as positive predictions; "possible match" counts as not merged.\n\n`;
  md += `| Set | Pairs | Real matches | TP | FP | FN | TN | Possible | Precision | Recall | F1 |\n|---|---|---|---|---|---|---|---|---|---|---|\n`;
  for (const s of sets) {
    const m = score(pairs.filter((p) => p.set === s));
    md += `| ${s} | ${m.pairs} | ${m.positives} | ${m.tp} | ${m.fp} | ${m.fn} | ${m.tn} | ${m.possible} | ${fmt(m.precision)} | ${fmt(m.recall)} | ${fmt(m.f1)} |\n`;
  }
  md += `| **all** | **${all.pairs}** | ${all.positives} | ${all.tp} | ${all.fp} | ${all.fn} | ${all.tn} | ${all.possible} | **${fmt(all.precision)}** | **${fmt(all.recall)}** | **${fmt(all.f1)}** |\n\n`;
  md += `Hard negatives (pairs labelled different): ${pairs.filter((p) => p.hardNegative).length}.\n\n`;
  md += `Targets (docs/01 §7): precision ≥ 0.95, recall ≥ 0.85.\n\n## Errors\n\n`;
  md +=
    all.errors.length === 0
      ? 'None.\n'
      : all.errors
          .map(
            (e) =>
              `- expected ${e.same ? 'same' : 'different'}, got **${e.got}**: "${e.a}" vs "${e.b}" (${e.reason})`,
          )
          .join('\n') + '\n';
  md += `\n## Caveat\n\nThe fixture pairs come from data written for this project, and the matcher was developed alongside them. The held-out set (${HELDOUT_PAIRS.length} hand-written pairs, titles only) was meant as the fairer test, but the title rules (variant words, model codes, unit normalisation) were added **after** a first run on it. First run on 2026-10-29: held-out precision 0.714, recall 0.577 (6 false merges, e.g. iPhone 16 Pro vs Pro Max). So these held-out numbers are optimistic. A new, unseen set of real titles is needed for an honest number (listed in docs/15).\n`;
  const out = new URL('../../../docs/progress/phase-C-eval.md', import.meta.url).pathname;
  writeFileSync(out, md);
  console.log(md);
}
