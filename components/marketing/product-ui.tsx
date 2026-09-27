import { translatorFor, type Locale, type TranslationKey } from "@/lib/i18n";

/**
 * The product mock-ups on the landing page.
 *
 * These are drawn, not screenshotted, and they are the point of the page: a promotion agency owner
 * decides in about four seconds whether this is real software or a template with a stock photo in
 * it. So they use the application's own tokens — the same borders, the same warm paper, the same
 * status colours — and they show the mechanism rather than a shape that suggests one.
 *
 * EVERY NAME AND STORE IN HERE IS INVENTED, and each panel carries a visible "example data" badge.
 * CLAUDE.md's first constraint is that no real agency's data ever enters this product, and a
 * marketing page is exactly where a "realistic example" quietly becomes somebody's actual roster.
 *
 * Each panel resolves its own translator from a `locale` string rather than taking `t` as a prop.
 * A function prop across a server/client boundary is the bug this repo has shipped five times
 * (CLAUDE.md, "A function is not a prop"); a string cannot be that bug.
 */

type Props = { locale: Locale };

function Panel({
  children,
  label,
  locale,
}: {
  children: React.ReactNode;
  label: string;
  locale: Locale;
}) {
  const t = translatorFor(locale);
  return (
    <figure className="overflow-hidden rounded-[var(--radius-xl)] border border-[color:var(--color-line)] bg-[color:var(--color-surface)]">
      <figcaption className="flex items-center justify-between gap-3 border-b border-[color:var(--color-line)] bg-[color:var(--color-n-25)] px-4 py-2.5 sm:px-5">
        <span className="text-[0.8rem] font-medium text-[color:var(--color-ink-soft)]">{label}</span>
        <span className="rounded-full border border-[color:var(--color-line)] px-2 py-0.5 text-[0.65rem] uppercase tracking-[0.1em] text-[color:var(--color-muted)]">
          {t("ui.demo_badge")}
        </span>
      </figcaption>
      {children}
    </figure>
  );
}

function Tag({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-[0.78rem] text-[color:var(--color-muted)]">
      <svg width="11" height="11" viewBox="0 0 12 12" aria-hidden="true" className="shrink-0">
        <path
          d="M2.5 6.2l2.4 2.4 4.6-5"
          fill="none"
          stroke="var(--color-ok)"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      {children}
    </span>
  );
}

const CANDIDATES: { name: TranslationKey; score: number; tags: TranslationKey[] }[] = [
  { name: "ui.person_1", score: 98, tags: ["ui.tag_available", "ui.tag_beauty", "ui.tag_nearby"] },
  { name: "ui.person_2", score: 94, tags: ["ui.tag_available", "ui.tag_beauty"] },
  { name: "ui.person_3", score: 87, tags: ["ui.tag_available", "ui.tag_retail"] },
];

/** The ranked shortlist for one shift — the thing the product is actually for. */
export function MatchingPanel({ locale }: Props) {
  const t = translatorFor(locale);

  return (
    <Panel locale={locale} label={t("ui.match_title")}>
      <div className="border-b border-[color:var(--color-line)] px-4 py-4 sm:px-5">
        <p className="text-[0.95rem] font-medium text-[color:var(--color-ink)]">
          {t("ui.shift_store")}
        </p>
        <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[0.82rem] text-[color:var(--color-muted)]">
          <span>{t("ui.shift_when")}</span>
          <span aria-hidden="true">·</span>
          <span>{t("ui.shift_needed")}</span>
        </p>
      </div>

      <ol>
        {CANDIDATES.map((candidate, index) => (
          <li
            key={candidate.name}
            className="flex items-start gap-3 border-b border-[color:var(--color-line)] px-4 py-4 last:border-b-0 sm:gap-4 sm:px-5"
          >
            <span className="mt-0.5 w-5 shrink-0 font-mono text-[0.72rem] tabular-nums text-[color:var(--color-muted-soft)]">
              {String(index + 1).padStart(2, "0")}
            </span>

            <div className="min-w-0 flex-1">
              <div className="flex items-baseline justify-between gap-3">
                <span className="truncate text-[0.95rem] font-medium text-[color:var(--color-ink)]">
                  {t(candidate.name)}
                </span>
                <span className="shrink-0 font-mono text-[0.8rem] tabular-nums text-[color:var(--color-action-ink)]">
                  {candidate.score}% <span className="text-[color:var(--color-muted)]">{t("ui.match_suffix")}</span>
                </span>
              </div>

              <div
                className="mt-2.5 h-[3px] w-full overflow-hidden rounded-full bg-[color:var(--color-canvas-sunken)]"
                role="presentation"
              >
                <div
                  className="h-full rounded-full bg-[color:var(--color-action)]"
                  style={{ width: `${candidate.score}%` }}
                />
              </div>

              <div className="mt-2.5 flex flex-wrap gap-x-4 gap-y-1">
                {candidate.tags.map((tag) => (
                  <Tag key={tag}>{t(tag)}</Tag>
                ))}
              </div>
            </div>
          </li>
        ))}
      </ol>

      <div className="border-t border-[color:var(--color-line)] px-4 py-3.5 sm:px-5">
        <span className="inline-flex rounded-[var(--radius-sm)] bg-[color:var(--color-accent)] px-3.5 py-2 text-[0.82rem] font-medium text-white">
          {t("ui.assign")}
        </span>
      </div>
    </Panel>
  );
}

