"use client";

import type { ReactNode } from "react";
import { useActionState, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { IDLE_STATE, readReportValues, type ReportActionState } from "./state";
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
  /** Contains no placeholder. */
  successWithPhotoFailuresOne: string;
  /** Contains the literal substring `{count}`. */
  successWithPhotoFailuresMany: string;
  photoFailuresTellCoordinator: string;
  offline: string;
  confirmEmptyQuestion: string;
  confirmEmptyNote: string;
  confirmEmptyYes: string;
  confirmEmptyNo: string;
};

/** The largest value a Postgres `integer` column holds — A3-07. Mirrors the server's own bound. */
const MAX_INT = 2_147_483_647;

const TEXT_FIELD_NAMES = [
  "unitsPromoted",
  "salesCount",
  "interactionsCount",
  "storeManagerName",
  "stockIssues",
  "notes",
] as const;

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
 * report.
 *
 * A3-15: `capture="environment"` used to sit on the file input. On iOS Safari that opens the
 * camera directly AND suppresses the photo library, and `multiple` is ignored while it is
 * present — so a promoter who photographed the display during the shift and files the report on
 * the bus afterwards could not reach those photos at all. `accept` + `multiple` alone makes a
 * phone offer both the camera and the library.
 *
 * A3-01: the action is called through `runAction` below rather than handed to `useActionState`
 * directly. A transport failure — the connection dropping between the tap and the server —
 * rejects the action's promise, which produces no state at all: before this the page did
 * nothing, the button stayed enabled, and nothing was saved. Now it becomes `offline`.
 */
