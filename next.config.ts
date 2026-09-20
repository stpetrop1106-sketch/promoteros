import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Moved out of `experimental` in Next 15 — the old location logs a warning and is ignored.
  typedRoutes: true,
  // Several agents build and run dev servers in this one directory at the same time. Two processes
  // writing one `.next` corrupt each other's output, so each agent sets NEXT_DIST_DIR to its own
  // folder (`.next-P37a`, …). Unset — Vercel, and anyone working alone — it is the usual `.next`.
  distDir: process.env.NEXT_DIST_DIR || ".next",
  experimental: {
    serverActions: {
      // A Server Action body defaults to 1 MB, which a single phone photo exceeds. Photos are
      // shrunk in the browser first (app/c/[token]/report/shrink-photo.ts); this is the backstop
      // for the ones that arrive big anyway, and sits under the hosting platform's own ~4.5 MB cap.
      bodySizeLimit: "4mb",
    },
  },
};

export default nextConfig;
