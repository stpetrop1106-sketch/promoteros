import { notFound } from "next/navigation";
import { PromoterPrivacyNotice } from "@/app/privacy/promoters/notice";
import { agencyForAvailabilityToken } from "@/lib/promoter-controller";

export const dynamic = "force-dynamic";

/**
 * The privacy notice for the promoter holding this link, naming their own agency as controller.
 *
 * The token is the credential, exactly as on the page that links here: a bad or unknown token is
 * a 404, so this route cannot be used to enumerate agencies.
 */
export default async function Page({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const agencyId = await agencyForAvailabilityToken(token);
  if (!agencyId) notFound();

  return <PromoterPrivacyNotice agencyId={agencyId} />;
}
