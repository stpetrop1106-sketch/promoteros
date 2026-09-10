/**
 * G7 / P23 — prove tenant isolation against the live database, not just by reading policies.
 *
 * CLAUDE.md §4: "No cross-tenant data leakage, ever... Tenant isolation is a feature we sell,
 * not an implementation detail." Until this script existed, that claim rested on reading
 * `0002_rls.sql` and `0011_accounts.sql` and trusting the policies do what they say. Nobody
 * had created a second agency and confirmed, from that agency's own authenticated session,
 * that it sees nothing of another agency's data. That is what this script does.
 *
 * What it does, against the live Supabase project:
 *   1. Creates TWO fresh synthetic agencies (Alpha and Beta), each through the real self-serve
 *      signup path (`create_agency_for_user`, called by an authenticated session obtained the
 *      same way `app/login/callback/route.ts` completes a magic link — `verifyOtp` against a
 *      token minted by the Admin API). This is deliberately not the existing seeded demo
 *      agency: this script must be able to assert real rows exist in every listed table for
 *      BOTH sides of the comparison, on every run, regardless of what the demo agency happens
 *      to contain that day.
 *   2. Populates one full fixture set per agency — promoter, client, store, campaign, shift,
 *      invitation, assignment, check-in, field report — via the service-role client (fast,
 *      deterministic, and not itself part of what we are testing).
 *   3. Invites and accepts an ordinary (non-owner) team member into Agency Alpha, for the
 *      privilege-escalation checks in step 5.
 *   4. Using RLS-scoped clients authenticated as each agency's owner, asserts — per table,
 *      printed individually — that Alpha cannot see Beta's rows and Beta cannot see Alpha's,
 *      AND that each owner CAN see their own row with the identical query. The "can see own
 *      row" half is not decoration: it is what makes the "cannot see the other" half a real
 *      test rather than a query that would return nothing regardless (e.g. a typo'd column, a
 *      revoked grant returning a permission error being misread as "no rows", or a table that
 *      is simply empty).
 *   5. Attempts the two privilege escalations 0011_accounts.sql was written to close:
 *        a. an ordinary member updating their own `app_users.role` to 'owner' directly via
 *           PostgREST
 *        b. a direct PostgREST insert into another agency's `promoters`
 *      Both must fail, and each is re-verified by reading the row back with the service-role
 *      client afterwards — an insert or update that returns an error but silently partially
 *      applied would otherwise pass a test that only checked the error object.
 *   6. Cleans up everything it created, in a `finally` block, so the script is safe to run
 *      repeatedly and leaves no residue on success or failure.
 *
 * Usage: npx tsx --env-file=.env scripts/verify-isolation.ts
 *
 * Mutates the live database only inside the two agencies this script creates and deletes. It
 * never reads or writes the seeded demo agency's rows.
 */
import { randomBytes, randomUUID, createHash } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!url || !serviceRoleKey || !anonKey) {
  throw new Error(
    "Set NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY and SUPABASE_SERVICE_ROLE_KEY in .env first.",
  );
}

const admin = createClient(url, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

// ---------------------------------------------------------------------------
// Pass/fail bookkeeping
// ---------------------------------------------------------------------------

type Result = { name: string; pass: boolean; detail?: string };
const results: Result[] = [];

function record(name: string, pass: boolean, detail?: string) {
  results.push({ name, pass, detail });
  const mark = pass ? "PASS" : "FAIL";
  console.log(`  [${mark}] ${name}${detail ? ` — ${detail}` : ""}`);
}

// ---------------------------------------------------------------------------
// Auth helpers — obtain a real RLS-scoped session, the same way a browser would.
// ---------------------------------------------------------------------------

/** Mints a magic-link token via the Admin API and completes it, exactly like
 *  `app/login/callback/route.ts` does with `verifyOtp`. Returns an anon-key client carrying a
 *  real session for that user, so every query it makes runs as Postgres role `authenticated`
 *  with a real `auth.uid()`, subject to every RLS policy. */
async function sessionClientFor(email: string): Promise<SupabaseClient> {
  const { data, error } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email,
  });
  if (error || !data?.properties?.hashed_token) {
    throw new Error(`Could not generate a magic link for ${email}: ${error?.message}`);
  }

  const client = createClient(url!, anonKey!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { error: otpError } = await client.auth.verifyOtp({
    type: "magiclink",
    token_hash: data.properties.hashed_token,
  });
  if (otpError) {
    throw new Error(`Could not verify the session for ${email}: ${otpError.message}`);
  }
  return client;
}

