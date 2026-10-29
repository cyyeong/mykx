// The Home simulator page: the passcode gate, the scripted afternoon, the two simulators (a kid's phone and the home's
// CCTV cameras) and myKx's answers. All sends go through this project's own server (/api/send), which holds the device
// token; the page never sees it. Every send shows on its button: pressed, sending, then sent, sent with a warning, or failed.
import { BEATS, CAMERAS, ROLES, SPOTS, clockOf } from "./script.js";

const $ = (id) => document.getElementById(id);
const store = { get: (k) => { try { return localStorage.getItem(k); } catch { return null; } }, set: (k, v) => { try { localStorage.setItem(k, v); } catch { /* private mode */ } } };
let pass = store.get("sim-pass") ?? "";
let mykx = "";
let names = { ...ROLES };
const state = {
  playing: false, speed: 10, min: 0, done: new Set(), skip: new Set(), role: "A", spot: "Walking home",
  // One entry per camera: the scene it shows and whether it's included in the next send.
  cams: new Map(CAMERAS.map((c) => [c.room, { scene: c.room === "Living room" ? "living-argument" : c.scenes[c.scenes.length - 1][0], on: c.room === "Living room" }])),
};
const kidNames = (text) => text.replace(/\b(Jordan|Abby|Leonard)\b/g, (n) => names[Object.keys(ROLES).find((k) => ROLES[k] === n)] ?? n);

async function api(method, body) {
  const res = await fetch("/api/send", { method, headers: { "content-type": "application/json", "x-sim-passcode": pass }, body: body ? JSON.stringify(body) : undefined });
  const json = await res.json().catch(() => ({ ok: false, reason: "not-json" }));
  if (res.status === 401) { $("gate").hidden = false; $("gatemsg").textContent = pass ? "That passcode didn’t work." : ""; }
  return json;
}

async function connect() {
  const r = await api("GET");
  if (r.mykx) mykx = r.mykx;
  if (r.ok) {
    names = { A: r.kids.A ?? "A", B: r.kids.B ?? "B", C: r.kids.C ?? "C" };
    $("conn").innerHTML = `Sending to <b>${new URL(mykx).host}</b> as Home simulator · ${Object.values(names).join(", ")}`;
  } else $("conn").textContent = r.reason === "not-paired" ? "Not paired: set SIM_HOME_LINK_TOKEN on this project" : `Not connected (${r.note ?? r.reason})`;
  render();
}

/** One line per result in the log, and a summary for the button: ok, warn (sent but nothing read) or fail. */
function logResult(label, r, ms) {
  const li = (what, status, took, text, ok) => {
    const el = document.createElement("li");
    el.className = "new";
    el.innerHTML = `<span class="meta"><span>${new Date().toLocaleTimeString("en-SG", { hour12: false })} · ${what}</span><span class="${ok ? "ok" : "bad"}">${status}${took ? ` · ${(took / 1000).toFixed(1)} s` : ""}</span></span><span></span>`;
    el.lastElementChild.textContent = text;
    $("log").prepend(el);
  };
  if (!r.ok) {
    const why = r.reason === "passcode" ? "the passcode was refused" : r.reason === "not-paired" ? "the simulator isn't paired with myKx" : (r.note ?? r.reason ?? "no answer");
    li(label, r.reason ?? "error", 0, r.note ?? "The simulator couldn’t send that.", false);
    return { state: "fail", text: `Failed: ${why}` };
  }
  let summary = { state: "ok", text: "" };
  for (const x of r.results) {
    const b = x.body;
    let text = b.reason ? `myKx: ${b.reason}${b.note ? ` (${b.note})` : ""}` : "";
    const good = x.status < 300;
    if (x.what.startsWith("location")) {
      text ||= b.pausedUntil ? `Paused sharing until ${new Date(b.pausedUntil).toLocaleTimeString("en-SG")}` : `${b.stored} point(s) stored · ${b.motion ?? "?"}${b.events?.length ? ` · ${b.events.map((e) => `${e.kind} ${e.place}`).join(", ")}` : ""}`;
      if (good) summary = { state: b.pausedUntil ? "warn" : summary.state, text: b.pausedUntil ? "Sent, but this kid has paused sharing" : `Sent · myKx stored it in ${(x.ms / 1000).toFixed(1)} s${b.motion ? ` (${b.motion})` : ""}` };
    } else if (b.camerasOn === false) {
      text ||= "Cameras are off right now (the family’s camera hours or a pause). Change them in Location and home cameras.";
      if (good) summary = { state: "warn", text: "Sent, but the family's cameras are off right now" };
    } else {
      const alerts = b.alerts ?? [];
      text ||= [...(b.statuses ?? []).map((s) => `${s.camera}: ${s.activity}${s.cue ? `, ${s.cue}` : ""}${s.concern !== "none" ? ` (${s.concern})` : ""}${s.source === "cached" ? " [cached]" : ""}`), ...alerts.map((a) => `ALERT ${a.level}: ${a.kind} in ${a.camera}`)].join(" · ") || "Read nothing";
      if (good) summary = { state: "ok", text: `Sent · Muse read ${b.statuses?.length ?? 0} camera${b.statuses?.length === 1 ? "" : "s"} in ${(x.ms / 1000).toFixed(1)} s${alerts.length ? ` · ${alerts.length} alert${alerts.length > 1 ? "s" : ""}` : ""}` };
    }
    if (!good) summary = { state: "fail", text: `Failed: myKx answered ${x.status}${b.reason ? ` (${b.reason})` : ""}` };
    li(x.what, x.status, x.ms, text, good);
  }
  if (!summary.text) summary.text = `Sent in ${(ms / 1000).toFixed(1)} s`;
  return summary;
}

