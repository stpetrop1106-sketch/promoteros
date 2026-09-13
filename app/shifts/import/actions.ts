"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { createServerSupabase } from "@/lib/supabase/server";
import { getEntitlement, checkBilling } from "@/lib/billing/subscription";
import { getGeocoder } from "@/lib/geocoding";
import { athensDate } from "@/lib/exceptions";
import { createProgramme } from "@/lib/programmes";
import { runImportCommit, type ImportDeps } from "./commit";
import { existingShiftKey, geocodeQueries } from "./plan";
import type { CommitInput, CommitResult, GeocodePreview, ImportContextResult } from "./types";

/**
 * P37c — the import's server actions. This module exports async functions only (CLAUDE.md's
 * boundary rule); every type the wizard needs is in `./types`, every decision is in `./plan` and
 * `./commit`. Everything here goes through the RLS-scoped client, so an id from another agency is
 * simply not found — there is no `agency_id` filter to forget.
 */

const RECENT_IMPORT_SECONDS = 120;

async function isReadOnly(agencyId: string): Promise<boolean> {
  const entitlement = await getEntitlement(agencyId);
  return Boolean(entitlement && !checkBilling(entitlement, "write").allowed);
}

/** Everything the wizard needs to decide where the shifts go and which stores they use. */
export async function loadImportContext(): Promise<ImportContextResult> {
  const user = await requireUser();
  const db = await createServerSupabase();

  const [clients, campaigns, stores, programmes, readOnly] = await Promise.all([
    db.from("clients").select("id, name").order("name", { ascending: true }),
    db
      .from("campaigns")
      .select("id, name, client_id, starts_on, ends_on, clients(name)")
      .order("starts_on", { ascending: false }),
    db.from("stores").select("id, name, address, chain, client_id").order("name", { ascending: true }),
    db
      .from("shift_programmes")
      .select("id, name, campaign_id, archived_at")
      .order("created_at", { ascending: false }),
    isReadOnly(user.agencyId),
  ]);

  if (clients.error || campaigns.error || stores.error) return { ok: false };

  type CampaignRow = {
    id: string;
    name: string;
    client_id: string;
    starts_on: string;
    ends_on: string;
    clients: { name: string } | null;
  };

  return {
    ok: true,
    context: {
      today: athensDate(new Date()),
      readOnly,
      clients: (clients.data ?? []).map((c) => ({ id: c.id, name: c.name })),
      campaigns: ((campaigns.data ?? []) as unknown as CampaignRow[]).map((c) => ({
        id: c.id,
        name: c.name,
        clientId: c.client_id,
        clientName: c.clients?.name ?? "",
        startsOn: c.starts_on,
        endsOn: c.ends_on,
      })),
      // 0016 may not be applied yet: the wizard says so and offers only a new section.
      programmesUnavailable: Boolean(programmes.error),
      programmes: programmes.error
        ? []
        : (programmes.data ?? []).map((p) => ({
            id: p.id,
            name: p.name,
            campaignId: p.campaign_id,
            archived: p.archived_at !== null,
          })),
      stores: (stores.data ?? []).map((s) => ({
        id: s.id,
        name: s.name,
        address: s.address,
        chain: s.chain,
        clientId: s.client_id,
      })),
    },
  };
}

async function existingShiftKeys(
  db: Awaited<ReturnType<typeof createServerSupabase>>,
  campaignId: string,
  storeIds: string[],
  from: string,
  to: string,
): Promise<string[] | null> {
  if (storeIds.length === 0) return [];
  const { data, error } = await db
    .from("shifts")
    .select("store_id, on_date, start_time, end_time")
    .eq("campaign_id", campaignId)
    .in("store_id", storeIds)
    .gte("on_date", from)
    .lte("on_date", to)
    // A cancelled shift does not occupy the slot: putting it back is not a duplicate.
    .neq("status", "cancelled");
  if (error) return null;
  return (data ?? []).map((s) => existingShiftKey(s.store_id, s.on_date, s.start_time, s.end_time));
}

/** For the preview: shifts already in this campaign at these stores and dates. Null when unreadable. */
export async function loadExistingShiftKeys(
  campaignId: string,
  storeIds: string[],
  from: string,
  to: string,
): Promise<string[] | null> {
  await requireUser();
  if (typeof campaignId !== "string" || !Array.isArray(storeIds) || storeIds.length > 2000) return null;
  const db = await createServerSupabase();
  return existingShiftKeys(db, campaignId, storeIds.map(String), String(from), String(to));
}

/**
 * For the stores step: can a new store be placed from what the file says? The coordinator sees the
 * address it resolved to before choosing "create". The commit geocodes again itself — this answer
 * is shown, never trusted.
 */
