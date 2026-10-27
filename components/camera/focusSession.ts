// One run of the focus camera while a learning screen is open (docs/prd/PARENT_INSIGHTS.md §1, AGENTS.md rule 12).
// Opens the webcam into a hidden <video>, runs Face Landmarker on about 3 frames a second, and hands each frame
// straight to the per-minute counter (lib/signals/camera.ts). No frame is drawn, kept or sent. Finished minutes
// go to /api/signals/focus with the browser's own "possibly losing focus" reading; that's all that leaves.
// The camera closes while the tab is hidden and reopens when it's back; the run ends when the screen does.
import type { FaceLandmarker } from "@mediapipe/tasks-vision";
import { FocusCounter, readFace } from "@/lib/signals/camera";
import { DEFAULT_BASELINE, canNudge, detectFocusDip, type FocusBaseline, type FocusMinute, type FocusSignal } from "@/lib/signals/focus";
import { MAX_MINUTES_PER_POST, type FocusPostResult } from "@/lib/signals/schemas";
import { loadFaceLandmarker } from "./mediapipe";

const URL_FOCUS = "/api/signals/focus";
/** Frame spacing: about 3.5 a second, easing to 2 and then 1 on a device that takes long per frame. */
const INTERVALS = [280, 500, 1000] as const;
/** A face seen this recently means someone is there to read Kix's suggestion. */
const PRESENT_MS = 5000;
/** Session minutes kept in memory for the 3-minute check. */
const KEEP_MINUTES = 60;

export type Unavailable = "denied" | "no-camera" | "busy" | "unsupported" | "failed";
export type CameraState = { kind: "starting" } | { kind: "on" } | { kind: "unavailable"; reason: Unavailable } | { kind: "ended" };

/** What outlives one run while the kid stays signed in on this page: the usual, the last note and break. */
export interface FocusMemory {
  baseline: FocusBaseline | null;
  minutes: FocusMinute[];
  lastSignalTo: string | undefined;
  lastNudgeAt: number | null;
}

export interface FocusEvents {
  state(s: CameraState): void;
  /** Kix may suggest a break now. */
  nudge(): void;
  /** The server refused: the grown-up switched the camera off, or the kid's session ended. */
  refused(): void;
}

function unavailableReason(err: unknown): Unavailable {
  const name = err instanceof DOMException || err instanceof Error ? err.name : "";
  if (name === "NotAllowedError" || name === "SecurityError" || name === "PermissionDeniedError") return "denied";
  if (name === "NotFoundError" || name === "OverconstrainedError" || name === "DevicesNotFoundError") return "no-camera";
  if (name === "NotReadableError" || name === "TrackStartError" || name === "AbortError") return "busy";
  return "failed";
}

export class FocusSession {
  private landmarker: FaceLandmarker | null = null;
  private stream: MediaStream | null = null;
  private readonly counter = new FocusCounter();
  private queue: FocusMinute[] = [];
  private signal: FocusSignal | null = null;
  private sending = false;
  private stopped = false;
  private looping = false;
  private lastFrame = 0;
  private cost = 0;
  private interval: number = INTERVALS[0];
  private timer: ReturnType<typeof setTimeout> | null = null;
  private frameRequest: number | null = null;

  constructor(
    private readonly video: HTMLVideoElement,
    private readonly memory: FocusMemory,
    private readonly on: FocusEvents,
  ) {}

  async start(): Promise<void> {
    this.on.state({ kind: "starting" });
    if (!navigator.mediaDevices?.getUserMedia || typeof WebAssembly === "undefined") return this.fail("unsupported");
    try {
      this.landmarker = await loadFaceLandmarker();
    } catch {
      return this.fail("failed");
    }
    if (this.stopped) return;
    document.addEventListener("visibilitychange", this.onVisibility);
    window.addEventListener("pagehide", this.onPageHide);
    if (document.visibilityState === "visible") await this.openCamera();
  }

  /** Ends the run: keeps the partly watched minute, closes the camera. Safe to call twice. */
  stop(): void {
    if (this.stopped) return;
    this.stopped = true;
    document.removeEventListener("visibilitychange", this.onVisibility);
    window.removeEventListener("pagehide", this.onPageHide);
    this.closeCamera();
    this.take(this.counter.flush());
    void this.send(true);
  }

  private fail(reason: Unavailable) {
    if (this.stopped) return;
    this.stop();
    this.on.state({ kind: "unavailable", reason });
  }

