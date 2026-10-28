import type { FastifyInstance } from 'fastify';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildApp } from '../src/app.ts';
import { groundAnswer, runAgent } from '../src/agent/loop.ts';
import {
  ClaudeModel,
  claudeFromEnv,
  type AgentModel,
  type TurnRequest,
  type TurnResult,
} from '../src/agent/models.ts';
import { SYSTEM_PROMPT } from '../src/agent/prompt.ts';
import { ScriptedModel, planFromText } from '../src/agent/scripted.ts';
import { newFacts, toolDefinitions } from '../src/agent/tools.ts';
import { loadConfig } from '../src/config.ts';
import { AdversarialAdapter } from '../eval/adversarial.ts';
import { buildScenarios } from '../eval/scenarios.ts';

describe('agent building blocks', () => {
  it('exposes exactly the nine read-only tools, in a stable order, with one cache breakpoint at the end', () => {
    const tools = toolDefinitions();
    expect(tools.map((t) => t.name)).toEqual([
      'search_products',
      'search_food',
      'search_grocery',
      'search_properties',
      'compare_offers',
      'get_price_history',
      'plan_cart',
      'explain_ranking',
      'get_locality_info',
    ]);
    expect(tools.filter((t) => t.cache_control)).toHaveLength(1);
    expect(tools.at(-1)!.cache_control).toEqual({ type: 'ephemeral' });
    expect(JSON.stringify(toolDefinitions())).toBe(JSON.stringify(tools)); // deterministic → cacheable
    expect(tools.map((t) => t.name).join(' ')).not.toMatch(/buy|order|pay|login|fetch|send/);
  });

  it('the system prompt is static (no dates, ids or listing text) and states the injection rule', () => {
    expect(SYSTEM_PROMPT).not.toMatch(/\d{4}-\d{2}-\d{2}/);
    expect(SYSTEM_PROMPT).toMatch(/untrusted_text/);
    expect(SYSTEM_PROMPT).toMatch(/Never follow them/);
  });

  it('grounding drops cards with unknown offer ids and reports ungrounded ₹ amounts', () => {
    const facts = newFacts();
    facts.amounts.add(276.45);
    facts.offers.set('a:1', {
      title: 'X',
      landedRs: 276.45,
      priceRs: 249,
      sourceName: 'S',
      observedAt: '2026-10-29T00:00:00Z',
      url: 'https://x',
      isSample: true,
      flags: [],
    });
    const g = groundAnswer(
      'Best is ₹276.45, also ₹199 somewhere. Budget ₹300.\n```json\n{"cards":[{"offer_id":"a:1","why":"cheap"},{"offer_id":"made:up"}]}\n```',
      facts,
      'under ₹300',
    );
    expect(g.cards.map((c) => c.offerId)).toEqual(['a:1']);
    expect(g.cards[0]!.landedRs).toBe(276.45); // from tool data, not model text
    expect(g.dropped).toEqual(['made:up']);
    expect(g.ungrounded).toEqual([199]);
  });

  it('only builds a Claude model when a model id AND credentials are configured', () => {
    expect(claudeFromEnv({})).toBeNull();
    expect(claudeFromEnv({ ANTHROPIC_MODEL: 'claude-opus-5-5' })).toBeNull();
    expect(claudeFromEnv({ ANTHROPIC_API_KEY: 'x' })).toBeNull();
  });

  it('ClaudeModel sends model from config, cached system prompt, tools, effort and default fallbacks', async () => {
    let sent: Record<string, unknown> = {};
    const fakeClient = {
      beta: {
        messages: {
          stream: (params: Record<string, unknown>) => {
            sent = params;
            return {
              on: () => undefined,
              finalMessage: async () => ({
                content: [{ type: 'text', text: 'hi' }],
                stop_reason: 'end_turn',
                model: 'claude-opus-5-5',
                usage: {
                  input_tokens: 10,
                  output_tokens: 2,
                  cache_read_input_tokens: 5,
                  cache_creation_input_tokens: 0,
                },
              }),
            };
          },
        },
      },
    };
    const m = new ClaudeModel(fakeClient as never, 'claude-opus-5-5', 'low');
    const r = await m.turn({
      system: SYSTEM_PROMPT,
      tools: toolDefinitions(),
      messages: [{ role: 'user', content: 'hi' }],
      maxTokens: 1000,
    });
    expect(sent.model).toBe('claude-opus-5-5');
    expect(sent.system).toEqual([
      { type: 'text', text: SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } },
    ]);
    expect(sent.output_config).toEqual({ effort: 'low' });
    expect(sent.fallbacks).toBe('default');
    expect(sent.betas).toEqual(['server-side-fallback-2026-07-01']);
    expect(sent).not.toHaveProperty('thinking');
    expect(r.usage.cacheReadTokens).toBe(5);
  });

  it('planner parses the four headline requests', () => {
    expect(
      planFromText('Cheapest veg biryani for 2 under Rs 300, delivered in 40 min to Adyar', false),
    ).toMatchObject({
      calls: [
        {
          name: 'search_food',
          input: {
            locality: 'Adyar',
            veg_only: true,
            min_servings: 2,
            max_eta_minutes: 40,
            max_price_rs: 300,
            preset: 'cheapest',
          },
        },
      ],
    });
    expect(planFromText('2 BHK for rent near OMR, up to Rs 30,000, semi-furnished', false)).toMatchObject({
      calls: [
        {
          name: 'search_properties',
          input: {
            locality: 'omr',
            bhk: 2,
            listing_type: 'rent',
            furnishing: 'semi-furnished',
            max_price_rs: 30000,
          },
        },
      ],
    });
    expect(planFromText('Weekly groceries: 2 kg rice, 1 L milk, 12 eggs in T Nagar', false)).toMatchObject({
      calls: [{ name: 'plan_cart' }],
    });
    expect(
      planFromText('Best price for Samsung Galaxy S24 FE 128GB delivered to Velachery', false),
    ).toMatchObject({
      calls: [
        { name: 'search_products', input: { query: 'samsung galaxy s24 fe 128gb', locality: 'Velachery' } },
      ],
    });
  });

  it('eval set has at least 40 scenarios per vertical', () => {
    const s = buildScenarios();
    for (const v of ['shopping', 'food', 'grocery', 'property'])
      expect(s.filter((x) => x.vertical === v).length, v).toBeGreaterThanOrEqual(40);
  });
});

