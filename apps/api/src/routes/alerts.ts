import type { FastifyInstance, FastifyRequest } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import type { AlertService } from '../alerts/service.ts';
import type { Services } from '../services.ts';

/** Price alerts and "my data" (export / delete). Identity = a signed link sent by email. */
export async function alertRoutes(
  fastify: FastifyInstance,
  opts: { alerts: AlertService; services: Services },
) {
  const app = fastify.withTypeProvider<ZodTypeProvider>();
  const { alerts, services } = opts;

  const emailOf = (req: FastifyRequest) => {
    const h = req.headers.authorization;
    return h?.startsWith('Bearer ') ? alerts.emailFromAccess(h.slice(7)) : null;
  };

  app.post(
    '/v1/alerts',
    {
      schema: {
        tags: ['alerts'],
        description:
          'Create a price alert. A confirmation link is emailed; nothing is sent until it is confirmed.',
        body: z.object({
          email: z.email().max(200),
          offerId: z.string().min(3).max(200),
          thresholdRs: z.number().positive().max(1e8),
          locale: z.enum(['en', 'ta']).default('en'),
        }),
      },
    },
    async (req, reply) => {
      const [offer] = await services.getOffers([req.body.offerId], req.id);
      if (!offer) return reply.code(404).send({ error: 'not_found', message: 'Unknown offer.' });
      await alerts.create({
        email: req.body.email,
        offer,
        thresholdPaise: Math.round(req.body.thresholdRs * 100),
        locale: req.body.locale,
      });
      return reply
        .code(202)
        .send({ status: 'confirmation_sent', message: 'Check your email to confirm the alert.' });
    },
  );

  app.post(
    '/v1/alerts/verify',
    { schema: { tags: ['alerts'], body: z.object({ token: z.string().min(10).max(2000) }) } },
    async (req, reply) => {
      const r = await alerts.verify(req.body.token);
      if (!r)
        return reply
          .code(400)
          .send({ error: 'invalid_token', message: 'This link is invalid or has expired.' });
      return { accessToken: r.accessToken, alert: r.alert };
    },
  );

  app.get(
    '/v1/me',
    {
      schema: {
        tags: ['privacy'],
        description: 'Export everything stored about you (Authorization: Bearer <access token>).',
      },
    },
    async (req, reply) => {
      const email = emailOf(req);
      if (!email)
        return reply
          .code(401)
          .send({ error: 'unauthorized', message: 'Open the link from your alert email first.' });
      reply.header('content-disposition', 'attachment; filename="my-chennai-commerce-data.json"');
      return alerts.export(email);
    },
  );

  app.delete(
    '/v1/me',
    { schema: { tags: ['privacy'], description: 'Delete everything stored about you.' } },
    async (req, reply) => {
      const email = emailOf(req);
      if (!email)
        return reply
          .code(401)
          .send({ error: 'unauthorized', message: 'Open the link from your alert email first.' });
      return { deletedAlerts: await alerts.deleteAll(email) };
    },
  );

  app.delete(
    '/v1/me/alerts/:id',
    { schema: { tags: ['privacy'], params: z.object({ id: z.uuid() }) } },
    async (req, reply) => {
      const email = emailOf(req);
      if (!email)
        return reply
          .code(401)
          .send({ error: 'unauthorized', message: 'Open the link from your alert email first.' });
      return { deleted: await alerts.deleteOne(req.params.id, email) };
    },
  );
}
