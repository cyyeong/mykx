// The Home Link engine: on each camera's interval, grab a picture, decide whether the room changed, and upload what
// changed to myKx in one POST per round. Nothing leaves this computer until it is paired and at least one camera is
// saved with its privacy confirmation. Time, the camera grab and the network are injectable so a round can be tested
// without a clock or a camera.
import { hostname as osHostname } from "node:os";
import { MAX_CAMERAS, checkServer, hostOf, publicCamera, redact, saveConfig, validateCamera, type CameraConfig, type CameraField, type Config, type PublicCamera } from "./config.ts";
import { GrabError, grabPicture, type GrabDeps } from "./grab.ts";
import { BURST_GAP_MS, BURST_SIZE, HEARTBEAT_MS, decide, forUpload, forWall, thumbnail, type LastSent, type Reason } from "./motion.ts";
import { pair as pairWithMyKx, sendFrames, syncCameras, type Frame, type Net, type SendResult } from "./upload.ts";

/** An unreachable camera is tried again after this long, whatever its interval. */
export const RETRY_UNREACHABLE_MS = 60_000;
/** Outside the family's camera hours Home Link asks again this often. */
export const OFF_HOURS_RECHECK_MS = 5 * 60_000;
export const SLOW_DOWN_MS = 60_000;
export const SLOW_DOWN_MAX_MS = 10 * 60_000;
const NO_CHANGE_LOG_MS = 10 * 60_000;
const LOG_LINES = 100;
const GRABS_AT_ONCE = 4;
/** myKx takes up to 12 frames and 4 MB a request; stay under both. */
const BATCH_FRAMES = 12;
const BATCH_BYTES = 3_600_000;

export interface LogLine {
  /** ISO time. */
  at: string;
  text: string;
}

export type CameraStatus = "waiting" | "sent" | "no-change" | "unreachable" | "off";

export interface CameraState extends PublicCamera {
  status: CameraStatus;
  lastGrabAt: string | null;
  lastSentAt: string | null;
  lastReason: Reason | null;
  unreachableSince: string | null;
  error: string | null;
  thumbAt: string | null;
}

export interface Notice {
  kind: "off-hours" | "revoked" | "slow-down" | "offline";
  message: string;
}

export interface PublicState {
  paired: boolean;
  server: string;
  serverHost: string;
  deviceName: string | null;
  max: number;
  /** Pictures go out only when paired and at least one camera is on. */
  sending: boolean;
  notice: Notice | null;
  cameras: CameraState[];
  /** Newest first, at most 100. */
  log: LogLine[];
}

export interface LinkDeps {
  net?: Net;
  grab?: (address: string) => Promise<Uint8Array>;
  grabDeps?: GrabDeps;
  now?: () => number;
  sleep?: (ms: number) => Promise<void>;
  /** Called with each activity line as it is written (the terminal). */
  print?: (line: string) => void;
  computerName?: string;
  /** Start a round straight after pairing or a camera change (default true; tests turn it off). */
  eager?: boolean;
}

export type SaveResult = { ok: true; camera: PublicCamera } | { ok: false; field: CameraField; message: string };
export type TestResult = { ok: true; dataUrl: string; at: string } | { ok: false; message: string; kind: string };

export interface HomeLink {
  start(): void;
  stop(): void;
  /** One round: the cameras that are due, then one upload. Safe to call while another round runs (it returns at once). */
  tick(): Promise<void>;
  state(): PublicState;
  pair(code: string, server?: string): Promise<{ ok: true } | { ok: false; message: string }>;
  unpair(): void;
  saveCamera(input: unknown): Promise<SaveResult>;
  removeCamera(key: string): boolean;
  /** One picture now, not uploaded. `address` tests one that isn't saved yet. */
  testPicture(key: string | null, address?: string): Promise<TestResult>;
  thumb(key: string): Buffer | null;
  note(text: string): void;
}

interface Runtime {
  nextDueAt: number;
  last: LastSent | null;
  status: CameraStatus;
  lastGrabAt: number | null;
  lastSentAt: number | null;
  lastReason: Reason | null;
  unreachableSince: number | null;
  errorKind: string | null;
  error: string | null;
  thumb: Buffer | null;
  thumbAt: number | null;
  noChangeLoggedAt: number;
}

