import { loadInvitation } from "@/lib/invitations";
import { translatorFor, DEFAULT_LOCALE } from "@/lib/i18n";
import { RespondForm } from "./respond-form";

export const dynamic = "force-dynamic";

/**
 * The promoter-facing invitation page.
 *
 * No login: the signed link is the credential. Designed for a phone, opened from whichever
 * messenger the promoter already uses.
 */
export default async function InvitationPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const t = translatorFor(DEFAULT_LOCALE);
  const result = await loadInvitation(token);

  if (!result.ok) {
    return (
      <main className="mx-auto max-w-md px-6 py-16 text-center">
        <p className="text-[color:var(--color-muted)]">{t("invitation.expired")}</p>
      </main>
    );
  }

  const v = result.view;
  const answered = v.status !== "pending";

  return (
    <main className="mx-auto max-w-md px-6 py-12">
      <h1 className="text-lg font-semibold">{t("invitation.title")}</h1>

      <dl className="mt-6 space-y-3 rounded-lg border border-[color:var(--color-line)] bg-white p-5 text-sm">
        <div>
          <dt className="text-[color:var(--color-muted)]">{t("shifts.campaign")}</dt>
          <dd className="font-medium">{v.campaignName}</dd>
        </div>
        <div>
          <dt className="text-[color:var(--color-muted)]">{t("shifts.store")}</dt>
          <dd className="font-medium">{v.storeName}</dd>
        </div>
        <div>
          <dt className="text-[color:var(--color-muted)]">{t("shifts.date")}</dt>
          <dd className="font-medium">
            {v.onDate} · {v.startTime}–{v.endTime}
          </dd>
        </div>
        {v.dressCode && (
          <div>
            <dt className="text-[color:var(--color-muted)]">Dress code</dt>
            <dd className="font-medium">{v.dressCode}</dd>
          </div>
        )}
        {v.rateCents > 0 && (
          <div>
            <dt className="text-[color:var(--color-muted)]">€</dt>
            <dd className="font-medium">{(v.rateCents / 100).toFixed(2)}</dd>
          </div>
        )}
      </dl>

      {answered ? (
        <p className="mt-6 text-sm text-[color:var(--color-muted)]">
          {v.status === "accepted" ? t("invitation.accepted") : t("invitation.declined")}
        </p>
      ) : (
        <>
          <p className="mt-6 text-center text-sm">{t("invitation.question")}</p>
          <RespondForm
            token={token}
            acceptLabel={t("invitation.accept")}
            declineLabel={t("invitation.decline")}
            acceptedLabel={t("invitation.accepted")}
            declinedLabel={t("invitation.declined")}
          />
        </>
      )}
    </main>
  );
}
