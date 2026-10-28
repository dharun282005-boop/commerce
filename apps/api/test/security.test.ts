import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { buildApp } from '../src/app.ts';
import { loadConfig } from '../src/config.ts';

describe('security hardening', () => {
  it('sets security headers and a locked-down CSP on API responses', async () => {
    const app = await buildApp({ config: loadConfig({ LOG_LEVEL: 'silent' }) });
    await app.ready();
    const r = await request(app.server).get('/health').expect(200);
    expect(r.headers['content-security-policy']).toBe("default-src 'none'; frame-ancestors 'none'");
    expect(r.headers['x-content-type-options']).toBe('nosniff');
    expect(r.headers['strict-transport-security']).toBeDefined();
    expect(r.headers['x-powered-by']).toBeUndefined();
    await app.close();
  });

  it('rate-limits the agent per IP (30/min) with a 429 and a clear message', async () => {
    const app = await buildApp({ config: loadConfig({ LOG_LEVEL: 'silent' }) });
    await app.ready();
    let last = 0;
    for (let i = 0; i < 31; i++)
      last = (await request(app.server).post('/v1/agent').send({ message: 'biryani in Bengaluru' })).status;
    expect(last).toBe(429);
    const r = await request(app.server).post('/v1/agent').send({ message: 'x' });
    expect(r.body.error).toBe('rate_limited');
    expect(r.headers['retry-after']).toBeDefined();
    await app.close();
  });

  it('rejects oversized and malformed bodies', async () => {
    const app = await buildApp({ config: loadConfig({ LOG_LEVEL: 'silent' }) });
    await app.ready();
    await request(app.server)
      .post('/v1/search')
      .set('content-type', 'application/json')
      .send('{"vertical":')
      .expect(400);
    await request(app.server)
      .post('/v1/agent')
      .send({ message: 'x'.repeat(5000) })
      .expect(400);
    await request(app.server)
      .post('/v1/search')
      .send({ vertical: 'food', q: 'a'.repeat(300 * 1024), locality: 'Adyar' })
      .expect(413);
    await app.close();
  });

  it('does not log request bodies, search text or auth headers (rule 6)', async () => {
    const lines: string[] = [];
    const app = await buildApp({
      config: loadConfig({ LOG_LEVEL: 'info' }),
      logStream: { write: (m) => void lines.push(m) },
    });
    await app.ready();
    await request(app.server)
      .post('/v1/search')
      .set('authorization', 'Bearer super-secret-token-123')
      .send({ vertical: 'food', q: 'my-private-query-xyz', locality: 'Adyar' })
      .expect(200);
    const all = lines.join('\n');
    expect(lines.length).toBeGreaterThan(0);
    expect(all).toContain('/v1/search');
    expect(all).not.toContain('my-private-query-xyz');
    expect(all).not.toContain('super-secret-token-123');
    await app.close();
  });
});
