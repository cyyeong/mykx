// Browser audio → the WAV Muse Voice Transcribe accepts: mono, 16-bit PCM, 16 kHz.
// Pure functions (no Web Audio), so they run in tests and in any browser.

export const TARGET_RATE = 16000;

/** Averages channels into one. */
export function downmix(channels: readonly Float32Array[]): Float32Array {
  if (channels.length === 1) return channels[0];
  const out = new Float32Array(channels[0].length);
  for (const ch of channels) for (let i = 0; i < out.length; i++) out[i] += ch[i] / channels.length;
  return out;
}

/** Linear-interpolation resample; good enough for speech going to a recogniser. */
export function resample(samples: Float32Array, fromRate: number, toRate = TARGET_RATE): Float32Array {
  if (fromRate === toRate) return samples;
  const ratio = fromRate / toRate;
  const out = new Float32Array(Math.floor(samples.length / ratio));
  for (let i = 0; i < out.length; i++) {
    const pos = i * ratio;
    const i0 = Math.floor(pos);
    const i1 = Math.min(i0 + 1, samples.length - 1);
    out[i] = samples[i0] + (samples[i1] - samples[i0]) * (pos - i0);
  }
  return out;
}

/** Mono float samples (−1…1) → a RIFF/WAVE file, 16-bit PCM. */
export function encodeWav(samples: Float32Array, sampleRate = TARGET_RATE): Uint8Array {
  const dataBytes = samples.length * 2;
  const buf = new ArrayBuffer(44 + dataBytes);
  const v = new DataView(buf);
  const ascii = (at: number, s: string) => {
    for (let i = 0; i < s.length; i++) v.setUint8(at + i, s.charCodeAt(i));
  };
  ascii(0, "RIFF");
  v.setUint32(4, 36 + dataBytes, true);
  ascii(8, "WAVE");
  ascii(12, "fmt ");
  v.setUint32(16, 16, true); // fmt chunk size
  v.setUint16(20, 1, true); // PCM
  v.setUint16(22, 1, true); // mono
  v.setUint32(24, sampleRate, true);
  v.setUint32(28, sampleRate * 2, true); // byte rate
  v.setUint16(32, 2, true); // block align
  v.setUint16(34, 16, true); // bits per sample
  ascii(36, "data");
  v.setUint32(40, dataBytes, true);
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    v.setInt16(44 + i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
  return new Uint8Array(buf);
}

/** Root-mean-square level, 0–1, for the mic ring. */
export function rms(frame: Float32Array | Uint8Array): number {
  if (frame.length === 0) return 0;
  let sum = 0;
  if (frame instanceof Uint8Array) {
    for (const v of frame) {
      const x = (v - 128) / 128;
      sum += x * x;
    }
  } else {
    for (const x of frame) sum += x * x;
  }
  return Math.sqrt(sum / frame.length);
}
