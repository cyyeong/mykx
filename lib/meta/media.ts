import { readFile } from "node:fs/promises";
import type { ImageInput } from "./types.ts";

/** MIME type from magic bytes (PNG, JPEG, WebP, GIF), or null. */
export function sniffImageMime(bytes: Uint8Array): string | null {
  const b = bytes;
  if (b.length >= 8 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return "image/png";
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "image/jpeg";
  if (
    b.length >= 12 &&
    b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 &&
    b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50
  ) {
    return "image/webp";
  }
  if (b.length >= 4 && b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x38) return "image/gif";
  return null;
}

export function bytesToDataUrl(bytes: Uint8Array): string {
  const mime = sniffImageMime(bytes);
  if (!mime) throw new Error("unsupported image bytes: expected PNG, JPEG, WebP or GIF");
  return `data:${mime};base64,${Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength).toString("base64")}`;
}

const isUrl = (s: string) => s.startsWith("data:") || s.startsWith("https://");

/** A value for `image_url`: data: and https: URLs pass through; paths and bytes become data URLs. */
export async function toImageUrl(input: ImageInput): Promise<string> {
  if (typeof input === "string") return isUrl(input) ? input : bytesToDataUrl(await readFile(input));
  return bytesToDataUrl(input);
}

/** Raw bytes for any ImageInput. */
export async function toImageBytes(input: ImageInput, signal?: AbortSignal): Promise<Buffer> {
  if (typeof input !== "string") return Buffer.from(input.buffer, input.byteOffset, input.byteLength);
  if (input.startsWith("data:")) {
    const comma = input.indexOf(",");
    if (comma < 0 || !input.slice(0, comma).endsWith(";base64")) throw new Error("only base64 data: URLs are supported");
    return Buffer.from(input.slice(comma + 1), "base64");
  }
  if (input.startsWith("https://")) {
    const res = await fetch(input, { signal });
    if (!res.ok) throw new Error(`image download failed: HTTP ${res.status}`);
    return Buffer.from(await res.arrayBuffer());
  }
  return readFile(input);
}
