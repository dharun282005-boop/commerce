import type { Offer } from '@cuc/core';
import type { FastifyInstance } from 'fastify';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildApp } from '../src/app.ts';
import { loadConfig } from '../src/config.ts';

const NOW = new Date('2026-10-28T10:00:00.000Z');

async function makeApp(env: Record<string, string> = {}, recorded?: Offer[][]) {
  const app = await buildApp({
    config: loadConfig({ LOG_LEVEL: 'silent', ...env }),
    now: () => NOW,
    recordObservations: recorded ? async (o) => recorded.push(o) : undefined,
  });
  await app.ready();
  return app;
}

describe('API', () => {
  let app: FastifyInstance;
  const recorded: Offer[][] = [];
  beforeAll(async () => {
    app = await makeApp({}, recorded);
  });
  afterAll(async () => {
    await app.close();
  });

  it('GET /health reports fixture mode and a request id', async () => {
    const res = await request(app.server).get('/health').expect(200);
    expect(res.body).toEqual({ status: 'ok', db: 'disabled', redis: 'disabled', fixtureMode: true });
    expect(res.headers['x-request-id']).toBeTruthy();
  });

  it('GET /v1/localities finds by name and pincode', async () => {
    const res = await request(app.server).get('/v1/localities?q=600042').expect(200);
    expect(res.body.localities.map((l: { id: string }) => l.id)).toEqual(['velachery']);
  });

  it('GET /v1/sources lists compliance for every source', async () => {
    const res = await request(app.server).get('/v1/sources').expect(200);
    expect(res.body.sources).toHaveLength(17);
    for (const s of res.body.sources) {
      expect(s.compliance.tier).toBe('fixture');
      expect(s.allowed.allowed).toBe(true);
    }
  });

  it('US-1 over HTTP: S24 FE 128GB in Velachery', async () => {
    const res = await request(app.server)
      .post('/v1/search')
      .send({ vertical: 'shopping', q: 'Samsung Galaxy S24 FE 128GB', locality: 'Velachery' })
      .expect(200);
    expect(res.body.sampleData).toBe(true);
    expect(res.body.offers.length).toBeGreaterThanOrEqual(4);
    expect(
      res.body.offers.every((o: Offer) => o.vertical === 'shopping' && o.variant.storageGb === 128),
    ).toBe(true);
    expect(res.body.offers.every((o: Offer) => o.provenance.sourceName && o.provenance.observedAt)).toBe(
      true,
    );
  });

  it('US-2 over HTTP: veg biryani for 2 in Adyar', async () => {
    const res = await request(app.server)
      .post('/v1/search')
      .send({
        vertical: 'food',
        q: 'veg biryani',
        locality: '600020',
        filters: { vegOnly: true, minServings: 2, maxPricePaise: 30000, maxEtaMinutes: 40 },
      })
      .expect(200);
    expect(res.body.offers.length).toBeGreaterThanOrEqual(2);
  });

  it('US-3 over HTTP: grocery items in T Nagar', async () => {
    for (const q of ['rice', 'milk', 'eggs']) {
      const res = await request(app.server)
        .post('/v1/search')
        .send({ vertical: 'grocery', q, locality: 'T Nagar' })
        .expect(200);
      expect(res.body.offers.length, q).toBeGreaterThan(0);
    }
  });

  it('US-4 over HTTP: 2 BHK semi-furnished rent in OMR', async () => {
    const res = await request(app.server)
      .post('/v1/search')
      .send({
        vertical: 'property',
        q: '2 BHK',
        locality: 'OMR',
        filters: { bhk: 2, listingType: 'rent', furnishing: 'semi-furnished', maxPricePaise: 3000000 },
      })
      .expect(200);
    expect(res.body.area.localityIds).toContain('sholinganallur');
    expect(res.body.offers.length).toBeGreaterThanOrEqual(5);
  });

  it('records fresh observations but not cached ones', async () => {
    recorded.length = 0;
    const body = { vertical: 'shopping', q: 'iPhone 16', locality: 'Adyar' };
    await request(app.server).post('/v1/search').send(body).expect(200);
    await new Promise((r) => setImmediate(r));
    expect(recorded.flat().length).toBeGreaterThan(0);
    recorded.length = 0;
    const second = await request(app.server).post('/v1/search').send(body).expect(200);
    expect(second.body.sources.every((s: { fromCache: boolean }) => s.fromCache)).toBe(true);
    await new Promise((r) => setImmediate(r));
    expect(recorded.flat()).toHaveLength(0);
  });

  it('rejects invalid input with 400', async () => {
    await request(app.server)
      .post('/v1/search')
      .send({ vertical: 'cars', q: 'x', locality: 'Adyar' })
      .expect(400);
    await request(app.server)
      .post('/v1/search')
      .send({ vertical: 'food', q: '', locality: 'Adyar' })
      .expect(400);
  });

  it('returns 404 with a clear message outside Chennai', async () => {
    const res = await request(app.server)
      .post('/v1/search')
      .send({ vertical: 'food', q: 'biryani', locality: 'Bengaluru' })
      .expect(404);
    expect(res.body.error).toBe('unknown_locality');
  });

  it('serves the OpenAPI document and metrics', async () => {
    const spec = await request(app.server).get('/docs/json').expect(200);
    expect(Object.keys(spec.body.paths)).toEqual(
      expect.arrayContaining(['/v1/search', '/v1/localities', '/v1/sources']),
    );
    const m = await request(app.server).get('/metrics').expect(200);
    expect(m.text).toMatch(/searches_total\{vertical="shopping"\}/);
  });
});

describe('API failure isolation and kill switches', () => {
  it('reports an unavailable source and still answers', async () => {
    const app = await makeApp({ FIXTURE_FAIL: 'fixture-zomato:error' });
    const res = await request(app.server)
      .post('/v1/search')
      .send({ vertical: 'food', q: 'biryani', locality: 'Adyar' })
      .expect(200);
    const zomato = res.body.sources.find((s: { sourceId: string }) => s.sourceId === 'fixture-zomato');
    expect(zomato.status).toBe('unavailable');
    expect(res.body.offers.length).toBeGreaterThan(0);
    await app.close();
  });

  it('global kill switch returns no offers and marks every source disabled', async () => {
    const app = await makeApp({ KILL_SWITCH_ALL: 'true' });
    const res = await request(app.server)
      .post('/v1/search')
      .send({ vertical: 'shopping', q: 'phone', locality: 'Adyar' })
      .expect(200);
    expect(res.body.offers).toHaveLength(0);
    expect(res.body.sources.every((s: { status: string }) => s.status === 'disabled')).toBe(true);
    await app.close();
  });
});
