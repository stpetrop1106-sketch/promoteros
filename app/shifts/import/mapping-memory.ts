import type { ColumnMapping } from "@/lib/import/types";

/**
 * The column mapping a coordinator confirmed, remembered in this browser by the file's header
 * signature (`headerSignature` in ./plan), so the same client's next file maps itself.
 *
 * Browser storage only, and only a mapping — column index → meaning. No cell value, name or store
 * ever goes in here. Every access is guarded: storage can be missing or throw (private windows,
 * blocked site data), and the import must work the same without it.
 */

const PREFIX = "promoteros.import.mapping.v1:";

export function recallMapping(signature: string): unknown {
  try {
    const raw = window.localStorage.getItem(PREFIX + signature);
    return raw ? (JSON.parse(raw) as unknown) : null;
  } catch {
    return null;
  }
}

export function rememberMapping(signature: string, mapping: ColumnMapping): void {
  try {
    window.localStorage.setItem(PREFIX + signature, JSON.stringify(mapping));
  } catch {
    // Not remembering is fine; the next file is simply detected again.
  }
}

export function forgetMapping(signature: string): void {
  try {
    window.localStorage.removeItem(PREFIX + signature);
  } catch {
    // Nothing to do.
  }
}
