import { describe, expect, it } from 'vitest';
import { ManualImportAdapter, csvToRows, parseCsv } from '../src/adapters/manual-import.ts';
import { OndcAdapter, isoDurationMinutes, mockOnSearch } from '../src/adapters/ondc.ts';
import { amazonOfficialApi, flipkartOfficialApi } from '../src/adapters/official.ts';
import { UserSubmittedAdapter } from '../src/adapters/user-submitted.ts';
import { GuardedAdapter, policyFromEnv } from '../src/adapters/guarded.ts';
import { MemoryCache } from '../src/adapters/resilience.ts';
import { checkSubmittedUrl, isPrivateAddress } from '../src/net/url-guard.ts';
import { Offer } from '../src/schemas.ts';
import { ctx, query } from './helpers.ts';

const publicDns = async () => ['13.226.1.1'];
const IMPORT_DIR = new URL('../../../data/imports', import.meta.url).pathname;

describe('SSRF guard for submitted URLs', () => {
  it.each([
    ['http://www.amazon.in/dp/x', 'only https'],
    ['https://user:pw@www.amazon.in/x', 'credentials'],
    ['https://www.amazon.in:8443/x', 'custom ports'],
    ['https://127.0.0.1/x', 'IP-address'],
    ['https://evil.example.com/x', 'supported'],
    ['https://amazon.in.evil.com/x', 'supported'],
    ['javascript:alert(1)', 'only https'],
    ['not a url', 'not a valid URL'],
  ])('rejects %s', async (url, reason) => {
    const r = await checkSubmittedUrl(url, publicDns);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toContain(reason);
  });

  it('rejects allowed domains that resolve to private addresses (DNS rebinding)', async () => {
    const r = await checkSubmittedUrl('https://www.flipkart.com/x', async () => ['10.0.0.5']);
    expect(r.ok).toBe(false);
  });

  it('accepts a public https link on an allowed platform', async () => {
    const r = await checkSubmittedUrl('https://www.flipkart.com/samsung-s24-fe/p/itm1', publicDns);
    expect(r.ok && r.platform).toBe('flipkart.com');
  });

  it('knows private ranges', () => {
    for (const ip of [
      '10.1.2.3',
      '172.16.0.1',
      '192.168.1.1',
      '127.0.0.1',
      '169.254.169.254',
      '100.64.0.1',
      '::1',
      'fd00::1',
      '::ffff:10.0.0.1',
    ]) {
      expect(isPrivateAddress(ip), ip).toBe(true);
    }
    for (const ip of ['8.8.8.8', '13.226.1.1', '2606:4700::1111'])
      expect(isPrivateAddress(ip), ip).toBe(false);
  });
});

describe('manual import (tier 3)', () => {
  it('parses quoted CSV', () => {
    expect(parseCsv('a,b\n"x, y","he said ""hi"""\n')).toEqual([
      ['a', 'b'],
      ['x, y', 'he said "hi"'],
    ]);
  });

  it('loads the example files, labels rows as sample, and reports rejected rows', async () => {
    const a = new ManualImportAdapter(IMPORT_DIR);
    expect(a.size).toBe(5);
    const bad = a.addRows('bad', [{ vertical: 'shopping', title: 'no price' }], '2026-10-29T00:00:00.000Z');
    expect(bad.accepted).toBe(0);
    expect(bad.rejected).toHaveLength(1);
    const raws = await a.search({
      ...query('Galaxy S24 FE 128GB'),
      pincodes: ['600017'],
      localityIds: ['t-nagar'],
    });
    expect(raws).toHaveLength(1);
    const o = Offer.parse(a.normalise(raws[0]!, ctx()));
    expect(o.provenance).toMatchObject({
      sourceId: 'manual-import',
      tier: 3,
      isSample: true,
      sourceName: 'T Nagar Mobiles (sample)',
    });
  });

  it('CSV rows become valid grocery offers with parsed quantities', () => {
    const rows = csvToRows(
      'vertical,title,url,price_rs,product,quantity,pincodes\ngrocery,Rice 1 kg,https://example.com/r,70,Rice,1 kg,600042\n',
    );
    const o = Offer.parse({
      ...(rows[0] as object),
      id: 'x:1',
      provenance: {
        sourceId: 'x',
        sourceName: 'x',
        tier: 3,
        observedAt: '2026-10-29T00:00:00.000Z',
        confidence: 1,
        isSample: true,
      },
    });
    expect(o.vertical === 'grocery' && o.quantity).toEqual({ value: 1000, unit: 'g' });
  });
});

