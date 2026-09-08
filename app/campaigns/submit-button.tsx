"use client";

import { useFormStatus } from "react-dom";
import { Button, type ButtonProps } from "@/components/ui";

/**
 * Primary submit control for every form in this parcel. Reads pending state from the
 * surrounding `<form action={...}>` via `useFormStatus`, so it must be rendered inside that
 * form, never passed the state as a prop.
 */
export function SubmitButton({
  label,
  pendingLabel,
  variant = "primary",
  ...rest
}: {
  label: string;
  pendingLabel: string;
} & Omit<ButtonProps, "children" | "loading" | "type">) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant={variant} loading={pending} disabled={pending} {...rest}>
      {pending ? pendingLabel : label}
    </Button>
  );
}
