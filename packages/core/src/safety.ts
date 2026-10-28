/**
 * Detects listing text that tries to instruct an AI or the user (rule 4). Detection is only for
 * flagging and tests: listing text is never treated as instructions whether or not it matches.
 */
const INJECTION_PATTERNS = [
  /ignore\s+(all\s+)?(previous|prior|above|earlier)\s+(instructions|rules|prompts?)/i,
  /\bsystem\s*(note|prompt|message)\b/i,
  /\b(note|message)\s+to\s+(the\s+)?(ai|assistant|model|llm)\b/i,
  /\brank\s+this\s+(offer|listing|item)\s+(first|#?1)\b/i,
  /\byou\s+are\s+now\b/i,
  /<\/?(system|instructions?)>/i,
];

export function looksLikeInjection(text: string): boolean {
  return INJECTION_PATTERNS.some((re) => re.test(text));
}

const SCAM_PATTERNS = [
  /\b(token|advance)\s+(amount|payment|advance)?\b.*\b(before|to (book|block))\b/i,
  /\bpay\b.*\b(before|in advance|upi|token)\b/i,
  /\bowner\s+(is\s+)?abroad\b/i,
  /\b(aadhaar|aadhar|pan)\s*(number|card)?\b/i,
];

export function looksLikeScamText(text: string): boolean {
  return SCAM_PATTERNS.some((re) => re.test(text));
}

// Control characters, zero-width and bidi-override characters (built from escapes so the source stays ASCII).
/* eslint-disable no-control-regex -- stripping control characters is the point */
const UNSAFE_CHARS = new RegExp(
  '[\\u0000-\\u001f\\u007f\\u200b-\\u200f\\u202a-\\u202e\\u2060-\\u2064\\ufeff]',
  'g',
);
/* eslint-enable no-control-regex */

/** Removes control and invisible formatting characters and caps length: for untrusted text shown to the model. */
export function sanitizeUntrusted(text: string, max = 300): string {
  const cleaned = text.replace(UNSAFE_CHARS, ' ').replace(/\s+/g, ' ').trim();
  return cleaned.length > max ? cleaned.slice(0, max) + '…' : cleaned;
}