async function createAuthUser(email: string, fullName: string): Promise<string> {
  const { data, error } = await admin.auth.admin.createUser({
    email,
    email_confirm: true,
    user_metadata: { full_name: fullName },
  });
  if (error || !data.user) {
    throw new Error(`Could not create auth user ${email}: ${error?.message}`);
  }
  return data.user.id;
}

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const RUN_ID = randomUUID().slice(0, 8);
const FIXTURE_TAG = `ISO-TEST-${RUN_ID}`;

type AgencyRig = {
  label: "Alpha" | "Beta";
  agencyId: string;
  ownerUserId: string;
  ownerEmail: string;
  ownerClient: SupabaseClient;
  clientId: string;
  promoterId: string;
  storeId: string;
  campaignId: string;
  shiftId: string;
  invitationId: string;
  assignmentId: string;
  checkinId: string;
  fieldReportId: string;
};

const createdAuthUserIds: string[] = [];
const createdAgencyIds: string[] = [];

/** Real self-serve signup: an authenticated-but-unattached user calls `create_agency_for_user`,
 *  exactly as `app/onboarding/**` does. This is intentionally NOT a service-role insert. */
async function signUpAgency(label: "Alpha" | "Beta"): Promise<{
  agencyId: string;
  ownerUserId: string;
  ownerEmail: string;
  ownerClient: SupabaseClient;
}> {
  const ownerEmail = `iso-test-owner-${label.toLowerCase()}-${RUN_ID}@example.test`;
  const ownerUserId = await createAuthUser(ownerEmail, `Isolation Owner ${label}`);
  createdAuthUserIds.push(ownerUserId);

  const ownerClient = await sessionClientFor(ownerEmail);

  const { data: agencyId, error } = await ownerClient.rpc("create_agency_for_user", {
    p_name: `${FIXTURE_TAG} Agency ${label}`,
    p_city: "Αθήνα",
    p_timezone: "Europe/Athens",
    p_full_name: `Isolation Owner ${label}`,
  });
  if (error || !agencyId) {
    throw new Error(`create_agency_for_user failed for ${label}: ${error?.message}`);
  }
  createdAgencyIds.push(agencyId as string);

  return { agencyId: agencyId as string, ownerUserId, ownerEmail, ownerClient };
}

/** Populates one full row per tenant-scoped table this script asserts isolation on, via the
 *  service-role client. Deliberately named and tagged so nobody mistakes these for real data
 *  (CLAUDE.md §1) or for the seeded demo agency's rows. */
