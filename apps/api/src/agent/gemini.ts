import { FinishReason, GoogleGenAI, type Content, type FunctionDeclaration, type Part } from '@google/genai';
import type Anthropic from '@anthropic-ai/sdk';
import type { AgentModel, Block, TurnRequest, TurnResult } from './models.ts';

/**
 * Gemini via the official Google Gen AI SDK (@google/genai), behind the same AgentModel interface
 * as Claude. The agent loop keeps history in one format; this class converts it to Gemini
 * `contents` on every turn and converts the reply back.
 *
 * Function calling: tools are declared with `parametersJsonSchema` (same JSON Schemas as for Claude);
 * results go back as `functionResponse` parts. Gemini's `thoughtSignature` on returned parts is kept on
 * our blocks and sent back unchanged, as the Gemini docs require for multi-step function calling.
 */
type GenAIModels = Pick<GoogleGenAI['models'], 'generateContentStream'>;

let callCounter = 0;

export class GeminiModel implements AgentModel {
  readonly live = true;
  constructor(
    private models: GenAIModels,
    readonly name: string,
    /** Other models to try when one is overloaded (503/504), rate-limited (429) or retired (404). */
    private alternates: string[] = [],
  ) {}

  async turn(req: TurnRequest): Promise<TurnResult> {
    let lastErr: unknown;
    for (const model of [this.name, ...this.alternates]) {
      try {
        return await this.turnWith(model, req);
      } catch (err) {
        lastErr = err;
        const status = errorStatus(err);
        if (status !== null && ![404, 429, 500, 503, 504].includes(status)) throw err;
      }
    }
    throw lastErr;
  }

  private async turnWith(modelName: string, req: TurnRequest): Promise<TurnResult> {
    const stream = await this.models.generateContentStream({
      model: modelName,
      contents: toContents(req.messages),
      config: {
        systemInstruction: req.system,
        maxOutputTokens: req.maxTokens,
        tools: [{ functionDeclarations: req.tools.map(toDeclaration) }],
      },
    });

    const blocks: Block[] = [];
    let finish: FinishReason | undefined;
    const usage = { inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0 };
    let modelVersion = modelName;
    for await (const chunk of stream) {
      const cand = chunk.candidates?.[0];
      if (cand?.finishReason) finish = cand.finishReason;
      if (chunk.modelVersion) modelVersion = chunk.modelVersion;
      if (chunk.usageMetadata) {
        usage.inputTokens = chunk.usageMetadata.promptTokenCount ?? usage.inputTokens;
        usage.outputTokens =
          (chunk.usageMetadata.candidatesTokenCount ?? 0) + (chunk.usageMetadata.thoughtsTokenCount ?? 0);
        usage.cacheReadTokens = chunk.usageMetadata.cachedContentTokenCount ?? 0;
      }
      for (const part of cand?.content?.parts ?? []) {
        if (part.functionCall) {
          blocks.push({
            type: 'tool_use',
            id: part.functionCall.id ?? `gemini_call_${++callCounter}`,
            name: part.functionCall.name ?? '',
            input: part.functionCall.args ?? {},
            ...(part.thoughtSignature ? { thoughtSignature: part.thoughtSignature } : {}),
          });
        } else if (typeof part.text === 'string' && !part.thought) {
          req.onText?.(part.text);
          const last = blocks.at(-1);
          // Merge streamed text pieces into one text block.
          if (last && last.type === 'text' && !part.thoughtSignature)
            (last as { text: string }).text += part.text;
          else
            blocks.push({
              type: 'text',
              text: part.text,
              ...(part.thoughtSignature ? { thoughtSignature: part.thoughtSignature } : {}),
            });
        } else if (part.thoughtSignature) {
          // A signature on a thought-only part still has to go back to the model.
          blocks.push({ type: 'gemini_signature', thoughtSignature: part.thoughtSignature });
        }
      }
    }

    const hasCalls = blocks.some((b) => b.type === 'tool_use');
    const stopReason =
      finish === FinishReason.SAFETY ||
      finish === FinishReason.PROHIBITED_CONTENT ||
      finish === FinishReason.BLOCKLIST ||
      finish === FinishReason.SPII
        ? 'refusal'
        : finish === FinishReason.MAX_TOKENS
          ? 'max_tokens'
          : hasCalls
            ? 'tool_use'
            : 'end_turn';
    return { content: blocks, stopReason, usage, model: modelVersion };
  }
}

function toDeclaration(t: Anthropic.Beta.BetaTool): FunctionDeclaration {
  return { name: t.name, description: t.description, parametersJsonSchema: t.input_schema };
}

/** Converts the loop's history (Anthropic-style blocks) to Gemini contents. */
export function toContents(messages: Anthropic.Beta.BetaMessageParam[]): Content[] {
  const names = new Map<string, string>();
  const out: Content[] = [];
  for (const m of messages) {
    if (typeof m.content === 'string') {
      out.push({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.content }] });
      continue;
    }
    const parts: Part[] = [];
    for (const raw of m.content ?? []) {
      const b = raw as unknown as Record<string, unknown> & { type: string };
      const sig = typeof b.thoughtSignature === 'string' ? { thoughtSignature: b.thoughtSignature } : {};
      if (b.type === 'text') parts.push({ text: String(b.text), ...sig });
      else if (b.type === 'tool_use') {
        names.set(String(b.id), String(b.name));
        parts.push({
          functionCall: { id: String(b.id), name: String(b.name), args: b.input as Record<string, unknown> },
          ...sig,
        });
      } else if (b.type === 'gemini_signature') parts.push({ text: '', ...sig });
      else if (b.type === 'tool_result') {
        const text = typeof b.content === 'string' ? b.content : JSON.stringify(b.content);
        let response: Record<string, unknown>;
        try {
          const parsed = JSON.parse(text) as unknown;
          response = b.is_error ? { error: parsed } : { output: parsed };
        } catch {
          response = b.is_error ? { error: text } : { output: text };
        }
        const id = String(b.tool_use_id);
        parts.push({ functionResponse: { id, name: names.get(id) ?? 'unknown', response } });
      }
    }
    if (parts.length) out.push({ role: m.role === 'assistant' ? 'model' : 'user', parts });
  }
  return out;
}

/**
 * GEMINI_MODEL may list several models, comma-separated; they are tried in order when one is
 * overloaded or out of quota. Default: gemini-3.8-flash, then gemini-flash-latest.
 */
export function geminiFromEnv(env: NodeJS.ProcessEnv = process.env): GeminiModel | null {
  const key = env.GEMINI_API_KEY?.trim();
  if (!key) return null;
  const names = (env.GEMINI_MODEL?.trim() || 'gemini-3.8-flash,gemini-flash-latest')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  const timeout = Number(env.GEMINI_TIMEOUT_MS ?? 15_000);
  const models = new GoogleGenAI({ apiKey: key, httpOptions: { timeout } }).models;
  return new GeminiModel(models, names[0]!, names.slice(1));
}

/** HTTP status from an SDK error, if any. */
export function errorStatus(err: unknown): number | null {
  const e = err as { status?: number; code?: number; message?: string };
  if (typeof e?.status === 'number') return e.status;
  const m = typeof e?.message === 'string' ? e.message.match(/"code":\s*(\d{3})/) : null;
  return m ? Number(m[1]) : null;
}
