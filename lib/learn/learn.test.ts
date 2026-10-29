// Every kid's subjects, sessions and word cards (founder, 29 Oct): scoped to the kid's own level, chosen by code,
// and marked by code. Runs against the packs on disk and the in-memory demo store (synthetic data only).
import { randomUUID } from "node:crypto";
import { beforeEach, describe, expect, it } from "vitest";
import { ABBY_ID, DEMO_HOUSEHOLD_ID, JORDAN_ID, LEONARD_ID } from "../auth/demo-family.ts";
import { resetDemoStore, type DemoStore } from "../auth/store-demo.ts";
import { familyOf } from "../domain/attempts.ts";
import { markItem } from "../domain/marking.ts";
import { attempt } from "../domain/test-helpers.ts";
import { FROG_QUEST } from "./frog-quest.ts";
import { cardQuestion, cardResponse, cleanMeaning } from "./cards.ts";
import { subskillName } from "./names.ts";
import { cardForRef, rewardCards } from "./reward-cards.ts";
import { needsPaper, parseSession, planSession, SESSION_MAX_ITEMS, sessionStep, sessionSummary, startHref } from "./session.ts";
import { findItem, itemForKid, subjectFor, subjectsFor } from "./subjects.ts";
import { cardFor, submitAttempt, type AttemptInput } from "./submit.ts";
import { subjectView } from "./views.ts";

const NOW = "2026-10-29T09:00:00.000Z";
const CJK = /[㐀-鿿]/u;

describe("a kid's subjects are their level's packs", () => {
  it("gives Jordan (P3) four subjects, Abby (P6) two and Leonard (Sec 2) two, in school order", () => {
    expect(subjectsFor("P3").map((s) => s.id)).toEqual(["p3-english", "p3-maths", "p3-science", "p3-chinese"]);
    expect(subjectsFor("P6").map((s) => s.id)).toEqual(["p6-maths", "p6-science"]);
    expect(subjectsFor("Sec 2").map((s) => s.id)).toEqual(["s2-maths", "s2-science"]);
    expect(subjectsFor(null)).toEqual([]);
    expect(subjectsFor("P4")).toEqual([]);
  });

  it("serves only reviewed items from the subject's own pack and level", () => {
    for (const level of ["P3", "P6", "Sec 2"]) {
      for (const s of subjectsFor(level)) {
        expect(s.level).toBe(level);
        expect(s.items.length).toBeGreaterThan(0);
        expect(s.items.every((i) => i.skill === s.id && i.status === "reviewed")).toBe(true);
        expect(s.topics.length).toBeGreaterThan(0);
      }
    }
  });

  it("finds an item with its pack version, and refuses another level's item", () => {
    expect(findItem("p3sci-demo-01")?.subject).toMatchObject({ id: "p3-science", version: FROG_QUEST.version });
    expect(itemForKid("P3", "p3sci-demo-01")).toMatchObject({ ok: true, subject: { id: "p3-science" } });
    expect(itemForKid("P6", "p3sci-demo-01")).toEqual({ ok: false, reason: "other-level" });
    expect(itemForKid("Sec 2", "p3sci-demo-01")).toEqual({ ok: false, reason: "other-level" });
    expect(itemForKid(null, "p3sci-demo-01")).toEqual({ ok: false, reason: "other-level" });
    expect(itemForKid("P3", "nope")).toEqual({ ok: false, reason: "not-found" });
    expect(subjectFor("P6", "p3-science")).toBeNull();
    expect(subjectFor("Sec 2", "s2-science")?.name).toBe("Science");
  });

  it("spells subskill ids out for a child", () => {
    expect(subskillName("tense_simple_present")).toBe("Tense simple present");
    expect(subskillName("sva")).toBe("Subject-verb agreement");
    expect(subskillName("tables_6_9")).toBe("Tables 6 to 9");
    expect(subskillName("convert_h_min")).toBe("Convert hours and minutes");
  });
});

