import { describe, expect, it } from "vitest";
import { estimateCostUsd } from "./pricing.ts";
import { checkWav } from "./voice.ts";

/** A silent mono 16-bit PCM WAV of `ms` milliseconds. */
function wav(ms: number, sampleRate = 16000, channels = 1, bits = 16): Uint8Array {
  const samples = Math.round((sampleRate * ms) / 1000);
  const dataBytes = samples * channels * (bits / 8);
  const buf = new ArrayBuffer(44 + dataBytes);
  const v = new DataView(buf);
  const put = (at: number, s: string) => [...s].forEach((c, i) => v.setUint8(at + i, c.charCodeAt(0)));
  put(0, "RIFF"); v.setUint32(4, 36 + dataBytes, true); put(8, "WAVE");
  put(12, "fmt "); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, channels, true);
  v.setUint32(24, sampleRate, true); v.setUint32(28, sampleRate * channels * (bits / 8), true);
  v.setUint16(32, channels * (bits / 8), true); v.setUint16(34, bits, true);
  put(36, "data"); v.setUint32(40, dataBytes, true);
  return new Uint8Array(buf);
}

describe("checkWav", () => {
  it("accepts mono 16-bit PCM at 16 or 24 kHz and reports its length", () => {
    expect(checkWav(wav(2000))).toEqual({ sampleRate: 16000, durationMs: 2000 });
    expect(checkWav(wav(500, 24000)).sampleRate).toBe(24000);
  });

  it("rejects stereo, 8-bit, 44.1 kHz and over-long clips", () => {
    expect(() => checkWav(wav(1000, 16000, 2))).toThrow(/mono 16-bit/);
    expect(() => checkWav(wav(1000, 16000, 1, 8))).toThrow(/mono 16-bit/);
    expect(() => checkWav(wav(1000, 44100))).toThrow(/16 or 24 kHz/);
    expect(() => checkWav(wav(31000))).toThrow(/limit is 30000 ms/);
  });

  it("rejects something that isn't a WAV", () => {
    expect(() => checkWav(new Uint8Array(100))).toThrow(/RIFF/);
  });
});

describe("voice pricing", () => {
  it("bills $0.18 an hour on whole seconds", () => {
    expect(estimateCostUsd("muse-voice-transcribe-1.0", { audioSeconds: 3600 })).toBe(0.18);
    expect(estimateCostUsd("muse-voice-transcribe-1.0", { audioSeconds: 4 })).toBe(0.0002);
    expect(estimateCostUsd("muse-voice-transcribe-1.0", {})).toBeNull();
  });
});
