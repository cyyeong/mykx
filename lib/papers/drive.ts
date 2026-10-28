// sgexam's papers are files shared publicly on Google Drive. Bots may not fetch Drive's download links (its
// robots.txt disallows them), but Google's Drive API is the sanctioned way to read a publicly shared file:
// files.get with alt=media and an API key (GOOGLE_API_KEY, server-side or local only). Pure helpers here; the
// scout script makes the calls. testpapersfree's downloads sit behind reCAPTCHA, so they are never automated.

/** The Drive file id in an sgexam paper page (a `uc?export=download&id=…` or `/file/d/…` link), or null. */
export function driveFileId(html: string): string | null {
  const m = /drive\.google\.com\/(?:uc\?[^"']*?\bid=|file\/d\/|open\?id=)([\w-]{20,})/.exec(html.replace(/&#0?38;|&amp;/g, "&"));
  return m ? m[1] : null;
}

export const DRIVE_API = "https://www.googleapis.com/drive/v3/files";

/** Metadata first (name, size, type), so a non-PDF or an oversized file is never downloaded. */
export function driveMetaUrl(id: string, key: string): string {
  return `${DRIVE_API}/${encodeURIComponent(id)}?fields=name,size,mimeType&supportsAllDrives=true&key=${encodeURIComponent(key)}`;
}

export function driveMediaUrl(id: string, key: string): string {
  return `${DRIVE_API}/${encodeURIComponent(id)}?alt=media&supportsAllDrives=true&key=${encodeURIComponent(key)}`;
}

/** A page that asks a human to prove itself (CAPTCHA) or to sign in: never automated past. */
export function isHumanGate(html: string): boolean {
  return /recaptcha|g-recaptcha|hcaptcha|cf-turnstile|challenge-platform|type="password"/i.test(html);
}
