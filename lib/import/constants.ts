/**
 * P37b — shared limits. No imports, so every consumer (browser and server) can read these without
 * pulling in anything heavier.
 */

export const MAX_IMPORT_ROWS = 2000;
export const MAX_IMPORT_BYTES = 5 * 1024 * 1024;
