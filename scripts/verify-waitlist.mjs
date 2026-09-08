import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!url || !serviceRoleKey || !anonKey) {
  throw new Error("Set the Supabase URL, anon key and service-role key in .env before verifying.");
}

const admin = createClient(url, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const anonymous = createClient(url, anonKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const email = `waitlist-check-${randomUUID()}@example.test`;
let signupId;

try {
  const { data: inserted, error: insertError } = await admin
    .from("waitlist_signups")
    .insert({
      full_name: "Waitlist Verification",
      work_email: email,
      company_name: "PromoterOS Verification",
      job_title: "Test",
      promoter_count: "31-100",
      primary_challenge: "Synthetic verification record",
      utm_source: "verification",
    })
    .select("id, email_normalized")
    .single();

  if (insertError) throw insertError;
  if (inserted.email_normalized !== email) {
    throw new Error("The stored waitlist email did not match the submitted email.");
  }
  signupId = inserted.id;

  const { error: duplicateError } = await admin.from("waitlist_signups").insert({
    full_name: "Waitlist Verification",
    work_email: email.toUpperCase(),
    company_name: "PromoterOS Verification",
    promoter_count: "31-100",
  });

  if (duplicateError?.code !== "23505") {
    throw new Error("Duplicate emails are not being rejected case-insensitively.");
  }

  const { data: publicRows, error: publicReadError } = await anonymous
    .from("waitlist_signups")
    .select("id")
    .eq("id", signupId);

  if (publicReadError) throw publicReadError;
  if (publicRows.length !== 0) {
    throw new Error("Anonymous users can read waitlist registrations.");
  }

  console.log("Waitlist verification passed: insert, duplicate protection and public-read isolation work.");
} finally {
  if (signupId) {
    const { error } = await admin.from("waitlist_signups").delete().eq("id", signupId);
    if (error) {
      console.error("Could not remove the synthetic verification record", { code: error.code });
      process.exitCode = 1;
    }
  }
}
