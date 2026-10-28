import Anthropic from '@anthropic-ai/sdk';

export type Block =
  | { type: 'text'; text: string }
  | { type: 'tool_use'; id: string; name: string; input: unknown }
  | { type: string; [k: string]: unknown };

export interface TurnRequest {
  system: string;
  tools: Anthropic.Beta.BetaTool[];
  messages: Anthropic.Beta.BetaMessageParam[];
  maxTokens: number;
  onText?: (delta: string) => void;
}

export interface TurnResult {
  content: Block[];
  stopReason: string | null;
  usage: { inputTokens: number; outputTokens: number; cacheReadTokens: number; cacheWriteTokens: number };
  model: string;
}

export interface AgentModel {
  readonly name: string;
  readonly live: boolean;
  turn(req: TurnRequest): Promise<TurnResult>;
}

/** Anything with the SDK's `beta.messages.stream` (tests pass a fake). */
export type StreamingClient = Pick<Anthropic, 'beta'>;

/**
 * Claude via the Messages API: streaming, prompt caching on the system prompt and the tool list,
 * model id from env (ANTHROPIC_MODEL), and server-side refusal fallback ("default" routing,
 * which runs the requested model alone where fallbacks are not supported).
 */
export class ClaudeModel implements AgentModel {
  readonly live = true;
  constructor(
    private client: StreamingClient,
    readonly name: string,
    private effort: 'low' | 'medium' | 'high' = 'medium',
  ) {}

  async turn(req: TurnRequest): Promise<TurnResult> {
    const stream = this.client.beta.messages.stream({
      model: this.name,
      max_tokens: req.maxTokens,
      system: [{ type: 'text', text: req.system, cache_control: { type: 'ephemeral' } }],
      tools: req.tools,
      messages: req.messages,
      output_config: { effort: this.effort },
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
    });
    if (req.onText) stream.on('text', req.onText);
    const msg = await stream.finalMessage();
    return {
      content: msg.content as unknown as Block[],
      stopReason: msg.stop_reason,
      usage: {
        inputTokens: msg.usage.input_tokens,
        outputTokens: msg.usage.output_tokens,
        cacheReadTokens: msg.usage.cache_read_input_tokens ?? 0,
        cacheWriteTokens: msg.usage.cache_creation_input_tokens ?? 0,
      },
      model: msg.model,
    };
  }
}

export function claudeFromEnv(env: NodeJS.ProcessEnv = process.env): ClaudeModel | null {
  const model = env.ANTHROPIC_MODEL?.trim();
  const hasCreds = Boolean(env.ANTHROPIC_API_KEY || env.ANTHROPIC_AUTH_TOKEN || env.ANTHROPIC_PROFILE);
  if (!model || !hasCreds) return null;
  const effort = (['low', 'medium', 'high'] as const).find((e) => e === env.AGENT_EFFORT) ?? 'medium';
  return new ClaudeModel(new Anthropic(), model, effort);
}
