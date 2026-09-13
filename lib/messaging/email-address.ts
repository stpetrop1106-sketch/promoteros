/**
 * P39 — may we email this address at all?
 *
 * PURE and client-safe: no environment, no network. Used by the email adapter before every send
 * and by /settings/messaging to tell a coordinator, before any run, which promoters the automation
 * cannot reach.
 *
 * The reserved-domain rule is not tidiness. Seed and demo data use `@example.invalid`; mail sent
 * to a reserved or example domain hard-bounces, and a sending domain that bounces loses reputation
 * with the mailbox providers — after which mail to REAL promoters of EVERY agency starts landing in
 * spam. One demo roster could degrade the product for all customers, so these addresses are
 * refused here and recorded as `reserved_domain`, never attempted.
 */

export type EmailCheck =
  | { ok: true; address: string }
  | { ok: false; reason: "missing" | "invalid" | "reserved_domain" };

/**
 * RFC 2606 / RFC 6761 special-use names. Any domain ending in one of these TLDs can never receive
 * mail from the public internet.
 */
const RESERVED_TLDS = ["invalid", "test", "example", "localhost"] as const;

/** RFC 2606 second-level example domains — and every subdomain of them. */
const RESERVED_DOMAINS = ["example.com", "example.net", "example.org"] as const;

/**
 * Deliberately modest. This is not an RFC 5322 validator (nothing is); it rejects what would make
 * the provider reject the request, and leaves real-world oddities to bounce handling.
 */
const SHAPE = /^[^\s@]+@[^\s@]+\.[^\s@.]{2,}$/;

export function checkEmailAddress(raw: string | null | undefined): EmailCheck {
  if (raw === null || raw === undefined) return { ok: false, reason: "missing" };
  const trimmed = raw.trim();
  if (trimmed.length === 0) return { ok: false, reason: "missing" };
  if (trimmed.length > 254) return { ok: false, reason: "invalid" };

  const at = trimmed.lastIndexOf("@");
  if (at <= 0) return { ok: false, reason: "invalid" };

  const local = trimmed.slice(0, at);
  // A trailing dot is a legal fully-qualified form ("example.com.") and must not slip past the
  // reserved check below.
  const domain = trimmed.slice(at + 1).toLowerCase().replace(/\.$/, "");

  if (isReservedDomain(domain)) return { ok: false, reason: "reserved_domain" };

  const address = `${local}@${domain}`;
  if (!SHAPE.test(address) || domain.includes("..") || domain.startsWith(".")) {
    return { ok: false, reason: "invalid" };
  }

  return { ok: true, address };
}

export function isReservedDomain(domain: string): boolean {
  const d = domain.trim().toLowerCase().replace(/\.$/, "");
  if (d.length === 0) return false;
  if (d === "localhost") return true;

  const labels = d.split(".");
  const tld = labels[labels.length - 1] ?? "";
  if ((RESERVED_TLDS as readonly string[]).includes(tld)) return true;

  return RESERVED_DOMAINS.some((reserved) => d === reserved || d.endsWith(`.${reserved}`));
}
