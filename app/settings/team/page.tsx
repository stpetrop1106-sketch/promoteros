import type { Metadata } from "next";
import Link from "next/link";
import { loadTeamSnapshot, type TeamMember, type TeamRole } from "@/lib/team";
import { translatorFor, DEFAULT_LOCALE, type TranslationKey } from "@/lib/i18n";
import { PageHeader, Card, Badge, Button, EmptyState } from "@/components/ui";
import { InviteForm, RoleControl, RemoveControl, RevokeControl } from "./team-controls";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "PromoterOS" };

const t = translatorFor(DEFAULT_LOCALE);

const ROLE_LABEL: Record<TeamRole, TranslationKey> = {
  owner: "team.role.owner",
  coordinator: "team.role.coordinator",
  supervisor: "team.role.supervisor",
  admin: "team.role.admin",
};

function formatDate(value: string | null): string {
  if (!value) return "—";
  return new Intl.DateTimeFormat("el-GR", { dateStyle: "medium" }).format(new Date(value));
}

function StatusBadge({ member }: { member: TeamMember }) {
  if (!member.active) return <Badge variant="neutral">{t("team.status.removed")}</Badge>;
  if (!member.acceptedAt) return <Badge variant="warn">{t("team.status.invited")}</Badge>;
  return <Badge variant="ok">{t("team.status.active")}</Badge>;
}

/**
 * Team management.
 *
 * The screen renders owner controls only for an owner, but that is presentation, not security:
 * every action re-derives the caller's role from the database, and every membership write goes
 * through a `security definer` function that does the same. Hiding a button stops a mistake;
 * it does not stop an attacker, and nothing here pretends otherwise.
 */
