/**
 * Shrink a camera photo in the browser, before it is ever uploaded.
 *
 * Why this exists: a Server Action's request body is capped — Next's own default is 1 MB and the
 * hosting platform refuses anything over about 4.5 MB — while a photo straight from a phone camera
 * is routinely 3 to 8 MB. The owner hit exactly this on 2026-09-20: arrival and the camera both
 * worked, and "Αποθήκευση αναφοράς" answered with a server exception. Raising the limit alone would
 * only move the wall; a 12-megapixel shelf photo is also a slow upload on a supermarket's signal,
 * and nothing downstream needs that resolution.
 *
 * So the long edge is capped at 1600px and the result is re-encoded as JPEG. A shelf photo lands
 * around 200-400 KB, uploads in a second, and still reads clearly when the client opens the report.
 *
 * Pure browser code: canvas only, no dependency. If anything at all goes wrong — an unreadable
 * format, a browser without `createImageBitmap`, a blob that comes back bigger than the original —
 * the ORIGINAL file is returned unchanged. A failure here must never cost the promoter their photo;
 * the server still accepts what fits.
 */

export const MAX_EDGE_PX = 1600;
export const JPEG_QUALITY = 0.82;
/** Files at or under this are already small enough to send untouched. */
export const SHRINK_THRESHOLD_BYTES = 700 * 1024;

export async function shrinkPhoto(file: File): Promise<File> {
  if (!file.type.startsWith("image/") || file.size <= SHRINK_THRESHOLD_BYTES) return file;
  if (typeof createImageBitmap !== "function" || typeof document === "undefined") return file;

  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, MAX_EDGE_PX / Math.max(bitmap.width, bitmap.height));
    const width = Math.round(bitmap.width * scale);
    const height = Math.round(bitmap.height * scale);

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.drawImage(bitmap, 0, 0, width, height);
    bitmap.close?.();

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", JPEG_QUALITY),
    );
    if (!blob || blob.size >= file.size) return file;

    return new File([blob], renameToJpeg(file.name), {
      type: "image/jpeg",
      lastModified: file.lastModified,
    });
  } catch {
    return file;
  }
}

function renameToJpeg(name: string): string {
  const base = name.replace(/\.[^.]+$/, "");
  return `${base || "photo"}.jpg`;
}
