"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Button, Icon } from "@/components/ui";
import { translatorFor, DEFAULT_LOCALE } from "@/lib/i18n";
import { setSectionArchived } from "./actions";
import { ARCHIVE_SECTION_IDLE } from "./state";

// A client component resolves its own translator — a function cannot cross the server/client
// boundary as a prop (CLAUDE.md). Same shape as `rename-section-form.tsx` beside it.
const t = translatorFor(DEFAULT_LOCALE);

function Submit({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="ghost" size="sm" loading={pending}>
      {label}
    </Button>
  );
}

/**
 * Archive / unarchive one section.
 *
 * **A2 finding 12.** This was a bare `<form action={setSectionArchived.bind(...)}>`; the action
 * returned `void`, and its own file comment admitted the consequence — "a blocked or failed
 * request silently no-ops". Archiving stays one click with no confirmation (it is reversible and
 * the archived view is one filter away, which the audit agreed is the right design); what
 * changes is that a refusal now says so instead of the page appearing to ignore the press.
 */
export function ArchiveSectionForm({
  programmeId,
  archived,
}: {
  programmeId: string;
  archived: boolean;
}) {
  const [state, formAction] = useActionState(setSectionArchived, ARCHIVE_SECTION_IDLE);

  return (
    <form action={formAction} className="flex flex-col items-end gap-1">
      <input type="hidden" name="programmeId" value={programmeId} />
      <input type="hidden" name="archived" value={archived ? "false" : "true"} />
      <Submit label={archived ? t("shifts.sections.unarchive_button") : t("shifts.sections.archive_button")} />
      {state.status === "error" && state.formError ? (
        <p
          role="alert"
          className="flex max-w-xs items-start gap-1.5 text-right text-xs font-medium leading-5 text-[color:var(--color-bad-ink)]"
        >
          <Icon name="alert" size={14} className="mt-0.5 shrink-0" />
          <span>{t(state.formError)}</span>
        </p>
      ) : null}
    </form>
  );
}
