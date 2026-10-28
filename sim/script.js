// The Home simulator's scripted afternoon and places (docs/prd/GUARDIAN.md §2.3). Synthetic: the frames are Muse
// Image art (public/art/sim on myKx) and the points are a made-up route around the demo family's pins in Sengkang.
// Shared by the page (sim/app.js) and the server (sim/api/send.js).

export const FRAMES = {
  "living-reading": { room: "Living room", what: "reading on the sofa" },
  "living-tv": { room: "Living room", what: "two kids watching TV" },
  "kitchen-snack": { room: "Kitchen", what: "eating noodles" },
  "study-homework": { room: "Study", what: "homework at the desk" },
  "living-argument": { room: "Living room", what: "tug-of-war over the remote" },
  "living-window": { room: "Living room", what: "walking to an open window" },
  "entrance-arrive": { room: "Entrance", what: "arriving home" },
  "kitchen-empty": { room: "Kitchen", what: "an empty kitchen" },
};

export const ROOMS = ["Living room", "Kitchen", "Study", "Entrance"];
export const cameraKey = (room) => room.toLowerCase().replace(/[^a-z]+/g, "-");

/** Spots on the route: coordinates near the demo family's Home and School pins, with how a phone would report them. */
export const SPOTS = {
  School: { lat: 1.3966, lng: 103.8865, speed: 0, activity: 0.5, note: "Still at School" },
  Playground: { lat: 1.3949, lng: 103.8907, speed: 0.6, activity: 7, note: "Lots of movement in one spot (maybe playing)" },
  "Walking home": { lat: 1.3921, lng: 103.8952, speed: 1.3, activity: 1.2, note: "Walking, about 4 minutes from Home" },
  Bus: { lat: 1.3932, lng: 103.8930, speed: 9, activity: 1, note: "In a vehicle, stop-start" },
  Home: { lat: 1.3895, lng: 103.9003, speed: 0.05, activity: 0.3, note: "Still at Home" },
};

/** Roles in the script; the server maps them to the paired family's kids (by nickname, else youngest first). */
export const ROLES = { A: "Jordan", B: "Abby", C: "Leonard" };

/** The afternoon, in script minutes from 15:00. Each beat is a location or camera frames. */
export const BEATS = [
  { min: 5, label: "Jordan leaves School, walking", send: { type: "location", role: "A", spot: "School" } },
  { min: 12, label: "Jordan walking", send: { type: "location", role: "A", spot: "Walking home" } },
  { min: 20, label: "Playground: maybe playing", send: { type: "location", role: "A", spot: "Playground" } },
  { min: 26, label: "Still at the playground", send: { type: "location", role: "A", spot: "Playground" } },
  { min: 37, label: "Abby still at School", send: { type: "location", role: "B", spot: "School" } },
  { min: 38, label: "Jordan walking home", send: { type: "location", role: "A", spot: "Walking home" } },
  { min: 41, label: "Jordan home: Entrance camera", send: { type: "location", role: "A", spot: "Home", frames: [{ frame: "entrance-arrive", room: "Entrance" }] } },
  { min: 45, label: "Kitchen: noodles", send: { type: "frames", frames: [{ frame: "kitchen-snack", room: "Kitchen" }] } },
  { min: 65, label: "Living room: TV with Abby", send: { type: "frames", frames: [{ frame: "living-tv", room: "Living room" }, { frame: "kitchen-empty", room: "Kitchen" }] } },
  { min: 90, label: "Study: Leonard’s homework", send: { type: "frames", frames: [{ frame: "study-homework", room: "Study" }] } },
  { min: 112, label: "Open window (urgent)", send: { type: "frames", burst: true, frames: [{ frame: "living-window", room: "Living room" }] } },
  { min: 126, label: "Remote tug-of-war, 1 of 3", send: { type: "frames", frames: [{ frame: "living-argument", room: "Living room" }] } },
  { min: 127, label: "Still arguing, 2 of 3", send: { type: "frames", frames: [{ frame: "living-argument", room: "Living room" }] } },
  { min: 128, label: "Still arguing, 3 of 3 (watch)", send: { type: "frames", frames: [{ frame: "living-argument", room: "Living room" }] } },
  { min: 150, label: "Quiet: reading, all calm", send: { type: "frames", frames: [{ frame: "living-reading", room: "Living room" }, { frame: "kitchen-empty", room: "Kitchen" }] } },
];

export const clockOf = (min) => `${String(15 + Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;