interface Observation {
  camera: CameraConfig;
  reason: Reason;
  frames: Frame[];
  lastThumb: Uint8Array;
  takenAt: number;
}

const sleepFor = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));
const clock = (ms: number) => new Date(ms).toTimeString().slice(0, 8);
const kb = (bytes: number) => `${Math.max(1, Math.round(bytes / 1024))} KB`;

async function mapLimit<T, R>(items: readonly T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out = new Array<R>(items.length);
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const i = next++;
      out[i] = await fn(items[i]);
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return out;
}

export function createHomeLink(dir: string, initial: Config, warnings: readonly string[] = [], deps: LinkDeps = {}): HomeLink {
  let config: Config = initial;
  const now = deps.now ?? Date.now;
  const sleep = deps.sleep ?? sleepFor;
  const grab = deps.grab ?? ((address: string) => grabPicture(address, deps.grabDeps));
  const computerName = (deps.computerName ?? osHostname()).replace(/\.local$/i, "").slice(0, 60) || "This computer";
  const runtime = new Map<string, Runtime>();
  const log: LogLine[] = [];
  let timer: ReturnType<typeof setInterval> | null = null;
  let inflight: Promise<void> | null = null;
  let needsSync = true;
  /** Counts camera changes, so a change made while a sync is in flight isn't marked as sent. */
  let version = 0;
  let everSynced = false;
  let holdUntil = 0;
  let holdKind: Notice["kind"] | null = null;
  let notice: Notice | null = null;
  let slowStreak = 0;
  let networkDown = false;

  // Anything that might repeat an address is scrubbed before it is written down.
  const scrub = (text: string) => config.cameras.reduce((t, c) => redact(t, c.url), text);
  const note = (text: string) => {
    const line = { at: new Date(now()).toISOString(), text: scrub(text) };
    log.unshift(line);
    log.length = Math.min(log.length, LOG_LINES);
    deps.print?.(`[${clock(now())}] ${line.text}`);
  };
  for (const w of warnings) note(w);

  const rt = (key: string): Runtime => {
    let r = runtime.get(key);
    if (!r) {
      r = { nextDueAt: 0, last: null, status: "waiting", lastGrabAt: null, lastSentAt: null, lastReason: null, unreachableSince: null, errorKind: null, error: null, thumb: null, thumbAt: null, noChangeLoggedAt: 0 };
      runtime.set(key, r);
    }
    return r;
  };
  const persist = () => saveConfig(config, dir);
  const dirty = () => {
    needsSync = true;
    version++;
  };
  const live = () => config.cameras.filter((c) => c.enabled && c.privacyConfirmed);
  const ready = () => Boolean(config.token) && live().length > 0;

  function hold(kind: Notice["kind"], ms: number, message: string) {
    holdUntil = now() + ms;
    holdKind = kind;
    notice = { kind, message };
  }
  function release() {
    holdUntil = 0;
    holdKind = null;
    slowStreak = 0;
    networkDown = false;
    if (notice && notice.kind !== "revoked") notice = null;
  }
  function revoked() {
    config = { ...config, token: null, deviceName: null };
    persist();
    holdUntil = 0;
    notice = { kind: "revoked", message: "This computer was removed in myKx; pair it again." };
    note("This computer was removed in myKx. Home Link has stopped sending; pair it again to start.");
  }

  async function ensureSynced(): Promise<boolean> {
    if (!needsSync) return true;
    if (!config.token) return false;
    // Nothing to tell myKx until a camera has been saved; after that, removing the last one is worth telling it.
    if (!everSynced && !live().length) return false;
    const asked = version;
    const r = await syncCameras(config.server, config.token, live().map((c) => ({ key: c.key, room: c.room, enabled: true })), deps.net);
    if (r.ok) {
      if (asked === version) needsSync = false;
      everSynced = true;
      return true;
    }
    if (r.kind === "revoked") revoked();
    else if (r.kind === "slow-down") hold("slow-down", Math.max((r.retryAfterSec ?? 60) * 1000, SLOW_DOWN_MS), "myKx asked Home Link to slow down. It will try again in a minute.");
    else if (r.kind === "network") offline(r.message);
    else {
      note(`myKx didn't take the camera list: ${r.message}`);
      hold("offline", RETRY_UNREACHABLE_MS, "myKx didn't take the camera list. Home Link will try again in a minute.");
    }
    return false;
  }

  function offline(why: string) {
    if (!networkDown) note(`${why} Home Link will keep trying every minute.`);
    networkDown = true;
    hold("offline", RETRY_UNREACHABLE_MS, `${why} Home Link will keep trying every minute.`);
  }

  function lost(camera: CameraConfig, r: Runtime, t: number, e: unknown) {
    const err = e instanceof GrabError ? e : new GrabError("unreachable", "Can't reach the camera.");
    r.nextDueAt = t + RETRY_UNREACHABLE_MS;
    const changed = r.status !== "unreachable" || r.errorKind !== err.kind;
    if (r.status !== "unreachable") r.unreachableSince = t;
    r.status = "unreachable";
    r.errorKind = err.kind;
    r.error = err.message;
    if (changed) {
      const what = err.kind === "unreachable" || err.kind === "timeout" ? "can't reach the camera." : err.message;
      note(`${camera.room}: ${what} Retrying every minute; your family sees “offline”.`);
    }
  }

  async function observe(camera: CameraConfig, t: number): Promise<Observation | null> {
    const r = rt(camera.key);
    r.nextDueAt = t + camera.intervalSec * 1000;
    let bytes: Uint8Array;
    let thumb: Uint8Array;
    try {
      bytes = await grab(camera.url);
      thumb = await thumbnail(bytes);
      r.thumb = await forWall(bytes);
    } catch (e) {
      lost(camera, r, t, e instanceof GrabError ? e : new GrabError("not-image", "The camera's picture couldn't be read."));
      return null;
    }
    r.thumbAt = r.lastGrabAt = t;
    if (r.status === "unreachable") {
      note(`${camera.room}: the camera is back.`);
      r.unreachableSince = null;
    }
    r.errorKind = r.error = null;
    const d = decide(thumb, r.last, t);
    if (!d.send) {
      r.status = "no-change";
      if (t - r.noChangeLoggedAt >= NO_CHANGE_LOG_MS) {
        r.noChangeLoggedAt = t;
        note(`${camera.room}: no change → nothing sent.`);
      }
      return null;
    }
    const frames: Frame[] = [{ camera: camera.key, at: new Date(now()).toISOString(), burst: 0, bytes: await forUpload(bytes) }];
    let lastThumb = thumb;
    if (d.burst) {
      for (let i = 1; i < BURST_SIZE; i++) {
        await sleep(BURST_GAP_MS);
        try {
          const more = await grab(camera.url);
          frames.push({ camera: camera.key, at: new Date(now()).toISOString(), burst: i, bytes: await forUpload(more) });
          lastThumb = await thumbnail(more);
        } catch {
          break;
        }
      }
    }
    return { camera, reason: d.reason, frames, lastThumb, takenAt: t };
  }

  function batches(all: Observation[]): Observation[][] {
    const out: Observation[][] = [];
    let cur: Observation[] = [];
    let frames = 0;
    let bytes = 0;
    for (const o of all) {
      const size = o.frames.reduce((n, f) => n + f.bytes.length, 0);
      if (cur.length && (frames + o.frames.length > BATCH_FRAMES || bytes + size > BATCH_BYTES)) {
        out.push(cur);
        cur = [];
        frames = bytes = 0;
      }
      cur.push(o);
      frames += o.frames.length;
      bytes += size;
    }
    if (cur.length) out.push(cur);
    return out;
  }

  function accepted(batch: Observation[], result: Extract<SendResult, { kind: "accepted" }>) {
    release();
    for (const o of batch) {
      const r = rt(o.camera.key);
      r.last = { thumb: o.lastThumb, at: o.takenAt };
      r.lastSentAt = now();
      r.lastReason = o.reason;
      r.status = "sent";
      const size = o.frames[0].bytes.length;
      const sent =
        o.reason === "first"
          ? `${o.camera.room}: sent the first picture.`
          : o.reason === "heartbeat"
            ? `${o.camera.room}: nothing new for ${Math.round(HEARTBEAT_MS / 60_000)} minutes → sent 1 picture so myKx knows it’s still there.`
            : o.frames.length > 1
              ? `${o.camera.room} changed a lot → sent a burst of ${o.frames.length} pictures (${kb(size)} each).`
              : `${o.camera.room} changed → sent 1 picture (${kb(size)}).`;
      const s = result.statuses.find((x) => x.camera === o.camera.key);
      const read = s ? ` myKx: “${s.activity}”${s.concern !== "none" ? ` (${s.concern})` : ""}.` : "";
      const flag = result.alerts.find((a) => a.camera === o.camera.key);
      note(`${sent}${read}${flag ? ` myKx raised a ${flag.level} flag for you to check.` : ""}`);
    }
  }

  async function sendBatch(batch: Observation[]): Promise<boolean> {
    if (!config.token) return false;
    const result = await sendFrames(config.server, config.token, batch.flatMap((o) => o.frames), deps.net);
    switch (result.kind) {
      case "accepted":
        accepted(batch, result);
        return true;
      case "off":
        if (holdKind !== "off-hours") note("Cameras are off right now (your family’s hours). Home Link will check again every 5 minutes.");
        hold("off-hours", OFF_HOURS_RECHECK_MS, "Cameras are off right now (your family’s hours). Home Link checks again every 5 minutes.");
        return false;
      case "revoked":
        revoked();
        return false;
      case "slow-down": {
        slowStreak++;
        const wait = Math.min(Math.max((result.retryAfterSec ?? 0) * 1000, SLOW_DOWN_MS * 2 ** (slowStreak - 1)), SLOW_DOWN_MAX_MS);
        if (holdKind !== "slow-down") note(`myKx asked Home Link to slow down. Waiting ${Math.round(wait / 1000)} seconds.`);
        hold("slow-down", wait, `myKx asked Home Link to slow down. Waiting ${Math.round(wait / 1000)} seconds.`);
        return false;
      }
      case "network":
        offline(result.message);
        return false;
      case "skipped":
        note(`myKx didn’t take this round’s pictures (${result.status}${result.reason ? `, ${result.reason}` : ""}). Skipping it.`);
        // A 400 can mean myKx doesn't know a camera yet: send the camera list again next round.
        if (result.status === 400) dirty();
        return true;
    }
  }

  async function round(): Promise<void> {
    try {
      const t = now();
      if (t < holdUntil || !config.token) return;
      for (let tries = 0; needsSync && tries < 3; tries++) if (!(await ensureSynced())) return;
      if (needsSync || !ready()) return;
      const due = live().filter((c) => rt(c.key).nextDueAt <= t);
      if (!due.length) return;
      const seen = await mapLimit(due, GRABS_AT_ONCE, (c) =>
        observe(c, t).catch((e) => {
          note(`${c.room}: something went wrong reading the picture (${e instanceof Error ? e.name : "error"}).`);
          return null;
        }),
      );
      for (const batch of batches(seen.filter((o): o is Observation => o !== null))) if (!(await sendBatch(batch))) break;
    } catch (e) {
      note(`Something went wrong in Home Link (${e instanceof Error ? e.name : "error"}). It will try again.`);
    }
  }

  /** One round at a time: asking while one is running joins it. */
  function tick(): Promise<void> {
    inflight ??= round().finally(() => {
      inflight = null;
    });
    return inflight;
  }
  const soon = () => {
    if (deps.eager !== false) void tick();
  };

  return {
    start() {
      if (timer) return;
      timer = setInterval(() => void tick(), 1000);
      void tick();
    },
    stop() {
      if (timer) clearInterval(timer);
      timer = null;
    },
    tick,
    note,
    state() {
      const t = now();
      const iso = (ms: number | null) => (ms === null ? null : new Date(ms).toISOString());
      return {
        paired: Boolean(config.token),
        server: config.server,
        serverHost: hostOf(config.server),
        deviceName: config.deviceName,
        max: MAX_CAMERAS,
        sending: ready(),
        notice: notice && (notice.kind === "revoked" || notice.kind === "off-hours" || t < holdUntil) ? notice : null,
        cameras: config.cameras.map((c) => {
          const r = rt(c.key);
          return { ...publicCamera(c), status: c.enabled ? r.status : "off", lastGrabAt: iso(r.lastGrabAt), lastSentAt: iso(r.lastSentAt), lastReason: r.lastReason, unreachableSince: iso(r.unreachableSince), error: r.error, thumbAt: iso(r.thumbAt) };
        }),
        log: log.slice(),
      };
    },
    async pair(code, serverInput) {
      const checked = checkServer(serverInput?.trim() ? serverInput : config.server);
      if (!checked.ok) return { ok: false, message: checked.message };
      const r = await pairWithMyKx(checked.server, code, computerName, deps.net);
      if (!r.ok) return { ok: false, message: r.message };
      config = { ...config, server: checked.server, token: r.token, deviceName: r.device.name };
      persist();
      dirty();
      release();
      notice = null;
      for (const c of config.cameras) rt(c.key).nextDueAt = 0;
      note(`Paired with your family as “${r.device.name}”.`);
      soon();
      return { ok: true };
    },
    unpair() {
      config = { ...config, token: null, deviceName: null };
      persist();
      release();
      notice = null;
      dirty();
      note("Pairing removed from this computer. Nothing is sent until you pair it again.");
    },
    async saveCamera(input) {
      const checked = validateCamera(input, config.cameras);
      if (!checked.ok) return checked;
      const before = config.cameras.find((c) => c.key === checked.camera.key);
      config = { ...config, cameras: before ? config.cameras.map((c) => (c.key === before.key ? checked.camera : c)) : [...config.cameras, checked.camera] };
      persist();
      const r = rt(checked.camera.key);
      // A new address or room starts fresh: its first picture always goes.
      if (!before || before.url !== checked.camera.url) {
        r.last = null;
        r.status = "waiting";
        r.errorKind = r.error = null;
        r.unreachableSince = null;
      }
      r.nextDueAt = 0;
      dirty();
      note(before ? `${checked.camera.room}: settings saved.` : `${checked.camera.room}: camera added.`);
      soon();
      return { ok: true, camera: publicCamera(checked.camera) };
    },
    removeCamera(key) {
      const cam = config.cameras.find((c) => c.key === key);
      if (!cam) return false;
      config = { ...config, cameras: config.cameras.filter((c) => c.key !== key) };
      persist();
      runtime.delete(key);
      dirty();
      note(`${cam.room}: camera removed.`);
      soon();
      return true;
    },
    async testPicture(key, address) {
      const cam = key ? config.cameras.find((c) => c.key === key) : undefined;
      const url = address?.trim() ? address.trim() : cam?.url;
      if (!url) return { ok: false, kind: "invalid", message: "Paste the camera's address first." };
      if (address?.trim() && !/^(https?|rtsps?):\/\//i.test(url)) return { ok: false, kind: "invalid", message: "Use a snapshot address (http:// or https://) or an RTSP address (rtsp://)." };
      try {
        const bytes = await grab(url);
        if (cam && !address?.trim()) {
          const r = rt(cam.key);
          r.thumb = await forWall(bytes);
          r.thumbAt = now();
        }
        const jpeg = await forWall(bytes, 640);
        return { ok: true, dataUrl: `data:image/jpeg;base64,${jpeg.toString("base64")}`, at: new Date(now()).toISOString() };
      } catch (e) {
        if (e instanceof GrabError) return { ok: false, kind: e.kind, message: redact(e.message, url) };
        return { ok: false, kind: "not-image", message: "That address answered, but Home Link couldn't read a picture from it." };
      }
    },
    thumb(key) {
      return runtime.get(key)?.thumb ?? null;
    },
  };
}
