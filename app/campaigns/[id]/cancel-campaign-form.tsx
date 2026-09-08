"use client";

import { Button } from "@/components/ui";

/**
 * The one destructive action on the campaign detail page. Kept as its own small client component
 * so cancelling requires a confirmation dialog — separated from the ordinary status buttons
 * (`Ενεργοποίηση` / `Ολοκλήρωση`), per the "dangerous action never adjacent to the common one"
 * rule. `action` is a bound server action passed down from the server component.
 */
export function CancelCampaignForm({
  action,
  label,
  confirmText,
}: {
  action: (formData: FormData) => void | Promise<void>;
  label: string;
  confirmText: string;
}) {
  return (
    <form
      action={action}
      onSubmit={(event) => {
        if (!window.confirm(confirmText)) event.preventDefault();
      }}
    >
      <Button type="submit" variant="danger" size="sm">
        {label}
      </Button>
    </form>
  );
}
