import { CORRIDORS, LOCALITIES, formatINR, queryTokens } from '@cuc/core';
import type Anthropic from '@anthropic-ai/sdk';
import type { AgentModel, Block, TurnRequest, TurnResult } from './models.ts';

/**
 * Offline, deterministic planner with the same interface as Claude. It parses the request with
 * rules, calls the same read-only tools, and writes the answer only from tool results.
 * Used when no API key / model is configured, and as the baseline for `npm run eval`.
 * It is NOT a language model: it understands only the phrasings below.
 */

export const CLARIFY_MARKER = 'Which part of Chennai';
const OTHER_CITIES = [
  'bengaluru',
  'bangalore',
  'mumbai',
  'bombay',
  'delhi',
  'new delhi',
  'hyderabad',
  'pune',
  'kolkata',
  'calcutta',
  'coimbatore',
  'madurai',
  'trichy',
  'tiruchirappalli',
  'salem',
  'kochi',
  'cochin',
  'ahmedabad',
  'jaipur',
  'noida',
  'gurgaon',
  'gurugram',
];

type Plan =
  | { kind: 'clarify' }
  | { kind: 'out_of_area'; city: string }
  | {
      kind: 'tools';
      calls: { name: string; input: Record<string, unknown> }[];
      then?: 'history' | 'explain';
    };

const lower = (s: string) => s.toLowerCase();

export function findLocality(text: string): string | null {
  const t = ` ${lower(text).replace(/[^a-z0-9஀-௿ ]+/g, ' ')} `;
  const pin = text.match(/\b6000\d{2}\b|\b60[01]\d{3}\b/);
  if (pin && LOCALITIES.some((l) => l.pincode === pin[0])) return pin[0];
  for (const [id, c] of Object.entries(CORRIDORS)) {
    for (const a of [id, ...c.aliases]) if (t.includes(` ${a} `)) return id;
  }
  // Longest names first, so "Anna Nagar" wins over a shorter match.
  const names = LOCALITIES.flatMap((l) =>
    [l.name, ...l.aliases, l.nameTa].map((n) => ({
      n: lower(n)
        .replace(/[^a-z0-9஀-௿ ]+/g, ' ')
        .trim(),
      id: l.name,
    })),
  ).sort((a, b) => b.n.length - a.n.length);
  for (const { n, id } of names) if (n && t.includes(` ${n} `)) return id;
  return null;
}

export function findOtherCity(text: string): string | null {
  const t = ` ${lower(text).replace(/[^a-z ]+/g, ' ')} `;
  return OTHER_CITIES.find((c) => t.includes(` ${c} `)) ?? null;
}

function budgetRs(text: string): number | undefined {
  const m = lower(text).match(
    /(?:under|below|upto|up to|within|max(?:imum)?|less than|budget(?: of)?|<)\s*(?:rs\.?|₹|inr)?\s*([\d,]+(?:\.\d+)?)\s*(k|lakh|lakhs|l)?\b/,
  );
  if (!m) return undefined;
  let n = Number(m[1]!.replace(/,/g, ''));
  if (m[2] === 'k') n *= 1000;
  if (m[2] && m[2].startsWith('l')) n *= 100000;
  return n > 0 ? n : undefined;
}

function preset(text: string): string | undefined {
  const t = lower(text);
  if (/\b(fastest|quickest|asap|urgent)\b/.test(t)) return 'fastest';
  if (/\b(best rated|top rated|highest rated|best reviewed)\b/.test(t)) return 'best_rated';
  if (/\b(cheapest|lowest price|lowest|cheap|best price|best deal)\b/.test(t)) return 'cheapest';
  return undefined;
}

const FOOD =
  /\b(biryani|dosa|idli|vada|pongal|meals?|curry|tiffin|food|dinner|lunch|breakfast|restaurant|paneer|chicken|mutton|fish|curd rice|parotta|thali|order food|pizza|burger|sushi|platter|noodles|fried rice|shawarma|milkshake|shake|juice|dessert|ice cream|snacks?)\b/;
const GROCERY =
  /\b(grocer(y|ies)|rice|milk|eggs?|atta|salt|onions?|tomato(es)?|butter|vegetables|kirana|quick commerce|instamart)\b/;
