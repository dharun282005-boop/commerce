import { CORRIDORS, LOCALITIES } from './localities.ts';

/** Words that describe the request, not the item, so they should not be matched against titles. */
const STOPWORDS = new Set(
  (
    'a an the for to of in on at and or with near under upto up below within best cheapest cheap price prices ' +
    'deliver delivered delivery rs inr rupees min mins minutes find show me i want need get buy rent for sale ' +
    'chennai please some any'
  ).split(' '),
);

for (const l of LOCALITIES) for (const w of tokenizeRaw(l.name)) STOPWORDS.add(w);
for (const c of Object.values(CORRIDORS))
  for (const a of c.aliases) for (const w of tokenizeRaw(a)) STOPWORDS.add(w);

function tokenizeRaw(text: string): string[] {
  return text
    .toLowerCase()
    .normalize('NFKC')
    .replace(/[’']/g, '')
    .split(/[^\p{L}\p{N}]+/u)
    .filter(Boolean);
}

const UNIT_WORDS = new Set(['gb', 'tb', 'kg', 'g', 'ml', 'l', 'bhk', 'pc', 'pcs', 'mah', 'inch']);

/**
 * Lower-cases, splits, joins numbers with following units ("128 GB" -> "128gb" + "gb", "2 BHK" -> "2bhk" + "bhk")
 * and applies a light plural rule ("eggs" -> "egg").
 */
export function tokenize(text: string): string[] {
  const raw = tokenizeRaw(text);
  const out: string[] = [];
  for (let i = 0; i < raw.length; i++) {
    const t = raw[i]!;
    const next = raw[i + 1];
    if (/^\d+$/.test(t) && next && UNIT_WORDS.has(next)) {
      out.push(t + next, next);
      i++;
      continue;
    }
    out.push(stem(t));
  }
  return out;
}

function stem(t: string): string {
  if (t.length > 3 && t.endsWith('s') && !t.endsWith('ss') && !/\d/.test(t)) return t.slice(0, -1);
  return t;
}

/** Tokens from a user query that must all appear in an item for it to match. */
export function queryTokens(q: string): string[] {
  return tokenize(q).filter((t) => !STOPWORDS.has(t) && !/^\d+$/.test(t));
}

/** True when every query token appears in the item's text. Empty queries match everything. */
export function matchesAll(qTokens: string[], itemText: string): boolean {
  if (qTokens.length === 0) return true;
  const have = new Set(tokenize(itemText));
  return qTokens.every((t) => have.has(t));
}
