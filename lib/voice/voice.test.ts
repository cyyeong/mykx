import { describe, expect, it } from "vitest";
import { checkWav } from "@/lib/meta/voice";
import { normalizeKix } from "./normalize";
import { downmix, encodeWav, resample, rms } from "./wav";

describe("wav encoding", () => {
  it("writes a WAV that the transcribe check accepts", () => {
    const tone = new Float32Array(16000).map((_, i) => Math.sin((2 * Math.PI * 440 * i) / 16000) * 0.5);
    const wav = encodeWav(tone);
    expect(checkWav(wav)).toEqual({ sampleRate: 16000, durationMs: 1000 });
  });

  it("resamples 48 kHz to 16 kHz and downmixes stereo", () => {
    const left = new Float32Array(48000).fill(0.5);
    const right = new Float32Array(48000).fill(-0.5);
    const mono = downmix([left, right]);
    expect(mono[100]).toBeCloseTo(0);
    expect(resample(new Float32Array(48000), 48000).length).toBe(16000);
  });

  it("clips out-of-range samples instead of wrapping", () => {
    const wav = encodeWav(Float32Array.from([2, -2]));
    const v = new DataView(wav.buffer);
    expect(v.getInt16(44, true)).toBe(0x7fff);
    expect(v.getInt16(46, true)).toBe(-0x8000);
  });

  it("measures level for the mic ring", () => {
    expect(rms(new Float32Array(10))).toBe(0);
    expect(rms(new Float32Array(10).fill(0.5))).toBeCloseTo(0.5);
    expect(rms(new Uint8Array(10).fill(128))).toBe(0);
  });
});

describe("normalizeKix", () => {
  it("fixes how the recogniser spells Kix", () => {
    expect(normalizeKix("Kicks, why does the tadpole lose its tail?.")).toBe("Kix, why does the tadpole lose its tail?");
    expect(normalizeKix("thanks kicks")).toBe("thanks Kix");
    expect(normalizeKix("I kicked the ball")).toBe("I kicked the ball");
  });
});
