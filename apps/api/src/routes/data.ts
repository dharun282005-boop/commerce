import { timingSafeEqual } from 'node:crypto';
import { mockOnSearch, type ManualImportAdapter, type UserSubmittedAdapter } from '@cuc/core';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import type { Config } from '../config.ts';
import type { Metrics } from '../metrics.ts';

/** Phase D routes: tier-3 data (owner imports, user-reported prices) and the mock ONDC gateway. */
export async function dataRoutes(
  fastify: FastifyInstance,
  opts: {
    importer: ManualImportAdapter;
    userSubmitted: UserSubmittedAdapter;
    config: Config;
    now: () => Date;
    metrics: Metrics;
  },
) {
  const app = fastify.withTypeProvider<ZodTypeProvider>();
  const { importer, userSubmitted, config, now, metrics } = opts;

  app.post(
    '/v1/submissions',
    {
      schema: {
        tags: ['data'],
        description:
          'Report a price you saw yourself on a supported platform. Shown as user-reported (confidence 0.5). The link is checked but never fetched.',
        body: z.object({}).loose(),
      },
    },
    async (req, reply) => {
      const r = await userSubmitted.submit(req.body);
      metrics.inc('submissions_total', { ok: String(r.ok) });
      if (!r.ok) return reply.code(400).send({ error: 'invalid_submission', message: r.error });
      return reply.code(201).send({ offer: r.offer });
    },
  );

  // ---- admin (owner) ----
  const isAdmin = (req: FastifyRequest) => {
    const given = req.headers['x-admin-token'];
    if (!config.ADMIN_TOKEN || typeof given !== 'string') return false;
    const a = Buffer.from(given);
    const b = Buffer.from(config.ADMIN_TOKEN);
    return a.length === b.length && timingSafeEqual(a, b);
  };

  app.post(
    '/v1/admin/import',
    {
      schema: {
        tags: ['admin'],
        description:
          'Import rows (JSON array, same format as data/imports/*.json). Needs the x-admin-token header.',
        body: z.object({
          label: z.string().min(1).max(60).default('api-import'),
          rows: z.array(z.unknown()).max(5000),
        }),
      },
    },
    async (req, reply) => {
      if (!isAdmin(req)) return reply.code(403).send({ error: 'forbidden', message: 'admin token required' });
      return importer.addRows(req.body.label, req.body.rows, now().toISOString());
    },
  );

  app.post('/v1/admin/import/reload', { schema: { tags: ['admin'] } }, async (req, reply) => {
    if (!isAdmin(req)) return reply.code(403).send({ error: 'forbidden', message: 'admin token required' });
    return { reports: importer.reload(), rows: importer.size };
  });

  app.get(
    '/v1/imports',
    { schema: { tags: ['data'], description: 'What was imported and what was rejected (row errors).' } },
    async () => ({
      rows: importer.size,
      reports: importer.reports,
    }),
  );

  // ---- mock ONDC gateway (development only) ----
  if (config.ONDC_MOCK === 'true') {
    app.post('/mock/ondc/search', { schema: { hide: true, body: z.object({}).loose() } }, async (req) =>
      mockOnSearch(req.body as { context?: { transaction_id?: string } }, now()),
    );
    app.get('/mock/ondc/health', { schema: { hide: true } }, async () => ({ ok: true }));
  }
}