const STATUS: Record<
  "confirmed" | "pending" | "cancelled" | "replacing",
  { key: TranslationKey; dot: string; text: string }
> = {
  confirmed: { key: "ui.status_confirmed", dot: "var(--color-ok)", text: "var(--color-ok-ink)" },
  pending: { key: "ui.status_pending", dot: "var(--color-warn)", text: "var(--color-warn-ink)" },
  cancelled: { key: "ui.status_cancelled", dot: "var(--color-bad)", text: "var(--color-bad-ink)" },
  replacing: { key: "ui.status_replacing", dot: "var(--color-ok)", text: "var(--color-ok-ink)" },
};

const ROWS: {
  shift: TranslationKey;
  person: TranslationKey;
  status: keyof typeof STATUS;
}[] = [
  { shift: "ui.board_shift_1", person: "ui.person_1", status: "confirmed" },
  { shift: "ui.board_shift_2", person: "ui.person_2", status: "pending" },
  { shift: "ui.board_shift_3", person: "ui.person_3", status: "cancelled" },
  { shift: "ui.board_shift_4", person: "ui.person_4", status: "replacing" },
];

/** Every shift, and where each one stands. */
export function ShiftBoardPanel({ locale }: Props) {
  const t = translatorFor(locale);

  return (
    <Panel locale={locale} label={t("ui.board_title")}>
      <div className="grid grid-cols-[1.2fr_1fr_1fr] gap-3 border-b border-[color:var(--color-line)] px-4 py-2.5 text-[0.7rem] uppercase tracking-[0.08em] text-[color:var(--color-muted)] sm:px-5">
        <span>{t("ui.board_col_shift")}</span>
        <span>{t("ui.board_col_promoter")}</span>
        <span>{t("ui.board_col_status")}</span>
      </div>

      {ROWS.map((row) => {
        const status = STATUS[row.status];
        return (
          <div
            key={row.shift}
            className="grid grid-cols-[1.2fr_1fr_1fr] items-center gap-3 border-b border-[color:var(--color-line)] px-4 py-3.5 text-[0.85rem] last:border-b-0 sm:px-5"
          >
            <span className="truncate text-[color:var(--color-ink-soft)]">{t(row.shift)}</span>
            <span className="truncate text-[color:var(--color-ink)]">{t(row.person)}</span>
            <span className="inline-flex items-center gap-1.5 truncate" style={{ color: status.text }}>
              <span
                className="size-1.5 shrink-0 rounded-full"
                style={{ background: status.dot }}
                aria-hidden="true"
              />
              <span className="truncate">{t(status.key)}</span>
            </span>
          </div>
        );
      })}
    </Panel>
  );
}

