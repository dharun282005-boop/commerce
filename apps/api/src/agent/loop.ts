import type Anthropic from '@anthropic-ai/sdk';
import type { Services } from '../services.ts';
import type { AgentModel, Block } from './models.ts';
import { SYSTEM_PROMPT } from './prompt.ts';
import { executeTool, newFacts, toolDefinitions, type GroundingFacts } from './tools.ts';

export interface AgentLimits {
  maxToolCalls: number;
  maxModelTurns: number;
  /** Per model call. */
  maxTokensPerTurn: number;
  /** Across the whole request (all model calls). */
  maxOutputTokensTotal: number;
}

export const DEFAULT_LIMITS: AgentLimits = {
  maxToolCalls: 8,
  maxModelTurns: 6,
  maxTokensPerTurn: 8000,
  maxOutputTokensTotal: 20000,
};

export type AgentEvent =
  | { type: 'status'; model: string; live: boolean }
  | { type: 'text'; delta: string }
  | { type: 'tool_call'; id: string; name: string; input: unknown }
  | { type: 'tool_result'; id: string; name: string; ok: boolean; summary: string }
  | { type: 'done'; result: AgentResult };

export interface Card {
  offerId: string;
  title: string;
  /** Always taken from tool results, never from model text. */
  landedRs: number;
  priceRs: number;
  sourceName: string;
  observedAt: string;
  url: string;
  isSample: boolean;
  flags: string[];
  why: string;
}

export interface AgentResult {
  text: string;
  cards: Card[];
  toolCalls: { name: string; input: unknown; ok: boolean }[];
  grounding: {
    ok: boolean;
    /** ₹ amounts in the answer that did not appear in any tool result or in the user's message. */
    ungroundedAmounts: number[];
    /** Cards the model proposed with offer ids that no tool returned (dropped). */
    droppedCards: string[];
  };
  stopReason: string;
  limitsHit: string[];
  usage: { inputTokens: number; outputTokens: number; cacheReadTokens: number; cacheWriteTokens: number };
  model: string;
  live: boolean;
  /** Session history to send back next turn (kept server-side, in memory only). */
  history: Anthropic.Beta.BetaMessageParam[];
}

const CARDS_RE = /```json\s*(\{[\s\S]*?\})\s*```\s*$/;

/** ₹ / Rs amounts mentioned in text. */
export function amountsIn(text: string): number[] {
  const out: number[] = [];
  for (const m of text.matchAll(/(?:₹|\brs\.?|\binr)\s*([\d,]+(?:\.\d{1,2})?)/gi)) {
    const n = Number(m[1]!.replace(/,/g, ''));
    if (Number.isFinite(n)) out.push(n);
  }
  return out;
}

/** Checks the model's answer against what tools returned this turn (rule 3). */
export function groundAnswer(raw: string, facts: GroundingFacts, userText: string) {
  const match = raw.match(CARDS_RE);
  const text = (match ? raw.slice(0, match.index) : raw).trim();
  let proposed: { offer_id?: unknown; why?: unknown }[] = [];
  if (match) {
    try {
      const parsed = JSON.parse(match[1]!) as { cards?: unknown };
      if (Array.isArray(parsed.cards)) proposed = parsed.cards.slice(0, 5) as typeof proposed;
    } catch {
      /* malformed block: no cards */
    }
  }
  const cards: Card[] = [];
  const dropped: string[] = [];
  for (const c of proposed) {
    const id = typeof c.offer_id === 'string' ? c.offer_id : '';
    const f = facts.offers.get(id);
    if (!f) {
      dropped.push(id || '(missing id)');
      continue;
    }
    cards.push({
      offerId: id,
      title: f.title,
      landedRs: f.landedRs,
      priceRs: f.priceRs,
      sourceName: f.sourceName,
      observedAt: f.observedAt,
      url: f.url,
      isSample: f.isSample,
      flags: f.flags,
      why: typeof c.why === 'string' ? c.why.slice(0, 200) : '',
    });
  }
  const userAmounts = new Set(
    amountsIn(userText).concat(
      [...userText.matchAll(/\b\d[\d,]*\b/g)].map((m) => Number(m[0].replace(/,/g, ''))),
    ),
  );
  const near = (n: number) => [...facts.amounts].some((a) => Math.abs(a - n) < 0.01) || userAmounts.has(n);
  const ungrounded = amountsIn(text).filter((n) => !near(n));
  return { text, cards, ungrounded, dropped };
}

export interface RunInput {
  message: string;
  history?: Anthropic.Beta.BetaMessageParam[];
  /** Only sent by the client when the user consented to saving them. */
  preferences?: { locality?: string; budgetRs?: number; vegOnly?: boolean };
}

