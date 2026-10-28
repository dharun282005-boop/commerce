import type { FastifyInstance } from 'fastify';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { MemoryNotifier } from '../src/alerts/notify.ts';
import { signToken, verifyToken } from '../src/alerts/tokens.ts';
import { buildApp } from '../src/app.ts';
import { loadConfig } from '../src/config.ts';

describe('signed tokens', () => {
  it('reject tampering, wrong purpose and expiry', () => {
    const t = signToken(
      { purpose: 'verify', email: 'a@b.c', alertId: 'x', exp: Date.now() + 1000 },
      'secret',
    );
    expect(verifyToken(t, 'secret', 'verify')?.email).toBe('a@b.c');
    expect(verifyToken(t, 'other', 'verify')).toBeNull();
    expect(verifyToken(t, 'secret', 'access')).toBeNull();
    expect(verifyToken(t.slice(0, -2) + 'aa', 'secret', 'verify')).toBeNull();
    expect(verifyToken(t, 'secret', 'verify', Date.now() + 5000)).toBeNull();
  });
});

describe('price alerts, export and delete', () => {
  let app: FastifyInstance;
  const mail = new MemoryNotifier();
  beforeAll(async () => {
    app = await buildApp({
      config: loadConfig({ LOG_LEVEL: 'silent', ALERT_SECRET: 'test-secret' }),
      notifier: mail,
    });
    await app.ready();
  });
  afterAll(async () => {
    await app.close();
  });

  it('double opt-in: nothing is sent until the email link is confirmed; then a price drop notifies once', async () => {
    const offerId = 'fixture-flipkart:s24fe-128-1';
    await request(app.server)
      .post('/v1/alerts')
      .send({ email: 'Student@Example.com', offerId, thresholdRs: 40000 })
      .expect(202);
    expect(mail.sent).toHaveLength(1);
    expect(mail.sent[0]!.subject).toMatch(/Confirm/);
    const token = decodeURIComponent(mail.sent[0]!.text.match(/token=([^\s]+)/)![1]!);

    // Unconfirmed alerts never fire.
    await request(app.server)
      .post('/v1/search')
      .send({ vertical: 'shopping', q: 'Galaxy S24 FE 128GB', locale: 'en', locality: 'Adyar' });
    await new Promise((r) => setTimeout(r, 20));
    expect(mail.sent).toHaveLength(1);

    const v = await request(app.server).post('/v1/alerts/verify').send({ token }).expect(200);
    const access = v.body.accessToken as string;
    expect(v.body.alert.verified).toBe(true);

    // A fresh observation under the threshold sends one alert (Delhi-style cache is per query, so use a new one).
    await request(app.server)
      .post('/v1/search')
      .send({ vertical: 'shopping', q: 'SAMSUNG Galaxy S24 FE', locality: 'Velachery' });
    await new Promise((r) => setTimeout(r, 20));
    expect(mail.sent).toHaveLength(2);
    expect(mail.sent[1]!.subject).toMatch(/Price alert/);
    expect(mail.sent[1]!.text).toMatch(/sample data/);

    // Export and delete.
    const exp = await request(app.server).get('/v1/me').set('authorization', `Bearer ${access}`).expect(200);
    expect(exp.body.email).toBe('student@example.com');
    expect(exp.body.alerts).toHaveLength(1);
    const del = await request(app.server)
      .delete('/v1/me')
      .set('authorization', `Bearer ${access}`)
      .expect(200);
    expect(del.body.deletedAlerts).toBe(1);
    await request(app.server).get('/v1/me').expect(401);
    await request(app.server).post('/v1/alerts/verify').send({ token: 'nonsense.token' }).expect(400);
  });

  it('CORS allows only the web origin', async () => {
    const ok = await request(app.server)
      .options('/v1/search')
      .set('origin', 'http://localhost:3100')
      .set('access-control-request-method', 'POST');
    expect(ok.headers['access-control-allow-origin']).toBe('http://localhost:3100');
    const bad = await request(app.server)
      .options('/v1/search')
      .set('origin', 'https://evil.example')
      .set('access-control-request-method', 'POST');
    expect(bad.headers['access-control-allow-origin']).toBeUndefined();
  });
});
