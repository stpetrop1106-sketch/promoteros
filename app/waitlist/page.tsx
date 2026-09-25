import { Landing } from "@/app/landing";

type WaitlistProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

/**
 * The waitlist, which used to be `/`.
 *
 * It was the front door of the whole product, and it should never have been: it collects email
 * addresses from interested agencies and nothing else, and the owner intends to switch it off once
 * there are enough of them. A page we plan to delete cannot be the page the product opens on.
 *
 * So it now lives here, whole and self-contained, and `/` is the product. Switching the waitlist
 * off later means deleting this directory, `app/landing.tsx`, `app/waitlist-form.tsx`,
 * `app/waitlist-state.ts` and the action in `app/actions.ts` — and nothing else in the application
 * notices, because nothing else imports any of them.
 *
 * The UTM parameters keep working exactly as before: any campaign link that pointed at `/` should
 * be repointed at `/waitlist`, and the attribution it carries is read here the same way.
 */
export default async function WaitlistPage({ searchParams }: WaitlistProps) {
  const params = await searchParams;
  const value = (key: string) => {
    const parameter = params[key];
    return typeof parameter === "string" ? parameter.slice(0, 120) : "";
  };

  return (
    <Landing
      attribution={{
        source: value("utm_source"),
        medium: value("utm_medium"),
        campaign: value("utm_campaign"),
      }}
    />
  );
}
