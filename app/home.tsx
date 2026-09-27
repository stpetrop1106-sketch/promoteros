"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { WaitlistForm } from "@/app/waitlist-form";
import {
  AttendancePanel,
  MatchingPanel,
  ShiftBoardPanel,
  TodayPanel,
} from "@/components/marketing/product-ui";
import { DEFAULT_LOCALE, type Locale, type TranslationKey, translatorFor } from "@/lib/i18n";

/**
 * The PromoterOS landing page.
 *
 * It sells one thing to one person: the coordinator or owner of a promotion agency who currently
 * runs their week out of a spreadsheet, Viber and the phone. Everything here is built around that
 * reader, which drives three decisions worth keeping:
 *
 * 1. **Product interface over decoration.** Four drawn panels, each a different screen, each using
 *    the application's own tokens. No stock imagery, no gradients, no illustration standing in for
 *    a product that exists. The panels are in `components/marketing/product-ui.tsx` and every name
 *    in them is invented, with a visible badge saying so.
 *
 * 2. **Sections, not card grids.** Hairline rules and whitespace separate the page; almost nothing
 *    is a card. A row of identical rounded boxes is the single strongest signal that a page was
 *    generated rather than designed.
 *
 * 3. **It is honest about the stage.** The product is in early access and the page says so. No
 *    invented statistics, no logos of customers that do not exist, no "trusted by" strip. The one
 *    conversion is the waitlist, which is also the only reason this page exists right now.
 *
 * `"use client"` for the language toggle and the waitlist form's `useActionState`. Anything it
 * hands to a child is a string — never `t` itself (CLAUDE.md, "A function is not a prop").
 */

type Attribution = { source: string; medium: string; campaign: string };
type T = (key: TranslationKey, params?: Record<string, string | number>) => string;

const TODAY_STEPS: TranslationKey[] = [
  "home.flow.today_1",
  "home.flow.today_2",
  "home.flow.today_3",
  "home.flow.today_4",
  "home.flow.today_5",
  "home.flow.today_6",
  "home.flow.today_7",
];

const WITH_STEPS: TranslationKey[] = [
  "home.flow.with_1",
  "home.flow.with_2",
  "home.flow.with_3",
  "home.flow.with_4",
];

const VALUE_TODAY: TranslationKey[] = [
  "home.value.today_1",
  "home.value.today_2",
  "home.value.today_3",
  "home.value.today_4",
];

const VALUE_WITH: TranslationKey[] = [
  "home.value.with_1",
  "home.value.with_2",
  "home.value.with_3",
  "home.value.with_4",
];

const STORY_ITEMS: TranslationKey[] = [
  "home.story.item_1",
  "home.story.item_2",
  "home.story.item_3",
];

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="font-mono text-[0.72rem] uppercase tracking-[0.16em] text-[color:var(--color-action-ink)]">
      {children}
    </p>
  );
}

/** One of the three product chapters: copy on one side, a real screen on the other. */
function Chapter({
  label,
  title,
  body,
  panel,
  flip,
}: {
  label: string;
  title: string;
  body: string;
  panel: React.ReactNode;
  flip?: boolean;
}) {
  return (
    <div className="grid items-center gap-10 lg:grid-cols-2 lg:gap-16">
      <div className={flip ? "lg:order-2" : undefined}>
        <SectionLabel>{label}</SectionLabel>
        <h2 className="mt-5 max-w-[15ch] text-[1.75rem] font-semibold leading-[1.15] tracking-[-0.02em] text-[color:var(--color-ink)] sm:text-[2.1rem]">
          {title}
        </h2>
        <p className="mt-5 max-w-lg text-[1.02rem] leading-[1.75] text-[color:var(--color-muted)]">
          {body}
        </p>
      </div>
      <div className={flip ? "lg:order-1" : undefined}>{panel}</div>
    </div>
  );
}

/** The before/after chain. Words and arrows, because that is what the problem literally is. */
function FlowLine({ steps, t, dim }: { steps: TranslationKey[]; t: T; dim?: boolean }) {
  return (
    <ol className="flex flex-wrap items-center gap-x-2.5 gap-y-2.5">
      {steps.map((step, i) => (
        <li key={step} className="flex items-center gap-2.5">
          <span
            className={`rounded-[var(--radius-sm)] border px-2.5 py-1.5 text-[0.85rem] ${
              dim
                ? "border-[color:var(--color-line)] text-[color:var(--color-muted)]"
                : "border-[color:var(--color-accent-line)] bg-[color:var(--color-surface)] text-[color:var(--color-ink)]"
            }`}
          >
            {t(step)}
          </span>
          {i < steps.length - 1 ? (
            <span
              aria-hidden="true"
              className={dim ? "text-[color:var(--color-muted-soft)]" : "text-[color:var(--color-action)]"}
            >
              →
            </span>
          ) : null}
        </li>
      ))}
    </ol>
  );
}

