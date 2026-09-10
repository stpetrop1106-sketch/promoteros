/**
 * Team role values that both the server and the browser need.
 *
 * `lib/team.ts` is `server-only`, so a client component importing `ASSIGNABLE_ROLES` from it
 * dragged the whole server module into the client bundle and failed the production build —
 * while `npm run dev` compiled it happily. Values shared across the boundary live here; the
 * mutations stay in `lib/team.ts`.
 */
export type TeamRole = "owner" | "coordinator" | "supervisor" | "admin";

/** What an owner may hand out. `admin` is the legacy 0001 value and is deliberately not offered. */
export const ASSIGNABLE_ROLES = ["owner", "coordinator", "supervisor"] as const;
export type AssignableRole = (typeof ASSIGNABLE_ROLES)[number];

export function isAssignableRole(value: string): value is AssignableRole {
  return (ASSIGNABLE_ROLES as readonly string[]).includes(value);
}
