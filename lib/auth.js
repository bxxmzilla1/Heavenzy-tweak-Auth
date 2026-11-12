import crypto from "crypto";

// The admin session cookie never stores the raw code. It stores an HMAC of a fixed string keyed by
// ADMIN_CODE, so a leaked cookie can't be reversed into the code, and verification is a constant
// recompute + timing-safe compare.
const COOKIE_NAME = "hz_admin";

export function sessionToken() {
  const code = process.env.ADMIN_CODE || "";
  return crypto.createHmac("sha256", code).update("heavenzy-admin-v1").digest("hex");
}

export function cookieName() {
  return COOKIE_NAME;
}

export function isValidToken(token) {
  if (!token) return false;
  const expected = sessionToken();
  const a = Buffer.from(String(token));
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

export function codeMatches(code) {
  const expected = process.env.ADMIN_CODE || "";
  if (!expected) return false;
  const a = Buffer.from(String(code || ""));
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}