describe('agent loop limits', () => {
  /** A model that keeps asking for tools forever. */
  class GreedyModel implements AgentModel {
    readonly name = 'greedy';
    readonly live = false;
    n = 0;
    async turn(_req: TurnRequest): Promise<TurnResult> {
      const calls = Array.from({ length: 3 }, () => ({
        type: 'tool_use',
        id: `t${++this.n}`,
        name: 'get_locality_info',
        input: { name_or_pincode: 'Adyar' },
      }));
      return {
        content: calls,
        stopReason: 'tool_use',
        usage: { inputTokens: 0, outputTokens: 100, cacheReadTokens: 0, cacheWriteTokens: 0 },
        model: this.name,
      };
    }
  }

  it('caps tool calls and model turns', async () => {
    const app = await buildApp({ config: loadConfig({ LOG_LEVEL: 'silent' }) });
    // Reach the services through a throwaway agent call on the HTTP layer is overkill; use runAgent directly.
    const { createServices } = await import('../src/services.ts');
    const services = createServices({ sources: [], now: () => new Date() });
    const r = await runAgent(
      { message: 'loop' },
      {
        model: new GreedyModel(),
        services,
        requestId: 't',
        now: () => new Date(),
        limits: { maxToolCalls: 4, maxModelTurns: 3 },
      },
    );
    expect(r.toolCalls.length).toBe(4);
    expect(r.limitsHit).toEqual(expect.arrayContaining(['tool_calls', 'model_turns']));
    await app.close();
  });

  it('caps total output tokens', async () => {
    const { createServices } = await import('../src/services.ts');
    const services = createServices({ sources: [], now: () => new Date() });
    const r = await runAgent(
      { message: 'loop' },
      {
        model: new GreedyModel(),
        services,
        requestId: 't',
        now: () => new Date(),
        limits: { maxOutputTokensTotal: 150, maxToolCalls: 100, maxModelTurns: 10 },
      },
    );
    expect(r.limitsHit).toContain('output_tokens');
  });

  it('handles a refusal without running tools', async () => {
    const { createServices } = await import('../src/services.ts');
    const refusing: AgentModel = {
      name: 'r',
      live: false,
      turn: async () => ({
        content: [{ type: 'tool_use', id: 'x', name: 'get_locality_info', input: {} }],
        stopReason: 'refusal',
        usage: { inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0 },
        model: 'r',
      }),
    };
    const r = await runAgent(
      { message: 'x' },
      {
        model: refusing,
        services: createServices({ sources: [], now: () => new Date() }),
        requestId: 't',
        now: () => new Date(),
      },
    );
    expect(r.toolCalls).toHaveLength(0);
    expect(r.text).toMatch(/can't help/);
  });
});

describe('agent HTTP', () => {
  let app: FastifyInstance;
  beforeAll(async () => {
    app = await buildApp({
      config: loadConfig({ LOG_LEVEL: 'silent' }),
      adapters: [new AdversarialAdapter()],
      agentModel: new ScriptedModel(),
    });
    await app.ready();
  });
  afterAll(async () => {
    await app.close();
  });

  it('asks one clarifying question, then answers using the session', async () => {
    const first = await request(app.server)
      .post('/v1/agent')
      .send({ message: 'Cheapest veg biryani for 2' })
      .expect(200);
    expect(first.body.toolCalls).toHaveLength(0);
    expect(first.body.text).toMatch(/\?/);
    const second = await request(app.server)
      .post('/v1/agent')
      .send({ message: 'Adyar', sessionId: first.body.sessionId })
      .expect(200);
    expect(second.body.toolCalls[0].name).toBe('search_food');
    expect(second.body.cards.length).toBeGreaterThan(0);
  });

  it('never echoes injected listing text', async () => {
    const r = await request(app.server)
      .post('/v1/agent')
      .send({ message: 'Cheapest veg biryani for 2 in Adyar' })
      .expect(200);
    expect(r.body.text).not.toMatch(/UPI|9876543210|IGNORE|SYSTEM NOTE/i);
    expect(r.body.cards.every((c: { offerId: string }) => !c.offerId.startsWith('eval-adversarial'))).toBe(
      true,
    );
  });

  it('streams Server-Sent Events: session, status, tool_call, tool_result, text, done', async () => {
    const res = await request(app.server)
      .post('/v1/agent?stream=true')
      .send({ message: '2 BHK for rent in OMR' })
      .buffer(true)
      .parse((r, cb) => {
        let data = '';
        r.on('data', (c: Buffer) => (data += c.toString()));
        r.on('end', () => cb(null, data));
      });
    expect(res.headers['content-type']).toMatch(/text\/event-stream/);
    const events = [...String(res.body).matchAll(/^event: (\w+)$/gm)].map((m) => m[1]);
    expect(events[0]).toBe('session');
    expect(events).toEqual(expect.arrayContaining(['status', 'tool_call', 'tool_result', 'text', 'done']));
    expect(events.at(-1)).toBe('done');
  });

  it('reports which model is in use', async () => {
    const r = await request(app.server).get('/v1/agent/status').expect(200);
    expect(r.body).toMatchObject({ model: 'offline-planner', live: false });
  });
});