  private async openCamera() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 }, frameRate: { ideal: 15, max: 30 } },
      });
      if (this.stopped || document.visibilityState !== "visible") {
        for (const t of stream.getTracks()) t.stop();
        return;
      }
      this.stream = stream;
      // Unplugged, switched off in the OS, or taken by another app: stop calmly, no retries.
      for (const t of stream.getVideoTracks()) t.addEventListener("ended", this.onTrackEnded);
      this.video.srcObject = stream;
      await this.video.play().catch(() => undefined);
      this.on.state({ kind: "on" });
      this.loop();
    } catch (err) {
      this.fail(unavailableReason(err));
    }
  }

  private closeCamera() {
    this.looping = false;
    if (this.timer !== null) clearTimeout(this.timer);
    if (this.frameRequest !== null && "cancelVideoFrameCallback" in this.video) this.video.cancelVideoFrameCallback(this.frameRequest);
    this.timer = this.frameRequest = null;
    if (this.stream) {
      for (const t of this.stream.getTracks()) {
        t.removeEventListener("ended", this.onTrackEnded);
        t.stop();
      }
    }
    this.stream = null;
    this.video.srcObject = null;
  }

  private readonly onTrackEnded = () => {
    if (this.stopped) return;
    this.stop();
    this.on.state({ kind: "ended" });
  };

  // The camera is off while the page is hidden (no frames are read then anyway), and back on when it returns.
  private readonly onVisibility = () => {
    if (this.stopped) return;
    if (document.visibilityState === "hidden") {
      this.closeCamera();
      this.on.state({ kind: "starting" });
    } else if (!this.stream) void this.openCamera();
  };

  private readonly onPageHide = () => {
    this.take(this.counter.flush());
    void this.send(true);
  };

  private loop() {
    if (this.looping) return;
    this.looping = true;
    this.schedule();
  }

  private schedule() {
    if (!this.looping || this.stopped) return;
    if ("requestVideoFrameCallback" in this.video) this.frameRequest = this.video.requestVideoFrameCallback(this.tick);
    else this.timer = setTimeout(this.tick, this.interval);
  }

  private readonly tick = () => {
    this.frameRequest = this.timer = null;
    if (!this.looping || this.stopped || !this.landmarker) return;
    const now = performance.now();
    if (now - this.lastFrame >= this.interval && this.video.readyState >= 2 && this.video.videoWidth > 0) {
      this.lastFrame = now;
      let reading = null;
      try {
        const t0 = performance.now();
        reading = readFace(this.landmarker.detectForVideo(this.video, now));
        this.pace(performance.now() - t0);
      } catch {
        reading = null; // a dropped frame reads as no face; the counter needs 20 s of frames to keep a minute
      }
      this.take(this.counter.push(reading, Date.now()));
    }
    this.schedule();
  };

  /** Slower devices get fewer frames, so learning stays smooth. */
  private pace(ms: number) {
    this.cost = this.cost ? this.cost * 0.8 + ms * 0.2 : ms;
    this.interval = this.cost > 150 ? INTERVALS[2] : this.cost > 70 ? INTERVALS[1] : INTERVALS[0];
  }

  /** Files finished minutes, checks for a dip against the kid's usual, and sends. */
  private take(done: FocusMinute[]) {
    if (!done.length) return;
    const m = this.memory;
    for (const minute of done) {
      m.minutes = [...m.minutes.filter((x) => x.minute !== minute.minute), minute].slice(-KEEP_MINUTES);
      this.queue = [...this.queue.filter((x) => x.minute !== minute.minute), minute].slice(-MAX_MINUTES_PER_POST);
    }
    const found = detectFocusDip(m.minutes, m.baseline ?? DEFAULT_BASELINE, { after: m.lastSignalTo });
    if (found) {
      m.lastSignalTo = found.to; // once per run of low minutes
      this.signal = found;
      const now = Date.now();
      const someoneThere = this.counter.lastFaceAt !== null && now - this.counter.lastFaceAt < PRESENT_MS;
      if (!this.stopped && someoneThere && canNudge(m.lastNudgeAt, now)) {
        m.lastNudgeAt = now;
        this.on.nudge();
      }
    }
    void this.send(false);
  }

  private async send(keepalive: boolean) {
    if (this.sending || !this.queue.length) return;
    this.sending = true;
    const minutes = this.queue.slice(0, MAX_MINUTES_PER_POST);
    const signal = this.signal;
    let again = false;
    try {
      const res = await fetch(URL_FOCUS, {
        method: "POST",
        cache: "no-store",
        keepalive,
        headers: { "content-type": "application/json" },
        body: JSON.stringify(signal ? { minutes, signal } : { minutes }),
      });
      if (res.ok || res.status === 400) {
        // Sent, or never acceptable (stale minutes): either way, don't send these again.
        this.queue = this.queue.filter((q) => !minutes.includes(q));
        if (this.signal === signal) this.signal = null;
        const json = res.ok ? ((await res.json().catch(() => null)) as (FocusPostResult & { ok: boolean }) | null) : null;
        if (json?.baseline) this.memory.baseline = json.baseline;
        again = this.queue.length > 0;
      } else if (res.status === 401 || res.status === 403) {
        this.queue = [];
        this.stop();
        this.on.refused();
      }
      // 429 or 5xx: keep them for the next minute.
    } catch {
      // Offline: keep them (up to MAX_MINUTES_PER_POST) for the next minute.
    } finally {
      this.sending = false;
    }
    // More arrived while this was in flight (or the run ended meanwhile): send it now.
    if (again) void this.send(keepalive || this.stopped);
  }
}
