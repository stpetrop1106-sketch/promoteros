import { createHmac, timingSafeEqual, createHash } from "node:crypto";

/**
 * Signed, single-use, expiring links for promoter-facing pages.
 *
 * A promoter never logs in — they tap a link in whatever messenger they already use. The link
 * itself is the credential, so it is HMAC-signed, scoped to one purpose and one record, and
 * short-lived. Only the HASH is stored; the raw token exists in the message and nowhere else,
 * so a database leak does not hand anyone a working link.
 */

export type TokenPurpose = "invitation" | "checkin";

type Payload = {
  /** purpose */
  p: TokenPurpose;
  /** record id */
  i: string;
  /** expiry, unix seconds */
  e: number;
};

const b64url = (buf: Buffer) => buf.toString("base64url");

function secret(): Buffer {
  const value = process.env.TOKEN_SIGNING_SECRET;
  if (!value) throw new Error("TOKEN_SIGNING_SECRET is not set");
  return Buffer.from(value, "utf8");
}

function sign(body: string): string {
  return b64url(createHmac("sha256", secret()).update(body).digest());
}

export function mintToken(
  purpose: TokenPurpose,
  recordId: string,
  ttlSeconds: number,
): { token: string; tokenHash: string; expiresAt: Date } {
  const expiresAt = new Date(Date.now() + ttlSeconds * 1000);
  const payload: Payload = {
    p: purpose,
    i: recordId,
    e: Math.floor(expiresAt.getTime() / 1000),
  };

  const body = b64url(Buffer.from(JSON.stringify(payload), "utf8"));
  const token = `${body}.${sign(body)}`;

  return { token, tokenHash: hashToken(token), expiresAt };
}

/** What we persist. Never store the token itself. */
export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export type VerifyResult =
  | { ok: true; purpose: TokenPurpose; recordId: string }
  | { ok: false; reason: "malformed" | "bad_signature" | "expired" | "wrong_purpose" };

export function verifyToken(token: string, expected: TokenPurpose): VerifyResult {
  const parts = token.split(".");
  if (parts.length !== 2) return { ok: false, reason: "malformed" };

  const [body, signature] = parts as [string, string];

  const actual = Buffer.from(sign(body));
  const provided = Buffer.from(signature);
  if (
    actual.length !== provided.length ||
    !timingSafeEqual(actual, provided)
  ) {
    return { ok: false, reason: "bad_signature" };
  }

  let payload: Payload;
  try {
    payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as Payload;
  } catch {
    return { ok: false, reason: "malformed" };
  }

  if (payload.p !== expected) return { ok: false, reason: "wrong_purpose" };
  if (payload.e * 1000 < Date.now()) return { ok: false, reason: "expired" };

  return { ok: true, purpose: payload.p, recordId: payload.i };
}

export function linkFor(token: string, purpose: TokenPurpose): string {
  const base = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const path = purpose === "invitation" ? "i" : "c";
  return `${base}/${path}/${token}`;
}