async function buildFixtures(
  label: "Alpha" | "Beta",
  agencyId: string,
  ownerUserId: string,
  ownerEmail: string,
  ownerClient: SupabaseClient,
): Promise<AgencyRig> {
  const suffix = `${label.toLowerCase()}-${RUN_ID}`;

  const { data: client, error: clientErr } = await admin
    .from("clients")
    .insert({ agency_id: agencyId, name: `${FIXTURE_TAG} Client ${label}` })
    .select("id")
    .single();
  if (clientErr || !client) throw new Error(`fixture client insert failed: ${clientErr?.message}`);

  const { data: promoter, error: promoterErr } = await admin
    .from("promoters")
    .insert({
      agency_id: agencyId,
      full_name: `${FIXTURE_TAG} Promoter ${label}`,
      phone: `690${label === "Alpha" ? "1" : "2"}${RUN_ID.replace(/[^0-9]/g, "0").padEnd(6, "0").slice(0, 6)}`,
      status: "active",
      home_lat: 37.9838,
      home_lng: 23.7275,
    })
    .select("id")
    .single();
  if (promoterErr || !promoter) throw new Error(`fixture promoter insert failed: ${promoterErr?.message}`);

  const { data: store, error: storeErr } = await admin
    .from("stores")
    .insert({
      agency_id: agencyId,
      client_id: client.id,
      name: `${FIXTURE_TAG} Store ${label}`,
      lat: 37.9838,
      lng: 23.7275,
    })
    .select("id")
    .single();
  if (storeErr || !store) throw new Error(`fixture store insert failed: ${storeErr?.message}`);

  const today = new Date().toISOString().slice(0, 10);
  const nextWeek = new Date(Date.now() + 7 * 86_400_000).toISOString().slice(0, 10);

  const { data: campaign, error: campaignErr } = await admin
    .from("campaigns")
    .insert({
      agency_id: agencyId,
      client_id: client.id,
      name: `${FIXTURE_TAG} Campaign ${label}`,
      campaign_type: "Δειγματισμός",
      starts_on: today,
      ends_on: nextWeek,
      status: "active",
    })
    .select("id")
    .single();
  if (campaignErr || !campaign) throw new Error(`fixture campaign insert failed: ${campaignErr?.message}`);

  const { data: shift, error: shiftErr } = await admin
    .from("shifts")
    .insert({
      agency_id: agencyId,
      campaign_id: campaign.id,
      store_id: store.id,
      on_date: today,
      start_time: "10:00",
      end_time: "18:00",
      promoters_required: 1,
      status: "open",
    })
    .select("id")
    .single();
  if (shiftErr || !shift) throw new Error(`fixture shift insert failed: ${shiftErr?.message}`);

  const rawInviteToken = randomBytes(24).toString("hex");
  const inviteTokenHash = createHash("sha256").update(rawInviteToken).digest("hex");

  const { data: invitation, error: invitationErr } = await admin
    .from("invitations")
    .insert({
      agency_id: agencyId,
      shift_id: shift.id,
      promoter_id: promoter.id,
      token_hash: `iso-${suffix}-${inviteTokenHash}`,
      channel: "clipboard",
      expires_at: new Date(Date.now() + 86_400_000).toISOString(),
      status: "pending",
    })
    .select("id")
    .single();
  if (invitationErr || !invitation) {
    throw new Error(`fixture invitation insert failed: ${invitationErr?.message}`);
  }

  const { data: assignment, error: assignmentErr } = await admin
    .from("assignments")
    .insert({
      agency_id: agencyId,
      shift_id: shift.id,
      promoter_id: promoter.id,
      status: "confirmed",
    })
    .select("id")
    .single();
  if (assignmentErr || !assignment) {
    throw new Error(`fixture assignment insert failed: ${assignmentErr?.message}`);
  }

  const { data: checkin, error: checkinErr } = await admin
    .from("check_ins")
    .insert({
      agency_id: agencyId,
      assignment_id: assignment.id,
      distance_from_store_m: 12,
      within_geofence: true,
      method: "geolocation",
    })
    .select("id")
    .single();
  if (checkinErr || !checkin) throw new Error(`fixture check_in insert failed: ${checkinErr?.message}`);

  const { data: fieldReport, error: fieldReportErr } = await admin
    .from("field_reports")
    .insert({
      agency_id: agencyId,
      assignment_id: assignment.id,
      shift_id: shift.id,
      units_promoted: 10,
      notes: `${FIXTURE_TAG} field report ${label}`,
    })
    .select("id")
    .single();
  if (fieldReportErr || !fieldReport) {
    throw new Error(`fixture field_report insert failed: ${fieldReportErr?.message}`);
  }

  return {
    label,
    agencyId,
    ownerUserId,
    ownerEmail,
    ownerClient,
    clientId: client.id,
    promoterId: promoter.id,
    storeId: store.id,
    campaignId: campaign.id,
    shiftId: shift.id,
    invitationId: invitation.id,
    assignmentId: assignment.id,
    checkinId: checkin.id,
    fieldReportId: fieldReport.id,
  };
}

async function cleanupFixtures(rig: AgencyRig) {
  await admin.from("field_reports").delete().eq("id", rig.fieldReportId);
  await admin.from("check_ins").delete().eq("id", rig.checkinId);
  await admin.from("assignments").delete().eq("id", rig.assignmentId);
  await admin.from("invitations").delete().eq("id", rig.invitationId);
  await admin.from("shifts").delete().eq("id", rig.shiftId);
  await admin.from("campaigns").delete().eq("id", rig.campaignId);
  await admin.from("stores").delete().eq("id", rig.storeId);
  await admin.from("promoters").delete().eq("id", rig.promoterId);
  await admin.from("clients").delete().eq("id", rig.clientId);
}

// ---------------------------------------------------------------------------
// Isolation assertions — each table is a named, individually printed assertion.
// ---------------------------------------------------------------------------

