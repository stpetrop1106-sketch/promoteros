"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { WaitlistForm } from "@/app/waitlist-form";
import { DEFAULT_LOCALE, type Locale, translatorFor } from "@/lib/i18n";

type Attribution = {
  source: string;
  medium: string;
  campaign: string;
};

export function Landing({ attribution }: { attribution: Attribution }) {
  const [locale, setLocale] = useState<Locale>(DEFAULT_LOCALE);
  const t = translatorFor(locale);

  return (
    <main className="min-h-screen bg-[color:var(--color-canvas)]">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-5 py-5 sm:px-8">
        <div className="flex items-center gap-2.5">
          <Image src="/promoteros-mark.svg" alt={t("landing.logo_alt")} width={36} height={36} priority />
          <span className="text-lg font-semibold tracking-tight text-[color:var(--color-ink)]">{t("app.name")}</span>
        </div>
        <div className="flex rounded-lg border border-[color:var(--color-line)] bg-[color:var(--color-surface)] p-1 text-xs font-semibold">
          {(["el", "en"] as const).map((choice) => (
            <button
              key={choice}
              type="button"
              onClick={() => setLocale(choice)}
              aria-pressed={locale === choice}
              className={`rounded-md px-2.5 py-1.5 transition ${locale === choice ? "bg-[color:var(--color-accent)] text-white" : "text-[color:var(--color-muted)] hover:text-[color:var(--color-ink)]"}`}
            >
              {choice === "el" ? t("landing.language.el") : t("landing.language.en")}
            </button>
          ))}
        </div>
      </header>

      <section className="mx-auto grid max-w-6xl gap-12 px-5 pb-16 pt-10 sm:px-8 lg:grid-cols-[1.05fr_0.95fr] lg:items-center lg:gap-16 lg:pb-24 lg:pt-20">
        <div>
          <p className="mb-5 text-sm font-semibold uppercase tracking-[0.14em] text-[color:var(--color-accent)]">{t("landing.eyebrow")}</p>
          <h1 className="max-w-2xl text-4xl font-semibold leading-[1.08] tracking-tight text-[color:var(--color-ink)] sm:text-5xl">{t("landing.title")}</h1>
          <p className="mt-6 max-w-xl text-lg leading-8 text-[color:var(--color-muted)]">{t("landing.lede")}</p>
          <div className="mt-8 flex items-start gap-3 border-l-2 border-[color:var(--color-action)] pl-4">
            <span className="mt-1.5 size-2 shrink-0 rounded-full bg-[color:var(--color-action)]" aria-hidden="true" />
            <p className="max-w-lg text-sm leading-6 text-[color:var(--color-ink)]">{t("landing.hero_note")}</p>
          </div>
        </div>
        <WaitlistForm attribution={attribution} locale={locale} />
      </section>

      <section className="border-y border-[color:var(--color-line)] bg-[color:var(--color-surface)]">
        <div className="mx-auto max-w-6xl px-5 py-14 sm:px-8 sm:py-16">
          <div className="max-w-2xl">
            <p className="text-sm font-semibold uppercase tracking-[0.14em] text-[color:var(--color-accent)]">{t("landing.product_label")}</p>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight text-[color:var(--color-ink)]">{t("landing.product_title")}</h2>
            <p className="mt-4 text-base leading-7 text-[color:var(--color-muted)]">{t("landing.product_lede")}</p>
          </div>
          <div className="mt-12 grid gap-9 md:grid-cols-3">
            <article>
              <span className="flex size-10 items-center justify-center rounded-lg bg-[color:var(--color-accent-subtle)] text-sm font-bold text-[color:var(--color-accent)]">01</span>
              <h3 className="mt-5 text-lg font-semibold text-[color:var(--color-ink)]">{t("landing.benefit_1_title")}</h3>
              <p className="mt-2 text-sm leading-6 text-[color:var(--color-muted)]">{t("landing.benefit_1_body")}</p>
            </article>
            <article>
              <span className="flex size-10 items-center justify-center rounded-lg bg-[color:var(--color-accent-subtle)] text-sm font-bold text-[color:var(--color-accent)]">02</span>
              <h3 className="mt-5 text-lg font-semibold text-[color:var(--color-ink)]">{t("landing.benefit_2_title")}</h3>
              <p className="mt-2 text-sm leading-6 text-[color:var(--color-muted)]">{t("landing.benefit_2_body")}</p>
            </article>
            <article>
              <span className="flex size-10 items-center justify-center rounded-lg bg-[color:var(--color-accent-subtle)] text-sm font-bold text-[color:var(--color-accent)]">03</span>
              <h3 className="mt-5 text-lg font-semibold text-[color:var(--color-ink)]">{t("landing.benefit_3_title")}</h3>
              <p className="mt-2 text-sm leading-6 text-[color:var(--color-muted)]">{t("landing.benefit_3_body")}</p>
            </article>
          </div>
        </div>
      </section>

      <footer className="mx-auto flex max-w-6xl flex-col gap-3 px-5 py-8 text-sm text-[color:var(--color-muted)] sm:flex-row sm:items-center sm:justify-between sm:px-8">
        <p>{t("landing.footer")}</p>
        <Link className="font-medium text-[color:var(--color-accent)] hover:underline" href="/privacy">{t("landing.privacy")}</Link>
      </footer>
    </main>
  );
}
