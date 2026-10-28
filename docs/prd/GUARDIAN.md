# myKx Guardian: location and home cameras (PRD 2)

**Written:** Wed 28 Oct 2026, 17:45 SGT, from the founder's request the same afternoon. **Status:** proposed. §3 changes two hard rules in `AGENTS.md` and needs the founder's yes before anything is built. Schedule and cut lines: `docs/plan/IMPLEMENTATION_PLAN.md`, stream F.

## 0. Verdict

**Doable before the freeze (Mon 2 Nov 22:00 SGT) as a thin, honest slice, if four things hold:**

1. The founder approves the rule changes in §3 today.
2. Location ships as **web location sharing** (any phone, while myKx is open) plus the **parent map**. The **Android background app** is a stretch on Sunday. **iOS background tracking is roadmap**: it needs full Xcode and Apple signing, and this Mac only has the command-line tools.
3. The CCTV client ships as a **small Node program with a local settings page**, not a signed installer. Signed macOS and Windows builds are roadmap.
4. The emulator is a **page that runs in a browser tab** (a second Vercel project). Vercel's free plan runs scheduled jobs at most once a day, so it can't drive a live feed.

**Size:** about 24.5 agent hours for the must-haves, 28.5 with the Android stretch, and about 3 hours of the founder's time. The plan's Days 3–6 work is mostly done already (PROGRESS.md, 27–28 Oct), so stream F fits from Wed evening to Sun without touching hardening or video hours. It does add one 20-second beat to the video (§6), so another beat gets shorter.

**Measured today** (Muse Spark 1.3, Standard, low reasoning effort, one frame of our own art with no people in it):

| Frame | Image tokens | Latency | Cost per frame |
|---|---|---|---|
| 640 px wide, 34 KB JPEG | ≈ 340 | 3.6 s | ≈ $0.0018 |
| 1280 px wide, 95 KB JPEG | ≈ 1,350 | 3.2 s | ≈ $0.0030 |

Output was 280–315 tokens, mostly reasoning, so output costs more than the image. One call per tick for all changed cameras keeps it cheap: four rooms at 640 px once a minute for a four-hour after-school window is about **$1 a day**, or **$0.30** with the motion filter (§2.2). The worst case, ten cameras every 30 s, is about **$4 a day**. That's fine for the demo and the founder's home.

## 1. Why: built for Singapore families

Many Singapore children go home on their own after school while both parents work, and many homes have a domestic helper. Parents want three plain answers: *where is my child now*, *are they home*, and *is everything all right at home*. They get those answers from a map and a short status line, not from watching a live feed all afternoon. Guardian gives **assurance, not surveillance**. Each feature uses the family's own phone and cameras, the child can always see when it's on, Kix never sees any of it, and nothing changes mastery or rewards.

## 2. What we build

### 2.1 Out and about (location and motion)

**Where the location comes from**

| Source | Works | Limits |
|---|---|---|
| **Kid's myKx on a phone browser** (must) | today, on any phone; `navigator.geolocation.watchPosition` + `DeviceMotionEvent` | **Foreground only**: the browser stops sending when the tab is hidden or the screen locks. The web has no background-location API, including installed PWAs. Labelled "Shared while myKx is open". |
| **myKx for Android** (stretch) | the same site in a Capacitor shell (`server.url` = production) with `@capacitor-community/background-geolocation` (MIT) | Sideloaded APK only (no Play Store review in time). Android shows a permanent "myKx is sharing your location with your family" notification, which is good for honesty. Uploads go through CapacitorHttp, because WebView requests are throttled after about 5 minutes in the background. Needs Android Studio on this Mac (not installed) and an Android phone. |
| **myKx for iPhone** (roadmap) | same shell plus the iOS "location" background mode | Needs full Xcode and an Apple developer signing identity. |
| **Home simulator** (must, §2.3) | a scripted afternoon route pushed through the same API | Synthetic, labelled. |