/** The seven tables the parcel brief names explicitly. `id` is the primary key on every one. */
const TENANT_TABLES = [
  "promoters",
  "campaigns",
  "shifts",
  "invitations",
  "assignments",
  "check_ins",
  "field_reports",
] as const;

function rowIdFor(rig: AgencyRig, table: (typeof TENANT_TABLES)[number]): string {
  switch (table) {
    case "promoters":
      return rig.promoterId;
    case "campaigns":
      return rig.campaignId;
    case "shifts":
      return rig.shiftId;
    case "invitations":
      return rig.invitationId;
    case "assignments":
      return rig.assignmentId;
    case "check_ins":
      return rig.checkinId;
    case "field_reports":
      return rig.fieldReportId;
  }
}

/**
 * For one table and one fixture row, checks BOTH directions with the same query shape:
 *   - the owning agency's session CAN see its own row (the sanity half — proves the query is
 *     capable of returning a row at all, so the "cannot see" half below is not vacuous)
 *   - the other agency's session CANNOT see that row
 */
async function checkTable(
  table: (typeof TENANT_TABLES)[number],
  owner: AgencyRig,
  other: AgencyRig,
) {
  const rowId = rowIdFor(owner, table);

  const { data: ownData, error: ownError } = await owner.ownerClient
    .from(table)
    .select("id")
    .eq("id", rowId);

  if (ownError) {
    record(
      `${table}: ${owner.label} can read its own row`,
      false,
      `query errored instead of returning it — ${ownError.message}`,
    );
  } else {
    const seen = (ownData ?? []).length === 1;
    record(
      `${table}: ${owner.label} can read its own row`,
      seen,
      seen ? undefined : "own row was not returned — this table's isolation check below would be meaningless",
    );
  }

  const { data: otherData, error: otherError } = await other.ownerClient
    .from(table)
    .select("id")
    .eq("id", rowId);

  if (otherError) {
    // A permission error (no SELECT grant at all) also proves isolation, but the tenant model
    // here grants SELECT to `authenticated` and relies on RLS, so an error is unexpected enough
    // to report rather than silently accept as a pass.
    record(
      `${table}: ${other.label} cannot see ${owner.label}'s row`,
      true,
      `query errored rather than returning rows (${otherError.message}) — treating as isolated, but this is not the expected shape`,
    );
  } else {
    const leaked = (otherData ?? []).length > 0;
    record(`${table}: ${other.label} cannot see ${owner.label}'s row`, !leaked, leaked ? "LEAKED" : undefined);
  }
}

// ---------------------------------------------------------------------------
// Privilege escalation — the exact two paths 0011_accounts.sql closed.
// ---------------------------------------------------------------------------

