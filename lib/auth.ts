export const SESSION_COOKIE = "hm_session";
export const SESSION_MAX_AGE = 60 * 60 * 24 * 30; // 30 days

// Cookie format: `<id>.<expiresAt>.<hmac>` — opaque to the client, signed
// server-side with HMAC-SHA256 keyed on the auth token. The token itself is
// never put in the cookie, and changing it invalidates all existing sessions.

export function authToken(): string | null {
  return process.env.HM_WEB_AUTH_TOKEN || null;
}

export function isAuthRequired(): boolean {
  return Boolean(authToken());
}

export async function createSessionCookie(): Promise<string> {
  const token = authToken();
  if (!token) throw new Error("createSessionCookie called without auth token");
  const id = randomHex(16);
  const expiresAt = Date.now() + SESSION_MAX_AGE * 1000;
  const payload = `${id}.${expiresAt}`;
  const sig = await hmacHex(payload, token);
  return `${payload}.${sig}`;
}

export async function isValidSessionCookie(
  value: string | null | undefined,
): Promise<boolean> {
  const token = authToken();
  if (!token || !value) return false;
  const parts = value.split(".");
  if (parts.length !== 3) return false;
  const [id, expiresAtStr, sig] = parts;
  const expiresAt = Number.parseInt(expiresAtStr, 10);
  if (!Number.isFinite(expiresAt) || expiresAt < Date.now()) return false;
  const expected = await hmacHex(`${id}.${expiresAt}`, token);
  return timingSafeEqual(sig, expected);
}

export function isValidBearer(headerValue: string | null): boolean {
  const token = authToken();
  if (!token) return true;
  if (!headerValue) return false;
  return headerValue === `Bearer ${token}`;
}

function randomHex(bytes: number): string {
  const buf = new Uint8Array(bytes);
  crypto.getRandomValues(buf);
  return Array.from(buf, (b) => b.toString(16).padStart(2, "0")).join("");
}

async function hmacHex(payload: string, key: string): Promise<string> {
  const enc = new TextEncoder();
  const k = await crypto.subtle.importKey(
    "raw",
    enc.encode(key),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", k, enc.encode(payload));
  return Array.from(new Uint8Array(sig), (b) => b.toString(16).padStart(2, "0")).join("");
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}
