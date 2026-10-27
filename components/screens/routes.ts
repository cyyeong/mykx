// Fixture routes for the Day 2 static ports. Day 3–4 replace the ids with the child's real quest and items.
export const DEMO_QUEST = "shadows";
export const DEMO_QUESTION = "shadows-2";

export const ROUTES = {
  home: "/home",
  quest: `/learn/${DEMO_QUEST}`,
  question: `/question/${DEMO_QUESTION}`,
  treasure: "/treasure",
} as const;
