import { Landing } from "@/app/landing";

type HomeProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function Home({ searchParams }: HomeProps) {
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
