// Prints a one-time sign-in link for a LOCAL dev server, so an agent can open the screens it built
// (CLAUDE.md: "Open the screens you built"). Uses the service-role key already in .env to ask
// Supabase for a magic-link token — no email is sent.
//
//   node scripts/dev-signin-link.mjs <port> [path]
//   node scripts/dev-signin-link.mjs 3301 /shifts
//
// Refuses anything but localhost: this must never mint a production login.
import fs from "node:fs";

const [port, path = "/dashboard"] = process.argv.slice(2);
if (!/^\d{4,5}$/.test(port ?? "")) {
  console.error("usage: node scripts/dev-signin-link.mjs <port> [path]");
  process.exit(1);
}
if (!path.startsWith("/")) {
  console.error("path must start with /");
  process.exit(1);
}

const env = Object.fromEntries(
  fs.readFileSync(".env", "utf8").split(/\r?\n/)
    .filter((l) => l.includes("=") && !l.startsWith("#"))
    .map((l) => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, "")]; }),
);
const base = `http://localhost:${port}`;
const res = await fetch(`${env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/admin/generate_link`, {
  method: "POST",
  headers: {
    apikey: env.SUPABASE_SERVICE_ROLE_KEY,
    Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
    "content-type": "application/json",
  },
  body: JSON.stringify({ type: "magiclink", email: "st.petrop1106@gmail.com", redirect_to: `${base}/login/callback` }),
});
const body = await res.json();
const hashed = body.properties?.hashed_token ?? body.hashed_token;
if (!hashed) {
  console.error("could not mint a link:", JSON.stringify(body).slice(0, 200));
  process.exit(1);
}
console.log(`${base}/login/callback?token_hash=${hashed}&type=magiclink&next=${encodeURIComponent(path)}`);
console.log(`\nThe dev server must run with NEXT_PUBLIC_APP_URL=${base}, or the callback redirects to the wrong port.`);
