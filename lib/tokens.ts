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
  return mintTokenAt(purpose, recordId, new Date(Date.now() + ttlSeconds * 1000));
}

/**
 * The same token, minted against an expiry that is already known.
 *
 * Added in F1 for A2 finding 7: once "Αποστολή πρόσκλησης" had been pressed, the link was shown
 * once and was then unreachable — with the default `ClipboardAdapter` the coordinator pastes it
 * by hand, so losing the clipboard is not an edge case. A token is a pure function of
 * (purpose, record id, expiry, secret), and `invitations` stores the expiry, so the link a
 * promoter was sent can be rebuilt exactly — the stored `token_hash` still matches and the
 * original message keeps working. Nothing new is issued and nothing is invalidated.
 *
 * Sub-second precision is dropped the same way `mintToken` always dropped it (the payload holds
 * whole seconds), so rebuilding from a stored `expires_at` is byte-identical.
 */
export function mintTokenAt(
  purpose: TokenPurpose,
  recordId: string,
  expiresAt: Date,
): { token: string; tokenHash: string; expiresAt: Date } {
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
  const checked = verifyTokenSignature(token, expected);
  if (!checked.ok) return checked;
  if (checked.expired) return { ok: false, reason: "expired" };
  return { ok: true, purpose: checked.purpose, recordId: checked.recordId };
}

export type SignatureResult =
  | { ok: true; purpose: TokenPurpose; recordId: string; expired: boolean }
  | { ok: false; reason: "malformed" | "bad_signature" | "wrong_purpose" };

/**
 * Signature and purpose, with expiry REPORTED rather than enforced.
 *
 * For exactly one case: an invitation the promoter has already accepted. Its token expires after
 * the response window (a day), but the promoter comes back to the same link on the day of the
 * shift to find their check-in link — which is what the page tells them to do. Verified in
 * production on 2026-09-15: an invitation accepted two days earlier answered "Η πρόσκληση έχει
 * λήξει", and the check-in link on it was unreachable. Callers decide what an expired token may
 * still see (`acceptedInvitationStillReadable`); nothing that WRITES may use this function.
 */
export function verifyTokenSignature(token: string, expected: TokenPurpose): SignatureResult {
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

  return { ok: true, purpose: payload.p, recordId: payload.i, expired: payload.e * 1000 < Date.now() };
}

/**
 * How long an ACCEPTED invitation stays readable after its token expired: through the day after
 * the shift, Europe/Athens. Long enough to reopen it on the day for the check-in link and to find
 * it again the next morning for the field report; short enough that an old link does not keep
 * showing a finished shift forever. Pure, so it is tested without a clock.
 */
export function acceptedInvitationStillReadable(onDate: string, now: Date = new Date()): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(onDate);
  if (!match) return false;
  const dayAfter = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]) + 1));
  const lastReadable = dayAfter.toISOString().slice(0, 10);
  const athensToday = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Athens" }).format(now);
  return athensToday <= lastReadable;
}

export function linkFor(token: string, purpose: TokenPurpose): string {
  const base = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const path = purpose === "invitation" ? "i" : "c";
  return `${base}/${path}/${token}`;
}