export async function previewStoreLocation(store: {
  name: string;
  address: string | null;
  city: string | null;
}): Promise<GeocodePreview> {
  await requireUser();
  const geocoder = getGeocoder();
  const queries = geocodeQueries({
    name: String(store?.name ?? ""),
    address: store?.address ? String(store.address) : null,
    city: store?.city ? String(store.city) : null,
  });
  for (const query of queries.slice(0, 3)) {
    const result = await geocoder.geocode(query.slice(0, 500), { country: "gr" });
    if (result) return { ok: true, formattedAddress: result.formattedAddress, confidence: result.confidence };
  }
  return { ok: false };
}

export async function commitImport(input: CommitInput): Promise<CommitResult> {
  const user = await requireUser();
  const db = await createServerSupabase();
  const geocoder = getGeocoder();

  const deps: ImportDeps = {
    today: athensDate(new Date()),
    readOnly: await isReadOnly(user.agencyId),

    async findCampaign(id) {
      const { data } = await db.from("campaigns").select("id, name, client_id").eq("id", id).maybeSingle();
      return data ? { id: data.id, name: data.name, clientId: data.client_id } : null;
    },
    async findClient(id) {
      const { data } = await db.from("clients").select("id").eq("id", id).maybeSingle();
      return data ? { id: data.id } : null;
    },
    async findClientByName(name) {
      // Exact, like the unique index on clients (agency_id, name). The wizard warns case-insensitively.
      const { data } = await db.from("clients").select("id").eq("name", name).limit(1);
      return data && data[0] ? { id: data[0].id } : null;
    },
    async findProgramme(id) {
      const { data } = await db
        .from("shift_programmes")
        .select("id, name, campaign_id, archived_at")
        .eq("id", id)
        .maybeSingle();
      return data
        ? { id: data.id, name: data.name, campaignId: data.campaign_id, archived: data.archived_at !== null }
        : null;
    },
    async listKnownStores(clientId) {
      // Same rule as the manual shift form (app/campaigns/[id]/shifts/new/page.tsx): the client's own
      // stores and unowned ones.
      let query = db.from("stores").select("id, name, address, chain");
      query = clientId ? query.or(`client_id.eq.${clientId},client_id.is.null`) : query.is("client_id", null);
      const { data, error } = await query;
      if (error) return null;
      return (data ?? []).map((s) => ({ id: s.id, name: s.name, address: s.address, chain: s.chain }));
    },
    listExistingShiftKeys: (campaignId, storeIds, from, to) => existingShiftKeys(db, campaignId, storeIds, from, to),
    async hasRecentImport(programmeName, filename) {
      const since = new Date(Date.now() - RECENT_IMPORT_SECONDS * 1000).toISOString();
      const { data } = await db
        .from("shift_programmes")
        .select("id")
        .eq("source", "import")
        .eq("name", programmeName)
        .eq("source_filename", filename)
        .gte("created_at", since)
        .limit(1);
      return Boolean(data && data.length > 0);
    },
    async geocode(query) {
      const result = await geocoder.geocode(query.slice(0, 500), { country: "gr" });
      return result ? result.coordinates : null;
    },
    async createClient(name) {
      const { data, error } = await db.from("clients").insert({ agency_id: user.agencyId, name }).select("id").single();
      return error || !data ? null : data.id;
    },
    async createCampaign(c) {
      const { data, error } = await db
        .from("campaigns")
        .insert({
          agency_id: user.agencyId,
          client_id: c.clientId,
          name: c.name,
          starts_on: c.startsOn,
          ends_on: c.endsOn,
          rate_cents: c.rateCents,
          status: "draft",
        })
        .select("id")
        .single();
      return error || !data ? null : data.id;
    },
    async createStore(s) {
      const { data, error } = await db
        .from("stores")
        .insert({
          agency_id: user.agencyId,
          client_id: s.clientId,
          name: s.name,
          address: s.address,
          chain: s.chain,
          lat: s.lat,
          lng: s.lng,
        })
        .select("id")
        .single();
      return error || !data ? null : data.id;
    },
    async createProgramme(p) {
      const result = await createProgramme(db, {
        agencyId: user.agencyId,
        campaignId: p.campaignId,
        name: p.name,
        source: "import",
        sourceFilename: p.filename,
      });
      return result.ok ? result.id : null;
    },
    async insertShifts(rows) {
      const { error } = await db.from("shifts").insert(
        rows.map((r) => ({
          agency_id: user.agencyId,
          campaign_id: r.campaignId,
          store_id: r.storeId,
          programme_id: r.programmeId,
          on_date: r.date,
          start_time: r.startTime,
          end_time: r.endTime,
          promoters_required: r.promotersRequired,
        })),
      );
      return !error;
    },
  };

  const result = await runImportCommit(input, deps);

  if (result.status === "done") {
    revalidatePath("/shifts");
    revalidatePath("/campaigns");
    if (result.outcome.campaignId) revalidatePath(`/campaigns/${result.outcome.campaignId}`);
  }
  return result;
}