/** Who is standing in the store right now, and who is not. */
export function AttendancePanel({ locale }: Props) {
  const t = translatorFor(locale);

  const arrived: { name: TranslationKey; time: TranslationKey }[] = [
    { name: "ui.person_1", time: "ui.att_time_1" },
    { name: "ui.person_2", time: "ui.att_time_2" },
  ];

  return (
    <Panel locale={locale} label={t("ui.att_title")}>
      {arrived.map((row) => (
        <div
          key={row.name}
          className="flex items-center justify-between gap-3 border-b border-[color:var(--color-line)] px-4 py-3.5 sm:px-5"
        >
          <span className="flex min-w-0 items-center gap-2.5">
            <svg width="14" height="14" viewBox="0 0 12 12" aria-hidden="true" className="shrink-0">
              <circle cx="6" cy="6" r="6" fill="var(--color-ok-subtle)" />
              <path
                d="M3.2 6.2l2 2 3.6-4"
                fill="none"
                stroke="var(--color-ok)"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            <span className="truncate text-[0.9rem] text-[color:var(--color-ink)]">{t(row.name)}</span>
          </span>
          <span className="shrink-0 text-right">
            <span className="block font-mono text-[0.82rem] tabular-nums text-[color:var(--color-ink-soft)]">
              {t(row.time)}
            </span>
            <span className="block text-[0.72rem] text-[color:var(--color-muted)]">
              {t("ui.att_arrived")}
            </span>
          </span>
        </div>
      ))}

      <div className="flex items-start gap-2.5 bg-[color:var(--color-warn-subtle)] px-4 py-3.5 sm:px-5">
        <span
          className="mt-1.5 size-1.5 shrink-0 rounded-full bg-[color:var(--color-warn)]"
          aria-hidden="true"
        />
        <span className="min-w-0">
          <span className="block text-[0.9rem] text-[color:var(--color-ink)]">
            {t("ui.person_3")} — {t("ui.att_late")}
          </span>
          <span className="mt-0.5 block text-[0.75rem] text-[color:var(--color-warn-ink)]">
            {t("ui.att_alert")}
          </span>
        </span>
      </div>
    </Panel>
  );
}

/**
 * The hero's overview: what a coordinator sees when they open the product in the morning.
 *
 * Deliberately a DIFFERENT screen from the three below it. Showing the same panel in the hero and
 * again in a feature section is the tell of a page assembled from one mock-up — and the whole
 * brief here is to not look like that.
 */
export function TodayPanel({ locale }: Props) {
  const t = translatorFor(locale);

  const stats: { value: string; label: TranslationKey }[] = [
    { value: "14", label: "ui.today_shifts" },
    { value: "12", label: "ui.today_confirmed" },
    { value: "9", label: "ui.today_arrived" },
    { value: "1", label: "ui.today_attention" },
  ];

  return (
    <Panel locale={locale} label={t("ui.today_title")}>
      <div className="grid grid-cols-2 sm:grid-cols-4">
        {stats.map((stat, i) => (
          <div
            key={stat.label}
            className={`border-[color:var(--color-line)] px-4 py-4 sm:px-5 ${
              i < 2 ? "border-b sm:border-b-0" : ""
            } ${i % 2 === 0 ? "border-r" : ""} sm:border-r sm:last:border-r-0`}
          >
            <p
              className={`font-mono text-2xl tabular-nums ${
                stat.label === "ui.today_attention"
                  ? "text-[color:var(--color-warn-ink)]"
                  : "text-[color:var(--color-ink)]"
              }`}
            >
              {stat.value}
            </p>
            <p className="mt-1 text-[0.75rem] text-[color:var(--color-muted)]">{t(stat.label)}</p>
          </div>
        ))}
      </div>

      <div className="flex items-start gap-2.5 border-t border-[color:var(--color-line)] bg-[color:var(--color-warn-subtle)] px-4 py-3.5 sm:px-5">
        <span
          className="mt-1.5 size-1.5 shrink-0 rounded-full bg-[color:var(--color-warn)]"
          aria-hidden="true"
        />
        <span className="min-w-0">
          <span className="block text-[0.88rem] text-[color:var(--color-ink)]">{t("ui.person_3")}</span>
          <span className="mt-0.5 block text-[0.75rem] text-[color:var(--color-warn-ink)]">
            {t("ui.today_exception")}
          </span>
        </span>
      </div>

      {ROWS.slice(0, 2).map((row) => {
        const status = STATUS[row.status];
        return (
          <div
            key={row.shift}
            className="flex items-center justify-between gap-3 border-t border-[color:var(--color-line)] px-4 py-3 text-[0.85rem] sm:px-5"
          >
            <span className="truncate text-[color:var(--color-ink-soft)]">{t(row.shift)}</span>
            <span className="inline-flex shrink-0 items-center gap-1.5" style={{ color: status.text }}>
              <span
                className="size-1.5 rounded-full"
                style={{ background: status.dot }}
                aria-hidden="true"
              />
              {t(status.key)}
            </span>
          </div>
        );
      })}
    </Panel>
  );
}
