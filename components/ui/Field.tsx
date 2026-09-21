import type {
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from "react";
import { cn } from "./cn";

function describedBy(...ids: Array<string | undefined>): string | undefined {
  const list = ids.filter((id): id is string => Boolean(id));
  return list.length ? list.join(" ") : undefined;
}

/**
 * The control chassis.
 *
 * Three P34 changes account for most of the difference. The fill is the faint
 * sunken neutral rather than pure white, so an input reads as a slot cut into
 * the card instead of a white rectangle on a white card — it turns white on
 * focus, which is what makes focus feel like the field "opening". The focus
 * state is a double box-shadow ring rather than an `outline`, matching Button,
 * so a form's tab order looks like one system. And the border darkens on hover,
 * which is the small signal that tells someone the thing is editable before
 * they click it.
 *
 * P42a softened the corner to 18px and moved the focus border from the accent
 * to **clay**. The accent is near-black now, so a focused field drawn in it was
 * indistinguishable from an unfocused one two rows down; clay is the product's
 * one live colour and "the control you are in" is exactly what it is for. It
 * also makes the border and the ring around it the same hue instead of two.
 */
const CONTROL_BASE =
  "w-full rounded-xl border bg-[color:var(--color-canvas-sunken)]/45 px-4 text-sm " +
  "text-[color:var(--color-ink)] outline-none " +
  "transition-[background-color,border-color,box-shadow] duration-150 ease-[var(--ease-out-soft)] " +
  "placeholder:text-[color:var(--color-muted-soft)] " +
  "hover:border-[color:var(--color-line-strong)] " +
  "focus-visible:border-[color:var(--color-action)] focus-visible:bg-[color:var(--color-surface)] " +
  "focus-visible:shadow-[var(--focus-ring)] " +
  // `disabled:` sorts after `hover:` in Tailwind's variant order, so these win: without the
  // border override a disabled control still darkened its edge under the pointer and read as
  // editable, which is the opposite of what the state is for.
  "disabled:cursor-not-allowed disabled:border-[color:var(--color-line)] " +
  "disabled:bg-[color:var(--color-canvas-sunken)] disabled:opacity-55 disabled:shadow-none";

function controlBorder(hasError: boolean) {
  return hasError
    ? "border-[color:var(--color-bad)] bg-[color:var(--color-bad-subtle)]/40 hover:border-[color:var(--color-bad)]"
    : "border-[color:var(--color-line-strong)]";
}

interface FieldShellProps {
  id: string;
  label: string;
  hint?: string;
  error?: string;
  required?: boolean;
  className?: string;
  children: ReactNode;
}

/** Label + hint/error layout shared by every field control below. */
function FieldShell({ id, label, hint, error, required, className, children }: FieldShellProps) {
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;

  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <label
        htmlFor={id}
        className="text-sm font-medium leading-5 text-[color:var(--color-ink)]"
      >
        {label}
        {required ? (
          <span aria-hidden="true" className="ml-0.5 text-[color:var(--color-bad)]">
            *
          </span>
        ) : null}
      </label>
      {children}
      {hint && !error ? (
        <p id={hintId} className="text-xs leading-5 text-[color:var(--color-muted)]">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p
          id={errorId}
          role="alert"
          className="flex items-start gap-1.5 text-xs font-medium leading-5 text-[color:var(--color-bad-ink)]"
        >
          <span
            aria-hidden="true"
            className="mt-1 size-1.5 shrink-0 rounded-full bg-[color:var(--color-bad)]"
          />
          <span>{error}</span>
        </p>
      ) : null}
    </div>
  );
}

export interface TextFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "id"> {
  id: string;
  label: string;
  hint?: string;
  error?: string;
  /** Classes for the outer wrapper (label + control + hint/error). */
  containerClassName?: string;
}

/** Single-line text input, labelled and described for assistive tech. */
export function TextField({
  id,
  label,
  hint,
  error,
  required,
  containerClassName,
  className,
  ...rest
}: TextFieldProps) {
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;

  return (
    <FieldShell id={id} label={label} hint={hint} error={error} required={required} className={containerClassName}>
      <input
        id={id}
        required={required}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(hintId, errorId)}
        className={cn(CONTROL_BASE, "h-11", controlBorder(Boolean(error)), className)}
        {...rest}
      />
    </FieldShell>
  );
}

export interface SelectOption {
  value: string;
  label: string;
}

export interface SelectFieldProps extends Omit<SelectHTMLAttributes<HTMLSelectElement>, "id"> {
  id: string;
  label: string;
  hint?: string;
  error?: string;
  options: SelectOption[];
  /** Shown as a disabled first option when no value is selected yet. */
  placeholder?: string;
  containerClassName?: string;
}

/**
 * The chevron, as a data URI background.
 *
 * A native select's own arrow is a different shape on every platform and is the
 * single most obvious "unstyled form" tell. Drawing our own means the control
 * matches the icon set — and it is inlined here rather than pulled from a file
 * so it costs no request and cannot 404.
 */
const SELECT_CHEVRON =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='20' height='20' viewBox='0 0 24 24' fill='none' stroke='%23a89e8f' stroke-width='1.75' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M5.5 9.5 12 16l6.5-6.5'/%3E%3C/svg%3E\")";

/** Native <select>, labelled and described for assistive tech. */
export function SelectField({
  id,
  label,
  hint,
  error,
  required,
  options,
  placeholder,
  containerClassName,
  className,
  ...rest
}: SelectFieldProps) {
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;

  return (
    <FieldShell id={id} label={label} hint={hint} error={error} required={required} className={containerClassName}>
      <select
        id={id}
        required={required}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(hintId, errorId)}
        style={{
          backgroundImage: SELECT_CHEVRON,
          backgroundRepeat: "no-repeat",
          backgroundPosition: "right 0.75rem center",
          backgroundSize: "1.25rem 1.25rem",
        }}
        className={cn(
          CONTROL_BASE,
          "h-11 cursor-pointer appearance-none pr-10",
          controlBorder(Boolean(error)),
          className,
        )}
        {...rest}
      >
        {placeholder ? (
          // NOT `hidden`. A hidden option cannot be the selected one, so a select with no explicit
          // default silently started on the first REAL option: /campaigns/new filed a campaign
          // under the alphabetically first client, and the shift-series form picked the first
          // store — which also fed the ranked list the wrong coordinates. The field looked empty
          // and behaved as filled, and `required` could not help because a value was present.
          // Keeping it selectable-but-empty makes `required` do its job again.
          <option value="">{placeholder}</option>
        ) : null}
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </FieldShell>
  );
}

export interface TextAreaProps extends Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, "id"> {
  id: string;
  label: string;
  hint?: string;
  error?: string;
  containerClassName?: string;
}

/** Multi-line text input, labelled and described for assistive tech. */
export function TextArea({
  id,
  label,
  hint,
  error,
  required,
  rows = 4,
  containerClassName,
  className,
  ...rest
}: TextAreaProps) {
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;

  return (
    <FieldShell id={id} label={label} hint={hint} error={error} required={required} className={containerClassName}>
      <textarea
        id={id}
        rows={rows}
        required={required}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(hintId, errorId)}
        className={cn(
          CONTROL_BASE,
          "resize-y py-2.5 leading-6",
          controlBorder(Boolean(error)),
          className,
        )}
        {...rest}
      />
    </FieldShell>
  );
}