const busy = new Set();
/** Sends, showing it on the button (if any) and the simulator's status line, then settles back after a few seconds. */
async function send(payload, label, btnId, statusId) {
  const btn = btnId ? $(btnId) : null;
  const status = $(statusId);
  if (btn) {
    if (busy.has(btnId)) return;
    busy.add(btnId);
    btn.dataset.state = "sending";
    btn.querySelector(".lbl").textContent = "Sending…";
  }
  status.dataset.state = "";
  status.textContent = `Sending ${kidNames(label)}…`;
  const t0 = performance.now();
  let r;
  try {
    r = await api("POST", payload);
  } catch {
    r = { ok: false, reason: "network", note: "No connection to the simulator" };
  }
  const result = logResult(label, r, performance.now() - t0);
  status.dataset.state = result.state;
  status.textContent = result.text;
  if (btn) {
    btn.dataset.state = result.state;
    btn.querySelector(".lbl").textContent = result.state === "fail" ? "Failed: try again" : "Sent";
    setTimeout(() => {
      busy.delete(btnId);
      btn.dataset.state = "";
      render();
    }, 3200);
  }
}

function render() {
  $("clock").textContent = clockOf(Math.floor(state.min));
  $("play").textContent = state.playing ? "Pause" : "Play";
  $("play").setAttribute("aria-pressed", String(state.playing));
  document.querySelectorAll("[data-speed]").forEach((b) => b.setAttribute("aria-pressed", String(Number(b.dataset.speed) === state.speed)));
  $("beats").replaceChildren(...BEATS.map((b, i) => {
    const li = document.createElement("li");
    const next = BEATS.findIndex((x, j) => !state.done.has(j) && !state.skip.has(j));
    li.dataset.state = state.done.has(i) ? "done" : i === next ? "next" : "";
    li.innerHTML = `<input type="checkbox" ${state.skip.has(i) ? "" : "checked"} aria-label="Include this beat"><b>${clockOf(b.min)}</b><span></span>`;
    li.lastElementChild.textContent = kidNames(b.label);
    li.firstElementChild.addEventListener("change", (e) => { if (e.target.checked) state.skip.delete(i); else state.skip.add(i); });
    return li;
  }));
  $("kids").replaceChildren(...Object.keys(ROLES).map((role) => chip(names[role], state.role === role, () => { state.role = role; render(); })));
  $("spots").replaceChildren(...Object.keys(SPOTS).map((spot) => chip(spot, state.spot === spot, () => { state.spot = spot; render(); })));
  $("spotnote").textContent = SPOTS[state.spot].note;
  if (!busy.has("sendloc")) $("sendloc").querySelector(".lbl").textContent = `Send ${names[state.role]}'s location`;

  const time = clockOf(Math.floor(state.min));
  $("cams").replaceChildren(...CAMERAS.map((c) => {
    const cam = state.cams.get(c.room);
    const what = c.scenes.find(([id]) => id === cam.scene)?.[1] ?? "";
    const div = document.createElement("div");
    div.className = "cam";
    div.dataset.on = String(cam.on);
    div.innerHTML = `<button class="feed" aria-pressed="${cam.on}" aria-label="${c.cam}, ${c.room}: ${cam.on ? "included" : "not included"} (tap to change)"><img alt="" src="${mykx ? `${mykx}/art/sim/${cam.scene}-640.webp` : ""}"><span class="osd"><span class="rec">${c.cam} · ${c.room.toUpperCase()}</span><span>${time}</span></span><span class="incl">${cam.on ? "✓ Included" : "Tap to include"}</span></button><div class="camcap">${c.room}<span></span></div><div class="scenes" role="radiogroup" aria-label="What's happening in the ${c.room.toLowerCase()}"></div>`;
    div.querySelector(".camcap span").textContent = kidNames(what);
    div.querySelector(".feed").addEventListener("click", () => { cam.on = !cam.on; render(); });
    div.querySelector(".scenes").replaceChildren(...c.scenes.map(([id, label]) => {
      const b = document.createElement("button");
      b.className = "scene";
      b.setAttribute("aria-pressed", String(cam.scene === id));
      b.setAttribute("aria-label", kidNames(label));
      b.title = kidNames(label);
      b.innerHTML = `<img alt="" src="${mykx ? `${mykx}/art/sim/${id}-640.webp` : ""}">`;
      b.addEventListener("click", () => { cam.scene = id; cam.on = true; render(); });
      return b;
    }));
    return div;
  }));
  const picked = [...state.cams.entries()].filter(([, v]) => v.on);
  if (!busy.has("sendframes")) {
    $("sendframes").disabled = !picked.length;
    $("sendframes").querySelector(".lbl").textContent = picked.length ? `Send ${picked.length} camera${picked.length > 1 ? "s" : ""}${$("burst").checked ? " as a burst" : ""}` : "Tap a camera to send";
  }
}