**Battery modes (the parent picks one per child)**

| Mode | While moving | While still | Default |
|---|---|---|---|
| Live | every 30 s | every 5 min | |
| Balanced | every 2 min | every 15 min | ✓ |
| Saver | every 10 min | every 30 min | |
| School hours only | Balanced, weekdays from the end of school to 19:00 | off | |

"Still" means under 25 m of movement for 5 minutes. The native app also sets `distanceFilter` (25 m Live, 50 m Balanced, 100 m Saver), because the plugin has no time interval of its own. Uploads are throttled in our code.

**Motion state (deterministic, tested, shown as "possibly …")**

| State | Rule |
|---|---|
| Still | speed < 0.3 m/s and < 25 m moved in 2 min |
| Walking | 0.3–2.2 m/s |
| Running | 2.2–4.5 m/s, or accelerometer cadence over 150 steps a minute |
| Cycling or scooter | 4.5–7 m/s sustained for 1 min |
| In a vehicle | over 7 m/s, or bus-like stop-start patterns |
| **Active in one place (maybe playing)** | high accelerometer variance with < 40 m moved in 5 min; foreground only, since it needs `DeviceMotionEvent` |

Android's Activity Recognition API and iOS Core Motion would be more accurate, but they need a small native plugin of our own: roadmap. Free Capacitor plugins don't expose them, and the one that does (Transistorsoft) needs a paid licence for Android release builds.

**Places.** The parent drops pins for Home and School, each with a radius of 50–300 m. The app records *arrived* and *left* events: "Ari left school 15:12 · walking · arrived home 15:41". There's an optional watch flag: "not home by 16:30 on a school day". Place names come from the parent's pins, so no reverse-geocoding service sees the child's position.

**The parent map.** Leaflet 1.9.4 (installed with `npm --save-exact`, not a CDN) with **OneMap** tiles, the Singapore Land Authority's official basemap. It uses `Default` tiles in light mode and `Night` in dark mode, with the required OneMap logo and attribution. Each kid gets a marker ringed in their Kix colour, an accuracy circle, today's trail fading with age, a motion chip, "updated 2 min ago" (amber after 15 min, grey after an hour) and battery level (native app only). It's phone-first, with a bottom sheet for each kid.

**Map choice**

| Option | Cost | Catch | Pick |
|---|---|---|---|
| **OneMap** (SLA) | free, no card | Singapore only; logo and attribution required | ✓ primary |
| OpenStreetMap tiles | free | tile policy discourages heavy use; attribution required | fallback outside Singapore |
| Google Maps JavaScript API | 10,000 free Dynamic Maps loads a month, then $7 per 1,000 | needs a billing account with a card; the browser key must be locked to our domain | no |
| MapLibre with OpenFreeMap or MapTiler | free tier | vector style setup; another account | roadmap |

**Data.** A `locations` table holds household, kid, time, lat, lng, accuracy, speed, heading, motion, source (`web`/`android`/`sim`) and battery. Points are kept **30 days**, and the parent can choose 7. A `places` table holds the parent's pins, and `place_events` the arrived and left events. Row-level security works by household, like every other table. The kid's session writes for web; a device token writes for Android and the simulator.

**The child knows.** A chip on Home and in the kid menu says "Sharing where you are with your grown-ups" with the mode. Teens can open "What my grown-ups see". The child can't switch it off; the parent can.

No Meta model is used for location: none is needed. The evening summary can mention it in passing ("walked home in 25 minutes").

### 2.2 Home watch (cameras)

**myKx Home Link, the desktop client** (`clients/home-link/`, Node 24, MIT)

