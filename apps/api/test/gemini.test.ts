import { describe, expect, it } from 'vitest';
import { GeminiModel, geminiFromEnv, toContents } from '../src/agent/gemini.ts';
import { ResilientModel, agentModelFromEnv, type AgentModel } from '../src/agent/models.ts';
import { SYSTEM_PROMPT } from '../src/agent/prompt.ts';
import { ScriptedModel } from '../src/agent/scripted.ts';
import { toolDefinitions } from '../src/agent/tools.ts';

/** A fake @google/genai `models` object that streams the given chunks. */
function fakeModels(script: Array<Record<string, unknown>[] | Error>) {
  const calls: Record<string, unknown>[] = [];
  let i = 0;
  return {
    calls,
    models: {
      generateContentStream: async (params: Record<string, unknown>) => {
        calls.push(params);
        const step = script[Math.min(i++, script.length - 1)]!;
        if (step instanceof Error) throw step;
        return (async function* () {
          for (const c of step) yield c;
        })();
      },
    },
  };
}

const req = (messages: Parameters<AgentModel['turn']>[0]['messages']) => ({
  system: SYSTEM_PROMPT,
  tools: toolDefinitions(),
  messages,
  maxTokens: 1000,
});

describe('Gemini adapter', () => {
  it('sends system prompt, JSON-schema tools and limits; parses function calls with thought signatures', async () => {
    const f = fakeModels([
      [
        {
          candidates: [
            {
              content: {
                parts: [
                  {
                    functionCall: {
                      id: 'c1',
                      name: 'search_food',
                      args: { query: 'veg biryani', locality: 'Adyar' },
                    },
                    thoughtSignature: 'sig-1',
                  },
                ],
              },
              finishReason: 'STOP',
            },
          ],
          usageMetadata: { promptTokenCount: 900, candidatesTokenCount: 20, thoughtsTokenCount: 30 },
          modelVersion: 'gemini-3.8-flash',
        },
      ],
    ]);
    const m = new GeminiModel(f.models as never, 'gemini-3.8-flash');
    const r = await m.turn(req([{ role: 'user', content: 'veg biryani in Adyar' }]));
    const sent = f.calls[0] as {
      model: string;
      config: {
        systemInstruction: string;
        maxOutputTokens: number;
        tools: { functionDeclarations: { name: string; parametersJsonSchema: unknown }[] }[];
      };
    };
    expect(sent.model).toBe('gemini-3.8-flash');
    expect(sent.config.systemInstruction).toBe(SYSTEM_PROMPT);
    expect(sent.config.maxOutputTokens).toBe(1000);
    expect(sent.config.tools[0]!.functionDeclarations.map((d) => d.name)).toContain('plan_cart');
    expect(sent.config.tools[0]!.functionDeclarations[0]!.parametersJsonSchema).toMatchObject({
      type: 'object',
    });
    expect(r.stopReason).toBe('tool_use');
    expect(r.content).toEqual([
      {
        type: 'tool_use',
        id: 'c1',
        name: 'search_food',
        input: { query: 'veg biryani', locality: 'Adyar' },
        thoughtSignature: 'sig-1',
      },
    ]);
    expect(r.usage).toMatchObject({ inputTokens: 900, outputTokens: 50 });
  });

  it('streams text, skips thought text, and maps safety blocks to refusal', async () => {
    const f = fakeModels([
      [
        { candidates: [{ content: { parts: [{ text: 'thinking…', thought: true }, { text: 'Hello ' }] } }] },
        { candidates: [{ content: { parts: [{ text: 'Chennai' }] }, finishReason: 'STOP' }] },
      ],
      [{ candidates: [{ content: { parts: [] }, finishReason: 'SAFETY' }] }],
    ]);
    const m = new GeminiModel(f.models as never, 'g');
    const deltas: string[] = [];
    const r = await m.turn({ ...req([{ role: 'user', content: 'hi' }]), onText: (d) => void deltas.push(d) });
    expect(r.content).toEqual([{ type: 'text', text: 'Hello Chennai' }]);
    expect(deltas.join('')).toBe('Hello Chennai');
    expect((await m.turn(req([{ role: 'user', content: 'x' }]))).stopReason).toBe('refusal');
  });

  it('converts history: tool_use → functionCall (signature kept), tool_result → functionResponse', () => {
    const contents = toContents([
      { role: 'user', content: 'q' },
      {
        role: 'assistant',
        content: [
          {
            type: 'tool_use',
            id: 'c1',
            name: 'search_food',
            input: { query: 'x' },
            thoughtSignature: 'sig',
          } as never,
        ],
      },
      { role: 'user', content: [{ type: 'tool_result', tool_use_id: 'c1', content: '{"results":[]}' }] },
      {
        role: 'user',
        content: [{ type: 'tool_result', tool_use_id: 'c1', is_error: true, content: '{"error":"bad"}' }],
      },
    ]);
    expect(contents[1]).toEqual({
      role: 'model',
      parts: [
        { functionCall: { id: 'c1', name: 'search_food', args: { query: 'x' } }, thoughtSignature: 'sig' },
      ],
    });
    expect(contents[2]).toEqual({
      role: 'user',
      parts: [{ functionResponse: { id: 'c1', name: 'search_food', response: { output: { results: [] } } } }],
    });
    expect(contents[3]!.parts![0]!.functionResponse!.response).toEqual({ error: { error: 'bad' } });
  });

  it('tries the next model when one is overloaded or out of quota', async () => {
    const overloaded = Object.assign(new Error('{"error":{"code":503,"message":"high demand"}}'), {
      status: 503,
    });
    const f = fakeModels([
      overloaded,
      [{ candidates: [{ content: { parts: [{ text: 'ok' }] }, finishReason: 'STOP' }] }],
    ]);
    const m = new GeminiModel(f.models as never, 'first', ['second']);
    const r = await m.turn(req([{ role: 'user', content: 'x' }]));
    expect(f.calls.map((c) => c.model)).toEqual(['first', 'second']);
    expect(r.content).toEqual([{ type: 'text', text: 'ok' }]);
  });

  it('does not retry on a bad request (e.g. 400)', async () => {
    const bad = Object.assign(new Error('bad'), { status: 400 });
    const f = fakeModels([bad]);
    await expect(
      new GeminiModel(f.models as never, 'a', ['b']).turn(req([{ role: 'user', content: 'x' }])),
    ).rejects.toThrow('bad');
    expect(f.calls).toHaveLength(1);
  });

  it('is configured only from env, never from code', async () => {
    expect(geminiFromEnv({})).toBeNull();
    expect(geminiFromEnv({ GEMINI_API_KEY: 'k' })?.name).toBe('gemini-3.8-flash');
    expect(geminiFromEnv({ GEMINI_API_KEY: 'k', GEMINI_MODEL: 'x,y' })?.name).toBe('x');
    expect(await agentModelFromEnv({ AGENT_PROVIDER: 'offline', GEMINI_API_KEY: 'k' })).toBeNull();
    expect((await agentModelFromEnv({ GEMINI_API_KEY: 'k' }))?.name).toBe('gemini-3.8-flash');
  });
});

describe('ResilientModel', () => {
  it('answers with the offline planner when the live model fails, then skips it during a cool-down', async () => {
    let calls = 0;
    const failing: AgentModel = {
      name: 'gemini-x',
      live: true,
      turn: async () => {
        calls++;
        throw new Error('429 quota');
      },
    };
    let t = 0;
    const m = new ResilientModel(failing, new ScriptedModel(), 60_000, () => t);
    const r1 = await m.turn(req([{ role: 'user', content: 'biryani in Bengaluru' }]));
    expect(r1.model).toBe('offline-planner (gemini-x unavailable)');
    expect(r1.content[0]).toMatchObject({ type: 'text' });
    expect(m.available).toBe(false);
    await m.turn(req([{ role: 'user', content: 'biryani in Bengaluru' }]));
    expect(calls).toBe(1); // skipped during cool-down
    t = 61_000;
    expect(m.available).toBe(true);
  });
});
