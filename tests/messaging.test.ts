import { describe, expect, it, vi } from "vitest";
import { checkEmailAddress, isReservedDomain } from "@/lib/messaging/email-address";
import {
  EmailAdapter,
  RESEND_ENDPOINT,
  emailConfigFrom,
  missingEmailEnv,
  renderEmail,
  sendWithResend,
} from "@/lib/messaging/email";
import { automaticDeliveryConfigured, getAdapterFor, type OutboundMessage } from "@/lib/messaging";

// P39. No network, ever: every test that reaches the transport passes a mocked `fetch`, and the
// adapter-selection tests pass an explicit env object so a developer's real RESEND_API_KEY in the
// shell can never make a test send an email.

const CONFIG = { apiKey: "re_test_key_not_real", from: "PromoterOS <no-reply@mail.promoteros.test>" };

const MESSAGE: OutboundMessage = {
  to: { name: "Δοκιμή Promoter", phone: "+306900000000", email: "promoter@mailbox.gr" },
  body: "Γεια σου Δοκιμή!\nΔήλωσε εδώ πότε μπορείς να δουλέψεις:",
  url: "https://app.promoteros.gr/a/abc.def",
  subject: "Ενημέρωσε τη διαθεσιμότητά σου",
  actionLabel: "Δήλωση διαθεσιμότητας",
};

const noSleep = async () => {};

function jsonResponse(status: number, body: unknown, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", ...headers },
  });
}

const manualFallback = {
  channel: "clipboard" as const,
  send: async (m: OutboundMessage) => ({
    delivered: false as const,
    channel: "clipboard" as const,
    manualBody: `${m.body}\n\n${m.url}`,
  }),
};

describe("checkEmailAddress", () => {
  it("accepts an ordinary address and lower-cases only the domain", () => {
    expect(checkEmailAddress("  Maria.P@Gmail.COM ")).toEqual({ ok: true, address: "Maria.P@gmail.com" });
  });

  it("calls a missing address missing, not invalid", () => {
    expect(checkEmailAddress(null)).toEqual({ ok: false, reason: "missing" });
    expect(checkEmailAddress(undefined)).toEqual({ ok: false, reason: "missing" });
    expect(checkEmailAddress("   ")).toEqual({ ok: false, reason: "missing" });
  });

  it("rejects shapes the provider would reject", () => {
    for (const bad of ["maria", "maria@", "@gmail.com", "maria@gmail", "ma ria@gmail.com", "maria@gmail..com"]) {
      expect(checkEmailAddress(bad)).toEqual({ ok: false, reason: "invalid" });
    }
  });

  it("refuses the seed data's domain — sending there would burn the sending domain's reputation", () => {
    expect(checkEmailAddress("maria.papadopoulou@example.invalid")).toEqual({
      ok: false,
      reason: "reserved_domain",
    });
  });

  it("refuses every reserved TLD and every example domain, subdomains and trailing dots included", () => {
    const reserved = [
      "a@x.invalid",
      "a@x.test",
      "a@x.example",
      "a@x.localhost",
      "a@localhost",
      "a@example.com",
      "a@EXAMPLE.NET",
      "a@example.org",
      "a@mail.example.com",
      "a@example.com.",
    ];
    for (const address of reserved) {
      expect(checkEmailAddress(address), address).toEqual({ ok: false, reason: "reserved_domain" });
    }
  });

  it("does not over-match lookalike real domains", () => {
    expect(isReservedDomain("examples.com")).toBe(false);
    expect(isReservedDomain("myexample.com")).toBe(false);
    expect(isReservedDomain("testing.gr")).toBe(false);
    expect(checkEmailAddress("a@example.com.gr").ok).toBe(true);
  });
});

