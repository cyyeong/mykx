// The Home simulator page: the passcode gate, the scripted afternoon, Send now and myKx's answers. All sends go
// through this project's own server (/api/send), which holds the device token; the page never sees it.
import { BEATS, FRAMES, ROLES, ROOMS, SPOTS, clockOf } from "./script.js";

const $ = (id) => document.getElementById(id);
const store = { get: (k) => { try { return localStorage.getItem(k); } catch { return null; } }, set: (k, v) => { try { localStorage.setItem(k, v); } catch { /* private mode */ } } };
let pass = store.get("sim-pass") ?? "";
let mykx = "";
let names = { ...ROLES };
const state = { playing: false, speed: 10, min: 0, done: new Set(), skip: new Set(), role: "A", spot: "Walking home", picked: new Map([["living-argument", "Living room"]]) };

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

function logResult(label, r) {
  const li = (what, status, ms, text, ok) => {
    const el = document.createElement("li");
    el.innerHTML = `<span class="meta"><span>${new Date().toLocaleTimeString("en-SG", { hour12: false })} · ${what}</span><span class="${ok ? "ok" : "bad"}">${status}${ms ? ` · ${(ms / 1000).toFixed(1)} s` : ""}</span></span><span></span>`;
    el.lastElementChild.textContent = text;
    $("log").prepend(el);
  };
  if (!r.ok) return li(label, r.reason ?? "error", 0, r.note ?? "The simulator couldn’t send that.", false);
  for (const x of r.results) {
    const b = x.body;
    let text = b.reason ? `myKx: ${b.reason}${b.note ? ` (${b.note})` : ""}` : "";
    if (x.what.startsWith("location")) text ||= b.pausedUntil ? `Paused sharing until ${new Date(b.pausedUntil).toLocaleTimeString("en-SG")}` : `${b.stored} point(s) stored · ${b.motion ?? "?"}${b.events?.length ? ` · ${b.events.map((e) => `${e.kind} ${e.place}`).join(", ")}` : ""}`;
    else if (b.camerasOn === false) text ||= "Cameras are off right now (the family’s camera hours or a pause). Change them in Location and home cameras.";
    else text ||= [...(b.statuses ?? []).map((s) => `${s.camera}: ${s.activity}${s.cue ? `, ${s.cue}` : ""}${s.concern !== "none" ? ` (${s.concern})` : ""}${s.source === "cached" ? " [cached]" : ""}`), ...(b.alerts ?? []).map((a) => `ALERT ${a.level}: ${a.kind} in ${a.camera}`)].join(" · ") || "Read nothing";
    li(x.what, x.status, x.ms, text, x.status < 300);
  }
}

async function send(payload, label) {
  const r = await api("POST", payload);
  logResult(label, r);
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
    li.lastElementChild.textContent = b.label.replace(/\b(Ari|Zara|Mei)\b/g, (n) => names[Object.keys(ROLES).find((k) => ROLES[k] === n)] ?? n);
    li.firstElementChild.addEventListener("change", (e) => { if (e.target.checked) state.skip.delete(i); else state.skip.add(i); });
    return li;
  }));
  $("kids").replaceChildren(...Object.keys(ROLES).map((role) => chip(names[role], state.role === role, () => { state.role = role; render(); })));
  $("spots").replaceChildren(...Object.keys(SPOTS).map((spot) => chip(spot, state.spot === spot, () => { state.spot = spot; render(); })));
  $("spotnote").textContent = SPOTS[state.spot].note;
  $("frames").replaceChildren(...Object.entries(FRAMES).map(([id, f]) => {
    const on = state.picked.has(id);
    const div = document.createElement("div");
    div.className = "frame";
    div.innerHTML = `<button class="pic" aria-pressed="${on}" aria-label="${f.what} (synthetic)"><img alt="" src="${mykx ? `${mykx}/art/sim/${id}-640.webp` : ""}"></button><button class="room">${on ? state.picked.get(id) : f.room} ▾</button>`;
    div.firstElementChild.addEventListener("click", () => { if (on) state.picked.delete(id); else state.picked.set(id, f.room); render(); });
    div.lastElementChild.addEventListener("click", () => { if (!on) return; state.picked.set(id, ROOMS[(ROOMS.indexOf(state.picked.get(id)) + 1) % ROOMS.length]); render(); });
    return div;
  }));
  const n = state.picked.size;
  $("sendframes").disabled = !n;
  $("sendframes").textContent = n ? `Send ${n} frame${n > 1 ? "s" : ""}${$("burst").checked ? " as a burst" : ""}` : "Tick a frame to send";
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
    if (!state.skip.has(i)) void send(b.send, b.label);
  });
  if (state.min > BEATS[BEATS.length - 1].min + 5) state.playing = false;
  render();
}, 1000);

$("play").addEventListener("click", () => { state.playing = !state.playing; render(); });
$("restart").addEventListener("click", () => { state.min = 0; state.done.clear(); render(); });
document.querySelectorAll("[data-speed]").forEach((b) => b.addEventListener("click", () => { state.speed = Number(b.dataset.speed); render(); }));
$("burst").addEventListener("change", render);
$("sendloc").addEventListener("click", () => send({ type: "location", role: state.role, spot: state.spot }, `${names[state.role]} at ${state.spot}`));
$("sendframes").addEventListener("click", () => send({ type: "frames", burst: $("burst").checked, frames: [...state.picked].map(([frame, room]) => ({ frame, room })) }, "frames"));
$("gateform").addEventListener("submit", (e) => { e.preventDefault(); pass = $("pass").value; store.set("sim-pass", pass); $("gate").hidden = true; void connect(); });

if (!pass) $("gate").hidden = false;
render();
void connect();
