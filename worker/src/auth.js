// Password hashing (PBKDF2-SHA256) and lightweight signed session tokens.
// Uses Web Crypto only — no npm deps, works natively in Cloudflare Workers.

const ITERATIONS = 100000;
const KEY_LEN = 32; // bytes

function toHex(buf) {
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
function fromHex(hex) {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) bytes[i] = parseInt(hex.substr(i * 2, 2), 16);
  return bytes;
}

export async function hashPassword(password, saltHex) {
  const salt = saltHex ? fromHex(saltHex) : crypto.getRandomValues(new Uint8Array(16));
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveBits"]
  );
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt, iterations: ITERATIONS, hash: "SHA-256" },
    keyMaterial,
    KEY_LEN * 8
  );
  return { hash: toHex(bits), salt: toHex(salt) };
}

export async function verifyPassword(password, saltHex, expectedHashHex) {
  const { hash } = await hashPassword(password, saltHex);
  // constant-time-ish compare
  if (hash.length !== expectedHashHex.length) return false;
  let diff = 0;
  for (let i = 0; i < hash.length; i++) diff |= hash.charCodeAt(i) ^ expectedHashHex.charCodeAt(i);
  return diff === 0;
}

async function hmac(secret, data) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(data));
  return toHex(sig);
}

// Minimal signed session token: base64(payload).signature
export async function createSessionToken(secret, payload, ttlSeconds = 3600) {
  const body = { ...payload, exp: Math.floor(Date.now() / 1000) + ttlSeconds };
  const encoded = btoa(JSON.stringify(body));
  const sig = await hmac(secret, encoded);
  return `${encoded}.${sig}`;
}

export async function verifySessionToken(secret, token) {
  if (!token || !token.includes(".")) return null;
  const [encoded, sig] = token.split(".");
  const expectedSig = await hmac(secret, encoded);
  if (sig !== expectedSig) return null;
  const payload = JSON.parse(atob(encoded));
  if (payload.exp < Math.floor(Date.now() / 1000)) return null;
  return payload;
}

export function randomToken() {
  return toHex(crypto.getRandomValues(new Uint8Array(24)));
}
