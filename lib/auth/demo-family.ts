// The synthetic demo family (hard rule 8: labelled in the UI). Same ids, nicknames and secret hashes
// as supabase/seed.sql; lib/auth/demo-family.test.ts keeps the two in step. The nicknames are the founder's stand-ins
// (AGENTS.md rule 10), never real names, and everything recorded about them is made up.
// The demo secrets are public on purpose (they open the demo, nothing else).
import type { Band, Level, Pack, SecretKind } from "./schemas.ts";

export const DEMO_HOUSEHOLD_ID = "00000000-0000-4000-8000-000000000001";
export const DEMO_PARENT_ID = "00000000-0000-4000-8000-000000000010";
/** The demo parent's auth user id in the in-memory demo store (Supabase links a real one on Day 3). */
export const DEMO_PARENT_USER_ID = "00000000-0000-4000-8000-0000000000a1";
export const DEMO_PARENT_EMAIL = "demo@mykx.ai";

export const JORDAN_ID = "00000000-0000-4000-8000-000000000011";
export const ABBY_ID = "00000000-0000-4000-8000-000000000012";
export const LEONARD_ID = "00000000-0000-4000-8000-000000000013";

/** What each demo kid types or taps. Jordan: idle, cheer, pilot, dreamlight. */
export const DEMO_SECRETS = {
  [JORDAN_ID]: { kind: "pictures", code: ["idle", "cheer", "pilot", "dreamlight"] },
  [ABBY_ID]: { kind: "password", password: "stars123" },
  [LEONARD_ID]: { kind: "password", password: "frogs123" },
} as const;

export interface DemoKid {
  id: string;
  nickname: string;
  band: Band;
  level: Level;
  pack: Pack;
  secretKind: SecretKind;
  secretHash: string;
  voiceEnabled: boolean;
  dailyLimitMin: number;
}

export const DEMO_KIDS: readonly DemoKid[] = [
  {
    id: JORDAN_ID,
    nickname: "Jordan",
    band: "junior",
    level: "P3",
    pack: "terrarium",
    secretKind: "pictures",
    secretHash: "scrypt$16384$8$1$R56ygih2QnUpKfvx2V-TAQ$PusjO4VBvo99NjoE2q9N0888tPwfuKQWnV8LWXPMe3E",
    voiceEnabled: true,
    dailyLimitMin: 30,
  },
  {
    id: ABBY_ID,
    nickname: "Abby",
    band: "teen",
    level: "P6",
    pack: "idol-stage",
    secretKind: "password",
    secretHash: "scrypt$16384$8$1$FevcUegSzdBYFanzvoOZdw$sSUAUykHk2NcF_lnaMBDW4yjh4k6kkAw5j4X7k5zsVw",
    voiceEnabled: true,
    dailyLimitMin: 45,
  },
  {
    id: LEONARD_ID,
    nickname: "Leonard",
    band: "teen",
    level: "Sec 2",
    pack: "anime-sky",
    secretKind: "password",
    secretHash: "scrypt$16384$8$1$pjXXCAkBz0et6aXl41WZOA$kkkXCpP2snjhWs21BhmbdWZ1hzBwhFqasgwGnZVdPOc",
    voiceEnabled: true,
    dailyLimitMin: 60,
  },
];

// A second synthetic family, demo store only: gives the admin People page more than one household
// and gives tests a parent who is not an admin.
export const OTHER_HOUSEHOLD_ID = "00000000-0000-4000-8000-000000000002";
export const OTHER_PARENT_ID = "00000000-0000-4000-8000-000000000020";
export const OTHER_PARENT_USER_ID = "00000000-0000-4000-8000-0000000000a2";
export const OTHER_PARENT_EMAIL = "other@demo.mykx";
export const KAI_ID = "00000000-0000-4000-8000-000000000021";
export const KAI_SECRET = { kind: "pictures", code: ["hint", "toon-pop", "pilot", "idle"] } as const;
export const KAI_SECRET_HASH = "scrypt$16384$8$1$v9aJ6aH62nn1sWeGi9aMzQ$w0F0puCpJprtV14NMTX5flss9EuY1ICeUsTtupLEeiw";

/**
 * Jordan's sample "possibly losing focus" note (synthetic; Your family labels it "Sample"), dated yesterday at
 * 4:12 pm Singapore time. Same id and words as supabase/seed.sql; lib/signals/focus.test.ts checks the words are
 * what the focus rule writes for SAMPLE_FOCUS_MINUTES against SAMPLE_FOCUS_BASELINE.
 */
export const ARI_SAMPLE_FOCUS_NOTE = {
  id: "00000000-0000-4000-8000-0000000000f1",
  evidence:
    "In 3 minutes: looked away 1 min 50 s (usually about 15 s), eyes closed 3 times (usually none), 2 yawns (usually none). Focus about 55, against a usual 86.",
  confidence: "medium",
} as const;