- Run it with `node home-link.ts`. It opens a settings page at `http://127.0.0.1:4747`, bound to this machine only.
- **Pairing:** the parent creates a one-time Home Link code in Your family → Home cameras. The client exchanges it for a device token, which the server keeps hashed (scrypt, like kid codes). The parent can revoke it, and every push is audited and rate-limited.
- **Up to 10 cameras.**
  - **ONVIF discovery** (`onvif` 0.8.3, MIT) finds cameras on the LAN and reads each profile's *snapshot URI* (a plain HTTP JPEG, no decoding needed) or *stream URI* (RTSP).
  - **RTSP** works by pasting a URL or by discovery. It grabs one frame with `ffmpeg -rtsp_transport tcp -i <url> -frames:v 1`. ffmpeg isn't bundled (it's GPL): the client checks for it and says how to install it (`brew install ffmpeg`, `winget install ffmpeg`). Snapshot-URI cameras don't need it.
- **For each camera:** a room label (Living room, Kitchen, Study, Entrance…), on/off, a test snapshot, and a privacy confirmation: "This camera doesn't see a bathroom, or a room where someone sleeps or changes."
- **Interval:** 10 s to 10 min, 60 s by default, plus the parent's schedule (for example weekdays 14:00–19:00) and "Pause for an hour".
- **Motion filter, on the machine:** the client shrinks each frame to 64×36 grey and compares it with the last one sent. It sends only if something changed, plus a heartbeat every 10 minutes. On a big change it sends a **burst** of 3 frames 1 s apart.
- **Upload:** frames are resized to 640–960 px, JPEG quality 70 (about 40–90 KB). One POST per tick carries all changed cameras, staying under Vercel's 4.5 MB request limit.
- **Camera passwords never leave this machine.** They sit in a config file readable only by the user (mode 600). The client only pushes; myKx never connects into the home network.

**On the server** (`/api/home/frames`)

1. Check the device token, the camera ids and the sizes (≤ 10 images, ≤ 1.5 MB each). Frames are held in memory only.
2. **One Muse Spark call (Standard) per tick** with every changed frame and its room label. A zod-checked JSON schema comes back, one entry per camera:
   - `people`: each person as `child`, `adult` or `unknown`. A child may be named `likely: "Ari"` with a confidence, only from the parent's own descriptions in settings (age band and, optionally, "usually in the blue PE shirt"). No face templates are made or stored. **Adults are never named.**
   - `activity`: one of watching a screen, eating or drinking, reading or homework, playing, talking, resting or sleeping, moving around, arguing, physical conflict, other. Plus a 60-character note.
   - `cue`: for **children only**, a *visible* behaviour: smiling or laughing, calm, frowning, crying, shouting posture, or unclear. Never an inferred inner feeling. "Dreaming" becomes "resting, eyes closed".
   - `hazard`: none, child near a lit stove, child climbing near an open window or ledge (a real high-rise risk in Singapore), child alone with an adult who isn't family (info only), fire or smoke, a child lying still on the floor.
   - `concern`: none, watch or urgent, with a reason and a confidence.
3. **Deterministic flag rules** (code, tested, like PARENT_INSIGHTS §2):
   - **Urgent:** a hazard of fire, a window or ledge, or a child lying still, on a single frame. Or physical conflict in 2 of the last 3 frames from one camera, or in a burst.
   - **Watch:** physical conflict once, arguing 3 times in 10 minutes, or crying for 5 minutes.
   - **Info:** arrivals ("Ari is in the living room, 15:42"), a camera offline for over 10 minutes.
4. **Storage:** only the frames behind an urgent or watch flag are kept, in a private Supabase bucket. The parent gets signed links, and the frames are **deleted after 24 hours**. Every other frame is dropped as soon as Muse has read it. A `home_status` row per camera and tick (text only) is kept 14 days.

**The parent's Home now page**

