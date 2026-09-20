import { cn } from "./cn";

export type AvatarSize = "xs" | "sm" | "md" | "lg";

export interface AvatarProps {
  /** The person's full name. Drives both the initials and the tint. */
  name: string;
  size?: AvatarSize;
  /** Render a filled brand-blue chip instead of the name-derived tint. */
  tone?: "auto" | "accent" | "neutral";
  className?: string;
}

const SIZES: Record<AvatarSize, string> = {
  xs: "size-6 text-2xs",
  sm: "size-8 text-xs",
  md: "size-10 text-sm",
  lg: "size-12 text-base",
};

/**
 * Six tints, picked deterministically from the name.
 *
 * Deterministic matters: the same promoter must get the same colour on the
 * shift page, in the roster table and in the match list, or the colour reads as
 * meaningful when it is not. These are all low-saturation so a column of them
 * stays calm — an avatar is an anchor for the eye, not a decoration.
 *
 * P42a swapped them onto the pastel chips. A roster of thirty initials in
 * status tints was the one place in the product where green and red appeared
 * without meaning anything — a promoter called Δήμητρα is not "bad". The
 * pastels are the system's decorative colours and carry no state at all, which
 * is the property this needs.
 */
const TINTS = [
  "bg-[color:var(--color-chip-peach)] text-[color:var(--color-chip-peach-ink)]",
  "bg-[color:var(--color-chip-mint)] text-[color:var(--color-chip-mint-ink)]",
  "bg-[color:var(--color-chip-lilac)] text-[color:var(--color-chip-lilac-ink)]",
  "bg-[color:var(--color-chip-sand)] text-[color:var(--color-chip-sand-ink)]",
  "bg-[color:var(--color-chip-rose)] text-[color:var(--color-chip-rose-ink)]",
  "bg-[color:var(--color-neutral-subtle)] text-[color:var(--color-neutral-ink)]",
] as const;

/** Combining diacritical marks, written as escapes so the source stays ASCII. */
const COMBINING_MARKS = new RegExp("[\\u0300-\\u036f]", "g");

/**
 * Up to two initials.
 *
 * Greek needs the accent stripped before uppercasing: `toUpperCase("άννα")` is
 * "ΆΝΝΑ", but Greek typography drops the tonos on capitals, so a bare "Ά" in a
 * circle looks like a typo to a Greek coordinator. Decomposing to NFD and
 * dropping the combining marks fixes Greek and Latin diacritics in one pass.
 */
export function initialsFor(name: string): string {
  const words = name
    .normalize("NFD")
    .replace(COMBINING_MARKS, "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  const first = words[0];
  const last = words[words.length - 1];
  if (!first || !last) return "?";
  if (words.length === 1) return first.slice(0, 2).toUpperCase();
  return (first.slice(0, 1) + last.slice(0, 1)).toUpperCase();
}

function tintFor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i += 1) {
    hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  }
  return TINTS[hash % TINTS.length] ?? TINTS[0];
}

/**
 * Initials chip. We have no promoter photos and are not going to collect any,
 * so this is the roster's only face — it does the work an avatar usually does:
 * makes a list of thirty names scannable.
 *
 * Decorative by default: the name is always rendered next to it in the UI, so
 * announcing it twice is noise.
 */
export function Avatar({ name, size = "md", tone = "auto", className }: AvatarProps) {
  const palette =
    tone === "accent"
      ? "bg-[color:var(--color-accent)] text-[color:var(--color-n-25)]"
      : tone === "neutral"
        ? "bg-[color:var(--color-neutral-subtle)] text-[color:var(--color-neutral-ink)]"
        : tintFor(name);

  return (
    <span
      aria-hidden="true"
      title={name}
      className={cn(
        "inline-flex shrink-0 select-none items-center justify-center rounded-full font-semibold uppercase leading-none tracking-tight ring-1 ring-inset ring-[color:var(--color-ink)]/5",
        SIZES[size],
        palette,
        className,
      )}
    >
      {initialsFor(name)}
    </span>
  );
}