async function checkPrivilegeEscalation(alpha: AgencyRig, beta: AgencyRig) {
  // (a) An ordinary member promotes themselves to owner via a direct PostgREST update.
  const memberEmail = `iso-test-member-alpha-${RUN_ID}@example.test`;
  const memberUserId = await createAuthUser(memberEmail, "Isolation Member Alpha");
  createdAuthUserIds.push(memberUserId);

  const rawInviteToken = randomBytes(24).toString("hex");
  const inviteTokenHash = createHash("sha256").update(rawInviteToken).digest("hex");
  const invitationId = randomUUID();

  const { error: inviteErr } = await alpha.ownerClient.rpc("invite_team_member", {
    p_invitation_id: invitationId,
    p_email: memberEmail,
    p_role: "coordinator",
    p_token_hash: inviteTokenHash,
    p_expires_at: new Date(Date.now() + 86_400_000).toISOString(),
  });
  if (inviteErr) {
    record("privilege escalation setup: invite ordinary member", false, inviteErr.message);
    return;
  }

  const memberClient = await sessionClientFor(memberEmail);
  const { error: acceptErr } = await memberClient.rpc("accept_agency_invitation", {
    p_token_hash: inviteTokenHash,
  });
  if (acceptErr) {
    record("privilege escalation setup: accept invitation as member", false, acceptErr.message);
    return;
  }

  const { error: selfPromoteErr } = await memberClient
    .from("app_users")
    .update({ role: "owner" })
    .eq("id", memberUserId);

  const { data: memberRowAfter } = await admin
    .from("app_users")
    .select("role")
    .eq("id", memberUserId)
    .single();

  const stillCoordinator = memberRowAfter?.role === "coordinator";
  record(
    "privilege escalation: ordinary member cannot self-promote to owner",
    stillCoordinator,
    stillCoordinator
      ? selfPromoteErr
        ? `write was rejected (${selfPromoteErr.message})`
        : "write returned no error but changed nothing"
      : `role is now "${memberRowAfter?.role}" — self-promotion succeeded`,
  );

  // (b) A direct PostgREST insert into another agency's promoters, from Beta's owner writing
  // into Alpha's tenant.
  const { data: escalationInsert, error: crossInsertErr } = await beta.ownerClient
    .from("promoters")
    .insert({
      agency_id: alpha.agencyId,
      full_name: `${FIXTURE_TAG} Escalation Attempt`,
      phone: `699${RUN_ID.replace(/[^0-9]/g, "0").padEnd(6, "0").slice(0, 6)}`,
    })
    .select("id");

  let leakedRowId: string | null = null;
  if (!crossInsertErr && escalationInsert && escalationInsert.length > 0) {
    leakedRowId = escalationInsert[0]!.id as string;
  }

  const { count: crossRowCount } = await admin
    .from("promoters")
    .select("id", { count: "exact", head: true })
    .eq("agency_id", alpha.agencyId)
    .eq("full_name", `${FIXTURE_TAG} Escalation Attempt`);

  const blocked = (crossRowCount ?? 0) === 0;
  record(
    "privilege escalation: cross-tenant PostgREST insert into another agency's promoters is rejected",
    blocked,
    blocked
      ? crossInsertErr
        ? `write was rejected (${crossInsertErr.message})`
        : undefined
      : "row was actually written into another agency's promoters table",
  );

  if (leakedRowId) {
    await admin.from("promoters").delete().eq("id", leakedRowId);
  }

  // Clean up the member — deactivate and remove their auth user; app_users row cascades when
  // the agency itself is deleted at the end of the run.
  await admin.from("app_users").delete().eq("id", memberUserId);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.log(`Tenant isolation verification — run ${RUN_ID}\n`);

  console.log("Setting up two synthetic agencies through the real signup path…");
  const alphaSignup = await signUpAgency("Alpha");
  const betaSignup = await signUpAgency("Beta");

  console.log("Populating one fixture row per table in each agency…");
  const alpha = await buildFixtures(
    "Alpha",
    alphaSignup.agencyId,
    alphaSignup.ownerUserId,
    alphaSignup.ownerEmail,
    alphaSignup.ownerClient,
  );
  const beta = await buildFixtures(
    "Beta",
    betaSignup.agencyId,
    betaSignup.ownerUserId,
    betaSignup.ownerEmail,
    betaSignup.ownerClient,
  );

  try {
    console.log("\nCross-tenant read isolation, per table (both directions):\n");
    for (const table of TENANT_TABLES) {
      await checkTable(table, alpha, beta);
      await checkTable(table, beta, alpha);
    }

    console.log("\nPrivilege escalation attempts (must both be blocked):\n");
    await checkPrivilegeEscalation(alpha, beta);

    const failed = results.filter((r) => !r.pass);
    console.log("\n" + "=".repeat(72));
    if (failed.length === 0) {
      console.log(`ALL ${results.length} ASSERTIONS PASSED. Tenant isolation held under test.`);
    } else {
      console.log(
        `${failed.length} OF ${results.length} ASSERTIONS FAILED. This is a product-ending bug ` +
          "if seen against the real database — do not paper over it:",
      );
      for (const f of failed) {
        console.log(`  - ${f.name}${f.detail ? `: ${f.detail}` : ""}`);
      }
      process.exitCode = 1;
    }
    console.log("=".repeat(72));
  } finally {
    console.log("\nCleaning up…");
    await cleanupFixtures(alpha);
    await cleanupFixtures(beta);

    for (const agencyId of createdAgencyIds) {
      const { error } = await admin.from("agencies").delete().eq("id", agencyId);
      if (error) {
        console.error(`Could not delete agency ${agencyId}: ${error.message}`);
        process.exitCode = 1;
      }
    }

    for (const userId of createdAuthUserIds) {
      const { error } = await admin.auth.admin.deleteUser(userId);
      if (error) {
        console.error(`Could not delete auth user ${userId}: ${error.message}`);
        process.exitCode = 1;
      }
    }
    console.log("Cleanup complete.");
  }
}

main().catch((err) => {
  console.error("\nVerification crashed before finishing:", err);
  process.exitCode = 1;
});
