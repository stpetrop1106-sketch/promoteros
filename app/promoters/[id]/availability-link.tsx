"use client";

import { useState, useTransition } from "react";
import { translatorFor, DEFAULT_LOCALE } from "@/lib/i18n";
import {
  createAvailabilityLink,
  type MintLinkState,
} from "@/app/a/[token]/coordinator-actions";

const t = translatorFor(DEFAULT_LOCALE);

/**
 * P30 — "copy this promoter's availability link".
 *
 * Same shape as the invitation's clipboard adapter (`app/shifts/[id]/invite-button.tsx`): we
 * render the exact message and the coordinator pastes it into WhatsApp themselves. That is what
 * they already do by hand, it needs no Meta verification, and it keeps the agency in control of
 * the tone of the message. Never a provider SDK from feature code — CLAUDE.md, "Messaging".
 *
 * Self-contained on purpose: it resolves its own strings rather than taking twelve label props,
 * so mounting it anywhere on the coordinator's promoter screen is a one-liner
 * (`<AvailabilityLink promoterId={p.id} />`). `lib/i18n` holds plain objects and is already
 * imported by other client components (`app/promoters/promoter-form.tsx`).
 *
 * Minting writes nothing to the database — it is an HMAC over the promoter id — so re-opening
 * this control simply issues a fresh link. A promoter can therefore hold two working links at
 * once; both point at the same page and neither leaks anything the other does not.
 */
export function AvailabilityLink({
  promoterId,
  promoterName,
}: {
  promoterId: string;
  promoterName?: string;
}) {
  const [state, setState] = useState<MintLinkState>({ status: "idle" });
  const [copied, setCopied] = useState(false);
  const [pending, startTransition] = useTransition();

  function create() {
    setCopied(false);
    startTransition(async () => {
      setState(await createAvailabilityLink(promoterId));
    });
  }

  const message =
    state.status === "ready"
      ? [
          promoterName ? t("availability_link.message.greeting", { name: promoterName }) : null,
          t("availability_link.message.body"),
          state.url,
        ]
          .filter((line): line is string => Boolean(line))
          .join("\n")
      : "";

  return (
    <section className="rounded-xl border border-[color:var(--color-line)] bg-[color:var(--color-surface)] p-4">
      <h2 className="text-sm font-semibold">{t("availability_link.title")}</h2>
      <p className="mt-1 text-sm text-[color:var(--color-muted)]">
        {t("availability_link.description")}
      </p>

      {state.status === "error" && (
        <p role="alert" className="mt-3 text-sm text-[color:var(--color-bad)]">
          {state.reason === "not_found"
            ? t("availability_link.error.not_found")
            : t("availability_link.error.failed")}
        </p>
      )}

      {state.status === "ready" ? (
        <div className="mt-3">
          <label className="block text-xs text-[color:var(--color-muted)]" htmlFor="availability-link-message">
            {t("availability_link.message_label")}
          </label>
          <textarea
            id="availability-link-message"
            readOnly
            value={message}
            rows={4}
            className="mt-1 w-full rounded-lg border border-[color:var(--color-line)] bg-white p-2 text-xs"
          />
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => {
                void navigator.clipboard.writeText(message).then(
                  () => setCopied(true),
                  () => setCopied(false),
                );
              }}
              className="rounded-lg border border-[color:var(--color-line)] px-3 py-1.5 text-sm font-medium hover:bg-[color:var(--color-canvas)]"
            >
              {copied ? t("availability_link.copied") : t("common.copy")}
            </button>
            <button
              type="button"
              onClick={create}
              disabled={pending}
              className="rounded-lg px-3 py-1.5 text-sm text-[color:var(--color-muted)] underline underline-offset-2 disabled:opacity-50"
            >
              {t("availability_link.regenerate")}
            </button>
          </div>
          <p className="mt-2 text-xs text-[color:var(--color-muted)]">
            {t("availability_link.expires", { date: formatExpiry(state.expiresAt) })}
          </p>
        </div>
      ) : (
        <button
          type="button"
          onClick={create}
          disabled={pending}
          className="mt-3 rounded-lg bg-[color:var(--color-accent)] px-4 py-2 text-sm font-semibold text-white hover:bg-[color:var(--color-accent-hover)] disabled:opacity-50"
        >
          {pending ? t("availability_link.creating") : t("availability_link.create")}
        </button>
      )}
    </section>
  );
}

/** `expiresAt` is a real instant (`timestamptz`-shaped ISO string), so this conversion is safe. */
function formatExpiry(iso: string): string {
  return new Intl.DateTimeFormat("el-GR", {
    timeZone: "Europe/Athens",
    dateStyle: "long",
  }).format(new Date(iso));
}
