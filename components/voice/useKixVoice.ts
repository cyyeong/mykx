"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Band } from "@/components/theme/packs";

// Meta has no text-to-speech model, so Kix speaks with the device's own voice (design skill §6a).
const PREFERRED = [/Samantha/i, /Google UK English Female/i, /Google US English/i, /Karen/i, /Moira/i, /Tessa/i, /Microsoft (Aria|Jenny)/i];

function pickVoice(): SpeechSynthesisVoice | null {
  const voices = window.speechSynthesis.getVoices().filter((v) => v.lang.startsWith("en"));
  for (const re of PREFERRED) {
    const v = voices.find((x) => re.test(x.name));
    if (v) return v;
  }
  return voices.find((v) => v.lang === "en-SG") ?? voices.find((v) => v.lang === "en-GB") ?? voices[0] ?? null;
}

/** Read-aloud with captions: `speaking` and the index of the word being spoken. */
export function useKixVoice(band: Band) {
  const [speaking, setSpeaking] = useState(false);
  const [wordIndex, setWordIndex] = useState(-1);
  const supported = typeof window !== "undefined" && "speechSynthesis" in window;
  const current = useRef<SpeechSynthesisUtterance | null>(null);

  useEffect(() => () => {
    if (supported) window.speechSynthesis.cancel();
  }, [supported]);

  const speak = useCallback(
    (text: string) => {
      if (!supported) return;
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      const voice = pickVoice();
      if (voice) u.voice = voice;
      u.rate = band === "junior" ? 0.95 : 1;
      u.pitch = band === "junior" ? 1.2 : 1;
      const starts = [...text.matchAll(/\S+/g)].map((m) => m.index ?? 0);
      u.onboundary = (e) => {
        if (e.name !== "word") return;
        let i = starts.findIndex((s) => s > e.charIndex);
        i = i === -1 ? starts.length - 1 : i - 1;
        setWordIndex(Math.max(0, i));
      };
      u.onstart = () => setSpeaking(true);
      u.onend = u.onerror = () => {
        setSpeaking(false);
        setWordIndex(-1);
      };
      current.current = u;
      window.speechSynthesis.speak(u);
    },
    [band, supported],
  );

  const stop = useCallback(() => {
    if (supported) window.speechSynthesis.cancel();
  }, [supported]);

  return { speak, stop, speaking, wordIndex, supported };
}