function chip(label, on, onClick) {
  const b = document.createElement("button");
  b.className = "chip";
  b.setAttribute("role", "radio");
  b.setAttribute("aria-checked", String(on));
  b.setAttribute("aria-pressed", String(on));
  b.textContent = label;
  b.addEventListener("click", onClick);
  return b;
}

setInterval(() => {
  if (!state.playing) return;
  state.min += state.speed / 60;
  BEATS.forEach((b, i) => {
    if (state.done.has(i) || b.min > state.min) return;
    state.done.add(i);
    if (!state.skip.has(i)) void send(b.send, b.label, null, b.send.type === "location" && !b.send.frames ? "locstatus" : "camstatus");
  });
  if (state.min > BEATS[BEATS.length - 1].min + 5) state.playing = false;
  render();
}, 1000);

$("play").addEventListener("click", () => { state.playing = !state.playing; render(); });
$("restart").addEventListener("click", () => { state.min = 0; state.done.clear(); render(); });
document.querySelectorAll("[data-speed]").forEach((b) => b.addEventListener("click", () => { state.speed = Number(b.dataset.speed); render(); }));
$("burst").addEventListener("change", render);
$("sendloc").addEventListener("click", () => void send({ type: "location", role: state.role, spot: state.spot }, `${names[state.role]} at ${state.spot}`, "sendloc", "locstatus"));
$("sendframes").addEventListener("click", () => {
  const frames = [...state.cams.entries()].filter(([, v]) => v.on).map(([room, v]) => ({ frame: v.scene, room }));
  void send({ type: "frames", burst: $("burst").checked, frames }, frames.map((f) => f.room).join(", "), "sendframes", "camstatus");
});
$("gateform").addEventListener("submit", (e) => { e.preventDefault(); pass = $("pass").value.trim(); store.set("sim-pass", pass); $("gate").hidden = true; void connect(); });

if (!pass) $("gate").hidden = false;
render();
void connect();