- **Room tiles:** room name, who's there (child or adult icons, with a name when likely), the activity, a visible cue chip, "updated 40 s ago", and an offline badge. **No live picture by default:** the page shows status, not a feed.
- **Today's timeline:** arrivals, and activities with how long they lasted ("TV 1 h 10 min, 16:05–17:15"), rolled up from the status rows.
- **An alert card for each flag:** the 1–3 frames, Muse's reason and confidence, **Right / Not right** (the same pattern as the focus-camera replay; "Not right" softens that camera's rule for 14 days) and "Call home". For harm, it shows **995** (ambulance and fire) and **999** (police).
- **Near real time:** the page polls every 10 s, and urgent flags also show in the existing flags list. Frame to status takes the interval, plus the upload, plus about 4 s for Muse.
- **Settings:** cameras (from the client), schedule, pause, the kids' descriptions, the Home Link code, and the client's download and instructions.

**The child knows.** A chip says "Home cameras are on" during camera hours. Camera data never reaches Kix, the tutor or the Notebook, and never changes mastery or rewards (rule 5).

### 2.3 Home simulator (the emulator)

- **A second Vercel project** on the free plan, from the same repo, `sim/` folder, a small static page. Free accounts can have more than one project. Vercel's scheduler can only fire once a day, so the simulator **runs while its tab is open** (or as `node sim/run.ts`).
- **What it plays:** a scripted after-school afternoon for the demo family, at real time or 10× speed.
  - Ari walks from a primary school to a playground (maybe playing), then home.
  - Cameras: living room (reading, then TV), kitchen (snack), study (homework), and a staged sibling argument that tips into a shove (a watch flag, then Right / Not right).
  - One hazard frame: a child climbing a chair by an open window (urgent).
- **The frames:** about 30 **pre-generated** frames from Muse Image. They show fictional characters in a stylised 3D look with a high, wide-angle camera viewpoint; the timestamp is drawn by code, never by the model. They live in `sim/frames/` with manifest entries (rule 6) and are labelled "Synthetic camera frames" (rule 8). If Muse Image refuses a frame (the argument and the hazard), we use a softer version, and the gap is noted.
- **Real path:** it signs in with a normal Home Link device token and posts to the **real ingest API**. myKx can't tell it from a real client, so the analysis, flags and map run live. If a live Muse call fails during a take, the page shows the last cached status, labelled (rule 7).

## 3. Rule changes (need the founder's yes)

| Rule | Today | Proposed |
|---|---|---|
| 2 | "Never take a child's photo as image input." | Keep it for every image *generation* (Studio, art). Add: "Home watch frames from the family's own cameras are read by Muse Spark (Standard) for safety status only: never used to generate images, never stored except flagged frames for 24 h." |
| 12 | "No face image or video ever leaves the device… Mood comes only from the child's words." | Keep both for the learning app's focus camera. Add: "Except Home watch (PRD 2): parent-installed cameras, opt-in per camera, a visible chip for the child; children's *visible* behaviour cues only, as 'possibly'; adults are never named or read for mood (a home with a helper is a workplace)." |
| new 15 | — | "**Guardian is care, not surveillance.** Location and Home watch are parent-installed and opt-in; the child always sees when they're on; their data never reaches Kix or the Notebook and never changes mastery or rewards; no cameras in bathrooms or where anyone sleeps or changes; adults are never identified; flagged frames live 24 h, status 14 days, location 30 days; every alert needs a parent's review (Right / Not right)." |
| video | "Never show real children's names or photos." | Unchanged: the video uses only the simulator's synthetic frames and route. |

## 4. Law, Meta policy and accuracy (research, 28 Oct)

