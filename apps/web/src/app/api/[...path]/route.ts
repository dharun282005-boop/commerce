import { Readable } from 'node:stream';
import type { FastifyInstance } from 'fastify';

/**
 * The API, embedded in the web app so a single deployment (e.g. Vercel) serves everything.
 * Requests to /api/* are passed to the same Fastify app the standalone API uses (in-memory mode:
 * sample data, no Postgres/Redis). Responses are streamed, so the assistant's Server-Sent Events
 * still arrive as they are produced.
 */
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

let appPromise: Promise<FastifyInstance> | null = null;

function getApp(): Promise<FastifyInstance> {
  appPromise ??= (async () => {
    const [{ buildApp }, { loadConfig }] = await Promise.all([
      import('@cuc/api/app'),
      import('@cuc/api/config'),
    ]);
    const config = loadConfig({
      ...process.env,
      LOG_LEVEL: process.env.LOG_LEVEL ?? 'warn',
      DOCS: 'off',
      ONDC_MOCK: 'false',
      // Same-origin in this mode; CORS only matters for other origins.
      WEB_ORIGIN:
        process.env.WEB_ORIGIN ??
        (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3100'),
    });
    const app = await buildApp({ config });
    await app.ready();
    return app;
  })().catch((err) => {
    appPromise = null; // retry on the next request
    throw err;
  });
  return appPromise;
}

const HOP_BY_HOP = new Set(['connection', 'keep-alive', 'transfer-encoding', 'content-length', 'upgrade']);

async function handle(req: Request): Promise<Response> {
  const app = await getApp();
  const url = new URL(req.url);
  const path = url.pathname.replace(/^\/api(?=\/|$)/, '') || '/';
  const headers: Record<string, string> = {};
  req.headers.forEach((v, k) => {
    if (!HOP_BY_HOP.has(k)) headers[k] = v;
  });
  const forwarded = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  const body = req.method === 'GET' || req.method === 'HEAD' ? undefined : await req.text();

  const res = await app.inject({
    method: req.method as 'GET',
    url: path + url.search,
    headers,
    payload: body,
    remoteAddress: forwarded || '127.0.0.1',
    payloadAsStream: true,
  });

  const out = new Headers();
  for (const [k, v] of Object.entries(res.headers)) {
    if (v === undefined || HOP_BY_HOP.has(k)) continue;
    if (Array.isArray(v)) v.forEach((x) => out.append(k, String(x)));
    else out.set(k, String(v));
  }
  const stream = res.stream();
  return new Response(Readable.toWeb(stream) as ReadableStream, { status: res.statusCode, headers: out });
}

export { handle as GET, handle as POST, handle as DELETE, handle as OPTIONS };
