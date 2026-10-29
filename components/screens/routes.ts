// Jordan's quest from task 2: the reviewed P3 frog life cycle, P3 Science's featured quest. The Learn tab opens the
// /learn hub (every kid's own subjects, lib/learn/subjects.ts); these are the frog quest's own routes, used by
// Home's sample data.
export const DEMO_QUEST = "frog-life-cycle";
export const DEMO_QUESTION = "p3sci-demo-01";

export const ROUTES = {
  home: "/home",
  learn: "/learn",
  quest: `/learn/${DEMO_QUEST}`,
  question: `/question/${DEMO_QUESTION}`,
  treasure: "/treasure",
} as const;
