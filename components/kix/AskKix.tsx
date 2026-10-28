"use client";

// Ask Kix: homework help for the kid (lib/kix/homework.ts). Type the question, or take or upload a photo of it.
// The photo is shrunk to 1600 px and re-drawn (which drops its location and camera data) and checked for faces on
// this device first; a photo with a face, or one the check can't run on, is never sent (AGENTS.md rule 2).
// Kix guides first: a hint, then the steps, then the full answer once the child has tried.
import { useRef, useState } from "react";
import { photoHasFace } from "@/components/camera/mediapipe";
import { CareCard, type Care } from "@/components/guardian/CareCard";
import { Art } from "@/components/ui/Art";
import type { Explanation, Stage } from "@/lib/kix/homework";
import { ExplainBlocks } from "./ExplainBlocks";
import s from "./ask.module.css";

const MAX_SIDE = 1600;
type Phase = "idle" | "checking" | "thinking";

async function prepare(file: File): Promise<{ dataUrl: string; face: boolean | "unknown" }> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  let face: boolean | "unknown";
  try {
    face = await photoHasFace(canvas);
  } catch {
    face = "unknown";
  }
  return { dataUrl: canvas.toDataURL("image/jpeg", 0.85), face };
}

export function AskKix({ nickname }: { nickname: string }) {
  const [text, setText] = useState("");
  const [photo, setPhoto] = useState<string | null>(null);
  const [phase, setPhase] = useState<Phase>("idle");
  const [note, setNote] = useState<string | null>(null);
  const [answer, setAnswer] = useState<Explanation | null>(null);
  const [sample, setSample] = useState(false);
  const [care, setCare] = useState<Care | null>(null);
  const camera = useRef<HTMLInputElement>(null);
  const upload = useRef<HTMLInputElement>(null);

  const pick = async (file: File | undefined) => {
    if (!file) return;
    setNote(null);
    setPhase("checking");
    try {
      const { dataUrl, face } = await prepare(file);
      if (face === true) setNote("That photo has a face in it. Point the camera at the question only, then try again.");
      else if (face === "unknown") setNote("Kix couldn't check this photo for faces on this device, so it isn't sent. Type the question instead?");
      else setPhoto(dataUrl);
    } catch {
      setNote("Kix couldn't open that picture. Try another one, or type the question.");
    }
    setPhase("idle");
  };

  const ask = async (stage: Stage) => {
    setPhase("thinking");
    setNote(null);
    try {
      const res = await fetch("/api/kix/homework", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(
          stage === "hint"
            ? { stage, ...(text.trim() ? { text: text.trim() } : {}), ...(photo ? { image: photo } : {}) }
            : { stage, question: answer?.question, ...(answer?.figure ? { figure: answer.figure } : {}) },
        ),
      });
      const data = (await res.json()) as { ok: boolean; explanation?: Explanation | null; sample?: boolean; care?: Care | null };
      if (!data.ok) throw new Error("not-ok");
      setCare(data.care ?? null);
      if (data.explanation) {
        setAnswer(data.explanation);
        setSample(Boolean(data.sample));
        if (stage === "hint") setPhoto(null); // read once, then gone
      }
    } catch {
      setNote("Kix couldn't answer just now. Check the connection and try again.");
    }
    setPhase("idle");
  };

  const reset = () => {
    setAnswer(null);
    setText("");
    setPhoto(null);
    setCare(null);
    setNote(null);
  };

  return (
    <main className={s.page}>
      <section className={s.askPane} aria-labelledby="ask-title">
        <div className={s.head}>
          <Art base="/art/kix/expressions/thinking" alt="Kix" sizes="88px" className={s.kix} />
          <div>
            <h1 id="ask-title" className={s.title}>
              Ask Kix
            </h1>
            <p className={s.lede}>Stuck on homework, {nickname}? Show me the question and we&apos;ll work it out together.</p>
          </div>
        </div>

        {!answer ? (
          <form
            className={s.form}
            onSubmit={(e) => {
              e.preventDefault();
              if (text.trim() || photo) void ask("hint");
            }}
          >
            <label htmlFor="ask-text" className={s.label}>
              Type the question
            </label>
            <textarea id="ask-text" className={s.input} rows={4} maxLength={800} value={text} onChange={(e) => setText(e.target.value)} placeholder="e.g. Ali had 3 times as many stickers as Ben…" />
            <div className={s.photoRow}>
              <button type="button" className="mk-btn mk-btn--secondary" onClick={() => camera.current?.click()} disabled={phase !== "idle"}>
                Take a photo
              </button>
              <button type="button" className="mk-btn mk-btn--secondary" onClick={() => upload.current?.click()} disabled={phase !== "idle"}>
                Upload a picture
              </button>
              <input ref={camera} type="file" accept="image/*" capture="environment" hidden onChange={(e) => void pick(e.target.files?.[0])} />
              <input ref={upload} type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={(e) => void pick(e.target.files?.[0])} />
            </div>
            {photo && (
              <div className={s.preview}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={photo} alt="Your question" />
                <button type="button" className={s.remove} onClick={() => setPhoto(null)}>
                  Remove
                </button>
              </div>
            )}
            {phase === "checking" && <p className={s.status}>Checking the photo on this device…</p>}
            {note && <p className={s.warn}>{note}</p>}
            <button type="submit" className="mk-btn mk-btn--primary" disabled={phase !== "idle" || (!text.trim() && !photo)}>
              {phase === "thinking" ? "Kix is reading…" : "Ask Kix"}
            </button>
            <p className={s.small}>Photos are checked for faces on this device, read once by Kix, and never saved.</p>
          </form>
        ) : (
          <div className={s.read}>
            <span className={s.label}>Kix read</span>
            <p className={s.question}>{answer.question}</p>
            <div className={s.chips}>
              <span className={s.subject}>{answer.subject}</span>
              <span>{answer.topic}</span>
              <span>{answer.method}</span>
            </div>
            <button type="button" className="mk-btn mk-btn--secondary" onClick={reset}>
              Ask another question
            </button>
          </div>
        )}
        {care && <CareCard care={care} />}
      </section>

      <section className={s.answerPane} aria-label="Kix explains" aria-live="polite">
        {answer ? (
          <>
            {sample && <p className={s.sample}>Sample explanation: Kix is offline right now.</p>}
            <ExplainBlocks blocks={answer.blocks} finalAnswer={answer.finalAnswer} />
            {!answer.unclear && (
              <div className={s.next}>
                {answer.stage === "hint" && (
                  <button type="button" className="mk-btn mk-btn--primary" disabled={phase !== "idle"} onClick={() => void ask("steps")}>
                    {phase === "thinking" ? "Kix is thinking…" : "Show me the steps"}
                  </button>
                )}
                {answer.stage === "steps" && (
                  <button type="button" className="mk-btn mk-btn--primary" disabled={phase !== "idle"} onClick={() => void ask("full")}>
                    {phase === "thinking" ? "Kix is thinking…" : "I tried it: show the full answer"}
                  </button>
                )}
              </div>
            )}
          </>
        ) : (
          <div className={s.empty}>
            <p className={s.emptyTitle}>Kix helps you think it through</p>
            <ol>
              <li>A hint to start you off</li>
              <li>The steps, the way your school teaches it</li>
              <li>The full answer, after you&apos;ve had a go</li>
            </ol>
          </div>
        )}
      </section>
    </main>
  );
}