**Meta Model API Acceptable Use Policy** ([dev.meta.ai/legal/acceptable-use-policy](https://dev.meta.ai/legal/acceptable-use-policy)). Under "prohibited biometric or surveillance practices":

- **Identifying or tracking a specific person from biometric data, and re-identifying them across images, frames or locations** from appearance or clothing: both are allowed only "with a lawful basis and consent where required by applicable law". A parent watching their own children at home has that basis. **Adults (helpers, visitors) haven't consented**, so we never name or track them.
- **Emotion recognition in workplaces and schools:** prohibited, except where the law permits it. A home with a domestic helper is the helper's workplace, so we never read adults' emotions. For children we report visible behaviour, not inferred emotion, and myKx's learning screens stay words-only (rule 12).
- **"Mass or indiscriminate surveillance"** is prohibited for law enforcement and national security; ours is one family's own cameras.
- **Relying on outputs for safety decisions "without a qualified person reviewing"** is prohibited. Every alert needs the parent's review, and nothing acts on its own.

**Singapore**

- **PDPA:** the PDPA doesn't place its obligations on individuals acting in a personal or domestic capacity. myKx is an organisation that processes the data for the parent, so it keeps PDPA-style protections anyway: purpose (safety status only), retention limits, access by the household only, and deletion on request. This is not legal advice.
- **Helpers:** MOM's guidance, as reported, is that employers must tell domestic workers about cameras and where they are, and keep cameras out of places where privacy is expected, such as bathrooms and where they change or sleep ([TSMP](https://www.tsmplaw.com/forefront/maid-cameras-naughty-or-nice/), [AWARE on the MOM/SPF reply](https://www.aware.org.sg/2015/11/filming-domestic-workers-mom-and-spf-reply/)). Hong Kong's privacy commissioner says the same in more detail ([PCPD guidance](https://www.pcpd.org.hk/english/resources_centre/publications/files/guidance_cctv_surveillance.pdf)). The client asks for that confirmation per camera, and the settings page reminds the parent to tell everyone in the home.

**Accuracy.** Vision-language models catch violence with high recall and explain themselves, but they give false positives on play-fighting, and still frames taken minutes apart miss short events ([VLM vs. transformer study, 2025](https://aclanthology.org/2025.r2lm-1.2); [LLM content moderation evaluation](https://arxiv.org/pdf/2411.17123)). So:

- every reading is "possibly …" with a confidence;
- conflict needs 2 of 3 frames or a burst;
- the motion filter triggers bursts on big changes;
- the parent's Right / Not right tunes the rule per camera;
- the UI says that cameras check every N seconds and can miss things.

Guardian is a reassurance tool, not a guarantee, and the settings page says so in plain words.

## 5. Build list (stream F)

| # | Task | Hours | Need |
|---|---|---|---|
| F1 | Tables (`locations`, `places`, `place_events`, `home_devices`, `home_cameras`, `home_status`, `home_alerts`) with RLS and PGlite tests; demo store; Home Link pairing and device tokens; `/api/location` and `/api/home/frames` ingest with limits and audit | 3 | must |
| F2 | Kid location sharing on the web: battery modes, motion classifier (pure, tested), places and arrive/leave events, the "sharing" chip | 2 | must |
| F3 | Parent map: Leaflet + OneMap tiles (light/night), markers, trail, accuracy, motion chip, places editor, bottom sheet | 3.5 | must |
| F4 | Home analysis: Muse Spark schema and prompt, flag rules (tested), flagged frames to a private bucket with 24 h expiry, `model_runs` logging, cached fallback | 3.5 | must |
| F5 | Home now page: room tiles, timeline, alert cards with Right / Not right, settings (schedule, pause, descriptions, Home Link code) | 4 | must |
| F6 | Home Link client: Node CLI and local settings page, ONVIF discovery, snapshot and RTSP grab, motion filter and burst, pairing, config file | 5 | must |
| F7 | Home simulator: second Vercel project, scripted route and afternoon, ~30 synthetic frames (Muse Image, in the manifest) | 3.5 | must |
| F8 | myKx for Android: Capacitor shell, background geolocation, native HTTP upload, the mode from the parent's settings | 4 | stretch |
| F9 | Canvas boards for the map and Home now (phone + desktop) | 2 | if time |

**Must: 24.5 h. With stretch: 28.5 h.** The founder's time is about 3 h:

- yes or no on §3 (15 min);
- the alert and chip wording (30 min);
- walking a block with the phone to test location (30 min);
- optionally, one real camera at home (30 min; real frames reach Muse Standard and are never used in the video);
- for the Android stretch, installing Android Studio and running the APK on a phone (1.5 h).

## 6. The demo beat (20 s, replaces part of 2:00–2:22)

The parent's phone at 15:41:

1. The map shows Ari's dot walking home from school, "possibly playing" at the playground on the way.
2. A notification: "Ari is home." Home now: "Living room: Ari, reading · calm".
3. The simulator jumps ahead, and a watch card arrives: "Possibly a shove between two children in the living room, 17:08, medium confidence". It shows the synthetic frames, and the parent taps **Not right** ("they were play-fighting").
4. A lower third: "Your cameras, your phone, read by Muse Spark. Frames deleted after 24 h. Kix never sees them."

The messages beat gets shorter to pay for it (§5 of the plan).

## 7. Out of scope (roadmap slide)

- iOS background app.
- Signed and notarised desktop installers.
- Play Store and App Store listings.
- Push notifications (in-app and polling only).
- Audio from cameras: never, as for voice (rule 9).
- Live video in the app.
- NVR and cloud-camera brands' own APIs.
- Android Activity Recognition through a native plugin.
- Fall detection from phone sensors.
- Supabase Realtime in place of polling.

## 8. Questions for the founder

1. Approve the rule changes in §3, as written or with edits?
2. Should the child be able to pause location (teens only, for 30 minutes, with the parent told), or never?
3. Should kids' rooms be allowed as camera rooms if no one else sleeps there, or keep every bedroom out?
4. Is a real Android phone available on Sunday for the stretch?

## Sources

- [Meta Model API Acceptable Use Policy](https://dev.meta.ai/legal/acceptable-use-policy)
- [Vercel cron jobs: usage and pricing](https://vercel.com/docs/cron-jobs/usage-and-pricing) (Hobby: once a day, ±59 min); [Vercel limits](https://vercel.com/docs/limits)
- [Google Maps Platform pricing](https://developers.google.com/maps/billing-and-pricing/pricing) (Dynamic Maps: 10,000 free a month, then $7 per 1,000)
- [OneMap maps documentation](https://www.onemap.gov.sg/docs/maps/) (tile URL, styles, logo and attribution required); [JOSM: Singapore imagery](https://josm.openstreetmap.de/wiki/Maps/Singapore)
- [@capacitor-community/background-geolocation](https://github.com/capacitor-community/background-geolocation) (MIT; foreground-service notification; WebView throttling note); [Transistorsoft licence note](https://classic.yarnpkg.com/en/package/@transistorsoft/capacitor-background-geolocation); [Capgo background geolocation](https://capgo.app/docs/plugins/background-geolocation/)
- [`onvif` on npm](https://github.com/agsh/onvif) (0.8.3, MIT); [ONVIF media service](https://documentation.euresys.com/Products/PICOLO_NET_HD1/PICOLO_NET_HD1/en-us/Content/04_Reference/01_ONVIF_Services/The_ONVIF_Media_Service.htm)
- [TSMP: maid cameras](https://www.tsmplaw.com/forefront/maid-cameras-naughty-or-nice/); [AWARE: MOM and SPF reply on filming domestic workers](https://www.aware.org.sg/2015/11/filming-domestic-workers-mom-and-spf-reply/); [Hong Kong PCPD CCTV guidance](https://www.pcpd.org.hk/english/resources_centre/publications/files/guidance_cctv_surveillance.pdf)
- [Comparative study of ViTs and multimodal LLMs for violence detection (2025)](https://aclanthology.org/2025.r2lm-1.2); [Evaluating LLMs for sensitive content across text, images and video](https://arxiv.org/pdf/2411.17123)
- Token and latency figures: a probe run from this repo on 28 Oct 2026 (two calls to `muse-spark-1.3`, our own no-people scene art).
