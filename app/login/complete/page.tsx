import type { Metadata } from "next";
import { CompleteSignIn } from "./complete-sign-in";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Login" };

function safeNext(value: string | undefined): string {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return "/dashboard";
  return value;
}

/**
 * Where `app/login/callback/route.ts` sends a sign-in it could not complete server-side.
 *
 * The session arrives in the URL fragment, which only the browser can read — see the component
 * for why. This page exists purely to hand `next` to it; everything else happens client-side.
 */
export default async function CompleteLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const params = await searchParams;
  return <CompleteSignIn next={safeNext(params.next)} />;
}