describe("email configuration", () => {
  it("needs both RESEND_API_KEY and EMAIL_FROM", () => {
    expect(emailConfigFrom({})).toBeNull();
    expect(emailConfigFrom({ RESEND_API_KEY: "re_x" })).toBeNull();
    expect(emailConfigFrom({ EMAIL_FROM: "a@b.gr" })).toBeNull();
    expect(emailConfigFrom({ RESEND_API_KEY: "  ", EMAIL_FROM: "a@b.gr" })).toBeNull();
    expect(emailConfigFrom({ RESEND_API_KEY: "re_x", EMAIL_FROM: "a@b.gr" })).toEqual({
      apiKey: "re_x",
      from: "a@b.gr",
    });
  });

  it("names what is missing, never a value", () => {
    expect(missingEmailEnv({})).toEqual(["RESEND_API_KEY", "EMAIL_FROM"]);
    expect(missingEmailEnv({ RESEND_API_KEY: "re_secret" })).toEqual(["EMAIL_FROM"]);
  });

  it("with nothing configured, selection is today's manual adapter", async () => {
    expect(automaticDeliveryConfigured({})).toBe(false);
    const adapter = getAdapterFor({}, {});
    expect(adapter.channel).toBe("clipboard");
    const result = await adapter.send(MESSAGE);
    expect(result.delivered).toBe(false);
    if (!result.delivered) expect(result.manualBody).toContain(MESSAGE.url);
  });

  it("with Resend configured, selection is the email adapter", () => {
    const env = { RESEND_API_KEY: "re_x", EMAIL_FROM: "a@b.gr" };
    expect(automaticDeliveryConfigured(env)).toBe(true);
    expect(getAdapterFor({}, env).channel).toBe("email");
  });
});

describe("renderEmail", () => {
  it("carries the link as a button and as visible text, in both parts", () => {
    const email = renderEmail(MESSAGE);
    expect(email.subject).toBe(MESSAGE.subject);
    expect(email.text).toContain(MESSAGE.url);
    expect(email.text).toContain("Γεια σου Δοκιμή!");
    expect(email.html.split(`href="${MESSAGE.url}"`).length - 1).toBe(2);
    expect(email.html).toContain("Δήλωση διαθεσιμότητας");
    expect(email.html).toContain('lang="el"');
  });

  it("escapes names and body text", () => {
    const email = renderEmail({ ...MESSAGE, body: 'Γεια σου <script>alert("x")</script>' });
    expect(email.html).not.toContain("<script>");
    expect(email.html).toContain("&lt;script&gt;");
  });

  it("never turns a non-http link into an href", () => {
    const email = renderEmail({ ...MESSAGE, url: "javascript:alert(1)" });
    expect(email.html).not.toContain('href="javascript:');
  });
});

