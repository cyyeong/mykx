// Ari's quest from task 2: the reviewed P3 frog life cycle. Task 2e builds the
// /learn quest list; until then Learn opens this quest's map.
export const DEMO_QUEST = "frog-life-cycle";
export const DEMO_QUESTION = "p3sci-demo-01";

export const ROUTES = {
  home: "/home",
  quest: `/learn/${DEMO_QUEST}`,
  question: `/question/${DEMO_QUESTION}`,
  treasure: "/treasure",
} as const;
