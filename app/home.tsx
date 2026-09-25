"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { DEFAULT_LOCALE, type Locale, type TranslationKey, translatorFor } from "@/lib/i18n";

/**
 * The PromoterOS product page — what `/` is.
 *
 * It exists because `/` used to BE the waitlist. The waitlist is a temporary lead collector the
 * owner intends to switch off once enough addresses are in; the product is not. Anything that
 * makes the front door of the product depend on a page we plan to delete is a mistake waiting for
 * the day we delete it, so the two now share no route, no component and no translation key. The
 * waitlist lives at `/waitlist` and can be removed in one commit without this page noticing.
 *
 * A client component because of the language toggle, which means it resolves its own translator
 * with `translatorFor(locale)` — a server component may not hand `t` across the boundary
 * (CLAUDE.md, "A function is not a prop").
 */

type T = (key: TranslationKey, params?: Record<string, string | number>) => string;

/**
 * The scoring breakdown, as the coordinator actually sees it inside the product.
 *
 * Shown rather than described on purpose: explainable ranking is the one thing here that a
 * competitor cannot copy by writing better marketing copy, and a screenshot of a real mechanism
 * says more than an adjective. The numbers are illustrative and read as such — a named example
 * candidate, not a statistic about anybody's business.
 */
const FACTORS: { key: TranslationKey; value: number }[] = [
  { key: "home.match.factor_distance", value: 92 },
  { key: "home.match.factor_brand", value: 78 },
  { key: "home.match.factor_category", value: 64 },
  { key: "home.match.factor_skills", value: 55 },
  { key: "home.match.factor_reliability", value: 88 },
];

const FLOW: { n: string; title: TranslationKey; body: TranslationKey }[] = [
  { n: "01", title: "home.flow.step_1_title", body: "home.flow.step_1_body" },
  { n: "02", title: "home.flow.step_2_title", body: "home.flow.step_2_body" },
  { n: "03", title: "home.flow.step_3_title", body: "home.flow.step_3_body" },
  { n: "04", title: "home.flow.step_4_title", body: "home.flow.step_4_body" },
  { n: "05", title: "home.flow.step_5_title", body: "home.flow.step_5_body" },
  { n: "06", title: "home.flow.step_6_title", body: "home.flow.step_6_body" },
];

const BEFORE: TranslationKey[] = [
  "home.day.before_1",
  "home.day.before_2",
  "home.day.before_3",
  "home.day.before_4",
  "home.day.before_5",
];

const AFTER: TranslationKey[] = [
  "home.day.after_1",
  "home.day.after_2",
  "home.day.after_3",
  "home.day.after_4",
  "home.day.after_5",
];

const TRUST: { title: TranslationKey; body: TranslationKey }[] = [
  { title: "home.trust.item_1_title", body: "home.trust.item_1_body" },
  { title: "home.trust.item_2_title", body: "home.trust.item_2_body" },
  { title: "home.trust.item_3_title", body: "home.trust.item_3_body" },
];

function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[color:var(--color-action-ink)]">
      {children}
    </p>
  );
}

function MatchCard({ t }: { t: T }) {
  return (
    <div className="rounded-[var(--radius-3xl)] border border-[color:var(--color-line)] bg-[color:var(--color-surface)] p-6 shadow-[var(--elevation-raised)] sm:p-8">
      <div className="flex items-baseline justify-between gap-4 border-b border-[color:var(--color-line)] pb-5">
        <div className="flex items-center gap-3">
          <span
            className="flex size-10 items-center justify-center rounded-full bg-[color:var(--color-accent-subtle)] text-sm font-semibold text-[color:var(--color-accent-ink)]"
            aria-hidden="true"
          >
            ΜΚ
          </span>
          <span className="text-base font-semibold text-[color:var(--color-ink)]">
            {t("home.match.example_name")}
          </span>
        </div>
        <div className="text-right">
          <p className="text-[0.7rem] uppercase tracking-[0.14em] text-[color:var(--color-muted)]">
            {t("home.match.example_score")}
          </p>
          <p className="font-mono text-2xl font-semibold tabular-nums text-[color:var(--color-ink)]">75</p>
        </div>
      </div>

      <dl className="mt-6 flex flex-col gap-4">
        {FACTORS.map((factor) => (
          <div key={factor.key} className="grid grid-cols-[1fr_auto] items-center gap-x-4 gap-y-1.5">
            <dt className="text-sm text-[color:var(--color-ink-soft)]">{t(factor.key)}</dt>
            <dd className="font-mono text-xs tabular-nums text-[color:var(--color-muted)]">
              {factor.value}
            </dd>
            <div
              className="col-span-2 h-1.5 overflow-hidden rounded-full bg-[color:var(--color-canvas-sunken)]"
              role="presentation"
            >
              <div
                className="h-full rounded-full bg-[color:var(--color-action)]"
                style={{ width: `${factor.value}%` }}
              />
            </div>
          </div>
        ))}
      </dl>
    </div>
  );
}

