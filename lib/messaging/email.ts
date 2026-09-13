/**
 * P39 — the email adapter, over Resend's REST API.
 *
 * `fetch`, not an SDK: no dependency, nothing in `package.json`, and the whole provider surface is
 * one POST that a test can mock. Feature code never imports this file — it asks
 * `getAdapterFor()` in `./index.ts` for an adapter, exactly like every other channel.
 *
 * What this adapter promises:
 *
 *  - It never sends to an address `checkEmailAddress()` refuses (missing, malformed, or a reserved
 *    / example domain). It returns the fallback adapter's manual result instead, with a `reason`,
 *    so the caller can both show the coordinator the message AND record why it did not go.
 *  - It retries only what is retryable: HTTP 429 (Resend's default limit is 2 requests/second per
 *    team) and 5xx / network failures, a bounded number of times. A 4xx is a permanent answer.
 *  - Every request can carry an `Idempotency-Key`. The dispatcher passes one derived from its
 *    dispatch row id, so a retry of a request that actually succeeded is de-duplicated by Resend
 *    itself — a second line of defence behind the database's unique key.
 *  - Errors are reduced to a status and Resend's error *name* (`rate_limit_exceeded`,
 *    `validation_error`). The error *message* can quote the recipient address, so it is never
 *    returned, logged, or stored.
 */

import { translatorFor, DEFAULT_LOCALE } from "@/lib/i18n";
import { checkEmailAddress } from "./email-address";
import type { MessagingAdapter, OutboundMessage, SendResult } from "./index";

const t = translatorFor(DEFAULT_LOCALE);

export const RESEND_ENDPOINT = "https://api.resend.com/emails";

export type EmailConfig = { apiKey: string; from: string };

type Env = Record<string, string | undefined>;

/** Null unless BOTH variables are set. A key without a sender cannot send anything. */
export function emailConfigFrom(env: Env = process.env): EmailConfig | null {
  const apiKey = env.RESEND_API_KEY?.trim();
  const from = env.EMAIL_FROM?.trim();
  if (!apiKey || !from) return null;
  return { apiKey, from };
}

/** Which of the two variables are missing — for the settings screen, never the values. */
export function missingEmailEnv(env: Env = process.env): ("RESEND_API_KEY" | "EMAIL_FROM")[] {
  const missing: ("RESEND_API_KEY" | "EMAIL_FROM")[] = [];
  if (!env.RESEND_API_KEY?.trim()) missing.push("RESEND_API_KEY");
  if (!env.EMAIL_FROM?.trim()) missing.push("EMAIL_FROM");
  return missing;
}

// ---------------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------------

export type RenderedEmail = { subject: string; text: string; html: string };

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

/** Only our own http(s) links ever become an href. Anything else renders as inert text. */
function safeHref(url: string): string | null {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" || parsed.protocol === "http:" ? parsed.toString() : null;
  } catch {
    return null;
  }
}

/**
 * Plain, table-based HTML — the only layout every mail client renders the same way. The link
 * appears twice on purpose: as a big button for a thumb, and as visible text for the clients (and
 * the corporate filters) that strip or rewrite buttons.
 */
