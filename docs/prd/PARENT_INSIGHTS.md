# Parent insights, wellbeing signals and family messages

**Written:** Tue 27 Oct 2026 (Day 1). **Status:** in scope as PRD_REVIEW E12; scheduled in `docs/plan/IMPLEMENTATION_PLAN.md` (stream D). Designs: [myKx Screens](https://claude.ai/artifact/8crEyKVQm9QxCHLDqPXioP), row 7.

## 1. What a parent sees

| Area | What it shows | Where it comes from |
|---|---|---|
| **Screen time** | today, the last 7 days against the daily limit, time of day, late-night use | `sessions`: a heartbeat every 30 s while the app is visible (deterministic) |
| **Learning plan** | planned vs done this week, overdue reviews, skipped quests, the next planned session | `plans` (days × minutes, set by the parent; topics picked by Kix from mastery gaps and the skill's exam blueprint) vs `attempts` (deterministic) |
| **Focus** | per session, 0–100 against the child's own 2-week baseline | interaction only: idle gaps, answers under 3 s (guessing), leaving the app (Page Visibility), quitting mid-quest, a hint on every question (deterministic, tested) |
| **Mood** | per session: calm, happy, curious, unsure, frustrated, tired or worried, with confidence and the words behind it | Muse Spark (Standard, JSON schema) reads only the child's own messages to Kix in that session, in the same post-session call as the Memory Keeper |
| **Hesitation** ("tentative") | answer changes, long pauses before submitting, "I'm not sure" | interaction and chat (deterministic plus the mood call) |
| **Voice** | speaking pace, long pauses and restarts | timing from the transcription result (`turns[].startMs/endMs`); never emotion from raw audio, and audio is never stored |
| **Camera (opt-in)** | per minute: face away from the screen, eyes closed over 1.5 s, yawns → "possibly sleepy", "looking away" | a face-landmark model running **on the device** in the browser (MediaPipe Face Landmarker). No image or video leaves the device or reaches any model. Off by default; the parent switches it on; the child sees a camera dot and can switch it off. |

Everything is shown as **"possibly …" with confidence and evidence**, compared only with the child's own baseline, never with other children. Mood and focus never change mastery or rewards (hard rule 5).

## 2. Flags

| Level | Fires when | What happens |
|---|---|---|
| **Urgent** | distress or safety words in chat or voice ("I want to hurt myself", "someone hurt me", "no one would care") from a keyword list confirmed by the Spark call | Kix answers with care and points to a trusted adult; a card shows **Tinkle Friend 1800 274 4788** (for children) and **SOS 1767** (24 h); the parent's dashboard shows it at once, even in quiet hours. Kix never offers counselling and never promises secrecy. |
| **Watch** | signs of a breakdown: frustrated or worried in 2+ sessions within 3 days; negative self-talk ("I'm stupid", "I can't do anything"); tired signals in 3 late sessions; focus well below baseline for 3 sessions | appears at the top of the dashboard and in tonight's summary, with a suggested action |
| **Info** | the plan isn't followed: a missed planned session, reviews overdue, quests skipped, over the daily limit | listed under the plan |

Each flag shows **what we saw** (the evidence), **what it may mean** (uncertain wording), **what may help** (a message, a break, an earlier session, a talk), and **Message {child}** and **Mark as seen** buttons.

## 3. Family messages

- Parent ↔ child inside the household only. The parent writes or picks an encouragement and can add a **Kix sticker**. The child sees "Message from Mum" delivered by Kix on Home and replies with quick replies, stickers, a short text or a voice note (transcribed).
- **Stickers instead of GIF services:** our own animated Kix sticker pack. Muse Image stills are animated with CSS: cheer, high five, hug, proud, you've got this, sleepy, star, party, rest time, heart. There's no third-party GIF service, so kids aren't tracked and there's no unsafe content. Standard emoji are allowed in text.
- When a flag fires, Kix suggests a message ("Ari found Wednesday tricky. Send a hug?").
- **Family messages are private:** Kix, the Memory Keeper and every language model never read them, and they aren't used for mood. A voice reply goes through Muse Voice Transcribe like any voice input (Standard, audio discarded) and only its text is sent.

## 4. Rules

1. Signals are possibilities with evidence, shown to the parent only, never diagnoses or labels. The child's settings say in plain words what their grown-up can see.
2. No face image or video ever leaves the device (hard rule 2); there is no facial emotion recognition. Emotion recognition from faces is unreliable, and the EU AI Act bans it in education settings.
3. Mood comes only from the child's words to Kix, through Standard models.
4. Safety flags bypass quiet hours and always show trusted-adult and helpline information.
5. A parent can set the daily limit, quiet hours and the camera toggle, and can delete any signal or flag.

## 5. Data

New tables: `sessions` (start, end, active minutes, device class), `signals` (session, kind, value, confidence, evidence JSON), `flags` (level, kind, evidence, status), `plans` (weekly targets), `messages` (household, sender, recipient, body, sticker, read_at). Row-level security by household, like everything else.

## 6. MVP cut line

- **Must:** screen time with limit, plan adherence, focus and mood signals, the three flag levels with the safety path, the parent dashboard, messages both ways with Kix stickers.
- **Should:** voice pace signals; Kix-suggested messages.
- **Stretch:** camera signals on the device behind the parent toggle; push or email notifications (in-app only for the MVP).
