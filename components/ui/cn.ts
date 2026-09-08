/**
 * Tiny className joiner. No external dependency (no clsx/tailwind-merge) —
 * filters falsy values and joins with a space.
 */
export function cn(...values: Array<string | false | null | undefined>): string {
  return values.filter(Boolean).join(" ");
}