export function renderEmail(message: OutboundMessage): RenderedEmail {
  const subject = message.subject ?? t("messaging.email.default_subject");
  const action = message.actionLabel ?? t("messaging.email.default_action");
  const fallback = t("messaging.email.link_fallback");
  const note = t("messaging.email.automated_note");

  const text = [message.body, "", message.url, "", note].join("\n");

  const href = safeHref(message.url);
  const paragraphs = message.body
    .split(/\n{2,}|\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map(
      (line) =>
        `<p style="margin:0 0 12px;font-size:16px;line-height:24px;color:#1a1a1a;">${escapeHtml(line)}</p>`,
    )
    .join("");

  const button = href
    ? `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:20px 0 24px;"><tr><td style="border-radius:10px;background:#1f4fd1;">` +
      `<a href="${escapeHtml(href)}" target="_blank" style="display:inline-block;padding:14px 26px;font-size:16px;font-weight:600;line-height:20px;color:#ffffff;text-decoration:none;border-radius:10px;">${escapeHtml(action)}</a>` +
      `</td></tr></table>`
    : "";

  const linkText = href
    ? `<a href="${escapeHtml(href)}" target="_blank" style="color:#1f4fd1;word-break:break-all;">${escapeHtml(message.url)}</a>`
    : escapeHtml(message.url);

  const html =
    `<!doctype html><html lang="el"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(subject)}</title></head>` +
    `<body style="margin:0;padding:0;background:#f5f4f0;">` +
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f5f4f0;"><tr><td align="center" style="padding:24px 12px;">` +
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:520px;background:#ffffff;border:1px solid #e4e2da;border-radius:14px;">` +
    `<tr><td style="padding:28px 24px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">` +
    paragraphs +
    button +
    `<p style="margin:0 0 6px;font-size:13px;line-height:20px;color:#6b6a63;">${escapeHtml(fallback)}</p>` +
    `<p style="margin:0;font-size:13px;line-height:20px;">${linkText}</p>` +
    `</td></tr></table>` +
    `<p style="max-width:520px;margin:16px auto 0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:12px;line-height:18px;color:#8a8980;">${escapeHtml(note)}</p>` +
    `</td></tr></table></body></html>`;

  return { subject, text, html };
}

// ---------------------------------------------------------------------------
// Transport
// ---------------------------------------------------------------------------

export type ResendOutcome =
  | { ok: true; id: string | null }
  | { ok: false; retryable: boolean; status: number; error: string };

export type EmailAdapterOptions = {
  fetchImpl?: typeof fetch;
  sleep?: (ms: number) => Promise<void>;
  /**
   * Awaited before EVERY request, retries included. The dispatcher passes a shared pacer here so a
   * whole run stays under Resend's rate limit; an interactive send passes nothing.
   */
  beforeRequest?: () => Promise<void>;
  /** Total attempts per message, first try included. */
  maxAttempts?: number;
  timeoutMs?: number;
};

const DEFAULT_MAX_ATTEMPTS = 3;
const DEFAULT_TIMEOUT_MS = 10_000;
const MAX_BACKOFF_MS = 5_000;

const realSleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

function backoffMs(attempt: number, retryAfterHeader: string | null): number {
  const seconds = retryAfterHeader ? Number(retryAfterHeader) : Number.NaN;
  if (Number.isFinite(seconds) && seconds >= 0) return Math.min(seconds * 1000, MAX_BACKOFF_MS);
  return Math.min(600 * 2 ** (attempt - 1), MAX_BACKOFF_MS);
}

/** Resend's error body is `{ statusCode, name, message }`. Only `name` is safe to keep. */
async function errorName(res: Response): Promise<string> {
  try {
    const body = (await res.json()) as { name?: unknown };
    if (typeof body.name === "string" && /^[a-z0-9_]{1,64}$/i.test(body.name)) return body.name;
  } catch {
    // Not JSON. The status alone will have to do.
  }
  return "http_error";
}

export async function sendWithResend(
  config: EmailConfig,
  to: string,
  email: RenderedEmail,
  idempotencyKey: string | undefined,
  options: EmailAdapterOptions = {},
): Promise<ResendOutcome> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const sleep = options.sleep ?? realSleep;
  const maxAttempts = Math.max(1, options.maxAttempts ?? DEFAULT_MAX_ATTEMPTS);
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  const headers: Record<string, string> = {
    Authorization: `Bearer ${config.apiKey}`,
    "Content-Type": "application/json",
  };
  if (idempotencyKey) headers["Idempotency-Key"] = idempotencyKey.slice(0, 256);

  const payload = JSON.stringify({
    from: config.from,
    to: [to],
    subject: email.subject,
    html: email.html,
    text: email.text,
  });

  let last: ResendOutcome = { ok: false, retryable: true, status: 0, error: "not_attempted" };

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    if (options.beforeRequest) await options.beforeRequest();

    let res: Response;
    try {
      res = await fetchImpl(RESEND_ENDPOINT, {
        method: "POST",
        headers,
        body: payload,
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch {
      // Network failure or timeout. Retryable — and safe to retry, because of the idempotency key.
      last = { ok: false, retryable: true, status: 0, error: "network_error" };
      if (attempt < maxAttempts) await sleep(backoffMs(attempt, null));
      continue;
    }

    if (res.ok) {
      let id: string | null = null;
      try {
        const body = (await res.json()) as { id?: unknown };
        id = typeof body.id === "string" ? body.id : null;
      } catch {
        id = null;
      }
      return { ok: true, id };
    }

    const retryable = res.status === 429 || res.status >= 500;
    last = { ok: false, retryable, status: res.status, error: await errorName(res) };
    if (!retryable) return last;
    if (attempt < maxAttempts) await sleep(backoffMs(attempt, res.headers.get("retry-after")));
  }

  return last;
}

export class EmailAdapter implements MessagingAdapter {
  readonly channel = "email" as const;

  constructor(
    private readonly config: EmailConfig,
    /** What the coordinator gets when this adapter cannot deliver. */
    private readonly fallback: MessagingAdapter,
    private readonly options: EmailAdapterOptions = {},
  ) {}

  async send(message: OutboundMessage): Promise<SendResult> {
    const check = checkEmailAddress(message.to.email);

    if (!check.ok) {
      const manual = await this.fallback.send(message);
      if (manual.delivered) return manual;
      return {
        ...manual,
        reason:
          check.reason === "missing"
            ? "no_address"
            : check.reason === "invalid"
              ? "invalid_address"
              : "reserved_domain",
      };
    }

    const outcome = await sendWithResend(
      this.config,
      check.address,
      renderEmail(message),
      message.idempotencyKey,
      this.options,
    );

    if (outcome.ok) {
      return { delivered: true, channel: this.channel, providerMessageId: outcome.id };
    }

    return {
      delivered: false,
      channel: this.channel,
      manualBody: `${message.body}\n\n${message.url}`,
      reason: outcome.status === 429 ? "rate_limited" : "provider_error",
      error: outcome.status > 0 ? `resend_${outcome.status}:${outcome.error}` : outcome.error,
    };
  }
}
