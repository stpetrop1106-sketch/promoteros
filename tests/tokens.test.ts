import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mintToken, verifyToken, hashToken } from "@/lib/tokens";

// lib/tokens.ts reads TOKEN_SIGNING_SECRET lazily, inside sign()/secret(), on every
// mint/verify call rather than at module load — so setting it here (module scope, before
// any test body runs) is sufficient. Not read from a real .env — tests must not depend on
// the environment.
process.env.TOKEN_SIGNING_SECRET = "test-signing-secret-do-not-use-in-prod";

describe("mintToken / verifyToken round trip", () => {
  it("mints a token that verifies for the same purpose and record id", () => {
    const { token } = mintToken("invitation", "record-123", 3600);
    const result = verifyToken(token, "invitation");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.recordId).toBe("record-123");
      expect(result.purpose).toBe("invitation");
    }
  });

  it("mints a checkin token that round-trips too", () => {
    const { token } = mintToken("checkin", "assignment-999", 600);
    const result = verifyToken(token, "checkin");
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.recordId).toBe("assignment-999");
  });
});

describe("purpose scoping", () => {
  it("fails wrong_purpose when a token minted for invitation is verified as checkin", () => {
    const { token } = mintToken("invitation", "record-123", 3600);
    const result = verifyToken(token, "checkin");
    expect(result).toEqual({ ok: false, reason: "wrong_purpose" });
  });

  it("fails wrong_purpose the other direction too", () => {
    const { token } = mintToken("checkin", "assignment-1", 3600);
    const result = verifyToken(token, "invitation");
    expect(result).toEqual({ ok: false, reason: "wrong_purpose" });
  });
});

describe("tampering", () => {
  it("fails bad_signature when the payload is tampered", () => {
    const { token } = mintToken("invitation", "record-123", 3600);
    const [body, signature] = token.split(".");

    // Decode, change the record id, re-encode — signature no longer matches.
    const decoded = JSON.parse(Buffer.from(body!, "base64url").toString("utf8"));
    decoded.i = "someone-elses-record";
    const tamperedBody = Buffer.from(JSON.stringify(decoded)).toString("base64url");
    const tamperedToken = `${tamperedBody}.${signature}`;

    expect(verifyToken(tamperedToken, "invitation")).toEqual({
      ok: false,
      reason: "bad_signature",
    });
  });

  it("fails bad_signature when the signature is tampered", () => {
    const { token } = mintToken("invitation", "record-123", 3600);
    const [body, signature] = token.split(".");
    // Flip the signature's last character (base64url alphabet, so this always changes the byte).
    const flipped = signature!.slice(0, -1) + (signature!.endsWith("A") ? "B" : "A");
    const tamperedToken = `${body}.${flipped}`;

    expect(verifyToken(tamperedToken, "invitation")).toEqual({
      ok: false,
      reason: "bad_signature",
    });
  });
});

describe("malformed tokens never throw", () => {
  const cases: Array<[string, string]> = [
    ["no dot", "justarandomstringwithnodotinit"],
    ["empty string", ""],
    ["random garbage", "!!not-a-token!!"],
  ];

  it.each(cases)("%s fails with malformed and does not throw", (_label, raw) => {
    let result;
    expect(() => {
      result = verifyToken(raw, "invitation");
    }).not.toThrow();
    expect(result).toEqual({ ok: false, reason: "malformed" });
  });

  // A lone "." splits into two empty-string parts, so it passes the `parts.length !== 2`
  // check and falls through to signature comparison instead of being rejected as malformed.
  // sign("") is a real 32-byte HMAC and the provided signature is 0 bytes, so the length
  // check in verifyToken trips first and it fails as bad_signature, not malformed. It never
  // throws and never verifies, so behaviourally this is safe — but it does not match the
  // "only a dot -> malformed" expectation in the P15 brief. Documented in docs/status/P15.md.
  it("a lone dot fails without throwing (reason is bad_signature, not malformed)", () => {
    let result;
    expect(() => {
      result = verifyToken(".", "invitation");
    }).not.toThrow();
    expect(result).toEqual({ ok: false, reason: "bad_signature" });
  });
});

describe("expiry", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("fails expired for a token minted with a zero TTL, once time moves forward", () => {
    vi.setSystemTime(new Date("2026-01-01T00:00:00.000Z"));
    const { token } = mintToken("invitation", "record-1", 0);

    // Advance by 1 second so `expiresAt` (== mint time) is now in the past.
    vi.setSystemTime(new Date("2026-01-01T00:00:01.000Z"));

    expect(verifyToken(token, "invitation")).toEqual({ ok: false, reason: "expired" });
  });

  it("fails expired for a token minted with a negative TTL immediately", () => {
    vi.setSystemTime(new Date("2026-01-01T00:00:00.000Z"));
    const { token } = mintToken("invitation", "record-1", -60);

    expect(verifyToken(token, "invitation")).toEqual({ ok: false, reason: "expired" });
  });

  it("still verifies a token that has not yet expired", () => {
    vi.setSystemTime(new Date("2026-01-01T00:00:00.000Z"));
    const { token } = mintToken("invitation", "record-1", 3600);

    vi.setSystemTime(new Date("2026-01-01T00:30:00.000Z"));

    expect(verifyToken(token, "invitation")).toEqual({
      ok: true,
      purpose: "invitation",
      recordId: "record-1",
    });
  });
});

describe("hashToken", () => {
  it("is deterministic for the same input", () => {
    const { token } = mintToken("invitation", "record-1", 3600);
    expect(hashToken(token)).toBe(hashToken(token));
  });

  it("produces different hashes for different tokens", () => {
    const a = mintToken("invitation", "record-1", 3600).token;
    const b = mintToken("invitation", "record-2", 3600).token;
    expect(hashToken(a)).not.toBe(hashToken(b));
  });

  it("never contains the raw token", () => {
    const { token } = mintToken("invitation", "record-1", 3600);
    const hash = hashToken(token);
    expect(hash).not.toContain(token);
    expect(hash).not.toBe(token);
    // sha256 hex digest: 64 lowercase hex characters, nothing token-shaped (no ".").
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it("matches the tokenHash returned by mintToken", () => {
    const { token, tokenHash } = mintToken("invitation", "record-1", 3600);
    expect(hashToken(token)).toBe(tokenHash);
  });
});
