"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  Badge,
  Card,
  CopyButton,
  EmptyState,
  Icon,
  LinkButton,
  TextField,
  WhatsAppButton,
  type BadgeVariant,
} from "@/components/ui";
import { translatorFor, DEFAULT_LOCALE, type TranslationKey } from "@/lib/i18n";
import type { UnreachableReason } from "@/lib/dispatch/summary";
// Type-only: `data.ts` is `server-only`, and a type import is erased, so this never drags the
// server module into the client bundle. CLAUDE.md, "the server/client boundary".
import type { UnreachablePromoter } from "./data";

const t = translatorFor(DEFAULT_LOCALE);

const REASON: Record<UnreachableReason, { key: TranslationKey; variant: BadgeVariant }> = {
  email_not_configured: { key: "messaging.reason.email_not_configured", variant: "neutral" },
  no_email: { key: "messaging.reason.no_email", variant: "warn" },
  invalid_email: { key: "messaging.reason.invalid_email", variant: "warn" },
  reserved_domain: { key: "messaging.reason.reserved_domain", variant: "warn" },
  last_send_failed: { key: "messaging.reason.last_send_failed", variant: "bad" },
};

/** Accents and case must not decide whether a name matches what someone typed. */
function fold(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
}

/**
 * A2 finding 25 — the manual-send list is the right idea and was unusable at scale: 59 rows
 * today, 150 on the Starter plan's own promoter limit, with no search and no filter. The
 * coordinator works down it one promoter at a time, in a messenger, and had no way to find the
 * one they were looking at.
 *
 * Filtering happens here rather than in the query on purpose: the whole list is already on the
 * page (it has to be — every row carries a freshly minted link), so a round trip per keystroke
 * would buy nothing. Accent- and case-insensitive, over name and phone, which is what
 * `/promoters` searches too.
 *
 * The audit also asked for "a way to see who has already been sent one". That needs somewhere to
 * record it — a column, i.e. a migration this parcel may not write — so it is not here. See
 * `docs/status/F1.md`.
 */
export function ManualSendList({ promoters }: { promoters: UnreachablePromoter[] }) {
  const [query, setQuery] = useState("");

  const shown = useMemo(() => {
    const needle = fold(query.trim());
    if (!needle) return promoters;
    return promoters.filter(
      (p) => fold(p.fullName).includes(needle) || fold(p.phone).includes(needle),
    );
  }, [promoters, query]);

  return (
    <div className="flex flex-col gap-3">
      <Card>
        <div className="flex flex-wrap items-end gap-3">
          <TextField
            id="manual-send-search"
            name="q"
            type="search"
            label={t("messaging.unreachable.search_label")}
            placeholder={t("messaging.unreachable.search_placeholder")}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            containerClassName="min-w-0 flex-1"
            autoComplete="off"
          />
          <p className="pb-2.5 text-xs tabular-nums text-[color:var(--color-muted)]">
            {t("messaging.unreachable.search_count", {
              shown: shown.length,
              total: promoters.length,
            })}
          </p>
        </div>
      </Card>

      {shown.length === 0 ? (
        <Card>
          <EmptyState
            bare
            icon={<Icon name="search" size={22} />}
            title={t("messaging.unreachable.search_empty_title")}
            description={t("messaging.unreachable.search_empty_body")}
          />
        </Card>
      ) : (
        <Card flush>
          <ul className="divide-y divide-[color:var(--color-line)]">
            {shown.map((p) => {
              const reason = REASON[p.reason];
              const inputId = `unreachable-link-${p.id}`;
              const addressProblem =
                p.reason === "no_email" || p.reason === "invalid_email" || p.reason === "reserved_domain";
              return (
                <li key={p.id} className="flex flex-col gap-3 px-4 py-4 sm:px-6">
                  <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1.5">
                    <div className="min-w-0">
                      <Link
                        href={`/promoters/${p.id}`}
                        className="font-medium text-[color:var(--color-ink)] hover:underline"
                      >
                        {p.fullName}
                      </Link>
                      <p className="text-xs tabular-nums text-[color:var(--color-muted)]">{p.phone}</p>
                    </div>
                    <Badge variant={reason.variant} size="sm">
                      {t(reason.key)}
                    </Badge>
                  </div>
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start">
                    <input
                      id={inputId}
                      readOnly
                      value={p.url}
                      aria-label={t("messaging.unreachable.link_label", { name: p.fullName })}
                      className="h-8 min-w-0 flex-1 rounded-lg border border-[color:var(--color-line-strong)] bg-[color:var(--color-n-25)] px-2.5 text-xs text-[color:var(--color-ink-soft)]"
                    />
                    <div className="flex flex-wrap items-start gap-2">
                      <CopyButton text={p.message} selectTargetId={inputId} />
                      <WhatsAppButton phone={p.phone} text={p.message} />
                      {addressProblem ? (
                        <LinkButton href={`/promoters/${p.id}/edit`} variant="ghost" size="sm">
                          {t("messaging.unreachable.fix_email")}
                        </LinkButton>
                      ) : null}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        </Card>
      )}
    </div>
  );
}