export async function runAgent(
  input: RunInput,
  deps: {
    model: AgentModel;
    services: Services;
    requestId: string;
    now: () => Date;
    limits?: Partial<AgentLimits>;
  },
  emit: (e: AgentEvent) => void = () => {},
): Promise<AgentResult> {
  const limits = { ...DEFAULT_LIMITS, ...deps.limits };
  const tools = toolDefinitions();
  const facts = newFacts();
  const prefs = input.preferences;
  const prefLine =
    prefs && Object.keys(prefs).length
      ? `User preferences (saved with consent): ${[prefs.locality && `locality ${prefs.locality}`, prefs.budgetRs && `budget ₹${prefs.budgetRs}`, prefs.vegOnly && 'veg only'].filter(Boolean).join(', ')}\n`
      : '';
  const userText = `${prefLine}${input.message}`;
  const messages: Anthropic.Beta.BetaMessageParam[] = [
    ...(input.history ?? []),
    { role: 'user', content: userText },
  ];
  const usage = { inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0 };
  const toolCalls: AgentResult['toolCalls'] = [];
  const limitsHit: string[] = [];
  let finalText = '';
  let stopReason = 'end_turn';
  let modelName = deps.model.name;

  emit({ type: 'status', model: deps.model.name, live: deps.model.live });

  for (let turn = 0; turn < limits.maxModelTurns; turn++) {
    const remaining = limits.maxOutputTokensTotal - usage.outputTokens;
    if (remaining <= 0) {
      limitsHit.push('output_tokens');
      break;
    }
    const res = await deps.model.turn({
      system: SYSTEM_PROMPT,
      tools,
      messages,
      maxTokens: Math.min(limits.maxTokensPerTurn, remaining),
      onText: (d) => emit({ type: 'text', delta: d }),
    });
    modelName = res.model;
    usage.inputTokens += res.usage.inputTokens;
    usage.outputTokens += res.usage.outputTokens;
    usage.cacheReadTokens += res.usage.cacheReadTokens;
    usage.cacheWriteTokens += res.usage.cacheWriteTokens;
    stopReason = res.stopReason ?? 'end_turn';
    messages.push({ role: 'assistant', content: res.content as Anthropic.Beta.BetaContentBlockParam[] });

    if (stopReason === 'refusal') {
      finalText = "I can't help with that request.";
      break;
    }
    const uses = res.content.filter(
      (b): b is Extract<Block, { type: 'tool_use' }> & { id: string; name: string } => b.type === 'tool_use',
    );
    if (uses.length === 0 || stopReason === 'max_tokens') {
      finalText = res.content.map((b) => (b.type === 'text' ? (b as { text: string }).text : '')).join('');
      if (stopReason === 'max_tokens') limitsHit.push('max_tokens');
      break;
    }

    const results: Anthropic.Beta.BetaToolResultBlockParam[] = [];
    for (const u of uses) {
      emit({ type: 'tool_call', id: u.id, name: u.name, input: u.input });
      if (toolCalls.length >= limits.maxToolCalls) {
        if (!limitsHit.includes('tool_calls')) limitsHit.push('tool_calls');
        results.push({
          type: 'tool_result',
          tool_use_id: u.id,
          is_error: true,
          content: JSON.stringify({
            error: 'tool-call limit reached for this request; answer with what you already have',
          }),
        });
        emit({ type: 'tool_result', id: u.id, name: u.name, ok: false, summary: 'limit reached' });
        continue;
      }
      const r = await executeTool(u.name, u.input, {
        services: deps.services,
        requestId: deps.requestId,
        now: deps.now,
        facts,
      });
      toolCalls.push({ name: u.name, input: u.input, ok: r.ok });
      results.push({
        type: 'tool_result',
        tool_use_id: u.id,
        is_error: !r.ok,
        content: JSON.stringify(r.result),
      });
      emit({ type: 'tool_result', id: u.id, name: u.name, ok: r.ok, summary: summarize(r.result) });
    }
    messages.push({ role: 'user', content: results });
    if (turn === limits.maxModelTurns - 1) limitsHit.push('model_turns');
  }

  if (!finalText && limitsHit.length)
    finalText = 'I stopped early because this request hit a safety limit. Here is what I could check.';
  const g = groundAnswer(finalText, facts, userText);
  const result: AgentResult = {
    text: g.text,
    cards: g.cards,
    toolCalls,
    grounding: {
      ok: g.ungrounded.length === 0 && g.dropped.length === 0,
      ungroundedAmounts: g.ungrounded,
      droppedCards: g.dropped,
    },
    stopReason,
    limitsHit,
    usage,
    model: modelName,
    live: deps.model.live,
    history: messages,
  };
  emit({ type: 'done', result });
  return result;
}

function summarize(result: unknown): string {
  const r = result as Record<string, unknown>;
  if (r.error) return String(r.error).slice(0, 120);
  if (Array.isArray(r.results)) {
    const sources = (r.sources as { status: string }[] | undefined) ?? [];
    return `${String(r.total_results ?? r.results.length)} offers from ${sources.filter((s) => s.status === 'ok').length} sources${sources.some((s) => s.status === 'unavailable') ? ' (some unavailable)' : ''}`;
  }
  if (r.orders) return `cart split across ${(r.orders as unknown[]).length} platform(s)`;
  if (r.points !== undefined) return `${String(r.points)} price points`;
  if (r.found !== undefined) return r.found ? `found ${String(r.label)}` : 'not in Chennai';
  return 'done';
}