describe("Start session: code chooses from the chosen subject only", () => {
  for (const level of ["P3", "P6", "Sec 2"]) {
    for (const subject of subjectsFor(level)) {
      it(`${subject.id}: a few picks, all from ${subject.id}, never a drawing question`, () => {
        const plan = planSession(subject, [], NOW, "kid:2026-10-29");
        expect(plan.itemIds.length).toBeGreaterThan(0);
        expect(plan.itemIds.length).toBeLessThanOrEqual(SESSION_MAX_ITEMS);
        const items = plan.itemIds.map((id) => subject.items.find((i) => i.id === id));
        expect(items.every((i) => i && i.skill === subject.id)).toBe(true);
        expect(items.some((i) => i && needsPaper(i))).toBe(false);
        // At most one written question family, and it comes last.
        const writtenFamilies = new Set(items.filter((i) => i?.type === "open").map((i) => familyOf(i!)));
        expect(writtenFamilies.size).toBeLessThanOrEqual(1);
        expect(startHref(subject.id, plan.itemIds)).toBe(`/question/${plan.itemIds[0]}?session=${plan.itemIds.join(",")}`);
      });
    }
  }

  it("is deterministic, and a topic session stays in its topic", () => {
    const maths = subjectFor("P6", "p6-maths")!;
    expect(planSession(maths, [], NOW, "abby:2026-10-29")).toEqual(planSession(maths, [], NOW, "abby:2026-10-29"));
    const plan = planSession(maths, [], NOW, "abby:2026-10-29", { topic: "number.ratio" });
    expect(plan.itemIds.length).toBeGreaterThan(0);
    expect(plan.itemIds.every((id) => maths.items.find((i) => i.id === id)?.topic === "number.ratio")).toBe(true);
  });

  it("never repeats a family practised this week, and falls back to an honest empty state", () => {
    const s2 = subjectFor("Sec 2", "s2-science")!;
    const first = planSession(s2, [], NOW, "leonard");
    const done = first.itemIds.map((id) => {
      const item = s2.items.find((i) => i.id === id)!;
      return attempt({ itemId: id, family: familyOf(item), skill: s2.id, topic: item.topic, subskill: item.subskill, at: NOW });
    });
    const second = planSession(s2, done, NOW, "leonard");
    const seen = new Set(done.map((a) => a.family));
    expect(second.itemIds.some((id) => seen.has(familyOf({ id })))).toBe(false);
    // Everything tried this week: no session, and the view says why.
    const all = s2.items.map((i) => attempt({ itemId: i.id, family: familyOf(i), skill: s2.id, topic: i.topic, subskill: i.subskill, at: NOW }));
    const view = subjectView(s2, all, NOW, "leonard", "idol-stage");
    expect(view.next).toBeNull();
    expect(view.empty).toMatch(/tried every question here this week/);
  });

  it("checks session ids against the subject and steps through them to the done page", () => {
    const maths = subjectFor("P3", "p3-maths")!;
    const ids = planSession(maths, [], NOW, "jordan").itemIds;
    expect(parseSession(`${ids.join(",")},p3sci-demo-01,nope,${ids[0]}`, maths)).toEqual(ids);
    expect(parseSession("p6maths-x,nope", maths)).toBeNull();
    expect(sessionStep(maths.id, ids, ids[0])).toMatchObject({ position: 1, total: ids.length, doneCount: 0, nextId: ids[1] ?? null });
    expect(sessionStep(maths.id, ids, ids[ids.length - 1]).nextHref).toBe(`/learn/p3-maths/done?session=${ids.join(",")}`);
  });

  it("shows a thin pack honestly: Sec 2 Science has questions for one topic of eight", () => {
    const view = subjectView(subjectFor("Sec 2", "s2-science")!, [], NOW, "leonard", "idol-stage");
    expect(view.ready).toBe(1);
    expect(view.topics).toHaveLength(8);
    expect(view.gap).toMatch(/one of eight topics.*More Sec 2 Science topics are on the way/);
    expect(view.topics[0].title).toBe("Electrical systems"); // topics with questions come first
    expect(view.topics.slice(1).every((t) => t.mastery === null && t.startHref === null && /on the way/.test(t.empty ?? ""))).toBe(true);
  });

  it("labels evidence honestly: no number until a family is answered", () => {
    const sci = subjectFor("P3", "p3-science")!;
    const fresh = subjectView(sci, [], NOW, "jordan", "terrarium", []);
    expect(fresh.topics.every((t) => t.mastery === null && t.evidence === "Not yet assessed")).toBe(true);
    const item = sci.items.find((i) => i.topic === "cycles.animal" && i.type === "mcq")!;
    const one = [attempt({ itemId: item.id, family: familyOf(item), skill: sci.id, topic: item.topic, subskill: item.subskill, at: NOW })];
    const after = subjectView(sci, one, NOW, "jordan", "terrarium", []);
    const topic = after.topics.find((t) => t.id === "cycles.animal")!;
    expect(topic.mastery).not.toBeNull();
    expect(topic.evidence).toBe("Limited evidence · 1 family");
    expect(topic.subskills.find((s) => s.id === item.subskill)?.label).toMatch(/limited evidence: one family/);
  });
});

