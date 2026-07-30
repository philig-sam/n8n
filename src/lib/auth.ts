// Minimal shared-password auth: a signed, expiring session cookie.
// Uses Web Crypto (crypto.subtle) so the same code runs in the Node runtime
// and in Edge middleware.

const SESSION_COOKIE = 'vli_session';
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

export { SESSION_COOKIE };

function secretKey(): Promise<CryptoKey> {
  const secret = process.env.SESSION_SECRET || process.env.ADMIN_PASSWORD || '';
  return crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(`vli:${secret}`),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify'],
  );
}

function toHex(buf: ArrayBuffer): string {
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

async function sign(payload: string): Promise<string> {
  const sig = await crypto.subtle.sign('HMAC', await secretKey(), new TextEncoder().encode(payload));
  return toHex(sig);
}

/** Create the session cookie value: `<expiryMillis>.<hmac>`. */
export async function createSessionValue(now: Date = new Date()): Promise<string> {
  const expires = String(now.getTime() + SESSION_TTL_MS);
  return `${expires}.${await sign(expires)}`;
}

/** Verify a session cookie value: valid signature and not expired. */
export async function verifySessionValue(value: string | undefined, now: Date = new Date()): Promise<boolean> {
  if (!value) return false;
  const dot = value.indexOf('.');
  if (dot === -1) return false;
  const expires = value.slice(0, dot);
  const givenSig = value.slice(dot + 1);
  if (!/^\d+$/.test(expires) || Number(expires) < now.getTime()) return false;
  const expected = await sign(expires);
  // Constant-time comparison
  if (givenSig.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) diff |= givenSig.charCodeAt(i) ^ expected.charCodeAt(i);
  return diff === 0;
}

export function checkPassword(password: string): boolean {
  const expected = process.env.ADMIN_PASSWORD ?? '';
  if (!expected) return false;
  if (password.length !== expected.length) {
    // still compare to keep timing flat-ish
    let x = 0;
    for (let i = 0; i < password.length; i++) x |= password.charCodeAt(i);
    return false;
  }
  let diff = 0;
  for (let i = 0; i < expected.length; i++) diff |= password.charCodeAt(i) ^ expected.charCodeAt(i);
  return diff === 0;
}
