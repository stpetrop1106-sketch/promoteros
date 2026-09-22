import { DEFAULT_LOCALE, isLocale, type Locale } from "@/lib/i18n";

/**
 * A3-16 — how a promoter reaches English.
 *
 * `CLAUDE.md` says the UI is bilingual from the first screen. Every promoter-facing page pinned
 * `translatorFor(DEFAULT_LOCALE)`, and no promoter page imports a `LocaleSwitcher`, so the English
 * dictionary — complete, 120 promoter-facing keys with no gaps — could not be reached from any
 * link the product ever sends. Field staff in Athens are not uniformly Greek-speaking, and this is
 * the one surface used by people who get no training and nobody to ask.
 *
 * `?lang=` on the token routes is the smallest thing that works: the link a coordinator pastes
 * stays exactly what it is, and the promoter switches with one tap on the page itself. Greek stays
 * the default and the bare URL stays canonical — `hrefWithLocale` emits no query string at all for
 * Greek, so nothing about an existing pasted link changes.
 *
 * This module is deliberately free of `server-only` and of any Supabase import: it is a pure
 * string function, used by the promoter server components and safe anywhere.
 */

/** What Next hands a page as `searchParams`. */
export type PromoterSearchParams = Promise<Record<string, string | string[] | undefined>>;

/** Anything that is not a locale we ship falls back to Greek rather than erroring. */
export function localeFromSearchParams(
  params: Record<string, string | string[] | undefined> | undefined,
): Locale {
  const raw = params?.lang;
  const value = Array.isArray(raw) ? raw[0] : raw;
  return isLocale(value) ? value : DEFAULT_LOCALE;
}

/** The other locale — what the toggle on the page switches to. */
export function otherLocale(locale: Locale): Locale {
  return locale === "el" ? "en" : "el";
}

/**
 * `undefined` for Greek so the canonical URL carries no query string, and `next/link`'s object
 * form rather than a template literal so typed routes keep checking the pathname.
 */
export function langQuery(locale: Locale): { lang: string } | undefined {
  return locale === DEFAULT_LOCALE ? undefined : { lang: locale };
}
