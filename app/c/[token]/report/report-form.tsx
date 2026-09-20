"use client";

import type { ReactNode } from "react";
import { useActionState, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { IDLE_STATE, type ReportActionState } from "./state";
import { shrinkPhoto } from "./shrink-photo";

export type ReportFormLabels = {
  unitsPromoted: string;
  salesCount: string;
  interactionsCount: string;
  stockIssues: string;
  storeManagerName: string;
  notes: string;
  photos: string;
  photosHint: string;
  photosPreparing: string;
  submit: string;
  submitting: string;
  success: string;
  successWithPhotoFailures: string;
};

function inputClass(hasError: boolean): string {
  return (
    "mt-1 w-full rounded-lg border bg-[color:var(--color-surface)] px-3 py-3 text-base outline-none " +
    "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 " +
    "focus-visible:outline-[color:var(--color-accent)] " +
    (hasError ? "border-[color:var(--color-bad)]" : "border-[color:var(--color-line)]")
  );
}

function Field({
  id,
  label,
  error,
  children,
}: {
  id: string;
  label: string;
  error?: string;
  children: ReactNode;
}) {
  return (
    <div>
      <label htmlFor={id} className="text-sm font-medium text-[color:var(--color-ink)]">
        {label}
      </label>
      {children}
      {error && (
        <p role="alert" className="mt-1 text-xs font-medium text-[color:var(--color-bad)]">
          {error}
        </p>
      )}
    </div>
  );
}

function SubmitButton({ label, submittingLabel }: { label: string; submittingLabel: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      aria-busy={pending || undefined}
      className="w-full rounded-lg bg-[color:var(--color-accent)] px-4 py-4 text-base font-semibold text-white transition hover:bg-[color:var(--color-accent-hover)] disabled:opacity-50"
    >
      {pending ? submittingLabel : label}
    </button>
  );
}

/**
 * The field report form. One primary action — "Save report" — with everything else optional,
 * because a promoter on the shop floor may not have every number yet and must never be blocked
 * from saving what they do have.
 *
 * Photos upload as part of the same submit, but strictly *after* the text fields are already
 * saved server-side (see `./actions.ts`): a bad connection dropping the photo never drops the
 * report. Plain `<input type="file" multiple>` with `capture="environment"` opens the back
 * camera directly on a phone without extra UI.
 */
export function ReportForm({
  action,
  labels,
}: {
  action: (state: ReportActionState, formData: FormData) => Promise<ReportActionState>;
  labels: ReportFormLabels;
}) {
  const [state, formAction] = useActionState<ReportActionState, FormData>(action, IDLE_STATE);
  const photosRef = useRef<HTMLInputElement>(null);
  const [preparingPhotos, setPreparingPhotos] = useState(false);

  /**
   * Shrink each chosen photo the moment it is chosen, and put the smaller files back into the
   * input, so the form still submits natively (which is what keeps the button's pending state
   * honest). A phone camera produces 3-8 MB; the Server Action body cap is far below that, and
   * before this the submit failed with a server exception — see ./shrink-photo.ts.
   */
  async function onPhotosChosen() {
    const input = photosRef.current;
    if (!input?.files?.length) return;
    setPreparingPhotos(true);
    try {
      const shrunk = await Promise.all([...input.files].map(shrinkPhoto));
      const box = new DataTransfer();
      for (const file of shrunk) box.items.add(file);
      input.files = box.files;
    } finally {
      setPreparingPhotos(false);
    }
  }

  if (state.status === "success") {
    return (
      <div className="mt-6 text-center text-sm">
        <p className="font-medium text-[color:var(--color-ok)]">
          {state.photosFailed > 0 ? labels.successWithPhotoFailures : labels.success}
        </p>
      </div>
    );
  }

  const errors = state.status === "error" ? state.errors : {};

  return (
    <form action={formAction} className="mt-6 space-y-4">
      {errors.general && (
        <p role="alert" className="text-sm font-medium text-[color:var(--color-bad)]">
          {errors.general}
        </p>
      )}

      <Field id="unitsPromoted" label={labels.unitsPromoted} error={errors.unitsPromoted}>
        <input
          id="unitsPromoted"
          name="unitsPromoted"
          type="number"
          inputMode="numeric"
          min={0}
          step={1}
          className={inputClass(Boolean(errors.unitsPromoted))}
        />
      </Field>

      <Field id="salesCount" label={labels.salesCount} error={errors.salesCount}>
        <input
          id="salesCount"
          name="salesCount"
          type="number"
          inputMode="numeric"
          min={0}
          step={1}
          className={inputClass(Boolean(errors.salesCount))}
        />
      </Field>

      <Field id="interactionsCount" label={labels.interactionsCount} error={errors.interactionsCount}>
        <input
          id="interactionsCount"
          name="interactionsCount"
          type="number"
          inputMode="numeric"
          min={0}
          step={1}
          className={inputClass(Boolean(errors.interactionsCount))}
        />
      </Field>

      <Field id="storeManagerName" label={labels.storeManagerName} error={errors.storeManagerName}>
        <input
          id="storeManagerName"
          name="storeManagerName"
          type="text"
          autoComplete="off"
          className={inputClass(Boolean(errors.storeManagerName))}
        />
      </Field>

      <Field id="stockIssues" label={labels.stockIssues} error={errors.stockIssues}>
        <textarea
          id="stockIssues"
          name="stockIssues"
          rows={3}
          className={inputClass(Boolean(errors.stockIssues))}
        />
      </Field>

      <Field id="notes" label={labels.notes} error={errors.notes}>
        <textarea id="notes" name="notes" rows={3} className={inputClass(Boolean(errors.notes))} />
      </Field>

      <div>
        <label htmlFor="photos" className="text-sm font-medium text-[color:var(--color-ink)]">
          {labels.photos}
        </label>
        <input
          ref={photosRef}
          id="photos"
          name="photos"
          type="file"
          onChange={onPhotosChosen}
          accept="image/jpeg,image/png,image/webp"
          capture="environment"
          multiple
          className="mt-1 block w-full text-sm"
        />
        <p className="mt-1 text-xs text-[color:var(--color-muted)]">
          {preparingPhotos ? labels.photosPreparing : labels.photosHint}
        </p>
      </div>

      <SubmitButton
        label={labels.submit}
        submittingLabel={preparingPhotos ? labels.photosPreparing : labels.submitting}
      />
    </form>
  );
}
