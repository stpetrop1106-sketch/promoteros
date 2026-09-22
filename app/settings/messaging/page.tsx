import type { Metadata } from "next";
import { translatorFor, DEFAULT_LOCALE } from "@/lib/i18n";
import { isoAsUtcDate } from "@/lib/availability-links";
import {
  Badge,
  Card,
  Icon,
  LinkButton,
  PageHeader,
  SectionHeading,
  StatStrip,
  StatTile,
} from "@/components/ui";
import { loadMessagingSettings } from "./data";
import { AutoSwitchForm } from "./auto-switch-form";
import { ManualSendList } from "./manual-send-list";
import { SendNow } from "./send-now";

export const dynamic = "force-dynamic";
/** "Send now" runs in `after()` from this page's action; give it the time a roster needs. */
export const maxDuration = 300;

export const metadata: Metadata = { title: translatorFor(DEFAULT_LOCALE)("page_title.settings_messaging") };

const t = translatorFor(DEFAULT_LOCALE);

function formatIsoDate(iso: string): string {
  return new Intl.DateTimeFormat("el-GR", { timeZone: "UTC", day: "numeric", month: "long" }).format(
    isoAsUtcDate(iso),
  );
}

function formatInstant(iso: string): string {
  return new Intl.DateTimeFormat("el-GR", {
    timeZone: "Europe/Athens",
    dateStyle: "medium",
    timeStyle: "short",
    // A2 finding 30 — 24-hour everywhere.
    hourCycle: "h23",
  }).format(new Date(iso));
}

function Notice({ tone, title, body }: { tone: "warn" | "info"; title: string; body: string }) {
  const palette =
    tone === "warn"
      ? "border-[color:var(--color-warn-line)] bg-[color:var(--color-warn-subtle)] text-[color:var(--color-warn-ink)]"
      : "border-[color:var(--color-accent-line)] bg-[color:var(--color-accent-subtle)] text-[color:var(--color-accent-ink)]";
  return (
    <div role="status" className={`flex items-start gap-2.5 rounded-xl border px-4 py-3 text-sm leading-5 ${palette}`}>
      <Icon name="alert" size={18} className="mt-0.5 shrink-0" />
      <div className="min-w-0">
        <p className="font-semibold">{title}</p>
        <p className="mt-1 opacity-90">{body}</p>
      </div>
    </div>
  );
}

/**
 * P39 — automatic messaging.
 *
 * The screen answers three questions for the coordinator, in the order they ask them: is it on,
 * did the last run work, and who do I still have to message myself. The third is the reason the
 * screen exists — email reaches only promoters with a real address, and the product says so
 * rather than pretending everyone was reached.
 */
