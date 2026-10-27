// Muse Voice Transcribe, file endpoint (push-to-talk). Multipart, so it is a hand-built fetch
// rather than the OpenAI SDK. Audio is sent once and never stored or logged (hard rule 9).
import { META_BASE_URL, callSignal, pickRequestId, requireMetaKey } from "./client.ts";
import { MetaApiError, redactSecrets } from "./errors.ts";
import { assertStandardModel } from "./guard.ts";
import { type RunFields, startRun } from "./run.ts";
import type { CallOptions, RunInfo } from "./types.ts";

export const VOICE_MODEL = "muse-voice-transcribe-1.0";
/** Our own cap per clip (the API allows 10 minutes). */
export const MAX_CLIP_MS = 30_000;

export interface TranscribeRequest {
  /** RIFF/WAVE, mono, 16-bit PCM at 16 kHz or 24 kHz. */
  wav: Uint8Array;
  mode?: "PUSH_TO_TALK" | "ENDPOINTING";
  model?: string;
  sessionId?: string;
}

export interface TranscribeTurn {
  turnId: string | null;
  startMs: number | null;
  endMs: number | null;
  transcript: string;
}

export interface TranscribeResult {
  text: string;
  sessionId: string | null;
  audioDurationMs: number | null;
  turns: TranscribeTurn[];
  run: RunInfo;
}

type TranscribeJson = {
  sessionId?: string;
  transcript?: string;
  audioDurationMs?: number;
  turns?: { turnId?: string; startMs?: number; endMs?: number; transcript?: string }[];
};

/** Reads the WAV header; throws when the clip isn't mono 16-bit PCM at 16/24 kHz or is too long. */
export function checkWav(wav: Uint8Array, maxMs = MAX_CLIP_MS): { sampleRate: number; durationMs: number } {
  const view = new DataView(wav.buffer, wav.byteOffset, wav.byteLength);
  const tag = (at: number) => String.fromCharCode(...wav.subarray(at, at + 4));
  if (wav.byteLength < 44 || tag(0) !== "RIFF" || tag(8) !== "WAVE") throw new RangeError("not a RIFF/WAVE file");
  let at = 12;
  let fmt: { channels: number; sampleRate: number; bits: number; format: number } | null = null;
  while (at + 8 <= wav.byteLength) {
    const id = tag(at);
    const size = view.getUint32(at + 4, true);
    if (id === "fmt ") {
      fmt = {
        format: view.getUint16(at + 8, true),
        channels: view.getUint16(at + 10, true),
        sampleRate: view.getUint32(at + 12, true),
        bits: view.getUint16(at + 22, true),
      };
    } else if (id === "data") {
      if (!fmt) throw new RangeError("WAV data before its fmt chunk");
      if (fmt.format !== 1 || fmt.channels !== 1 || fmt.bits !== 16 || ![16000, 24000].includes(fmt.sampleRate)) {
        throw new RangeError(`WAV must be mono 16-bit PCM at 16 or 24 kHz (got ${fmt.channels} ch, ${fmt.bits}-bit, ${fmt.sampleRate} Hz)`);
      }
      const durationMs = Math.round((size / 2 / fmt.sampleRate) * 1000);
      if (durationMs > maxMs) throw new RangeError(`clip is ${durationMs} ms; the limit is ${maxMs} ms`);
      return { sampleRate: fmt.sampleRate, durationMs };
    }
    at += 8 + size + (size % 2);
  }
  throw new RangeError("WAV has no data chunk");
}

/** Speech to text. The transcript is child data: callers treat it like typed text. */
export async function transcribe(req: TranscribeRequest, options: CallOptions = {}): Promise<TranscribeResult> {
  const model = assertStandardModel(req.model ?? VOICE_MODEL);
  checkWav(req.wav);
  const { signal, timedOut } = callSignal(options);
  const clock = startRun("transcribe", model);
  const fields: RunFields = {};
  try {
    const form = new FormData();
    form.append("request", new Blob([JSON.stringify({ model, audioEncoding: "WAV", mode: req.mode ?? "PUSH_TO_TALK" })], { type: "application/json" }));
    form.append("audio", new Blob([new Uint8Array(req.wav)], { type: "audio/wav" }), "clip.wav");
    const url = new URL(`${process.env.META_API_BASE_URL?.trim() || META_BASE_URL}/asr/transcribe`);
    if (req.sessionId) url.searchParams.set("sessionId", req.sessionId);

    const res = await fetch(url, {
      method: "POST",
      headers: { Authorization: `Bearer ${requireMetaKey()}`, Accept: "application/json" },
      body: form,
      signal,
    });
    fields.requestId = pickRequestId(res.headers);
    if (!res.ok) {
      const detail = redactSecrets(await res.text().catch(() => "")).replace(/\s+/g, " ").slice(0, 200);
      throw new MetaApiError(`transcribe (${model}) failed: HTTP ${res.status} ${detail}`.trim(), {
        status: res.status,
        code: `http_${res.status}`,
        run: clock.fail(fields, `http_${res.status}`),
      });
    }
    const json = (await res.json()) as TranscribeJson;
    fields.responseId = json.sessionId ?? null;
    if (typeof json.audioDurationMs === "number") fields.audioSeconds = Math.floor(json.audioDurationMs / 1000);
    return {
      text: (json.transcript ?? "").trim(),
      sessionId: json.sessionId ?? null,
      audioDurationMs: json.audioDurationMs ?? null,
      turns: (json.turns ?? []).map((t) => ({
        turnId: t.turnId ?? null,
        startMs: t.startMs ?? null,
        endMs: t.endMs ?? null,
        transcript: (t.transcript ?? "").trim(),
      })),
      run: clock.finish(fields),
    };
  } catch (err) {
    throw clock.toError(err, fields, timedOut());
  }
}
