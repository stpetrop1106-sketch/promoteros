import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Moved out of `experimental` in Next 15 — the old location logs a warning and is ignored.
  typedRoutes: true,
  // Several agents build and run dev servers in this one directory at the same time. Two processes
  // writing one `.next` corrupt each other's output, so each agent sets NEXT_DIST_DIR to its own
  // folder (`.next-P37a`, …). Unset — Vercel, and anyone working alone — it is the usual `.next`.
  distDir: process.env.NEXT_DIST_DIR || ".next",
};

export default nextConfig;