export default async function MessagingSettingsPage() {
  const s = await loadMessagingSettings();
  const canSend = s.isOwner && s.emailConfigured && s.migrationApplied;

  return (
    <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6 sm:py-12">
      <PageHeader
        title={t("messaging.title")}
        subtitle={t("messaging.subtitle")}
        actions={
          <LinkButton href="/settings" variant="ghost" size="sm">
            {t("messaging.back_to_settings")}
          </LinkButton>
        }
      />

      <div className="mt-8 flex flex-col gap-3">
        {!s.migrationApplied ? (
          <Notice tone="warn" title={t("messaging.migration_missing.title")} body={t("messaging.migration_missing.body")} />
        ) : null}
        {!s.emailConfigured ? (
          <Notice
            tone="info"
            title={t("messaging.not_configured.title")}
            body={t("messaging.not_configured.body", { vars: s.missingEnv.join(", ") })}
          />
        ) : null}
      </div>

      <div className="mt-6 flex flex-col gap-6">
        <Card
          header={
            <SectionHeading
              level={3}
              title={t("messaging.auto.title")}
              description={t("messaging.auto.description")}
            />
          }
        >
          <div className="flex flex-col gap-4">
            {s.isOwner && s.migrationApplied ? (
              <AutoSwitchForm enabled={s.autoEnabled} />
            ) : (
              <div className="flex flex-col gap-2">
                <Badge variant={s.autoEnabled ? "ok" : "neutral"} dot className="self-start">
                  {s.autoEnabled ? t("messaging.auto.state_on") : t("messaging.auto.state_off")}
                </Badge>
                {!s.isOwner ? (
                  <p className="text-xs leading-5 text-[color:var(--color-muted)]">{t("messaging.auto.owner_only")}</p>
                ) : null}
              </div>
            )}
            <p className="border-t border-[color:var(--color-line)] pt-4 text-sm leading-6 text-[color:var(--color-muted)]">
              {s.autoEnabled
                ? t("messaging.auto.next_run", { date: formatIsoDate(s.nextRunDate) })
                : t("messaging.auto.next_run_off")}
            </p>
          </div>
        </Card>

        <Card
          header={
            <SectionHeading
              level={3}
              title={t("messaging.last_run.title")}
              meta={
                s.lastRun
                  ? `${formatInstant(s.lastRun.at)} · ${
                      s.lastRun.manual ? t("messaging.last_run.manual") : t("messaging.last_run.scheduled")
                    }`
                  : undefined
              }
            />
          }
        >
          {s.lastRun ? (
            <div className="flex flex-col gap-3">
              <StatStrip>
                <StatTile
                  label={t("messaging.last_run.sent")}
                  value={s.lastRun.sent}
                  tone={s.lastRun.sent > 0 ? "ok" : "neutral"}
                  icon={<Icon name="check" size={18} />}
                />
                <StatTile
                  label={t("messaging.last_run.no_email")}
                  value={s.lastRun.skippedNoEmail}
                  tone={s.lastRun.skippedNoEmail > 0 ? "warn" : "neutral"}
                  icon={<Icon name="inbox" size={18} />}
                />
                <StatTile
                  label={t("messaging.last_run.reserved_domain")}
                  value={s.lastRun.skippedReservedDomain}
                  tone={s.lastRun.skippedReservedDomain > 0 ? "warn" : "neutral"}
                  icon={<Icon name="alert" size={18} />}
                />
                <StatTile
                  label={t("messaging.last_run.failed")}
                  value={s.lastRun.failed}
                  tone={s.lastRun.failed > 0 ? "bad" : "neutral"}
                  icon={<Icon name="close" size={18} />}
                />
              </StatStrip>
              {s.lastRun.pending > 0 ? (
                <p className="text-xs leading-5 text-[color:var(--color-muted)]">
                  {t("messaging.last_run.pending", { count: s.lastRun.pending })}
                </p>
              ) : null}
            </div>
          ) : (
            <p className="text-sm leading-6 text-[color:var(--color-muted)]">{t("messaging.last_run.none")}</p>
          )}

          <div className="mt-5 border-t border-[color:var(--color-line)] pt-5">
            {canSend ? (
              <SendNow
                reachable={s.reachableCount}
                alreadySentToday={s.alreadySentToday}
                unreachable={s.unreachable.length}
              />
            ) : (
              <p className="text-xs leading-5 text-[color:var(--color-muted)]">
                {!s.isOwner
                  ? t("messaging.send_now.owner_only")
                  : !s.emailConfigured
                    ? t("messaging.send_now.needs_email")
                    : t("messaging.send_now.needs_migration")}
              </p>
            )}
          </div>
        </Card>

        <section className="flex flex-col gap-3">
          <SectionHeading
            title={t("messaging.unreachable.title")}
            meta={String(s.unreachable.length)}
            description={
              s.emailConfigured ? t("messaging.unreachable.description") : t("messaging.unreachable.description_no_email")
            }
          />

          {/* A2 finding 25 — the list is now searchable. `ManualSendList` is a client island
              because the filtering is over rows that are already on the page. */}
          {s.unreachable.length === 0 ? (
            <Card>
              <p className="flex items-center gap-2 text-sm text-[color:var(--color-ok-ink)]">
                <Icon name="check" size={16} />
                {s.activeCount === 0 ? t("messaging.unreachable.no_promoters") : t("messaging.unreachable.none")}
              </p>
            </Card>
          ) : (
            <ManualSendList promoters={s.unreachable} />
          )}
        </section>
      </div>
    </main>
  );
}
