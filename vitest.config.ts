import { fileURLToPath } from "node:url";
import path from "node:path";
import { defineConfig } from "vitest/config";

const projectRoot = path.dirname(fileURLToPath(import.meta.url));

/**
 * P15 — test harness. Node environment only: nothing here touches a browser DOM.
 * No network, no database — the matching engine's SQL path (`matchPromoters`) is out of
 * scope for unit tests; only the pure `topReasons` function is exercised. See tests/README.md.
 */
export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    globals: false,
  },
  resolve: {
    alias: {
      "@": projectRoot,
    },
  },
});