describe("sendWithResend", () => {
  it("POSTs one message to Resend with the key, sender, idempotency key and both bodies", async () => {
    const fetchImpl = vi.fn(async () => jsonResponse(200, { id: "email_123" }));
    const outcome = await sendWithResend(CONFIG, "promoter@mailbox.gr", renderEmail(MESSAGE), "key-1", {
      fetchImpl: fetchImpl as unknown as typeof fetch,
      sleep: noSleep,
    });

    expect(outcome).toEqual({ ok: true, id: "email_123" });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe(RESEND_ENDPOINT);
    expect(init.method).toBe("POST");
    const headers = init.headers as Record<string, string>;
    expect(headers.Authorization).toBe(`Bearer ${CONFIG.apiKey}`);
    expect(headers["Idempotency-Key"]).toBe("key-1");
    const body = JSON.parse(String(init.body));
    expect(body).toMatchObject({ from: CONFIG.from, to: ["promoter@mailbox.gr"], subject: MESSAGE.subject });
    expect(typeof body.html).toBe("string");
    expect(typeof body.text).toBe("string");
  });

  it("treats 429 as retryable, honours Retry-After, and succeeds on the retry", async () => {
    const sleep = vi.fn(noSleep);
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(429, { name: "rate_limit_exceeded" }, { "retry-after": "1" }))
      .mockResolvedValueOnce(jsonResponse(200, { id: "email_2" }));

    const outcome = await sendWithResend(CONFIG, "a@mailbox.gr", renderEmail(MESSAGE), "k", {
      fetchImpl: fetchImpl as unknown as typeof fetch,
      sleep,
    });

    expect(outcome).toEqual({ ok: true, id: "email_2" });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(sleep).toHaveBeenCalledWith(1000);
  });

  it("gives up after the attempt budget on persistent 429 and says it was retryable", async () => {
    const fetchImpl = vi.fn(async () => jsonResponse(429, { name: "rate_limit_exceeded" }));
    const outcome = await sendWithResend(CONFIG, "a@mailbox.gr", renderEmail(MESSAGE), "k", {
      fetchImpl: fetchImpl as unknown as typeof fetch,
      sleep: noSleep,
      maxAttempts: 3,
    });
    expect(fetchImpl).toHaveBeenCalledTimes(3);
    expect(outcome).toEqual({ ok: false, retryable: true, status: 429, error: "rate_limit_exceeded" });
  });

  it("does not retry a 4xx, and never keeps Resend's message (it can quote the address)", async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse(422, { name: "validation_error", message: "Invalid `to` field: promoter@mailbox.gr" }),
    );
    const outcome = await sendWithResend(CONFIG, "promoter@mailbox.gr", renderEmail(MESSAGE), "k", {
      fetchImpl: fetchImpl as unknown as typeof fetch,
      sleep: noSleep,
    });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(outcome).toEqual({ ok: false, retryable: false, status: 422, error: "validation_error" });
    expect(JSON.stringify(outcome)).not.toContain("@");
  });

  it("retries a network failure", async () => {
    const fetchImpl = vi
      .fn()
      .mockRejectedValueOnce(new TypeError("fetch failed"))
      .mockResolvedValueOnce(jsonResponse(200, { id: "email_3" }));
    const outcome = await sendWithResend(CONFIG, "a@mailbox.gr", renderEmail(MESSAGE), "k", {
      fetchImpl: fetchImpl as unknown as typeof fetch,
      sleep: noSleep,
    });
    expect(outcome).toEqual({ ok: true, id: "email_3" });
  });

  it("awaits the pacer before every request, retries included", async () => {
    const beforeRequest = vi.fn(noSleep);
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(503, { name: "internal_server_error" }))
      .mockResolvedValueOnce(jsonResponse(200, { id: "e" }));
    await sendWithResend(CONFIG, "a@mailbox.gr", renderEmail(MESSAGE), "k", {
      fetchImpl: fetchImpl as unknown as typeof fetch,
      sleep: noSleep,
      beforeRequest,
    });
    expect(beforeRequest).toHaveBeenCalledTimes(2);
  });
});

describe("EmailAdapter", () => {
  it("delivers and reports the provider id", async () => {
    const fetchImpl = vi.fn(async () => jsonResponse(200, { id: "email_ok" }));
    const adapter = new EmailAdapter(CONFIG, manualFallback, {
      fetchImpl: fetchImpl as unknown as typeof fetch,
      sleep: noSleep,
    });
    const result = await adapter.send({ ...MESSAGE, idempotencyKey: "dispatch-1" });
    expect(result).toEqual({ delivered: true, channel: "email", providerMessageId: "email_ok" });
  });

  it("never calls Resend for the seed domain, and hands back the manual message with the reason", async () => {
    const fetchImpl = vi.fn();
    const adapter = new EmailAdapter(CONFIG, manualFallback, {
      fetchImpl: fetchImpl as unknown as typeof fetch,
      sleep: noSleep,
    });
    const result = await adapter.send({
      ...MESSAGE,
      to: { ...MESSAGE.to, email: "demo.promoter@example.invalid" },
    });
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(result).toMatchObject({ delivered: false, channel: "clipboard", reason: "reserved_domain" });
    if (!result.delivered) expect(result.manualBody).toContain(MESSAGE.url);
  });

  it("never calls Resend for a promoter with no email", async () => {
    const fetchImpl = vi.fn();
    const adapter = new EmailAdapter(CONFIG, manualFallback, { fetchImpl: fetchImpl as unknown as typeof fetch });
    const result = await adapter.send({ ...MESSAGE, to: { name: "x", phone: "+30690", email: null } });
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(result).toMatchObject({ delivered: false, reason: "no_address" });
  });

  it("returns a manual message and a short error when Resend refuses", async () => {
    const fetchImpl = vi.fn(async () => jsonResponse(403, { name: "invalid_from_address", message: "x" }));
    const adapter = new EmailAdapter(CONFIG, manualFallback, {
      fetchImpl: fetchImpl as unknown as typeof fetch,
      sleep: noSleep,
    });
    const result = await adapter.send(MESSAGE);
    expect(result).toMatchObject({
      delivered: false,
      channel: "email",
      reason: "provider_error",
      error: "resend_403:invalid_from_address",
    });
  });
});
