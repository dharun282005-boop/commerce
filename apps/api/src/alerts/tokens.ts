import { createHmac, timingSafeEqual } from 'node:crypto';

/** Small signed tokens (HMAC-SHA256) for email links. No passwords, no sessions in cookies. */
export type TokenPurpose = 'verify' | 'access';

export interface TokenPayload {
  purpose: TokenPurpose;
  email: string;
  alertId?: string;
  exp: number; // ms since epoch
}

const b64 = (b: Buffer) => b.toString('base64url');

export function signToken(p: TokenPayload, secret: string): string {
  const body = b64(Buffer.from(JSON.stringify(p)));
  const mac = b64(createHmac('sha256', secret).update(body).digest());
  return `${body}.${mac}`;
}

export function verifyToken(
  token: string,
  secret: string,
  purpose: TokenPurpose,
  now = Date.now(),
): TokenPayload | null {
  const [body, mac] = token.split('.');
  if (!body || !mac) return null;
  const expected = createHmac('sha256', secret).update(body).digest();
  const given = Buffer.from(mac, 'base64url');
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;
  try {
    const p = JSON.parse(Buffer.from(body, 'base64url').toString()) as TokenPayload;
    if (p.purpose !== purpose || p.exp < now) return null;
    return p;
  } catch {
    return null;
  }
}
