import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';

/** Platforms a user may link to when submitting a price. Subdomains of these are allowed. */
export const ALLOWED_PLATFORM_DOMAINS = [
  'amazon.in',
  'flipkart.com',
  'croma.com',
  'reliancedigital.in',
  'myntra.com',
  'swiggy.com',
  'zomato.com',
  'blinkit.com',
  'zeptonow.com',
  'bigbasket.com',
  'magicbricks.com',
  '99acres.com',
  'nobroker.in',
  'housing.com',
] as const;

export type UrlCheck = { ok: true; url: URL; platform: string } | { ok: false; reason: string };

export type Resolver = (host: string) => Promise<string[]>;
export const dnsResolver: Resolver = async (host) =>
  (await lookup(host, { all: true })).map((a) => a.address);

/** True for loopback, private, link-local, carrier-grade NAT, multicast and other non-public ranges. */
export function isPrivateAddress(ip: string): boolean {
  if (isIP(ip) === 4) {
    const [a, b] = ip.split('.').map(Number) as [number, number];
    return (
      a === 0 ||
      a === 10 ||
      a === 127 ||
      a >= 224 ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 198 && (b === 18 || b === 19))
    );
  }
  const v6 = ip.toLowerCase();
  if (v6.startsWith('::ffff:')) return isPrivateAddress(v6.slice(7));
  return (
    v6 === '::' ||
    v6 === '::1' ||
    v6.startsWith('fc') ||
    v6.startsWith('fd') ||
    v6.startsWith('fe8') ||
    v6.startsWith('fe9') ||
    v6.startsWith('fea') ||
    v6.startsWith('feb') ||
    v6.startsWith('ff')
  );
}

/**
 * SSRF guard for user-submitted URLs (brief §9): https only, no credentials or custom ports,
 * host must be on the platform allow-list, and every address it resolves to must be public.
 * The app never fetches these URLs today; the guard still runs so the rule holds if that changes.
 */
export async function checkSubmittedUrl(raw: string, resolve: Resolver = dnsResolver): Promise<UrlCheck> {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return { ok: false, reason: 'not a valid URL' };
  }
  if (url.protocol !== 'https:') return { ok: false, reason: 'only https links are accepted' };
  if (url.username || url.password) return { ok: false, reason: 'links with credentials are not accepted' };
  if (url.port && url.port !== '443') return { ok: false, reason: 'custom ports are not accepted' };
  const host = url.hostname.toLowerCase().replace(/\.$/, '');
  if (isIP(host)) return { ok: false, reason: 'IP-address links are not accepted' };
  const platform = ALLOWED_PLATFORM_DOMAINS.find((d) => host === d || host.endsWith(`.${d}`));
  if (!platform)
    return { ok: false, reason: 'link must be to a supported shopping, food, grocery or property site' };
  let addresses: string[];
  try {
    addresses = await resolve(host);
  } catch {
    return { ok: false, reason: 'could not resolve the link host' };
  }
  if (addresses.length === 0 || addresses.some(isPrivateAddress)) {
    return { ok: false, reason: 'link host resolves to a private or reserved address' };
  }
  return { ok: true, url, platform };
}
