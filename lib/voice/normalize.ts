// Muse Voice Transcribe hears "Kix" as "Kicks" (tested 27 Oct). Fix the name before a
// transcript is shown to the child or sent to Kix.
const KIX = /\b(kicks|kix|kiks|kick's|kicks's)\b/gi;

export function normalizeKix(text: string): string {
  return text
    .replace(KIX, "Kix")
    .replace(/\s+([?.!,])/g, "$1")
    .replace(/([?!])\.$/, "$1")
    .trim();
}