describe("word cards: code marks them, a self-check never counts", () => {
  const chinese = subjectFor("P3", "p3-chinese")!;
  const cards = chinese.items.filter((i) => i.type === "card");

  it("never shows the word's own characters in a meaning", () => {
    for (const c of cards) expect(CJK.test(cleanMeaning(c))).toBe(false);
  });

  it("builds four distinct meanings with the right one among them, the same way every time", () => {
    for (const c of cards.filter((i) => i.subskill === "recognise").slice(0, 60)) {
      const q = cardQuestion(c, cards);
      if (q.mode !== "meaning") continue;
      expect(q.options).toHaveLength(4);
      expect(new Set(q.options).size).toBe(4);
      expect(q.options[(q.markable.answer as number) - 1]).toBe(cleanMeaning(c));
      expect(q.options.some((o) => CJK.test(o))).toBe(false);
      expect(cardQuestion(c, cards)).toEqual(q);
    }
  });

  it("marks a typed word by exact match, spaces ignored", () => {
    const write = cards.find((i) => i.subskill === "write" && i.stem.length >= 2) ?? cards.find((i) => i.subskill === "write")!;
    const q = cardQuestion(write, cards);
    expect(q.mode).toBe("write");
    expect(q.options).toEqual([]);
    expect(q.meaning === null || !CJK.test(q.meaning)).toBe(true);
    const spaced = [...write.stem].join(" ");
    expect(markItem(q.markable, cardResponse("write", spaced))).toMatchObject({ correct: true, confirmed: true });
    expect(markItem(q.markable, cardResponse("write", `${write.stem}了`))).toMatchObject({ correct: false });
  });
});

