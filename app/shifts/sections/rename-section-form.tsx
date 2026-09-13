"use client";

import { useActionState, useEffect, useState } from "react";
import { Button, Icon, TextField } from "@/components/ui";
import { translatorFor, DEFAULT_LOCALE } from "@/lib/i18n";
import { renameSection } from "./actions";
import { RENAME_SECTION_IDLE } from "./state";

const t = translatorFor(DEFAULT_LOCALE);

/**
 * "Μετονομασία" toggles between the plain ghost button and an inline name field + save/cancel,
 * closing itself again once the rename succeeds. The section's displayed name lives in the
 * server-rendered header above this component and updates on its own via `revalidatePath` inside
 * `renameSection` — this component only needs to get out of the way once that happens.
 */
export function RenameSectionForm({ programmeId, currentName }: { programmeId: string; currentName: string }) {
  const [editing, setEditing] = useState(false);
  const [state, formAction, pending] = useActionState(renameSection, RENAME_SECTION_IDLE);

  useEffect(() => {
    if (state.status === "done") setEditing(false);
  }, [state]);

  if (!editing) {
    return (
      <Button variant="ghost" size="sm" onClick={() => setEditing(true)}>
        {t("shifts.sections.rename_button")}
      </Button>
    );
  }

  return (
    <form action={formAction} className="flex flex-wrap items-end gap-2">
      <input type="hidden" name="programmeId" value={programmeId} />
      <TextField
        id={`rename-${programmeId}`}
        name="name"
        label={t("shifts.sections.rename.name_label")}
        defaultValue={currentName}
        error={state.status === "error" && state.formError ? t(state.formError) : undefined}
        containerClassName="min-w-48"
        required
        autoFocus
      />
      <Button type="submit" size="sm" loading={pending}>
        {t("shifts.sections.rename.save")}
      </Button>
      <Button type="button" variant="ghost" size="sm" onClick={() => setEditing(false)}>
        <Icon name="close" size={16} />
        <span className="sr-only">{t("shifts.sections.rename.cancel")}</span>
      </Button>
    </form>
  );
}
