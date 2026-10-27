"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { TARGET_RATE, downmix, encodeWav, resample, rms } from "@/lib/voice/wav";

const MAX_MS = 30_000;
const MIN_MS = 300; // shorter than this is an accidental tap

export type RecorderState = "idle" | "listening" | "denied" | "unsupported";

/**
 * Hold-to-talk recording. `start()` asks for the mic and records; `stop()` resolves with a
 * 16 kHz mono WAV (or null for an accidental tap). Nothing is kept after it resolves.
 */
export function useRecorder() {
  const [state, setState] = useState<RecorderState>("idle");
  const [level, setLevel] = useState(0);
  const live = useRef<{
    stream: MediaStream;
    ctx: AudioContext;
    recorder: MediaRecorder;
    chunks: Blob[];
    startedAt: number;
    raf: number;
    timer: ReturnType<typeof setTimeout>;
    done: Promise<Blob>;
  } | null>(null);

  const teardown = useCallback(() => {
    const l = live.current;
    if (!l) return;
    cancelAnimationFrame(l.raf);
    clearTimeout(l.timer);
    l.stream.getTracks().forEach((t) => t.stop());
    void l.ctx.close();
    live.current = null;
    setLevel(0);
  }, []);

  useEffect(() => teardown, [teardown]);

  const start = useCallback(async () => {
    if (live.current) return;
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      setState("unsupported");
      return;
    }
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true } });
    } catch {
      setState("denied");
      return;
    }
    const ctx = new AudioContext();
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 512;
    ctx.createMediaStreamSource(stream).connect(analyser);
    const frame = new Uint8Array(analyser.fftSize);
    const recorder = new MediaRecorder(stream);
    const chunks: Blob[] = [];
    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunks.push(e.data);
    };
    const done = new Promise<Blob>((resolve) => {
      recorder.onstop = () => resolve(new Blob(chunks, { type: recorder.mimeType }));
    });
    const tick = () => {
      analyser.getByteTimeDomainData(frame);
      setLevel(Math.min(1, rms(frame) * 4));
      if (live.current) live.current.raf = requestAnimationFrame(tick);
    };
    live.current = {
      stream,
      ctx,
      recorder,
      chunks,
      startedAt: performance.now(),
      raf: requestAnimationFrame(tick),
      timer: setTimeout(() => recorder.state === "recording" && recorder.stop(), MAX_MS),
      done,
    };
    recorder.start();
    setState("listening");
  }, []);

  /** Stops and returns the WAV, or null for a tap shorter than 0.3 s. */
  const stop = useCallback(async (): Promise<Uint8Array | null> => {
    const l = live.current;
    if (!l) return null;
    const heldMs = performance.now() - l.startedAt;
    if (l.recorder.state === "recording") l.recorder.stop();
    const blob = await l.done;
    const ctx = l.ctx;
    try {
      if (heldMs < MIN_MS || blob.size === 0) return null;
      const audio = await ctx.decodeAudioData(await blob.arrayBuffer());
      const channels = Array.from({ length: audio.numberOfChannels }, (_, i) => audio.getChannelData(i));
      return encodeWav(resample(downmix(channels), audio.sampleRate, TARGET_RATE));
    } finally {
      teardown();
      setState("idle");
    }
  }, [teardown]);

  /** Stops without returning anything (pointer cancelled, component left). */
  const cancel = useCallback(() => {
    const l = live.current;
    if (l?.recorder.state === "recording") l.recorder.stop();
    teardown();
    setState("idle");
  }, [teardown]);

  return { state, level, start, stop, cancel };
}
