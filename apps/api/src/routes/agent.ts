import { randomUUID } from 'node:crypto';
import type Anthropic from '@anthropic-ai/sdk';
import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { runAgent, type AgentEvent, type AgentLimits } from '../agent/loop.ts';
import type { AgentModel } from '../agent/models.ts';
import type { Metrics } from '../metrics.ts';
import type { Services } from '../services.ts';

const SESSION_TTL_MS = 30 * 60 * 1000;
const MAX_SESSIONS = 1000;
const MAX_HISTORY_MESSAGES = 40;

/** Session memory lives only in this process and expires after 30 minutes (rule 5). */
class SessionStore {
  private map = new Map<string, { history: Anthropic.Beta.BetaMessageParam[]; expires: number }>();
  get(id: string) {
    const s = this.map.get(id);
    if (!s || s.expires < Date.now()) {
      this.map.delete(id);
      return [];
    }
    return s.history;
  }
  set(id: string, history: Anthropic.Beta.BetaMessageParam[]) {
    if (this.map.size >= MAX_SESSIONS) this.map.delete(this.map.keys().next().value!);
    // Trim from the front, but only at a plain user message so tool_use/tool_result pairs stay intact.
    let h = history;
    while (h.length > MAX_HISTORY_MESSAGES) {
      const next = h.findIndex((m, i) => i > 0 && m.role === 'user' && typeof m.content === 'string');
      if (next <= 0) break;
      h = h.slice(next);
    }
    this.map.set(id, { history: h, expires: Date.now() + SESSION_TTL_MS });
  }
  delete(id: string) {
    return this.map.delete(id);
  }
}

const Body = z.object({
  message: z.string().trim().min(1).max(2000),
  sessionId: z
    .string()
    .regex(/^[\w-]{8,64}$/)
    .optional(),
  preferences: z
    .object({
      locality: z.string().max(60).optional(),
      budgetRs: z.number().positive().max(1e8).optional(),
      vegOnly: z.boolean().optional(),
    })
    .optional()
    .describe('Only send when the user has agreed to save preferences.'),
});

export async function agentRoutes(
  fastify: FastifyInstance,
  opts: {
    services: Services;
    metrics: Metrics;
    model: AgentModel;
    now: () => Date;
    limits?: Partial<AgentLimits>;
  },
) {
  const app = fastify.withTypeProvider<ZodTypeProvider>();
  const sessions = new SessionStore();

  app.get('/v1/agent/status', { schema: { tags: ['agent'] } }, async () => ({
    model: opts.model.name,
    live: opts.model.live,
    available: (opts.model as { available?: boolean }).available ?? true,
    note: opts.model.live
      ? `Live model: ${opts.model.name}. If it is unavailable, the offline assistant answers instead.`
      : 'Offline planner (no Gemini or Anthropic key configured). Same tools and safety checks, rule-based language understanding.',
  }));

  app.post(
    '/v1/agent',
    {
      schema: {
        tags: ['agent'],
        description:
          'Ask the shopping agent. Add ?stream=true for Server-Sent Events (status, text, tool_call, tool_result, done).',
        body: Body,
        querystring: z.object({ stream: z.enum(['true', 'false']).default('false') }),
      },
    },
    async (req, reply) => {
      const sessionId = req.body.sessionId ?? randomUUID();
      const history = sessions.get(sessionId);
      opts.metrics.inc('agent_requests_total', { live: String(opts.model.live) });
      const run = (emit?: (e: AgentEvent) => void) =>
        runAgent(
          { message: req.body.message, history, preferences: req.body.preferences },
          {
            model: opts.model,
            services: opts.services,
            requestId: req.id,
            now: opts.now,
            limits: opts.limits,
          },
          emit,
        );

      if (req.query.stream === 'true') {
        reply.hijack();
        reply.raw.writeHead(200, {
          'content-type': 'text/event-stream; charset=utf-8',
          'cache-control': 'no-cache, no-transform',
          connection: 'keep-alive',
          'x-request-id': req.id,
          'access-control-allow-origin': (reply.getHeader('access-control-allow-origin') as string) ?? '',
        });
        const send = (event: string, data: unknown) =>
          reply.raw.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
        send('session', { sessionId });
        try {
          const result = await run((e) => {
            if (e.type === 'done') {
              const { history: _h, ...pub } = e.result;
              send('done', pub);
            } else send(e.type, e);
          });
          sessions.set(sessionId, result.history);
        } catch (err) {
          req.log.error({ err }, 'agent failed');
          send('error', { message: 'The assistant is unavailable right now.' });
        }
        reply.raw.end();
        return reply;
      }

      try {
        const result = await run();
        sessions.set(sessionId, result.history);
        const { history: _h, ...pub } = result;
        return { sessionId, ...pub };
      } catch (err) {
        req.log.error({ err }, 'agent failed');
        return reply
          .code(503)
          .send({ error: 'agent_unavailable', message: 'The assistant is unavailable right now.' });
      }
    },
  );

  app.delete(
    '/v1/agent/sessions/:id',
    { schema: { tags: ['agent'], params: z.object({ id: z.string().max(64) }) } },
    async (req) => ({
      deleted: sessions.delete(req.params.id),
    }),
  );
}
