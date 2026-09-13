import Link from "next/link";
import { notFound } from "next/navigation";
import { translatorFor, DEFAULT_LOCALE } from "@/lib/i18n";
import { PageHeader, Icon } from "@/components/ui";
import { loadInvitePanel } from "./data";
import { InvitePanel } from "./invite-panel";

export const dynamic = "force-dynamic";

/**
 * P38 — "Στείλε πρόσκληση" from a promoter's own profile, to any upcoming shift that still needs
 * people, whether or not the matching engine would have suggested it. A coordinator reaches for
 * this when they know something the engine does not ("she worked this store last year and the
 * manager asked for her").
 */
export default async function PromoterInvitePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const t = translatorFor(DEFAULT_LOCALE);

  // RLS-scoped throughout `data.ts` — a promoter id belonging to another agency returns
  // `not_found` here exactly the way `app/promoters/[id]/page.tsx` handles the same case.
  const result = await loadInvitePanel(id);
  if (!result.ok) notFound();

  const { promoter, shifts } = result.view;

  return (
    <main className="mx-auto max-w-4xl px-6 py-10 sm:py-12">
      <div className="flex flex-col gap-8">
        <PageHeader
          eyebrow={
            <Link
              href={`/promoters/${promoter.id}`}
              className="inline-flex items-center gap-1 rounded-sm hover:text-[color:var(--color-ink)] focus-visible:outline-none focus-visible:shadow-[var(--focus-ring)]"
            >
              <Icon name="chevronLeft" size={14} />
              {promoter.fullName}
            </Link>
          }
          icon={<Icon name="megaphone" size={20} />}
          title={t("invite_panel.title")}
          subtitle={t("invite_panel.subtitle", { name: promoter.fullName })}
        />

        <InvitePanel promoterId={promoter.id} promoterPhone={promoter.phone} shifts={shifts} />
      </div>
    </main>
  );
}
