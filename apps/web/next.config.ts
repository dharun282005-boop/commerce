import type { NextConfig } from 'next';
import { fileURLToPath } from 'node:url';
import createNextIntlPlugin from 'next-intl/plugin';

// Monorepo root: lets Next/Vercel trace and bundle the workspace packages the embedded API uses.
const ROOT = fileURLToPath(new URL('../../', import.meta.url));

const API = process.env.NEXT_PUBLIC_API_URL || '';
const dev = process.env.NODE_ENV !== 'production';

// Content Security Policy (brief §9). Next.js App Router injects small inline scripts, so
// script-src needs 'unsafe-inline' unless a per-request nonce is used (see docs/10, docs/15).
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${dev ? " 'unsafe-eval'" : ''}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data:",
  "font-src 'self'",
  `connect-src 'self'${API ? ` ${API}` : ''}${dev ? ' ws:' : ''}`,
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
  "manifest-src 'self'",
  "worker-src 'self'",
].join('; ');

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  outputFileTracingRoot: ROOT,
  turbopack: { root: ROOT },
  // Workspace packages are TypeScript sources; compile them with the app.
  transpilePackages: ['@cuc/api', '@cuc/core'],
  // Node server libraries used by the embedded API: load them from node_modules at runtime.
  serverExternalPackages: [
    'fastify',
    '@fastify/cors',
    '@fastify/helmet',
    '@fastify/rate-limit',
    '@fastify/swagger',
    '@fastify/swagger-ui',
    'fastify-type-provider-zod',
    'pino',
    'ioredis',
    'nodemailer',
    '@anthropic-ai/sdk',
    '@google/genai',
  ],
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'Content-Security-Policy', value: csp },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
          { key: 'X-Frame-Options', value: 'DENY' },
        ],
      },
      {
        source: '/sw.js',
        headers: [
          { key: 'Cache-Control', value: 'no-cache' },
          { key: 'Service-Worker-Allowed', value: '/' },
        ],
      },
    ];
  },
};

export default createNextIntlPlugin()(nextConfig);