const PROPERTY = /\b(\d\s*bhk|bhk|rent|rental|flat|apartment|house|villa|lease|property|sqft|pg)\b/;

export function detectVertical(text: string): 'shopping' | 'food' | 'grocery' | 'property' {
  const t = lower(text);
  if (PROPERTY.test(t) && !/\brent(ed)? (a )?(car|bike)\b/.test(t)) return 'property';
  if (FOOD.test(t) && !/\b(kg|litre|liter|\d+\s*l\b)/.test(t)) return 'food';
  if (GROCERY.test(t)) return 'grocery';
  return 'shopping';
}

/** Words that describe the request rather than the item (removed from the search text). */
const FILTER_WORDS =
  /\b(phones?|mobiles?|offers?|where|is|are|what|which|how|much|does|cost|costs|compare|comparison|prices|live|im|my|the|a|an|at|of|on|can|you|tell|top|why|ranked|first|history|trend|last|days|over|chart|metro|route|bus|semi|furnished|fully|unfurnished|delivered|delivery|deliver|in|min|mins|minutes|for|cheapest|cheap|best|price|rated|fastest|find|me|show|please|want|need|get|order|buy|under|below|upto|up|to|within|rs|inr|near|veg-only|only)\b/g;

export function planFromText(text: string, clarifiedBefore: boolean): Plan {
  const other = findOtherCity(text);
  const loc = findLocality(text);
  if (other && !loc) return { kind: 'out_of_area', city: other };
  const locality = loc ?? (clarifiedBefore ? 'T Nagar' : null);
  if (!locality) return { kind: 'clarify' };

  const t = lower(text);
  const vertical = detectVertical(text);
  const p = preset(text);
  const then = /\b(history|trend|last (30|90) days|price chart)\b/.test(t)
    ? 'history'
    : /\bwhy\b.*\b(first|#1|top|number one|ranked)\b/.test(t)
      ? 'explain'
      : undefined;
  const budget = budgetRs(text);
  const clean = (s: string) =>
    queryTokens(s.toLowerCase().replace(FILTER_WORDS, ' '))
      .filter((w) => !['cheap', 'cheapest', 'price', 'best', 'veg'].includes(w))
      .join(' ');

  if (vertical === 'property') {
    const bhk = t.match(/(\d)\s*bhk/);
    const furnishing = /semi[- ]?furnished/.test(t)
      ? 'semi-furnished'
      : /\bunfurnished\b/.test(t)
        ? 'unfurnished'
        : /\b(fully )?furnished\b/.test(t)
          ? 'furnished'
          : undefined;
    const listing = /\b(buy|purchase|for sale|sale)\b/.test(t) ? 'buy' : 'rent';
    return {
      kind: 'tools',
      calls: [
        {
          name: 'search_properties',
          input: {
            locality,
            ...(bhk ? { bhk: Number(bhk[1]) } : {}),
            listing_type: listing,
            ...(furnishing ? { furnishing } : {}),
            ...(budget ? { max_price_rs: budget } : {}),
            ...(p ? { preset: p } : {}),
          },
        },
      ],
      then,
    };
  }
  if (vertical === 'grocery') {
    const items = text
      .split(/,|\n|;|\band\b/i)
      .map((s) => s.replace(/^.*?:/, '').trim())
      .filter((s) => /[a-z]/i.test(s) && GROCERY.test(lower(s)));
    if (items.length >= 2 || /\b(split|list|weekly|basket|cart)\b/.test(t)) {
      return {
        kind: 'tools',
        calls: [{ name: 'plan_cart', input: { list: items.join(', ') || clean(text), locality } }],
      };
    }
    return {
      kind: 'tools',
      calls: [
        {
          name: 'search_grocery',
          input: { query: clean(text) || 'groceries', locality, ...(p ? { preset: p } : {}) },
        },
      ],
      then,
    };
  }
  if (vertical === 'food') {
    const veg = /\b(veg|vegetarian|pure veg)\b/.test(t) && !/\bnon[- ]?veg\b/.test(t);
    const servings = t.match(/\b(?:for|serves)\s+(\d{1,2})\b/);
    const eta = t.match(/\b(\d{2,3})\s*(?:min|mins|minutes)\b/);
    const dishWords = clean(text);
    return {
      kind: 'tools',
      calls: [
        {
          name: 'search_food',
          input: {
            query: [veg && !/\bveg\b/.test(dishWords) ? '' : '', dishWords || 'meals'].join(' ').trim(),
            locality,
            ...(veg ? { veg_only: true } : {}),
            ...(servings ? { min_servings: Number(servings[1]) } : {}),
            ...(eta ? { max_eta_minutes: Number(eta[1]) } : {}),
            ...(budget ? { max_price_rs: budget } : {}),
            ...(p ? { preset: p } : {}),
          },
        },
      ],
      then,
    };
  }
  return {
    kind: 'tools',
    calls: [
      {
        name: 'search_products',
        input: {
          query: clean(text) || text.slice(0, 100),
          locality,
          ...(budget ? { max_price_rs: budget } : {}),
          ...(p ? { preset: p } : {}),
        },
      },
    ],
    then,
  };
}

// ---------- reading the conversation ----------

type Msg = Anthropic.Beta.BetaMessageParam;

const textOf = (m: Msg): string =>
  typeof m.content === 'string'
    ? m.content
    : (m.content ?? []).map((b) => (b.type === 'text' ? b.text : '')).join('');

function lastUserText(messages: Msg[]): { text: string; clarifiedBefore: boolean } {
  const users = messages.filter((m) => m.role === 'user' && textOf(m).trim());
  const last = users.at(-1);
  const prevAssistant = [...messages].reverse().find((m) => m.role === 'assistant');
  const clarified = prevAssistant ? textOf(prevAssistant).includes(CLARIFY_MARKER) : false;
  let text = last ? textOf(last) : '';
  // After our one clarifying question, combine the original request with the answer.
  if (clarified && users.length >= 2) text = `${textOf(users.at(-2)!)} ${text}`;
  return { text: text.replace(/^User preferences[^\n]*\n/, ''), clarifiedBefore: clarified };
}

interface ToolResultsView {
  name: string;
  input: Record<string, unknown>;
  result: Record<string, unknown>;
  isError: boolean;
}

/** Tool calls since the latest user text message. */
function recentToolResults(messages: Msg[]): ToolResultsView[] {
  const out: ToolResultsView[] = [];
  let start = 0;
  messages.forEach((m, i) => {
    if (m.role !== 'user') return;
    if (typeof m.content === 'string' || (m.content ?? []).some((b) => b.type === 'text')) start = i;
  });
  const uses = new Map<string, { name: string; input: Record<string, unknown> }>();
  for (const m of messages.slice(start)) {
    if (typeof m.content === 'string') continue;
    for (const b of m.content ?? []) {
      if (b.type === 'tool_use') uses.set(b.id, { name: b.name, input: b.input as Record<string, unknown> });
      if (b.type === 'tool_result') {
        const u = uses.get(b.tool_use_id);
        const raw =
          typeof b.content === 'string'
            ? b.content
            : (b.content ?? []).map((c) => (c.type === 'text' ? c.text : '')).join('');
        let result: Record<string, unknown>;
        try {
          result = JSON.parse(raw);
        } catch {
          result = { error: raw };
        }
        if (u) out.push({ ...u, result, isError: Boolean(b.is_error) });
      }
    }
  }
  return out;
}

// ---------- writing the answer ----------

const money = (rs: number) => formatINR(Math.round(rs * 100));
const DEMOTING = ['price_anomaly', 'suspicious_text', 'below_market', 'asks_for_payment_or_id'];

interface ShapedResult {
  offer_id: string;
  name: { untrusted_text: string };
  source: string;
  sample_data: boolean;
  checked_minutes_ago: number;
  landed_total_rs: number;
  fees_unknown: boolean;
  eta_minutes: number | null;
  flags: string[];
  bhk?: number;
  area_sqft?: number;
  furnishing?: string;
  locality?: string;
  also_listed_on?: string[];
}

function describe(r: ShapedResult): string {
  // Listings whose text tries to instruct software are not quoted at all.
  const name = r.flags.includes('suspicious_text')
    ? '[listing name hidden: it contains instructions aimed at software]'
    : r.name.untrusted_text;
  const fresh = `checked ${r.checked_minutes_ago} min ago`;
  const eta =
    r.eta_minutes !== null && r.eta_minutes !== undefined
      ? `, about ${r.eta_minutes < 120 ? `${r.eta_minutes} min` : `${Math.round(r.eta_minutes / 60)} h`}`
      : '';
  const fees = r.fees_unknown ? ' (delivery fees not known yet)' : '';
  const prop = r.bhk
    ? ` (${r.bhk} BHK, ${r.area_sqft} sqft, ${r.furnishing}${r.also_listed_on?.length ? `, also on ${r.also_listed_on.join(', ')}` : ''})`
    : '';
  return `${name}${prop}: ${money(r.landed_total_rs)}${r.bhk ? '/month' : ' total'}${fees} on ${r.source}${eta}, ${fresh}`;
}

function answerFromResults(views: ToolResultsView[]): {
  text: string;
  cards: { offer_id: string; why: string }[];
} {
  const lines: string[] = [];
  const cards: { offer_id: string; why: string }[] = [];
  let sample = false;
  for (const v of views) {
    const res = v.result;
    if (v.isError) {
      lines.push(
        `I could not complete that search: ${String((res as { error?: string }).error ?? 'unknown error')}.`,
      );
      continue;
    }
    sample ||= Boolean(res.sample_data);
    const unavailable = ((res.sources as { source: string; status: string }[] | undefined) ?? [])
      .filter((s) => s.status === 'unavailable')
      .map((s) => s.source);
    if (v.name === 'plan_cart') {
      const orders = res.orders as {
        source: string;
        items: { name: { untrusted_text: string }; packs: number }[];
        total_rs: number;
        fees_rs: number;
      }[];
      if (!res.feasible || orders.length === 0) {
        lines.push("I couldn't build a valid cart for that list from the sources I can see.");
      } else {
        lines.push(
          `Cheapest way to buy your list in ${String(res.area)}: ${money(res.total_rs as number)} in total.`,
        );
        for (const o of orders)
          lines.push(
            `- ${o.source}: ${o.items.map((i) => `${i.packs} × ${i.name.untrusted_text}`).join(', ')} = ${money(o.total_rs)} (fees ${money(o.fees_rs)})`,
          );
        const single = res.single_platform_best as { source: string; total_rs: number } | null;
        if (single && single.total_rs > (res.total_rs as number))
          lines.push(`Buying everything on one app would cost at least ${money(single.total_rs)}.`);
      }
      const nf = (res.not_found as string[]).filter(Boolean);
      if (nf.length) lines.push(`Not found on any source: ${nf.join(', ')}.`);
      continue;
    }
    if (v.name === 'get_price_history') {
      if (!res.points) lines.push('There is no price history for that offer yet.');
      else
        lines.push(
          `Over the last ${String(res.days)} days the price ranged from ${money(res.min_rs as number)} to ${money(res.max_rs as number)}${res.sample_data ? ' (sample history)' : ''}.`,
        );
      continue;
    }
    if (v.name === 'explain_ranking') {
      lines.push(
        `Why it is ranked #${String(res.rank)} of ${String(res.of)}:`,
        ...(res.explanation as string[]).map((l) => `- ${l}`),
      );
      continue;
    }
    if (v.name === 'get_locality_info') {
      lines.push(res.found ? `${String(res.label)} is in Chennai.` : String(res.message));
      continue;
    }
    // Searches
    const results = (res.results as ShapedResult[] | undefined) ?? [];
    if (results.length === 0) {
      lines.push(
        `I couldn't find any matching offers in ${String(res.area)}. I won't guess a price; try a broader search or another locality.`,
      );
    } else {
      const clean = results.filter((r) => !r.flags.some((f) => DEMOTING.includes(f)));
      const flagged = results.filter((r) => r.flags.some((f) => DEMOTING.includes(f)));
      lines.push(
        `Here is what I found in ${String(res.area)} (${String(res.total_results)} offers), best value first:`,
      );
      clean.slice(0, 3).forEach((r, i) => {
        lines.push(`${i + 1}. ${describe(r)}`);
        cards.push({
          offer_id: r.offer_id,
          why: i === 0 ? 'Best overall value in these results' : 'Good alternative',
        });
      });
      if (flagged.length)
        lines.push(
          `I left out ${flagged.length} listing(s) with warnings (${[...new Set(flagged.flatMap((r) => r.flags.filter((f) => DEMOTING.includes(f))))].join(', ').replace(/_/g, ' ')}). Don't pay anyone in advance or share ID documents.`,
        );
    }
    if (unavailable.length)
      lines.push(
        `Not checked: ${unavailable.join(', ')} ${unavailable.length > 1 ? 'were' : 'was'} unavailable just now.`,
      );
  }
  if (sample) lines.push('Note: these are sample prices, not live prices. Prices can change at checkout.');
  return { text: lines.join('\n'), cards };
}

let counter = 0;

export class ScriptedModel implements AgentModel {
  readonly name = 'offline-planner';
  readonly live = false;

  async turn(req: TurnRequest): Promise<TurnResult> {
    const usage = { inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0 };
    const last = req.messages.at(-1);
    const views = recentToolResults(req.messages);
    const lastIsToolResult =
      last &&
      last.role === 'user' &&
      typeof last.content !== 'string' &&
      (last.content ?? []).some((b) => b.type === 'tool_result');

    if (lastIsToolResult) {
      // Follow-up step (history or explanation of the top result), then answer.
      const first = views[0];
      const firstResults = (first?.result.results as ShapedResult[] | undefined) ?? [];
      const top = firstResults.find((r) => !r.flags.some((f) => DEMOTING.includes(f)));
      const { text } = lastUserText(req.messages);
      const plan = planFromText(text, true);
      if (views.length === 1 && top && plan.kind === 'tools' && plan.then === 'history') {
        return this.toolTurn(
          [{ name: 'get_price_history', input: { offer_id: top.offer_id, days: /90/.test(text) ? 90 : 30 } }],
          usage,
        );
      }
      if (views.length === 1 && top && plan.kind === 'tools' && plan.then === 'explain') {
        const c = plan.calls[0]!;
        const vertical =
          c.name === 'search_food'
            ? 'food'
            : c.name === 'search_grocery'
              ? 'grocery'
              : c.name === 'search_properties'
                ? 'property'
                : 'shopping';
        const query =
          (c.input.query as string | undefined) ?? (c.input.bhk ? `${String(c.input.bhk)} bhk` : 'bhk');
        return this.toolTurn(
          [
            {
              name: 'explain_ranking',
              input: {
                vertical,
                query,
                locality: c.input.locality,
                offer_id: top.offer_id,
                ...(c.input.preset ? { preset: c.input.preset } : {}),
              },
            },
          ],
          usage,
        );
      }
      const { text: answer, cards } = answerFromResults(views);
      return this.textTurn(`${answer}\n\n\`\`\`json\n${JSON.stringify({ cards })}\n\`\`\``, req, usage);
    }

    const { text, clarifiedBefore } = lastUserText(req.messages);
    const plan = planFromText(text, clarifiedBefore);
    if (plan.kind === 'clarify') {
      return this.textTurn(
        `${CLARIFY_MARKER} should I check? Tell me a locality or pincode (for example Adyar, Velachery or 600017).\n\n\`\`\`json\n{"cards":[]}\n\`\`\``,
        req,
        usage,
      );
    }
    if (plan.kind === 'out_of_area') {
      const city = plan.city.replace(/\b\w/g, (c) => c.toUpperCase());
      return this.textTurn(
        `Sorry, this service covers Chennai only, so I can't check ${city}. If you like, tell me a Chennai locality (for example T Nagar or Velachery) and I'll search there.\n\n\`\`\`json\n{"cards":[]}\n\`\`\``,
        req,
        usage,
      );
    }
    const note =
      !findLocality(text) && clarifiedBefore ? 'No locality given, so I used T Nagar as the default.\n' : '';
    if (note) req.onText?.(note);
    return this.toolTurn(plan.calls, usage);
  }

  private toolTurn(
    calls: { name: string; input: Record<string, unknown> }[],
    usage: TurnResult['usage'],
  ): TurnResult {
    return {
      content: calls.map((c) => ({
        type: 'tool_use',
        id: `toolu_offline_${++counter}`,
        name: c.name,
        input: c.input,
      })) as Block[],
      stopReason: 'tool_use',
      usage,
      model: this.name,
    };
  }

  private textTurn(text: string, req: TurnRequest, usage: TurnResult['usage']): TurnResult {
    req.onText?.(text);
    return { content: [{ type: 'text', text }], stopReason: 'end_turn', usage, model: this.name };
  }
}