describe('user-submitted prices (tier 3)', () => {
  it('accepts a valid report and shows it as unverified with confidence 0.5', async () => {
    const a = new UserSubmittedAdapter(undefined, publicDns, () => new Date('2026-10-29T10:00:00Z'));
    const r = await a.submit({
      vertical: 'shopping',
      url: 'https://www.croma.com/p/123',
      title: 'Samsung Galaxy S24 FE 128GB Mint',
      priceRs: 33999,
      locality: 'Velachery',
    });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.offer.provenance.confidence).toBe(0.5);
      expect(r.offer.provenance.sourceName).toBe('User-reported (croma.com)');
      expect(r.offer.provenance.isSample).toBe(false);
    }
    expect(await a.search(query('Galaxy S24 FE'))).toHaveLength(1);
  });

  it('rejects disallowed links and places outside Chennai', async () => {
    const a = new UserSubmittedAdapter(undefined, publicDns);
    expect(
      (
        await a.submit({
          vertical: 'shopping',
          url: 'https://evil.example.com',
          title: 'Phone',
          priceRs: 1,
          locality: 'Adyar',
        })
      ).ok,
    ).toBe(false);
    expect(
      (
        await a.submit({
          vertical: 'shopping',
          url: 'https://www.croma.com/p',
          title: 'Phone',
          priceRs: 1,
          locality: 'Mumbai',
        })
      ).ok,
    ).toBe(false);
  });

  it('expires old reports', async () => {
    let now = new Date('2026-10-29T10:00:00Z');
    const a = new UserSubmittedAdapter(undefined, publicDns, () => now);
    await a.submit({
      vertical: 'grocery',
      url: 'https://blinkit.com/prn/x',
      title: 'Toned Milk 500 ml',
      priceRs: 25,
      locality: 'Adyar',
      quantity: '500 ml',
    });
    expect(await a.search(query('milk', 'grocery'))).toHaveLength(0); // query() uses Velachery
    now = new Date('2026-10-31T10:00:00Z');
    expect((await a.health()).detail).toBe('0 recent user reports');
  });
});

describe('ONDC client (tier 2, mock gateway)', () => {
  const fakeFetch: typeof fetch = async (_url, init) =>
    new Response(
      JSON.stringify(mockOnSearch(JSON.parse(String(init?.body)), new Date('2026-10-29T10:00:00Z'))),
      { status: 200 },
    );

  it('builds a Beckn search request for Chennai and never anything that buys', () => {
    const a = new OndcAdapter('http://mock');
    const req = a.buildSearchRequest({ ...query('rice', 'grocery'), pincodes: ['600004'] }, new Date());
    expect(req.context).toMatchObject({
      domain: 'ONDC:RET10',
      action: 'search',
      city: 'std:044',
      country: 'IND',
    });
    expect(req.message.intent.fulfillment.end.location.address.area_code).toBe('600004');
    expect(Object.getOwnPropertyNames(OndcAdapter.prototype)).not.toEqual(
      expect.arrayContaining(['confirm', 'init', 'select']),
    );
  });

  it('maps on_search items to grocery offers with fees marked unknown', async () => {
    const a = new OndcAdapter('http://mock', 'test', fakeFetch);
    const q = { ...query('rice', 'grocery'), pincodes: ['600004'] };
    const raws = await a.search(q, ctx());
    expect(raws).toHaveLength(1);
    const o = Offer.parse(a.normalise(raws[0]!));
    expect(o.vertical === 'grocery' && o.quantity).toEqual({ value: 1000, unit: 'g' });
    expect(o.fees.deliveryPaise).toBeNull();
    expect(o.etaMinutes).toBe(45);
    expect(o.provenance.tier).toBe(2);
  });

  it('is disabled by default and needs ENABLED_SOURCES=ondc-mock', async () => {
    const a = new OndcAdapter('http://mock', 'test', fakeFetch);
    const off = new GuardedAdapter(a, { policy: policyFromEnv({}), cache: new MemoryCache() });
    expect((await off.search(query('rice', 'grocery'), ctx())).status).toBe('disabled');
    const on = new GuardedAdapter(a, {
      policy: policyFromEnv({ ENABLED_SOURCES: 'ondc-mock' }),
      cache: new MemoryCache(),
    });
    expect((await on.search({ ...query('rice', 'grocery'), pincodes: ['600004'] }, ctx())).status).toBe('ok');
  });

  it('parses ISO durations', () => {
    expect(isoDurationMinutes('PT1H30M')).toBe(90);
    expect(isoDurationMinutes('P1D')).toBeNull();
  });
});

describe('official API stubs (tier 1)', () => {
  it('ship disabled and stay disabled even if enabled without credentials', async () => {
    for (const a of [amazonOfficialApi(), flipkartOfficialApi()]) {
      expect(a.compliance.enabledByDefault).toBe(false);
      expect((await a.health()).ok).toBe(false);
      const g = new GuardedAdapter(a, {
        policy: policyFromEnv({ ENABLED_SOURCES: a.id }),
        cache: new MemoryCache(),
        retries: 0,
      });
      const r = await g.search(query(), ctx());
      expect(r.status).toBe('unavailable');
      expect(r.error?.kind).toBe('disabled');
    }
  });
});
