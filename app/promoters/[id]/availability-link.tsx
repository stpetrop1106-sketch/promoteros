"use client";

import { useState, useTransition } from "react";
import { translatorFor, DEFAULT_LOCALE } from "@/lib/i18n";
import { Button, Card, Icon } from "@/components/ui";
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
    <Card header={<h2 className="text-sm font-semibold text-[color:var(--color-ink)]">{t("availability_link.title")}</h2>}>
      <p className="text-sm text-[color:var(--color-muted)]">{t("availability_link.description")}</p>

      {state.status === "error" && (
        <p role="alert" className="mt-3 text-sm font-medium text-[color:var(--color-bad-ink)]">
          {state.reason === "not_found"
            ? t("availability_link.error.not_found")
            : t("availability_link.error.failed")}
        </p>
      )}

      {state.status === "ready" ? (
        <div className="mt-3">
          <label className="text-xs font-medium text-[color:var(--color-muted)]" htmlFor="availability-link-message">
            {t("availability_link.message_label")}
          </label>
          <textarea
            id="availability-link-message"
            readOnly
            value={message}
            rows={4}
            className="mt-1.5 w-full rounded-lg border border-[color:var(--color-line-strong)] bg-[color:var(--color-canvas-sunken)]/50 p-2.5 text-xs leading-5 text-[color:var(--color-ink-soft)]"
          />
          <div className="mt-2.5 flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              iconLeft={copied ? <Icon name="check" size={14} /> : undefined}
              onClick={() => {
                void navigator.clipboard.writeText(message).then(
                  () => setCopied(true),
                  () => setCopied(false),
                );
              }}
            >
              {copied ? t("availability_link.copied") : t("common.copy")}
            </Button>
            <Button type="button" variant="ghost" size="sm" disabled={pending} onClick={create}>
              {t("availability_link.regenerate")}
            </Button>
          </div>
          <p className="mt-2.5 text-xs text-[color:var(--color-muted)]">
            {t("availability_link.expires", { date: formatExpiry(state.expiresAt) })}
          </p>
        </div>
      ) : (
        <Button type="button" size="sm" className="mt-3" loading={pending} onClick={create}>
          {pending ? t("availability_link.creating") : t("availability_link.create")}
        </Button>
      )}
    </Card>
  );
}

/** `expiresAt` is a real instant (`timestamptz`-shaped ISO string), so this conversion is safe. */
function formatExpiry(iso: string): string {
  return new Intl.DateTimeFormat("el-GR", {
    timeZone: "Europe/Athens",
    dateStyle: "long",
  }).format(new Date(iso));
}
