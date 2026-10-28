# Guardian: demo runbook and video beat

For the 20-second beat at 2:10–2:30 of the video (`docs/plan/IMPLEMENTATION_PLAN.md` §5) and for any live demo. Everything on
screen is synthetic and says so. Nothing here needs a camera, a phone or a live search: the simulator plays the home, and the
outing ideas were recorded from a real Muse Spark web search.

## Before every take (2 minutes)

1. Reset the demo household's Guardian data: `node --env-file=.env.local scripts/guardian/reset-demo.ts`. It clears today's
   points, arrivals, room readings, alerts and their stored frames, and any pause. Pins, sharing, descriptions and the saved
   outing ideas stay.
2. Open the Home simulator (https://mykx-sim.vercel.app, sign in to Vercel, paste the passcode) in one browser window, and
   the parent's phone view in another (a 390 px wide window, or the real phone): myKx → Where.
3. Check once that the cameras are on: Your family → Location and home cameras shows the simulator with four rooms online,
   hours 00:00–23:59, every day.
4. Optional, if a take needs a fresh set of ideas: `node --env-file=.env.local scripts/guardian/outings-seed.ts` (about a
   minute, $0.20). The page otherwise opens on the saved, sourced ideas.

## The beat (what to do, and what the viewer sees)

| Time | You do | On screen |
|---|---|---|
| 0:00 | In the simulator, press **Send location** for Jordan at School, then Walking home, then Playground twice. On the parent's phone, stay on Where. | Muse Spark's "Right now" over the map; Jordan's Kix dot walks home along its trail; "Possibly playing" at the playground |
| 0:05 | Send Jordan at Home, then the Kitchen and Study frames. Tap **Home**. | The floor plan lights up, Kix avatars appear in their rooms |
| 0:10 | Send the tug-of-war frame three times (about 4 s each), one at a time. | A watch note arrives; the banner and "Right now" change |
| 0:13 | Tap the banner: the alert sheet opens. | Three frames, the last with SAM 3.1's colour outline on each child; "Was Muse right?" |
| 0:16 | Tap **Not right**. | "Thanks. This camera now needs one more matching check…" |
| 0:18 | Go to Today, then **Do something together**. | Muse's summary, weekend ideas with sources, the weather |
| 0:20 | Lower third. | "Your cameras, read by Muse Spark and SAM 3.1. Pictures deleted after 24 hours. Kix never sees them." |

For the urgent version (a longer cut): send **Send as a burst** of the open-window frame instead; an urgent alert arrives at once
and the sheet shows 995 and 999.

## What is live, cached or sample

| Part | In the take |
|---|---|
| Room readings and alerts | Live Muse Spark on the simulator's frames (3–10 s each). If the live call ever fails, the same frames fall back to a recorded reading, labelled "cached" |
| SAM 3.1 outlines | Live |
| "Right now" and Tonight | Live Muse Spark; the rules' own sentence (labelled) if it's unavailable |
| Outing ideas | A real Muse Spark web search recorded earlier, labelled "saved from a search at …" |
| Frames, route, kids | Synthetic (Muse Image art, a scripted route) and labelled "Synthetic" |

## Lines for the voice-over (about 45 words)

"Mum's phone, on a Tuesday afternoon. Muse Spark reads the family's own cameras and says what it sees, and where everyone is.
A fight? It says 'possibly', shows Mum the pictures, and she decides. And on Saturday, it searches Sengkang for something
to do together."

## What not to say or show

- No real children, real homes or real cameras. The frames are drawn.
- Never say Muse "detects" or "knows"; it reads, says "possibly" and waits for the parent.
- Don't show the Home Link settings with a real camera address. The desktop client is shown only with the fake camera.
