import { describe, expect, it } from "vitest";
import { createHmac } from "node:crypto";
import { acceptedInvitationStillReadable, mintToken, verifyToken, verifyTokenSignature } from "@/lib/tokens";

// Same convention as tests/availability-links.test.ts; the secret is read lazily at sign time.
process.env.TOKEN_SIGNING_SECRET = "test-signing-secret-do-not-use-in-prod";

// Regression for what production showed on 2026-09-15: an invitation accepted two days earlier
// answered "Η πρόσκληση έχει λήξει", so the promoter could not reopen it for the check-in link.

describe("acceptedInvitationStillReadable", () => {
  const at = (iso: string) => new Date(iso);

  it("is readable before, on and the day after the shift (Athens)", () => {
    expect(acceptedInvitationStillReadable("2026-09-15", at("2026-09-10T09:00:00Z"))).toBe(true);
    expect(acceptedInvitationStillReadable("2026-09-15", at("2026-09-15T20:00:00Z"))).toBe(true);
    expect(acceptedInvitationStillReadable("2026-09-15", at("2026-09-16T20:00:00Z"))).toBe(true);
  });

  it("stops two days after the shift", () => {
    expect(acceptedInvitationStillReadable("2026-09-15", at("2026-09-17T09:00:00Z"))).toBe(false);
  });

  it("uses the Athens date, not UTC", () => {
    // 22:30 UTC on the 16th is already the 17th in Athens (UTC+3 in September).
    expect(acceptedInvitationStillReadable("2026-09-15", at("2026-09-16T22:30:00Z"))).toBe(false);
  });

  it("crosses a month end", () => {
    expect(acceptedInvitationStillReadable("2026-09-30", at("2026-10-01T12:00:00Z"))).toBe(true);
    expect(acceptedInvitationStillReadable("2026-09-30", at("2026-10-02T12:00:00Z"))).toBe(false);
  });

  it("refuses anything that is not a date", () => {
    expect(acceptedInvitationStillReadable("", at("2026-09-15T12:00:00Z"))).toBe(false);
  });
});

describe("verifyTokenSignature", () => {
  it("reports expiry without failing, while verifyToken still refuses", () => {
    const { token } = mintToken("invitation", "inv-1", -60);
    const sig = verifyTokenSignature(token, "invitation");
    expect(sig).toMatchObject({ ok: true, recordId: "inv-1", expired: true });
    expect(verifyToken(token, "invitation")).toEqual({ ok: false, reason: "expired" });
  });

  it("still refuses a forged or repurposed token", () => {
    const { token } = mintToken("invitation", "inv-1", 3600);
    const [body] = token.split(".");
    const forged = `${body}.${createHmac("sha256", "not-the-secret").update(body!).digest("base64url")}`;
    expect(verifyTokenSignature(forged, "invitation")).toEqual({ ok: false, reason: "bad_signature" });
    expect(verifyTokenSignature(token, "checkin")).toEqual({ ok: false, reason: "wrong_purpose" });
  });
});
