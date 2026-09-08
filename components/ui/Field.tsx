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

const CONTROL_BASE =
  "w-full rounded-lg border bg-[color:var(--color-surface)] px-3 text-sm text-[color:var(--color-ink)] " +
  "outline-none transition placeholder:text-[color:var(--color-muted)] " +
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 " +
  "focus-visible:outline-[color:var(--color-accent)] disabled:cursor-not-allowed disabled:opacity-50";

function controlBorder(hasError: boolean) {
  return hasError
    ? "border-[color:var(--color-bad)]"
    : "border-[color:var(--color-line)]";
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
      <label htmlFor={id} className="text-sm font-medium text-[color:var(--color-ink)]">
        {label}
        {required ? (
          <span aria-hidden="true" className="ml-0.5 text-[color:var(--color-bad)]">
            *
          </span>
        ) : null}
      </label>
      {children}
      {hint && !error ? (
        <p id={hintId} className="text-xs text-[color:var(--color-muted)]">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={errorId} role="alert" className="text-xs font-medium text-[color:var(--color-bad)]">
          {error}
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
        className={cn(CONTROL_BASE, "h-10", controlBorder(Boolean(error)), className)}
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
        className={cn(CONTROL_BASE, "h-10", controlBorder(Boolean(error)), className)}
        {...rest}
      >
        {placeholder ? (
          <option value="" disabled hidden>
            {placeholder}
          </option>
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
        className={cn(CONTROL_BASE, "py-2 leading-6", controlBorder(Boolean(error)), className)}
        {...rest}
      />
    </FieldShell>
  );
}
