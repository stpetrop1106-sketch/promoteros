import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Moved out of `experimental` in Next 15 — the old location logs a warning and is ignored.
  typedRoutes: true,
};

export default nextConfig;
