import type { Metadata } from "next";
import Link from "next/link";
import { authState } from "@/lib/auth";
import { createServerSupabase } from "@/lib/supabase/server";
import { hashToken, verifyToken } from "@/lib/tokens";
import { translatorFor, DEFAULT_LOCALE, type TranslationKey } from "@/lib/i18n";
import { PageHeader, Card, Button, Badge } from "@/components/ui";
import { AcceptForm } from "./accept-form";
import { signOutAndReturn } from "./actions";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "PromoterOS" };

const t = translatorFor(DEFAULT_LOCALE);

const ROLE_LABEL: Record<string, TranslationKey> = {
  owner: "team.role.owner",
  coordinator: "team.role.coordinator",
  supervisor: "team.role.supervisor",
  admin: "team.role.admin",
};

type PreviewRow = {
  agency_name: string;
  invited_email: string;
  invited_role: string;
  invite_expires_at: string;
  invite_accepted_at: string | null;
};

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("el-GR", { dateStyle: "long", timeStyle: "short" }).format(
    new Date(value),
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return <main className="mx-auto max-w-lg px-6 py-16">{children}</main>;
}

function DeadEndFree({ titleKey, bodyKey }: { titleKey: TranslationKey; bodyKey: TranslationKey }) {
  return (
    <Shell>
      <PageHeader title={t(titleKey)} subtitle={t(bodyKey)} />
      <div className="mt-6 flex flex-wrap gap-2">
        <Link href="/onboarding">
          <Button variant="secondary">{t("onboarding.join.error_way_out")}</Button>
        </Link>
      </div>
    </Shell>
  );
}

/**
 * Accepting a staff invitation.
 *
 * Not `/i/[token]` — that page is the promoter-facing one and is anonymous by design. A staff
 * invitation is the opposite: it must end in a real sign-in, because it creates a login. So it
 * lives in the onboarding area, which `middleware.ts` does not gate, and handles the signed-out
 * case itself by sending the visitor to `/login?next=` back to this exact link.
 */
