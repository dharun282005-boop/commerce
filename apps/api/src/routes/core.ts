import { explainRanking, searchLocalities, LOCALITIES, CORRIDORS } from '@cuc/core';
import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { ErrorResponse, SearchBody, SearchResponse } from '../schemas.ts';
import { UnknownLocalityError, type Services } from '../services.ts';
import type { Metrics } from '../metrics.ts';

export async function coreRoutes(fastify: FastifyInstance, opts: { services: Services; metrics: Metrics }) {
  const app = fastify.withTypeProvider<ZodTypeProvider>();
  const { services, metrics } = opts;

  const notChennai = (err: unknown) =>
    err instanceof UnknownLocalityError ? { error: 'unknown_locality', message: err.message } : null;

  app.get(
    '/v1/localities',
    {
      schema: {
        tags: ['localities'],
        querystring: z.object({ q: z.string().max(60).optional() }),
      },
    },
    async (req) => ({
      localities: searchLocalities(req.query.q).map(({ aliases: _a, ...l }) => l),
      corridors: Object.entries(CORRIDORS).map(([id, c]) => ({
        id,
        name: c.name,
        nameTa: c.nameTa,
        members: c.members,
      })),
    }),
  );

  app.get('/v1/sources', { schema: { tags: ['sources'] } }, async () => ({
    sources: await Promise.all(
      services.sources.map(async (g) => ({
        id: g.adapter.id,
        name: g.adapter.name,
        verticals: g.adapter.capabilities.verticals,
        compliance: g.adapter.compliance,
        allowed: g.isAllowed(),
        health: await g.health(),
      })),
    ),
  }));

  app.post(
    '/v1/search',
    { schema: { tags: ['search'], body: SearchBody, response: { 200: SearchResponse, 404: ErrorResponse } } },
    async (req, reply) => {
      metrics.inc('searches_total', { vertical: req.body.vertical });
      try {
        const res = await services.search(req.body, req.id);
        return { requestId: req.id, ...res };
      } catch (err) {
        const nc = notChennai(err);
        if (nc) return reply.code(404).send(nc);
        throw err;
      }
    },
  );

  app.post(
    '/v1/explain',
    {
      schema: {
        tags: ['search'],
        description: 'Plain-language "Why is this #1?" for one offer in a search.',
        body: SearchBody.extend({ offerId: z.string().min(3).max(200) }),
      },
    },
    async (req, reply) => {
      try {
        const res = await services.search(req.body, req.id);
        const item = res.results.find((r) => r.offer.id === req.body.offerId);
        if (!item)
          return reply
            .code(404)
            .send({ error: 'not_in_results', message: 'That offer is not in these results.' });
        return { offerId: item.offer.id, rank: item.rank, lines: explainRanking(item, res.weights) };
      } catch (err) {
        const nc = notChennai(err);
        if (nc) return reply.code(404).send(nc);
        throw err;
      }
    },
  );

  app.post(
    '/v1/cart/plan',
    {
      schema: {
        tags: ['grocery'],
        body: z.object({
          list: z.string().trim().min(1).max(1000).describe('e.g. "2 kg rice, 1 L milk, 12 eggs"'),
          locality: z.string().trim().min(1).max(60),
        }),
      },
    },
    async (req, reply) => {
      metrics.inc('cart_plans_total');
      try {
        return { requestId: req.id, ...(await services.planCart(req.body, req.id)) };
      } catch (err) {
        const nc = notChennai(err);
        if (nc) return reply.code(404).send(nc);
        throw err;
      }
    },
  );

  app.get(
    '/v1/offers/:id',
    { schema: { tags: ['offers'], params: z.object({ id: z.string().min(3).max(200) }) } },
    async (req, reply) => {
      const d = await services.offerDetail(req.params.id, req.id);
      if (!d)
        return reply
          .code(404)
          .send({ error: 'not_found', message: 'No such offer, or its source is switched off.' });
      return d;
    },
  );

  app.get(
    '/v1/offers/:id/history',
    {
      schema: {
        tags: ['offers'],
        params: z.object({ id: z.string().min(3).max(200) }),
        querystring: z.object({ days: z.coerce.number().int().min(1).max(365).default(30) }),
      },
    },
    async (req) => services.history(req.params.id, req.query.days),
  );

  app.get(
    '/v1/localities/:id',
    { schema: { tags: ['localities'], params: z.object({ id: z.string().max(60) }) } },
    async (req, reply) => {
      const area = services.resolve(req.params.id);
      if (!area)
        return reply
          .code(404)
          .send({ error: 'unknown_locality', message: 'Not a Chennai locality we know.' });
      return {
        label: area.label,
        localities: area.localities,
        pincodes: area.pincodes,
        count: LOCALITIES.length,
      };
    },
  );
}
