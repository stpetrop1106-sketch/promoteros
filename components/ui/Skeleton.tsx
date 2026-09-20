import { cn } from "./cn";

export type SkeletonVariant = "text" | "block" | "circle";

export interface SkeletonProps {
  variant?: SkeletonVariant;
  /** CSS width, e.g. "60%" or 120. Defaults per variant. */
  width?: string | number;
  /** CSS height, e.g. "1rem" or 40. Defaults per variant. */
  height?: string | number;
  className?: string;
}

/* P42a: the corners follow the containers they stand in for — a block skeleton
   is a card-in-waiting, so it is a card's radius. */
const VARIANTS: Record<SkeletonVariant, string> = {
  text: "h-4 w-full rounded-full",
  block: "h-24 w-full rounded-2xl",
  circle: "size-10 rounded-full",
};

/**
 * A loading placeholder shaped like the thing that is coming.
 *
 * Always `aria-hidden`: a screen reader should hear the loading state from the
 * container's `aria-busy`, not from a stack of empty boxes. Pair it with
 * `aria-busy` on the region you are filling.
 *
 * Use it where a Suspense boundary would otherwise flash an empty card. Do not
 * use it for anything that takes under ~200ms — a skeleton that appears and
 * vanishes reads as a glitch.
 */
export function Skeleton({ variant = "text", width, height, className }: SkeletonProps) {
  return (
    <span
      aria-hidden="true"
      className={cn("block animate-shimmer", VARIANTS[variant], className)}
      style={{ width, height }}
    />
  );
}

export interface SkeletonTextProps {
  /** How many lines. Defaults to 3. */
  lines?: number;
  className?: string;
}

/**
 * A paragraph's worth of skeleton lines, the last one short — the detail that
 * makes a placeholder read as text rather than as a broken layout.
 */
export function SkeletonText({ lines = 3, className }: SkeletonTextProps) {
  return (
    <span className={cn("flex flex-col gap-2", className)}>
      {Array.from({ length: Math.max(1, lines) }, (_, index) => (
        <Skeleton
          key={index}
          variant="text"
          className={index === lines - 1 && lines > 1 ? "w-2/3" : undefined}
        />
      ))}
    </span>
  );
}