describe("submitting any item of the kid's own subjects", () => {
  let store: DemoStore;
  beforeEach(() => {
    store = resetDemoStore();
  });
  const input = (p: Partial<AttemptInput> & { itemId: string }): AttemptInput => ({ response: null, explanation: null, hintsUsed: 0, revealed: false, key: randomUUID(), ...p });

  it("refuses another level's item for every kid", async () => {
    await expect(submitAttempt(store, DEMO_HOUSEHOLD_ID, ABBY_ID, input({ itemId: "p3sci-demo-01", response: 2 }))).rejects.toThrow("other-level");
    const p6 = subjectFor("P6", "p6-maths")!.items[0].id;
    await expect(submitAttempt(store, DEMO_HOUSEHOLD_ID, JORDAN_ID, input({ itemId: p6, response: 1 }))).rejects.toThrow("other-level");
    await expect(submitAttempt(store, DEMO_HOUSEHOLD_ID, LEONARD_ID, input({ itemId: p6, response: 1 }))).rejects.toThrow("other-level");
    expect(await store.learn.attempts(DEMO_HOUSEHOLD_ID, ABBY_ID)).toHaveLength(0);
  });

  it("marks Abby's P6 multiple choice and stamps the pack version", async () => {
    const maths = subjectFor("P6", "p6-maths")!;
    const item = maths.items.find((i) => i.type === "mcq")!;
    const r = await submitAttempt(store, DEMO_HOUSEHOLD_ID, ABBY_ID, input({ itemId: item.id, response: item.answer as number }));
    expect(r).toMatchObject({ correct: true, kind: "marked", firstTry: true });
    expect(r.mastery).toMatch(/limited evidence: one family/);
  });

  it("marks a word card's meaning by code: mastery evidence, but no stars without a reason", async () => {
    const chinese = subjectFor("P3", "p3-chinese")!;
    const card = chinese.items.find((i) => i.type === "card" && i.subskill === "recognise")!;
    const q = cardFor(card, chinese);
    const r = await submitAttempt(store, DEMO_HOUSEHOLD_ID, JORDAN_ID, input({ itemId: card.id, response: q.markable.answer as number, explanation: "I just know" }));
    expect(r).toMatchObject({ correct: true, kind: "card", awards: [] });
    expect(r.mastery).toMatch(/^\d+\/100; limited evidence/);
  });

  it("logs 'I wrote it on paper: show me' as practice, never as mastery evidence", async () => {
    const chinese = subjectFor("P3", "p3-chinese")!;
    const card = chinese.items.find((i) => i.type === "card" && i.subskill === "write")!;
    const r = await submitAttempt(store, DEMO_HOUSEHOLD_ID, JORDAN_ID, input({ itemId: card.id, response: null, revealed: true }));
    expect(r.answer).toBe(card.stem.replace(/\s+/g, ""));
    expect(r.mastery).toBe("Not yet assessed");
    const [saved] = await store.learn.attempts(DEMO_HOUSEHOLD_ID, JORDAN_ID);
    expect(saved).toMatchObject({ revealed: true });
  });

  it("saves a written answer as practice: unmarked, unconfirmed, then Kix's model answer", async () => {
    const s2 = subjectFor("Sec 2", "s2-science")!;
    const open = s2.items.find((i) => i.type === "open")!;
    await expect(submitAttempt(store, DEMO_HOUSEHOLD_ID, LEONARD_ID, input({ itemId: open.id, response: "  " }))).rejects.toThrow("invalid");
    const r = await submitAttempt(store, DEMO_HOUSEHOLD_ID, LEONARD_ID, input({ itemId: open.id, response: "The voltmeter measures the potential difference across R2." }));
    expect(r).toMatchObject({ correct: null, marks: null, kind: "written", answer: open.answer });
    expect(r.mastery).toBe("Not yet assessed");
    const [saved] = await store.learn.attempts(DEMO_HOUSEHOLD_ID, LEONARD_ID);
    expect(saved).toMatchObject({ confirmed: false, skill: "s2-science" });
    const summary = sessionSummary([open.id], await store.learn.attempts(DEMO_HOUSEHOLD_ID, LEONARD_ID), new Date().toISOString(), s2.items);
    expect(summary).toMatchObject({ attempted: 1, correct: 0, written: 1 });
  });
});

describe("reward cards for every subject", () => {
  it("titles a card by its topic with the subject's chip and existing art, never an item id", () => {
    const subjects = subjectsFor("P6");
    const cards = rewardCards(subjects, "anime-sky");
    const item = subjects[0].items[0];
    expect(cards[item.id]).toMatchObject({ chip: "P6 Maths", art: "/art/kix/anime-sky" });
    const forces = subjects[1].items.find((i) => i.topic === "interactions.forces")!;
    expect(cards[forces.id]).toMatchObject({ label: "Forces and magnets", art: "/art/cards/forces", chip: "P6 Science" });
    expect(cardForRef("p6-science/energy.light/shadows#x", cards, subjects, "anime-sky")).toMatchObject({ label: "Light", art: "/art/cards/light-and-shadows" });
    expect(cardForRef("p3-science/cycles.animal/x#y", cards, subjects, "anime-sky")).toBeNull();
    expect(rewardCards(subjectsFor("P3"), "terrarium")["p3sci-demo-02"]).toMatchObject({ label: "Pip the tadpole", chip: "P3 Science" });
  });
});
