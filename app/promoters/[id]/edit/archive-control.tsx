"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui";
import { archivePromoter } from "../../actions";

function ConfirmSubmit({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="danger" size="sm" loading={pending}>
      {label}
    </Button>
  );
}

/**
 * Archive is destructive-adjacent (it removes the promoter from every active list and ranking)
 * but reversible, so it gets a lighter two-step confirmation than a true delete would — a typed
 * name is reserved for irreversible actions (commercial-architecture.md §6). Kept in its own
 * card, away from the main "Save changes" button, per the same section: the dangerous action is
 * never adjacent to the common one.
 */
export function ArchiveControl({
  promoterId,
  labels,
}: {
  promoterId: string;
  labels: { prompt: string; confirm: string; cancel: string; start: string };
}) {
  const [confirming, setConfirming] = useState(false);
  const boundArchive = archivePromoter.bind(null, promoterId);

  if (!confirming) {
    return (
      <Button type="button" variant="danger" size="sm" onClick={() => setConfirming(true)}>
        {labels.start}
      </Button>
    );
  }

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
      <p className="text-sm text-[color:var(--color-ink)]">{labels.prompt}</p>
      <div className="flex items-center gap-2">
        <form action={boundArchive}>
          <ConfirmSubmit label={labels.confirm} />
        </form>
        <Button type="button" variant="ghost" size="sm" onClick={() => setConfirming(false)}>
          {labels.cancel}
        </Button>
      </div>
    </div>
  );
}
