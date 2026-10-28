#!/usr/bin/env node
// Load test for the search API with autocannon. Usage: node scripts/loadtest.mjs [baseUrl] [seconds]
// Run against an API started with RATE_LIMIT=off, otherwise the per-IP limit (correctly) returns 429s.
import autocannon from 'autocannon';

const base = process.argv[2] ?? 'http://localhost:4198';
const duration = Number(process.argv[3] ?? 15);
const bodies = [
  { vertical: 'shopping', q: 'Samsung Galaxy S24 FE 128GB', locality: 'Velachery', preset: 'cheapest' },
  { vertical: 'food', q: 'veg biryani', locality: 'Adyar', filters: { vegOnly: true, minServings: 2 } },
  { vertical: 'grocery', q: 'milk', locality: 'T Nagar' },
  { vertical: 'property', q: '2 bhk', locality: 'OMR', filters: { bhk: 2, listingType: 'rent' } },
  { vertical: 'shopping', q: 'iPhone 16', locality: 'Anna Nagar' },
];

function run(title, opts) {
  return new Promise((resolve, reject) => {
    autocannon({ url: base, duration, connections: 20, ...opts }, (err, r) => {
      if (err) return reject(err);
      resolve({
        test: title,
        'req/s (avg)': Math.round(r.requests.average),
        'p50 ms': r.latency.p50,
        'p90 ms': r.latency.p90,
        'p99 ms': r.latency.p99,
        'max ms': r.latency.max,
        requests: r.requests.total,
        errors: r.errors + r.timeouts,
        non2xx: r.non2xx,
      });
    });
  });
}

const results = [];
results.push(await run('GET /health', { requests: [{ method: 'GET', path: '/health' }] }));
results.push(
  await run('POST /v1/search (5 popular queries, cache warm)', {
    requests: bodies.map((b) => ({
      method: 'POST',
      path: '/v1/search',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(b),
    })),
  }),
);
let n = 0;
results.push(
  await run('POST /v1/search (unique queries, cache cold)', {
    requests: [
      {
        method: 'POST',
        path: '/v1/search',
        setupRequest: (req) => ({
          ...req,
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ vertical: 'shopping', q: `phone ${n++}`, locality: 'Adyar' }),
        }),
      },
    ],
  }),
);
console.table(results);