export default async function JoinPage({ params }: { params: Promise<{ token: string }> }) {
  const { token: rawToken } = await params;
  const token = decodeURIComponent(rawToken);

  // Signature and expiry before anything touches the database.
  const verified = verifyToken(token, "invitation");
  if (!verified.ok) {
    return verified.reason === "expired" ? (
      <DeadEndFree titleKey="onboarding.join.expired_title" bodyKey="onboarding.join.expired_body" />
    ) : (
      <DeadEndFree titleKey="onboarding.join.invalid_title" bodyKey="onboarding.join.invalid_body" />
    );
  }

  const db = await createServerSupabase();

  // `agency_invitation_preview` is security definer and keyed on the token hash, so it tells a
  // token holder — signed in or not — which agency invited them, and nothing to anybody else.
  const { data } = await db.rpc("agency_invitation_preview", { p_token_hash: hashToken(token) });
  const invitation = (data as PreviewRow[] | null)?.[0];

  if (!invitation) {
    return (
      <DeadEndFree titleKey="onboarding.join.invalid_title" bodyKey="onboarding.join.invalid_body" />
    );
  }
  if (invitation.invite_accepted_at) {
    return <DeadEndFree titleKey="onboarding.join.used_title" bodyKey="onboarding.join.used_body" />;
  }
  if (new Date(invitation.invite_expires_at).getTime() <= Date.now()) {
    return (
      <DeadEndFree titleKey="onboarding.join.expired_title" bodyKey="onboarding.join.expired_body" />
    );
  }

  const state = await authState();
  const roleKey = ROLE_LABEL[invitation.invited_role] ?? "team.role.coordinator";

  const summary = (
    <div className="flex flex-col gap-2 text-sm">
      <p className="text-base font-semibold text-[color:var(--color-ink)]">
        {t("onboarding.join.invited_to", { agency: invitation.agency_name })}
      </p>
      <p className="flex items-center gap-2 text-[color:var(--color-muted)]">
        <span>{t("onboarding.join.role_label")}</span>
        <Badge variant="info">{t(roleKey)}</Badge>
      </p>
      <p className="text-[color:var(--color-muted)]">
        {t("onboarding.join.sent_to", { email: invitation.invited_email })}
      </p>
      <p className="text-xs text-[color:var(--color-muted)]">
        {t("onboarding.join.expires", { when: formatDate(invitation.invite_expires_at) })}
      </p>
    </div>
  );

  // Signed out: send them to the magic link and straight back here afterwards. `next` is a
  // relative path, which `safeNext` in app/login requires, so this cannot become an open redirect.
  if (!state.ok && state.reason === "anonymous") {
    const next = encodeURIComponent(`/onboarding/join/${encodeURIComponent(token)}`);
    return (
      <Shell>
        <PageHeader title={t("onboarding.join.title")} />
        <Card className="mt-6">{summary}</Card>
        <Card className="mt-4">
          <h2 className="text-sm font-semibold text-[color:var(--color-ink)]">
            {t("onboarding.join.signin_title")}
          </h2>
          <p className="mt-1 text-sm leading-6 text-[color:var(--color-muted)]">
            {t("onboarding.join.signin_body", { email: invitation.invited_email })}
          </p>
          <div className="mt-4">
            <Link href={`/login?next=${next}`}>
              <Button>{t("onboarding.join.signin_cta")}</Button>
            </Link>
          </div>
        </Card>
      </Shell>
    );
  }

  const {
    data: { user },
  } = await db.auth.getUser();
  const signedInEmail = (user?.email ?? "").toLowerCase();
  const invitedEmail = invitation.invited_email.toLowerCase();

  // Signed in as someone else. A forwarded email must not be a way into another tenant, so the
  // database refuses this too — this is the readable version of that refusal.
  if (signedInEmail !== invitedEmail) {
    return (
      <Shell>
        <PageHeader title={t("onboarding.join.title")} />
        <Card className="mt-6">{summary}</Card>
        <Card className="mt-4">
          <h2 className="text-sm font-semibold text-[color:var(--color-ink)]">
            {t("onboarding.join.wrong_email_title")}
          </h2>
          <p className="mt-1 text-sm leading-6 text-[color:var(--color-muted)]">
            {t("onboarding.join.wrong_email_body", {
              invited: invitation.invited_email,
              current: signedInEmail,
            })}
          </p>
          <form action={signOutAndReturn} className="mt-4">
            <input type="hidden" name="token" value={token} />
            <Button type="submit" variant="secondary">
              {t("onboarding.join.sign_out_and_return")}
            </Button>
          </form>
        </Card>
      </Shell>
    );
  }

  // Already attached to an agency. If it is a different one, joining is impossible — one person
  // is one tenant — and saying that plainly beats a failed accept.
  if (state.ok) {
    return (
      <Shell>
        <PageHeader title={t("onboarding.join.title")} />
        <Card className="mt-6">{summary}</Card>
        <Card className="mt-4">
          <p className="text-sm leading-6 text-[color:var(--color-muted)]">
            {t("onboarding.join.already_in_agency_body")}
          </p>
          <div className="mt-4">
            <Link href="/shifts">
              <Button variant="secondary">{t("onboarding.join.go_to_app")}</Button>
            </Link>
          </div>
        </Card>
      </Shell>
    );
  }

  return (
    <Shell>
      <PageHeader title={t("onboarding.join.title")} />
      <Card className="mt-6">{summary}</Card>
      <Card className="mt-4">
        <p className="text-sm leading-6 text-[color:var(--color-muted)]">
          {t("onboarding.join.accept_body", { agency: invitation.agency_name })}
        </p>
        <div className="mt-4">
          <AcceptForm token={token} />
        </div>
      </Card>
    </Shell>
  );
}
