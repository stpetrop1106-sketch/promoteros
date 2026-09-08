import { el } from "./el";
import { en } from "./en";

export const LOCALES = ["el", "en"] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "el";

/** Greek is the reference locale, so its keys define the contract. */
export type TranslationKey = keyof typeof el;

const dictionaries: Record<Locale, Record<TranslationKey, string>> = { el, en };

export function isLocale(value: string | undefined): value is Locale {
  return LOCALES.includes(value as Locale);
}

/**
 * Look up a translated string.
 *
 * A missing key is a bug, not a fallback case: in development it throws so it surfaces
 * immediately, in production it degrades to the key rather than crashing a promoter's page.
 */
export function translate(
  locale: Locale,
  key: TranslationKey,
  params?: Record<string, string | number>,
): string {
  const template = dictionaries[locale][key] ?? dictionaries[DEFAULT_LOCALE][key];

  if (template === undefined) {
    if (process.env.NODE_ENV === "development") {
      throw new Error(`Missing translation for "${key}" in locale "${locale}"`);
    }
    return key;
  }

  if (!params) return template;

  return template.replace(/\{(\w+)\}/g, (match, name: string) => {
    const value = params[name];
    return value === undefined ? match : String(value);
  });
}

/** Bind a locale once and pass `t` down through a page. */
export function translatorFor(locale: Locale) {
  return (key: TranslationKey, params?: Record<string, string | number>) =>
    translate(locale, key, params);
}
