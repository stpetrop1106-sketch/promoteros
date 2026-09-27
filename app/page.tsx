import { Home } from "@/app/home";

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

/**
 * The front door of PromoterOS.
 *
 * A server component only so the campaign attribution can be read before the page renders and
 * handed to the client tree as plain strings. Everything visible is in `app/home.tsx`.
 */
export default async function Page({ searchParams }: PageProps) {
  const params = await searchParams;
  const value = (key: string) => {
    const parameter = params[key];
    return typeof parameter === "string" ? parameter.slice(0, 120) : "";
  };

  return (
    <Home
      attribution={{
        source: value("utm_source"),
        medium: value("utm_medium"),
        campaign: value("utm_campaign"),
      }}
    />
  );
}
