import { NextResponse, type NextRequest } from "next/server";
import { requireUser } from "@/lib/auth";
import { athensDate } from "@/lib/exceptions";
import { csvFileName, shiftCsvRows, storeCsvRows, toCsv } from "@/lib/reporting";
import { loadCampaignReport } from "../data";

/**
 * P29 — CSV export of a campaign report.
 *
 * `docs/product-spec.md` §11 and `docs/commercial-architecture.md` §4: *"Export all of their data
 * … as CSV, any time, without asking us."* An agency that knows it can leave is more willing to
 * arrive, so this endpoint is a sales feature and is treated as one — which means the file has to
 * open cleanly in Greek Excel on the first double-click. See `lib/reporting.ts` for why that means
 * a BOM and a semicolon rather than RFC 4180's comma.
 *
 * Two modes over the same rollup, never a second query path:
 *   `?mode=shifts` (default) — one row per shift, every derived figure and the basis it rests on
 *   `?mode=stores`           — one row per store, closed by a `TOTAL` row
 *
 * `requireUser()` first, then RLS-scoped reads inside `loadCampaignReport`. A campaign belonging
 * to another agency returns no row and this endpoint 404s — the same answer as a campaign that
 * does not exist, which is the answer it should be.
 */

/** `loadCampaignReport` uses the cookie-bound server client — Node runtime, never the edge. */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MODES = ["shifts", "stores"] as const;
type Mode = (typeof MODES)[number];

function readMode(value: string | null): Mode {
  return value === "stores" ? "stores" : "shifts";
}

/**
 * A `Content-Disposition` a browser on any platform can act on.
 *
 * The bare `filename` parameter is ASCII-only by specification, so a Greek campaign name has to
 * be carried in `filename*` (RFC 5987) alongside an ASCII fallback. Sending only the Greek name
 * produces a header some proxies mangle and some browsers ignore; sending only ASCII loses the
 * campaign's identity in the customer's downloads folder. Both, in this order, is what works.
 */
function contentDisposition(asciiName: string, utf8Name: string): string {
  const encoded = encodeURIComponent(utf8Name).replace(/['()*]/g, (ch) =>
    `%${ch.charCodeAt(0).toString(16).toUpperCase()}`,
  );
  return `attachment; filename="${asciiName}"; filename*=UTF-8''${encoded}`;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { id } = await params;
  await requireUser();

  const loaded = await loadCampaignReport(id);
  if (!loaded) {
    return new NextResponse("Not found", { status: 404 });
  }

  const mode = readMode(request.nextUrl.searchParams.get("mode"));
  const rows = mode === "stores" ? storeCsvRows(loaded.report) : shiftCsvRows(loaded.report);
  const csv = toCsv(rows);

  const today = athensDate(new Date());
  const asciiName = csvFileName(loaded.report.campaign.name, mode, today);
  const utf8Name = `${loaded.report.campaign.name} — ${mode} — ${today}.csv`;

  return new NextResponse(csv, {
    status: 200,
    headers: {
      // The BOM is inside the body; the charset here is what stops a browser preview mangling it.
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": contentDisposition(asciiName, utf8Name),
      // Promoter names and field data. Never cached by a proxy, never held by the browser.
      "Cache-Control": "no-store, max-age=0",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