export function ReportForm({
  action,
  labels,
}: {
  action: (state: ReportActionState, formData: FormData) => Promise<ReportActionState>;
  labels: ReportFormLabels;
}) {
  const photosRef = useRef<HTMLInputElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  /** Set by the "yes, submit it empty" button so the next submit passes straight through. */
  const emptyConfirmedRef = useRef(false);
  const [preparingPhotos, setPreparingPhotos] = useState(false);
  const [confirmingEmpty, setConfirmingEmpty] = useState(false);

  async function runAction(
    previous: ReportActionState,
    formData: FormData,
  ): Promise<ReportActionState> {
    try {
      return await action(previous, formData);
    } catch {
      // Never rethrow: an unhandled rejection here is exactly the silent failure A3-01 describes.
      // The values go back with it — React resets the form to its `defaultValue`s once the action
      // completes, and after a failed submit on a supermarket connection the last thing a
      // promoter should have to do is type the whole report again.
      return { status: "offline", values: readReportValues(formData) };
    } finally {
      emptyConfirmedRef.current = false;
    }
  }

  const [state, formAction] = useActionState<ReportActionState, FormData>(runAction, IDLE_STATE);

  /** Nothing typed, nothing chosen — A3-14. A report is written once and cannot be edited. */
  function isEmptySubmission(form: HTMLFormElement): boolean {
    const data = new FormData(form);
    const hasText = TEXT_FIELD_NAMES.some((name) => String(data.get(name) ?? "").trim() !== "");
    if (hasText) return false;
    return !data
      .getAll("photos")
      .some((entry) => entry instanceof File && entry.size > 0);
  }

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    if (emptyConfirmedRef.current) return;
    if (isEmptySubmission(event.currentTarget)) {
      event.preventDefault();
      setConfirmingEmpty(true);
    }
  }

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
    // A3-08: this branch used to be unreachable — `submitReport` called `revalidatePath`, the
    // page re-rendered with `hasReport` true and replaced the whole form (and this state) with
    // the terminal "already submitted" screen, so a promoter whose photo was rejected was never
    // told. The revalidate is gone; this is now what they see.
    const photoWarning =
      state.photosFailed === 1
        ? labels.successWithPhotoFailuresOne
        : labels.successWithPhotoFailuresMany.replace("{count}", String(state.photosFailed));
    return (
      <div className="mt-6 space-y-2 text-center text-sm">
        {state.photosFailed > 0 ? (
          <>
            <p role="alert" className="font-medium text-[color:var(--color-warn)]">
              {photoWarning}
            </p>
            <p className="text-[color:var(--color-muted)]">
              {labels.photoFailuresTellCoordinator}
            </p>
          </>
        ) : (
          <p className="font-medium text-[color:var(--color-ok)]">{labels.success}</p>
        )}
      </div>
    );
  }

  const errors = state.status === "error" ? state.errors : {};
  // See `state.ts`: these become each field's `defaultValue`, which is what React restores the
  // form to when it resets it after the action.
  const values = state.status === "error" || state.status === "offline" ? state.values : {};

  return (
    <form ref={formRef} action={formAction} onSubmit={onSubmit} className="mt-6 space-y-4">
      {state.status === "offline" && (
        <p
          role="alert"
          className="rounded-lg border border-[color:var(--color-bad)] bg-[color:var(--color-surface)] p-3 text-sm font-medium text-[color:var(--color-bad)]"
        >
          {labels.offline}
        </p>
      )}

      {errors.general && (
        <p role="alert" className="text-sm font-medium text-[color:var(--color-bad)]">
          {errors.general}
        </p>
      )}

      <Field id="unitsPromoted" label={labels.unitsPromoted} error={errors.unitsPromoted}>
        <input
          id="unitsPromoted"
          name="unitsPromoted"
          defaultValue={values.unitsPromoted ?? ""}
          type="number"
          inputMode="numeric"
          min={0}
          max={MAX_INT}
          step={1}
          className={inputClass(Boolean(errors.unitsPromoted))}
        />
      </Field>

      <Field id="salesCount" label={labels.salesCount} error={errors.salesCount}>
        <input
          id="salesCount"
          name="salesCount"
          defaultValue={values.salesCount ?? ""}
          type="number"
          inputMode="numeric"
          min={0}
          max={MAX_INT}
          step={1}
          className={inputClass(Boolean(errors.salesCount))}
        />
      </Field>

      <Field id="interactionsCount" label={labels.interactionsCount} error={errors.interactionsCount}>
        <input
          id="interactionsCount"
          name="interactionsCount"
          defaultValue={values.interactionsCount ?? ""}
          type="number"
          inputMode="numeric"
          min={0}
          max={MAX_INT}
          step={1}
          className={inputClass(Boolean(errors.interactionsCount))}
        />
      </Field>

      <Field id="storeManagerName" label={labels.storeManagerName} error={errors.storeManagerName}>
        <input
          id="storeManagerName"
          name="storeManagerName"
          defaultValue={values.storeManagerName ?? ""}
          type="text"
          autoComplete="off"
          className={inputClass(Boolean(errors.storeManagerName))}
        />
      </Field>

      <Field id="stockIssues" label={labels.stockIssues} error={errors.stockIssues}>
        <textarea
          id="stockIssues"
          name="stockIssues"
          defaultValue={values.stockIssues ?? ""}
          rows={3}
          className={inputClass(Boolean(errors.stockIssues))}
        />
      </Field>

      <Field id="notes" label={labels.notes} error={errors.notes}>
        <textarea
          id="notes"
          name="notes"
          rows={3}
          defaultValue={values.notes ?? ""}
          className={inputClass(Boolean(errors.notes))}
        />
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
          multiple
          className="mt-1 block w-full text-sm"
        />
        <p className="mt-1 text-xs text-[color:var(--color-muted)]">
          {preparingPhotos ? labels.photosPreparing : labels.photosHint}
        </p>
      </div>

      {confirmingEmpty ? (
        <div
          role="alert"
          className="space-y-3 rounded-lg border border-[color:var(--color-warn)] bg-[color:var(--color-surface)] p-4"
        >
          <p className="text-sm font-medium text-[color:var(--color-ink)]">
            {labels.confirmEmptyQuestion}
          </p>
          <p className="text-xs text-[color:var(--color-muted)]">{labels.confirmEmptyNote}</p>
          <button
            type="button"
            onClick={() => {
              emptyConfirmedRef.current = true;
              setConfirmingEmpty(false);
              formRef.current?.requestSubmit();
            }}
            className="w-full rounded-lg bg-[color:var(--color-accent)] px-4 py-3 text-base font-semibold text-white transition hover:bg-[color:var(--color-accent-hover)]"
          >
            {labels.confirmEmptyYes}
          </button>
          <button
            type="button"
            onClick={() => setConfirmingEmpty(false)}
            className="w-full rounded-lg border border-[color:var(--color-line)] px-4 py-3 text-base font-medium text-[color:var(--color-ink)] transition hover:bg-[color:var(--color-surface-hover)]"
          >
            {labels.confirmEmptyNo}
          </button>
        </div>
      ) : (
        <SubmitButton
          label={labels.submit}
          submittingLabel={preparingPhotos ? labels.photosPreparing : labels.submitting}
        />
      )}
    </form>
  );
}