export function Home({ attribution }: { attribution: Attribution }) {
  const [locale, setLocale] = useState<Locale>(DEFAULT_LOCALE);
  const t = translatorFor(locale);

  return (
    <div className="bg-[color:var(--color-canvas)]">
      {/* ------------------------------------------------------------------ nav */}
      <header className="sticky top-0 z-20 border-b border-[color:var(--color-line)] bg-[color:var(--color-canvas)]/92 backdrop-blur">
        <nav className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-3.5 sm:px-8">
          <Link href="/" className="flex items-center gap-2.5">
            <Image src="/promoteros-mark.svg" alt={t("landing.logo_alt")} width={28} height={28} priority />
            <span className="text-[1.05rem] font-semibold tracking-tight text-[color:var(--color-ink)]">
              {t("app.name")}
            </span>
          </Link>

          <div className="hidden items-center gap-7 md:flex">
            <a
              href="#how"
              className="text-[0.88rem] text-[color:var(--color-muted)] transition hover:text-[color:var(--color-ink)]"
            >
              {t("home.nav.how")}
            </a>
            <a
              href="#agencies"
              className="text-[0.88rem] text-[color:var(--color-muted)] transition hover:text-[color:var(--color-ink)]"
            >
              {t("home.nav.for_agencies")}
            </a>
            <a
              href="#early-access"
              className="text-[0.88rem] text-[color:var(--color-muted)] transition hover:text-[color:var(--color-ink)]"
            >
              {t("home.nav.early_access")}
            </a>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            <div className="hidden rounded-[var(--radius-xs)] border border-[color:var(--color-line)] p-0.5 text-[0.72rem] font-medium sm:flex">
              {(["el", "en"] as const).map((choice) => (
                <button
                  key={choice}
                  type="button"
                  onClick={() => setLocale(choice)}
                  aria-pressed={locale === choice}
                  className={`rounded-[3px] px-2 py-1 transition ${
                    locale === choice
                      ? "bg-[color:var(--color-accent)] text-white"
                      : "text-[color:var(--color-muted)] hover:text-[color:var(--color-ink)]"
                  }`}
                >
                  {choice === "el" ? t("landing.language.el") : t("landing.language.en")}
                </button>
              ))}
            </div>
            {/* The full sentence wraps to two lines on a 375px phone and squashes the logo, which
                is the "desktop layout, stacked" look this page is meant to avoid. The short label
                says the same thing in the space a phone actually has. */}
            <a
              href="#early-access"
              className="whitespace-nowrap rounded-[var(--radius-sm)] bg-[color:var(--color-accent)] px-3.5 py-2 text-[0.85rem] font-medium text-white transition hover:bg-[color:var(--color-accent-hover)]"
            >
              <span className="sm:hidden">{t("home.nav.early_access")}</span>
              <span className="hidden sm:inline">{t("home.nav.cta")}</span>
            </a>
          </div>
        </nav>
      </header>

      <main>
        {/* ---------------------------------------------------------------- hero */}
        <section className="mx-auto max-w-6xl px-5 pb-16 pt-14 sm:px-8 sm:pb-24 sm:pt-20 lg:pb-28 lg:pt-24">
          <div className="grid items-center gap-12 lg:grid-cols-[1.02fr_0.98fr] lg:gap-16">
            <div>
              <h1 className="max-w-[13ch] text-[2.4rem] font-semibold leading-[1.06] tracking-[-0.028em] text-[color:var(--color-ink)] sm:text-[3.2rem] lg:text-[3.6rem]">
                {t("home.hero.title")}
              </h1>
              <p className="mt-6 max-w-xl text-[1.08rem] leading-[1.7] text-[color:var(--color-ink-soft)] sm:text-[1.15rem]">
                {t("home.hero.subtitle")}
              </p>
              <p className="mt-3.5 max-w-lg text-[0.98rem] leading-[1.7] text-[color:var(--color-muted)]">
                {t("home.hero.support")}
              </p>

              <div className="mt-9 flex flex-col items-stretch gap-3 sm:flex-row sm:items-center">
                <a
                  href="#early-access"
                  className="rounded-[var(--radius-md)] bg-[color:var(--color-accent)] px-6 py-3.5 text-center text-[0.98rem] font-medium text-white transition hover:bg-[color:var(--color-accent-hover)]"
                >
                  {t("home.hero.cta")}
                </a>
                <a
                  href="#how"
                  className="rounded-[var(--radius-md)] border border-[color:var(--color-line-strong)] px-6 py-3.5 text-center text-[0.98rem] font-medium text-[color:var(--color-ink)] transition hover:bg-[color:var(--color-surface)]"
                >
                  {t("home.nav.how")}
                </a>
              </div>

              <p className="mt-6 text-[0.85rem] text-[color:var(--color-muted)]">
                {t("home.hero.note")}
              </p>
            </div>

            <TodayPanel locale={locale} />
          </div>
        </section>

        {/* ------------------------------------------------- before / after flow */}
        <section className="border-y border-[color:var(--color-line)] bg-[color:var(--color-surface)]">
          <div className="mx-auto max-w-6xl px-5 py-14 sm:px-8 sm:py-16">
            <div className="grid gap-10 lg:grid-cols-[auto_1fr] lg:gap-16">
              <div className="lg:w-40">
                <p className="text-[0.8rem] font-medium uppercase tracking-[0.12em] text-[color:var(--color-muted)]">
                  {t("home.flow.today")}
                </p>
              </div>
              <FlowLine steps={TODAY_STEPS} t={t} dim />
            </div>

            <hr className="my-10 border-[color:var(--color-line)]" />

            <div className="grid gap-10 lg:grid-cols-[auto_1fr] lg:gap-16">
              <div className="lg:w-40">
                <p className="text-[0.8rem] font-medium uppercase tracking-[0.12em] text-[color:var(--color-action-ink)]">
                  {t("home.flow.with")}
                </p>
              </div>
              <FlowLine steps={WITH_STEPS} t={t} />
            </div>
          </div>
        </section>

        {/* --------------------------------------------------------- positioning */}
        <section id="agencies" className="mx-auto max-w-6xl scroll-mt-20 px-5 py-20 sm:px-8 sm:py-24">
          <div className="grid gap-8 lg:grid-cols-[0.9fr_1.1fr] lg:gap-16">
            <h2 className="max-w-[18ch] text-[1.8rem] font-semibold leading-[1.2] tracking-[-0.02em] text-[color:var(--color-ink)] sm:text-[2.2rem]">
              {t("home.positioning.title")}
            </h2>
            <div className="max-w-xl">
              <p className="text-[1.02rem] leading-[1.8] text-[color:var(--color-muted)]">
                {t("home.positioning.body_1")}
              </p>
              <p className="mt-4 text-[1.02rem] leading-[1.8] text-[color:var(--color-ink-soft)]">
                {t("home.positioning.body_2")}
              </p>
            </div>
          </div>
        </section>

        {/* ------------------------------------------------------ product chapters */}
        <section id="how" className="scroll-mt-16 border-t border-[color:var(--color-line)]">
          <div className="mx-auto flex max-w-6xl flex-col gap-20 px-5 py-20 sm:gap-28 sm:px-8 sm:py-28">
            <div>
              <Chapter
                label={t("home.s1.label")}
                title={t("home.s1.title")}
                body={t("home.s1.body")}
                panel={<MatchingPanel locale={locale} />}
              />
              {/* The AI claim lives here, small, attached to the one screen it describes — rather
                  than as its own section shouting a word the buyer did not ask for. */}
              <div className="mt-10 max-w-2xl border-l-2 border-[color:var(--color-action)] pl-5">
                <SectionLabel>{t("home.ai.label")}</SectionLabel>
                <p className="mt-3 text-[1.02rem] font-medium text-[color:var(--color-ink)]">
                  {t("home.ai.title")}
                </p>
                <p className="mt-2 text-[0.95rem] leading-[1.7] text-[color:var(--color-muted)]">
                  {t("home.ai.body")}
                </p>
              </div>
            </div>

            <Chapter
              flip
              label={t("home.s2.label")}
              title={t("home.s2.title")}
              body={t("home.s2.body")}
              panel={<ShiftBoardPanel locale={locale} />}
            />

            <Chapter
              label={t("home.s3.label")}
              title={t("home.s3.title")}
              body={t("home.s3.body")}
              panel={<AttendancePanel locale={locale} />}
            />
          </div>
        </section>

        {/* -------------------------------------------------------- brand story */}
        <section className="border-y border-[color:var(--color-line)] bg-[color:var(--color-surface)]">
          <div className="mx-auto max-w-6xl px-5 py-20 sm:px-8 sm:py-24">
            <div className="grid gap-10 lg:grid-cols-[1.1fr_0.9fr] lg:gap-16">
              <div>
                <h2 className="max-w-[20ch] text-[1.8rem] font-semibold leading-[1.2] tracking-[-0.02em] text-[color:var(--color-ink)] sm:text-[2.1rem]">
                  {t("home.story.title")}
                </h2>
                <p className="mt-6 max-w-xl text-[1.02rem] leading-[1.8] text-[color:var(--color-muted)]">
                  {t("home.story.body_1")}
                </p>
                <p className="mt-4 max-w-xl text-[1.02rem] leading-[1.8] text-[color:var(--color-ink-soft)]">
                  {t("home.story.body_2")}
                </p>
              </div>

              <div className="flex flex-col justify-center">
                <ul className="flex flex-col gap-3 border-l border-[color:var(--color-line)] pl-6">
                  {STORY_ITEMS.map((item) => (
                    <li key={item} className="text-[1rem] text-[color:var(--color-muted)]">
                      {t(item)}
                    </li>
                  ))}
                </ul>
                <p className="mt-7 pl-6 text-[1.05rem] font-medium text-[color:var(--color-ink)]">
                  {t("home.story.closing")}
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* ------------------------------------------------------ business value */}
        <section className="mx-auto max-w-6xl px-5 py-20 sm:px-8 sm:py-24">
          <h2 className="max-w-[22ch] text-[1.8rem] font-semibold leading-[1.2] tracking-[-0.02em] text-[color:var(--color-ink)] sm:text-[2.1rem]">
            {t("home.value.title")}
          </h2>

          <div className="mt-12 grid gap-px overflow-hidden rounded-[var(--radius-lg)] border border-[color:var(--color-line)] bg-[color:var(--color-line)] sm:grid-cols-2">
            <div className="bg-[color:var(--color-canvas)] p-6 sm:p-8">
              <p className="text-[0.8rem] font-medium uppercase tracking-[0.12em] text-[color:var(--color-muted)]">
                {t("home.flow.today")}
              </p>
              <ul className="mt-5 flex flex-col gap-3">
                {VALUE_TODAY.map((item) => (
                  <li
                    key={item}
                    className="flex gap-3 text-[0.95rem] leading-7 text-[color:var(--color-muted)]"
                  >
                    <span
                      className="mt-3 h-px w-3.5 shrink-0 bg-[color:var(--color-line-strong)]"
                      aria-hidden="true"
                    />
                    {t(item)}
                  </li>
                ))}
              </ul>
            </div>

            <div className="bg-[color:var(--color-surface)] p-6 sm:p-8">
              <p className="text-[0.8rem] font-medium uppercase tracking-[0.12em] text-[color:var(--color-action-ink)]">
                {t("home.flow.with")}
              </p>
              <ul className="mt-5 flex flex-col gap-3">
                {VALUE_WITH.map((item) => (
                  <li
                    key={item}
                    className="flex gap-3 text-[0.95rem] leading-7 text-[color:var(--color-ink-soft)]"
                  >
                    <span
                      className="mt-2.5 size-1.5 shrink-0 rounded-full bg-[color:var(--color-action)]"
                      aria-hidden="true"
                    />
                    {t(item)}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        {/* -------------------------------------------------------- early access */}
        <section
          id="early-access"
          className="scroll-mt-16 border-t border-[color:var(--color-line)] bg-[color:var(--color-surface)]"
        >
          <div className="mx-auto max-w-6xl px-5 py-20 sm:px-8 sm:py-24">
            <div className="grid gap-12 lg:grid-cols-[0.95fr_1.05fr] lg:gap-16">
              <div className="lg:pt-2">
                <h2 className="max-w-[16ch] text-[1.9rem] font-semibold leading-[1.15] tracking-[-0.02em] text-[color:var(--color-ink)] sm:text-[2.3rem]">
                  {t("home.early.title")}
                </h2>
                <p className="mt-6 max-w-lg text-[1.02rem] leading-[1.8] text-[color:var(--color-muted)]">
                  {t("home.early.body")}
                </p>
                <p className="mt-6 text-[0.88rem] text-[color:var(--color-muted)]">
                  {t("home.early.note")}
                </p>
              </div>

              <WaitlistForm attribution={attribution} locale={locale} />
            </div>
          </div>
        </section>
      </main>

      {/* --------------------------------------------------------------- footer */}
      <footer className="border-t border-[color:var(--color-line)]">
        <div className="mx-auto flex max-w-6xl flex-col gap-4 px-5 py-9 text-[0.85rem] text-[color:var(--color-muted)] sm:flex-row sm:items-center sm:justify-between sm:px-8">
          <p>{t("home.footer.tagline")}</p>
          <div className="flex items-center gap-6">
            <Link className="transition hover:text-[color:var(--color-ink)]" href="/login">
              {t("auth.login_title")}
            </Link>
            <Link className="transition hover:text-[color:var(--color-ink)]" href="/privacy">
              {t("home.footer.privacy")}
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
