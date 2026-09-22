import type { TranslationKey } from "@/lib/i18n";

/**
 * State types and their idle constants, kept out of `actions.ts` on purpose — CLAUDE.md's
 * server/client boundary rule: a `"use server"` module may export only async functions, so the
 * type and the constant a client component needs to seed `useActionState` have to live beside it
 * instead. Same split as `app/waitlist-state.ts` and `app/settings/team/state.ts`.
 */

export type CreateSectionField = "name" | "campaignId";

export type CreateSectionState = {
  status: "idle" | "error";
  fieldErrors?: Partial<Record<CreateSectionField, TranslationKey>>;
  formError?: TranslationKey;
};

export const CREATE_SECTION_IDLE: CreateSectionState = { status: "idle" };

export type RenameSectionState = {
  status: "idle" | "done" | "error";
  formError?: TranslationKey;
};

export const RENAME_SECTION_IDLE: RenameSectionState = { status: "idle" };

/** A2 finding 12 — `setSectionArchived` used to return `void`, so a refusal was invisible. */
export type ArchiveSectionState = {
  status: "idle" | "done" | "error";
  formError?: TranslationKey;
};

export const ARCHIVE_SECTION_IDLE: ArchiveSectionState = { status: "idle" };
