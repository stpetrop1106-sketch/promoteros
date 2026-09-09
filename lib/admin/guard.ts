import "server-only";
import { notFound } from "next/navigation";
import { createServerSupabase } from "@/lib/supabase/server";

export type PlatformAdmin = {
  id: string;
  fullName: string;
};

/**
 * The gate for the whole `/admin` route segment and every server action under it.
 *
 * Checked against `platform_admins` — a table entirely separate from `app_users`, never a role
 * string on an agency user and never an env-var email list (commercial-architecture.md §5). The
 * membership check itself goes through `is_platform_admin()`, a SECURITY DEFINER function
 * (0013_admin.sql): `platform_admins` grants `authenticated` nothing at all, so there is no
 * query shape that could read or spoof membership from the browser even if this file were
 * bypassed.
 *
 * A non-admin — including a real, signed-in agency owner — gets a plain 404. It must reveal
 * nothing about the console's existence. Call this first, before any query, exactly like
 * `requireUser()` is the first call on every coordinator page.
 */
export async function requirePlatformAdmin(): Promise<PlatformAdmin> {
  const db = await createServerSupabase();

  const {
    data: { user },
  } = await db.auth.getUser();

  if (!user) notFound();

  const { data: isAdmin, error } = await db.rpc("is_platform_admin");
  if (error || isAdmin !== true) notFound();

  const { data: fullName } = await db.rpc("current_platform_admin_name");

  return {
    id: user.id,
    fullName: (typeof fullName === "string" && fullName.trim().length > 0 ? fullName : user.email) ?? "Admin",
  };
}