export function Home() {
  const [locale, setLocale] = useState<Locale>(DEFAULT_LOCALE);
  const t = translatorFor(locale);

  return (
    <main className="min-h-screen bg-[color:var(--color-canvas)]">
      {/* ---------------------------------------------------------------- header */}
      <header className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-6 sm:px-8">
        <div className="flex items-center gap-2.5">
          <Image src="/promoteros-mark.svg" alt={t("landing.logo_alt")} width={34} height={34} priority />
          <span className="text-lg font-semibold tracking-tight text-[color:var(--color-ink)]">
            {t("app.name")}
          </span>
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          <div className="flex rounded-[var(--radius-sm)] border border-[color:var(--color-line)] bg-[color:var(--color-surface)] p-1 text-xs font-semibold">
            {(["el", "en"] as const).map((choice) => (
              <button
                key={choice}
                type="button"
                onClick={() => setLocale(choice)}
                aria-pressed={locale === choice}
                className={`rounded-[var(--radius-xs)] px-2.5 py-1.5 transition ${
                  locale === choice
                    ? "bg-[color:var(--color-accent)] text-white"
                    : "text-[color:var(--color-muted)] hover:text-[color:var(--color-ink)]"
                }`}
              >
                {choice === "el" ? t("landing.language.el") : t("landing.language.en")}
              </button>
            ))}
          </div>
          <Link
            href="/login"
            className="rounded-[var(--radius-sm)] bg-[color:var(--color-accent)] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[color:var(--color-accent-hover)]"
          >
            {t("home.nav.login")}
          </Link>
        </div>
      </header>

      {/* ---------------------------------------------------------------- hero */}
      <section className="relative overflow-hidden">
        {/* A single warm bloom behind the headline. Subtle enough that it reads as paper catching
            light rather than as a gradient, which is the difference between considered and cheap. */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -top-40 left-1/2 h-[36rem] w-[64rem] -translate-x-1/2 rounded-full opacity-60 blur-3xl"
          style={{
            background:
              "radial-gradient(closest-side, var(--color-action-subtle), transparent 70%)",
          }}
        />

        <div className="relative mx-auto grid max-w-6xl gap-16 px-5 pb-20 pt-12 sm:px-8 sm:pb-28 sm:pt-20 lg:grid-cols-[1.08fr_0.92fr] lg:items-center lg:gap-20 lg:pb-36 lg:pt-28">
          <div>
            <Eyebrow>{t("home.hero.eyebrow")}</Eyebrow>
            <h1 className="mt-6 max-w-[16ch] text-[2.75rem] font-semibold leading-[1.04] tracking-[-0.025em] text-[color:var(--color-ink)] sm:text-6xl lg:text-[4.25rem]">
              {t("home.hero.title")}
            </h1>
            <p className="mt-7 max-w-xl text-lg leading-[1.75] text-[color:var(--color-muted)] sm:text-xl">
              {t("home.hero.lede")}
            </p>

            <div className="mt-10 flex flex-wrap items-center gap-3">
              <Link
                href="/login"
                className="rounded-[var(--radius-md)] bg-[color:var(--color-accent)] px-6 py-3.5 text-base font-semibold text-white transition hover:bg-[color:var(--color-accent-hover)]"
              >
                {t("home.hero.cta")}
              </Link>
              <a
                href="#flow"
                className="rounded-[var(--radius-md)] border border-[color:var(--color-line-strong)] bg-[color:var(--color-surface)] px-6 py-3.5 text-base font-semibold text-[color:var(--color-ink)] transition hover:bg-[color:var(--color-surface-hover)]"
              >
                {t("home.hero.secondary")}
              </a>
            </div>

            <ul className="mt-12 flex flex-col gap-3 border-t border-[color:var(--color-line)] pt-8 sm:flex-row sm:flex-wrap sm:gap-x-8">
              {(["home.hero.proof_1", "home.hero.proof_2", "home.hero.proof_3"] as const).map((key) => (
                <li key={key} className="flex items-center gap-2.5 text-sm text-[color:var(--color-ink-soft)]">
                  <span
                    className="size-1.5 shrink-0 rounded-full bg-[color:var(--color-action)]"
                    aria-hidden="true"
                  />
                  {t(key)}
                </li>
              ))}
            </ul>
          </div>

          <MatchCard t={t} />
        </div>
      </section>

      {/* ---------------------------------------------------------------- the day */}
      <section className="border-y border-[color:var(--color-line)] bg-[color:var(--color-surface)]">
        <div className="mx-auto max-w-6xl px-5 py-20 sm:px-8 sm:py-28">
          <Eyebrow>{t("home.day.label")}</Eyebrow>
          <h2 className="mt-4 max-w-[20ch] text-3xl font-semibold tracking-[-0.02em] text-[color:var(--color-ink)] sm:text-4xl">
            {t("home.day.title")}
          </h2>

          <div className="mt-14 grid gap-8 lg:grid-cols-2 lg:gap-12">
            <div className="rounded-[var(--radius-2xl)] border border-[color:var(--color-line)] bg-[color:var(--color-canvas)] p-7 sm:p-9">
              <h3 className="text-sm font-semibold uppercase tracking-[0.12em] text-[color:var(--color-muted)]">
                {t("home.day.before_title")}
              </h3>
              <ul className="mt-6 flex flex-col gap-4">
                {BEFORE.map((key) => (
                  <li key={key} className="flex gap-3.5 text-[0.95rem] leading-7 text-[color:var(--color-muted)]">
                    <span
                      className="mt-3 h-px w-4 shrink-0 bg-[color:var(--color-line-strong)]"
                      aria-hidden="true"
                    />
                    {t(key)}
                  </li>
                ))}
              </ul>
            </div>

            <div className="rounded-[var(--radius-2xl)] border border-[color:var(--color-accent-line)] bg-[color:var(--color-surface)] p-7 shadow-[var(--elevation-card)] sm:p-9">
              <h3 className="text-sm font-semibold uppercase tracking-[0.12em] text-[color:var(--color-action-ink)]">
                {t("home.day.after_title")}
              </h3>
              <ul className="mt-6 flex flex-col gap-4">
                {AFTER.map((key) => (
                  <li key={key} className="flex gap-3.5 text-[0.95rem] leading-7 text-[color:var(--color-ink-soft)]">
                    <span
                      className="mt-2.5 size-1.5 shrink-0 rounded-full bg-[color:var(--color-action)]"
                      aria-hidden="true"
                    />
                    {t(key)}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* ---------------------------------------------------------------- matching */}
      <section className="mx-auto max-w-6xl px-5 py-20 sm:px-8 sm:py-28 lg:py-36">
        <div className="max-w-2xl">
          <Eyebrow>{t("home.match.label")}</Eyebrow>
          <h2 className="mt-4 text-3xl font-semibold tracking-[-0.02em] text-[color:var(--color-ink)] sm:text-4xl">
            {t("home.match.title")}
          </h2>
          <p className="mt-6 text-lg leading-[1.75] text-[color:var(--color-muted)]">
            {t("home.match.body")}
          </p>
        </div>
      </section>

      {/* ---------------------------------------------------------------- flow */}
      <section id="flow" className="border-y border-[color:var(--color-line)] bg-[color:var(--color-surface)]">
        <div className="mx-auto max-w-6xl px-5 py-20 sm:px-8 sm:py-28">
          <Eyebrow>{t("home.flow.label")}</Eyebrow>
          <h2 className="mt-4 max-w-[22ch] text-3xl font-semibold tracking-[-0.02em] text-[color:var(--color-ink)] sm:text-4xl">
            {t("home.flow.title")}
          </h2>

          <ol className="mt-16 grid gap-x-12 gap-y-14 sm:grid-cols-2 lg:grid-cols-3">
            {FLOW.map((step) => (
              <li key={step.n} className="border-t border-[color:var(--color-line)] pt-6">
                <span className="font-mono text-xs font-semibold tracking-[0.1em] text-[color:var(--color-action-ink)]">
                  {step.n}
                </span>
                <h3 className="mt-4 text-xl font-semibold tracking-[-0.01em] text-[color:var(--color-ink)]">
                  {t(step.title)}
                </h3>
                <p className="mt-3 text-[0.95rem] leading-7 text-[color:var(--color-muted)]">
                  {t(step.body)}
                </p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* ---------------------------------------------------------------- trust */}
      <section className="mx-auto max-w-6xl px-5 py-20 sm:px-8 sm:py-28 lg:py-36">
        <Eyebrow>{t("home.trust.label")}</Eyebrow>
        <h2 className="mt-4 max-w-[24ch] text-3xl font-semibold tracking-[-0.02em] text-[color:var(--color-ink)] sm:text-4xl">
          {t("home.trust.title")}
        </h2>

        <div className="mt-14 grid gap-10 md:grid-cols-3 md:gap-8">
          {TRUST.map((item) => (
            <article key={item.title}>
              <h3 className="text-lg font-semibold text-[color:var(--color-ink)]">{t(item.title)}</h3>
              <p className="mt-3 text-[0.95rem] leading-7 text-[color:var(--color-muted)]">
                {t(item.body)}
              </p>
            </article>
          ))}
        </div>
      </section>

      {/* ---------------------------------------------------------------- closing */}
      <section className="mx-auto max-w-6xl px-5 pb-20 sm:px-8 sm:pb-28">
        <div className="rounded-[var(--radius-3xl)] bg-[color:var(--color-accent)] px-7 py-14 text-center sm:px-14 sm:py-20">
          <h2 className="mx-auto max-w-[18ch] text-3xl font-semibold tracking-[-0.02em] text-[color:var(--color-n-25)] sm:text-4xl">
            {t("home.cta.title")}
          </h2>
          <p className="mx-auto mt-5 max-w-md text-base leading-7 text-[color:var(--color-n-300)]">
            {t("home.cta.body")}
          </p>
          <Link
            href="/login"
            className="mt-9 inline-block rounded-[var(--radius-md)] bg-[color:var(--color-action)] px-7 py-3.5 text-base font-semibold text-white transition hover:bg-[color:var(--color-action-hover)]"
          >
            {t("home.cta.button")}
          </Link>
          <p className="mt-7 text-sm text-[color:var(--color-n-400)]">
            {t("home.cta.waitlist")}{" "}
            <Link href="/waitlist" className="font-semibold text-[color:var(--color-n-100)] underline underline-offset-4 hover:no-underline">
              {t("home.cta.waitlist_link")}
            </Link>
          </p>
        </div>
      </section>

      {/* ---------------------------------------------------------------- footer */}
      <footer className="border-t border-[color:var(--color-line)]">
        <div className="mx-auto flex max-w-6xl flex-col gap-4 px-5 py-10 text-sm text-[color:var(--color-muted)] sm:flex-row sm:items-center sm:justify-between sm:px-8">
          <p>{t("home.footer.tagline")}</p>
          <div className="flex items-center gap-6">
            <Link className="hover:text-[color:var(--color-ink)]" href="/waitlist">
              {t("home.nav.waitlist")}
            </Link>
            <Link className="font-medium text-[color:var(--color-accent)] hover:underline" href="/privacy">
              {t("home.footer.privacy")}
            </Link>
          </div>
        </div>
      </footer>
    </main>
  );
}