export default async function TeamPage() {
  const snapshot = await loadTeamSnapshot();

  if (!snapshot) {
    return (
      <main className="mx-auto max-w-3xl px-6 py-12">
        <PageHeader title={t("team.title")} />
        <div className="mt-6">
          <EmptyState
            title={t("team.no_agency_title")}
            description={t("team.no_agency_body")}
            action={
              <Link href="/onboarding">
                <Button>{t("team.no_agency_cta")}</Button>
              </Link>
            }
          />
        </div>
      </main>
    );
  }

  const { agency, members, invitations, viewer, seatsUsed, seatsRemaining, activeOwnerCount } =
    snapshot;

  const activeMembers = members.filter((m) => m.active);
  const removedMembers = members.filter((m) => !m.active);
  const liveInvitations = invitations.filter((i) => !i.expired);
  const expiredInvitations = invitations.filter((i) => i.expired);

  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <PageHeader
        title={t("team.title")}
        subtitle={t("team.subtitle", { agency: agency.name })}
        actions={
          <Link href="/settings">
            <Button variant="ghost" size="sm">
              {t("team.back_to_settings")}
            </Button>
          </Link>
        }
      />

      <p className="mt-2 text-sm text-[color:var(--color-muted)]">
        {t("team.seats", { used: seatsUsed, limit: agency.seatLimit })}
      </p>

      {/* One primary action per screen: inviting a colleague. */}
      {viewer.isOwner ? (
        <Card
          className="mt-6"
          header={
            <div>
              <h2 className="text-sm font-semibold text-[color:var(--color-ink)]">
                {t("team.invite.title")}
              </h2>
              <p className="mt-0.5 text-xs text-[color:var(--color-muted)]">
                {t("team.invite.subtitle")}
              </p>
            </div>
          }
        >
          <InviteForm seatsRemaining={seatsRemaining} />
        </Card>
      ) : (
        <div className="mt-6 rounded-lg border border-[color:var(--color-line)] bg-[color:var(--color-surface)] px-4 py-3 text-sm text-[color:var(--color-muted)]">
          {t("team.readonly_notice")}
        </div>
      )}

      <Card
        className="mt-6"
        header={
          <h2 className="text-sm font-semibold text-[color:var(--color-ink)]">
            {t("team.members_title")}
          </h2>
        }
      >
        <ul className="flex flex-col divide-y divide-[color:var(--color-line)]">
          {activeMembers.map((member) => {
            const isLastOwner = member.role === "owner" && activeOwnerCount <= 1;

            const roleBlocked: TranslationKey | undefined = member.isSelf
              ? "team.role_change.self_blocked"
              : isLastOwner
                ? "team.role_change.last_owner_blocked"
                : undefined;

            const removeBlocked: TranslationKey | undefined = member.isSelf
              ? "team.remove.self_blocked"
              : isLastOwner
                ? "team.remove.last_owner_blocked"
                : undefined;

            return (
              <li key={member.id} className="flex flex-col gap-3 py-4 first:pt-0 last:pb-0">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-sm font-medium text-[color:var(--color-ink)]">
                      {member.fullName}
                      {member.isSelf ? (
                        <span className="ml-2 text-xs font-normal text-[color:var(--color-muted)]">
                          {t("team.you")}
                        </span>
                      ) : null}
                    </p>
                    <p className="text-xs text-[color:var(--color-muted)]">{member.email}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="info">{t(ROLE_LABEL[member.role])}</Badge>
                    <StatusBadge member={member} />
                  </div>
                </div>

                {viewer.isOwner ? (
                  <div className="flex flex-col gap-3">
                    <RoleControl
                      userId={member.id}
                      currentRole={member.role}
                      disabledReasonKey={roleBlocked}
                    />
                    {/* Kept away from the role control: the dangerous action is never adjacent
                        to the common one (commercial-architecture §6). */}
                    <div className="border-t border-dashed border-[color:var(--color-line)] pt-3">
                      <RemoveControl
                        userId={member.id}
                        name={member.fullName}
                        blockedReasonKey={removeBlocked}
                      />
                    </div>
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      </Card>

      <Card
        className="mt-6"
        header={
          <h2 className="text-sm font-semibold text-[color:var(--color-ink)]">
            {t("team.pending_title")}
          </h2>
        }
      >
        {liveInvitations.length === 0 && expiredInvitations.length === 0 ? (
          <EmptyState
            title={t("team.pending_none_title")}
            description={t("team.pending_none_body")}
          />
        ) : (
          <ul className="flex flex-col divide-y divide-[color:var(--color-line)]">
            {[...liveInvitations, ...expiredInvitations].map((invitation) => (
              <li
                key={invitation.id}
                className="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-0 last:pb-0"
              >
                <div>
                  <p className="text-sm text-[color:var(--color-ink)]">{invitation.email}</p>
                  <p className="text-xs text-[color:var(--color-muted)]">
                    {invitation.expired
                      ? t("team.pending.expired", { when: formatDate(invitation.expiresAt) })
                      : t("team.pending.expires", { when: formatDate(invitation.expiresAt) })}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={invitation.expired ? "neutral" : "warn"}>
                    {t(ROLE_LABEL[invitation.role])}
                  </Badge>
                  {viewer.isOwner ? <RevokeControl invitationId={invitation.id} /> : null}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {removedMembers.length > 0 ? (
        <Card
          className="mt-6"
          header={
            <div>
              <h2 className="text-sm font-semibold text-[color:var(--color-ink)]">
                {t("team.removed_title")}
              </h2>
              <p className="mt-0.5 text-xs text-[color:var(--color-muted)]">
                {t("team.removed_body")}
              </p>
            </div>
          }
        >
          <ul className="flex flex-col divide-y divide-[color:var(--color-line)]">
            {removedMembers.map((member) => (
              <li
                key={member.id}
                className="flex flex-wrap items-center justify-between gap-2 py-3 first:pt-0 last:pb-0"
              >
                <div>
                  <p className="text-sm text-[color:var(--color-ink)]">{member.fullName}</p>
                  <p className="text-xs text-[color:var(--color-muted)]">{member.email}</p>
                </div>
                <StatusBadge member={member} />
              </li>
            ))}
          </ul>
        </Card>
      ) : null}
    </main>
  );
}
