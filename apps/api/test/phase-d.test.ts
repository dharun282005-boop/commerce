import type { FastifyInstance } from 'fastify';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildApp } from '../src/app.ts';
import { loadConfig } from '../src/config.ts';

const IMPORT_DIR = new URL('../../../data/imports', import.meta.url).pathname;

describe('Phase D API', () => {
  let app: FastifyInstance;
  beforeAll(async () => {
    app = await buildApp({
      config: {
        ...loadConfig({
          LOG_LEVEL: 'silent',
          ADMIN_TOKEN: 'test-admin-token-123',
          ENABLED_SOURCES: 'ondc-mock',
        }),
        IMPORT_DIR,
      },
      resolver: async () => ['13.226.1.1'],
    });
    await app.listen({ port: 0, host: '127.0.0.1' });
    // Point the ONDC client at this server's own mock gateway.
    const port = (app.server.address() as { port: number }).port;
    await app.close();
    app = await buildApp({
      config: {
        ...loadConfig({
          LOG_LEVEL: 'silent',
          ADMIN_TOKEN: 'test-admin-token-123',
          ENABLED_SOURCES: 'ondc-mock',
          ONDC_GATEWAY_URL: `http://127.0.0.1:${port}/mock/ondc`,
        }),
        IMPORT_DIR,
      },
      resolver: async () => ['13.226.1.1'],
    });
    await app.listen({ port, host: '127.0.0.1' });
  });
  afterAll(async () => {
    await app.close();
  });

  it('imported custom data joins the comparison and matches the same product', async () => {
    const res = await request(app.server)
      .post('/v1/search')
      .send({ vertical: 'shopping', q: 'Galaxy S24 FE 128GB', locality: 'T Nagar' })
      .expect(200);
    const imported = res.body.results.find(
      (r: { offer: { id: string } }) => r.offer.id === 'manual-import:tn-mobiles-s24fe-128',
    );
    expect(imported).toBeTruthy();
    const group = res.body.groups.find((g: { offerIds: string[] }) =>
      g.offerIds.includes('manual-import:tn-mobiles-s24fe-128'),
    );
    expect(group.offerIds).toContain('fixture-flipkart:s24fe-128-1');
  });

  it('ONDC (mock gateway) results appear in grocery search when enabled', async () => {
    const res = await request(app.server)
      .post('/v1/search')
      .send({ vertical: 'grocery', q: 'rice', locality: 'Mylapore' })
      .expect(200);
    const ondc = res.body.sources.find((s: { sourceId: string }) => s.sourceId === 'ondc-mock');
    expect(ondc.status).toBe('ok');
    const r = res.body.results.find(
      (x: { offer: { provenance: { sourceId: string } } }) => x.offer.provenance.sourceId === 'ondc-mock',
    );
    expect(r.flags).toContain('fees_unknown');
  });

  it('accepts a user-reported price and shows it right away', async () => {
    await request(app.server)
      .post('/v1/submissions')
      .send({
        vertical: 'shopping',
        url: 'https://www.croma.com/p/1',
        title: 'Apple iPhone 16 128GB Black',
        priceRs: 68999,
        locality: 'Adyar',
      })
      .expect(201);
    const res = await request(app.server)
      .post('/v1/search')
      .send({ vertical: 'shopping', q: 'iPhone 16', locality: 'Adyar' })
      .expect(200);
    const mine = res.body.results.find(
      (r: { offer: { provenance: { sourceId: string } } }) =>
        r.offer.provenance.sourceId === 'user-submitted',
    );
    expect(mine.offer.provenance.confidence).toBe(0.5);
  });

  it('rejects a submission pointing at a private address', async () => {
    const res = await request(app.server)
      .post('/v1/submissions')
      .send({
        vertical: 'shopping',
        url: 'http://169.254.169.254/latest/meta-data',
        title: 'x x x',
        priceRs: 1,
        locality: 'Adyar',
      })
      .expect(400);
    expect(res.body.error).toBe('invalid_submission');
  });

  it('admin import needs the token', async () => {
    const row = {
      vertical: 'grocery',
      title: 'Tata Salt 1 kg',
      url: 'https://example.com/salt',
      pricePaise: 2500,
      mrpPaise: 3000,
      fees: {
        deliveryPaise: 0,
        handlingPaise: 0,
        platformPaise: 0,
        packagingPaise: 0,
        taxesNotIncludedPaise: 0,
      },
      coupons: [],
      rating: null,
      etaMinutes: 60,
      trust: { fulfilledByPlatform: null, returnPolicyDays: null, sellerRating: null },
      affiliate: false,
      brand: 'Tata',
      product: 'Iodised Salt',
      category: 'staples',
      quantity: { value: 1000, unit: 'g' },
      packCount: 1,
      deliversTo: ['600020'],
      order: { minOrderPaise: null, freeDeliveryAbovePaise: null },
    };
    await request(app.server)
      .post('/v1/admin/import')
      .send({ rows: [row] })
      .expect(403);
    await request(app.server)
      .post('/v1/admin/import')
      .set('x-admin-token', 'wrong-token-000000000')
      .send({ rows: [row] })
      .expect(403);
    const ok = await request(app.server)
      .post('/v1/admin/import')
      .set('x-admin-token', 'test-admin-token-123')
      .send({ rows: [row] })
      .expect(200);
    expect(ok.body.accepted).toBe(1);
  });

  it('GET /v1/imports shows import reports', async () => {
    const res = await request(app.server).get('/v1/imports').expect(200);
    expect(res.body.rows).toBeGreaterThanOrEqual(5);
  });
});
