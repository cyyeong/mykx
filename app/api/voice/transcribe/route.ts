// Push-to-talk transcription. The browser sends a 16 kHz mono WAV (≤ 30 s); the key stays on
// the server. Audio is held in memory for this request only: never stored or logged (hard rule 9).
import { MetaApiError, MetaConfigError, checkWav, transcribe } from "@/lib/meta";
import { requireFamily } from "@/lib/auth/guard";
import { normalizeKix } from "@/lib/voice/normalize";
import { logRunsFor } from "@/lib/runs/log";

const MAX_BYTES = 1_200_000; // 30 s at 16 kHz × 16-bit is about 960 KB

// Only a signed-in family can spend Meta credit here (20 clips a minute per household), and never for a
// kid whose parent turned voice off.
export async function POST(request: Request) {
  const family = await requireFamily(request, "voice", 20);
  if (family.refused) return family.refused;
  if (family.kid && !family.kid.voiceEnabled) return Response.json({ error: "Voice is off. A grown-up can turn it on in Your family." }, { status: 403 });
  logRunsFor("voice", family.householdId, family.kid?.id ?? null);
  const type = request.headers.get("content-type") ?? "";
  if (!type.startsWith("audio/wav") && !type.startsWith("audio/x-wav")) {
    return Response.json({ error: "Send the clip as audio/wav." }, { status: 415 });
  }
  const length = Number(request.headers.get("content-length") ?? "0");
  if (length > MAX_BYTES) return Response.json({ error: "That clip is too long. Keep it under 30 seconds." }, { status: 413 });

  const wav = new Uint8Array(await request.arrayBuffer());
  if (wav.byteLength > MAX_BYTES) return Response.json({ error: "That clip is too long. Keep it under 30 seconds." }, { status: 413 });
  try {
    checkWav(wav);
  } catch (err) {
    return Response.json({ error: (err as Error).message }, { status: 400 });
  }

  try {
    const result = await transcribe({ wav }, { timeoutMs: 15_000 });
    // The call is logged to model_runs by lib/runs/log.ts (no transcript, no audio).
    return Response.json({ text: normalizeKix(result.text), durationMs: result.audioDurationMs });
  } catch (err) {
    if (err instanceof MetaConfigError) return Response.json({ error: "Voice isn't set up on this server." }, { status: 503 });
    const timeout = err instanceof MetaApiError && err.code === "timeout";
    return Response.json({ error: timeout ? "Kix didn't catch that in time. Try again or type it." : "Kix couldn't hear that. Try again or type it." }, { status: 502 });
  }
}
