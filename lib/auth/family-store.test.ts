// Family messages and the Notebook in the demo store (synthetic data only).
import { beforeEach, describe, expect, it } from "vitest";
import { messageBody } from "../family/messages.ts";
import { JORDAN_ID, DEMO_HOUSEHOLD_ID, DEMO_PARENT_ID, OTHER_HOUSEHOLD_ID, OTHER_PARENT_ID, ABBY_ID } from "./demo-family.ts";
import { resetDemoStore, type DemoStore } from "./store-demo.ts";

let store: DemoStore;
beforeEach(() => {
  store = resetDemoStore();
});

describe("family messages", () => {
  it("keeps a thread between two people, oldest first, and counts unread", async () => {
    await store.family.send(DEMO_HOUSEHOLD_ID, { from: DEMO_PARENT_ID, to: JORDAN_ID, body: "Proud of you!", sticker: null, byVoice: false });
    await store.family.send(DEMO_HOUSEHOLD_ID, { from: DEMO_PARENT_ID, to: ABBY_ID, body: null, sticker: "hug", byVoice: false });
    await store.family.send(DEMO_HOUSEHOLD_ID, { from: JORDAN_ID, to: DEMO_PARENT_ID, body: "Thank you!", sticker: "love", byVoice: true });
    const thread = await store.family.thread(DEMO_HOUSEHOLD_ID, DEMO_PARENT_ID, JORDAN_ID);
    expect(thread.map((m) => m.body)).toEqual(["Proud of you!", "Thank you!"]);
    expect(thread[1]).toMatchObject({ sticker: "love", byVoice: true, readAt: null });
    const unread = await store.family.unread(DEMO_HOUSEHOLD_ID, JORDAN_ID);
    expect(unread).toHaveLength(1);
    await store.family.markRead(DEMO_HOUSEHOLD_ID, JORDAN_ID, [unread[0].id]);
    expect(await store.family.unread(DEMO_HOUSEHOLD_ID, JORDAN_ID)).toHaveLength(0);
  });

  it("never sends across households", async () => {
    expect(await store.family.send(DEMO_HOUSEHOLD_ID, { from: DEMO_PARENT_ID, to: OTHER_PARENT_ID, body: "hi", sticker: null, byVoice: false })).toBeNull();
    expect(await store.family.send(OTHER_HOUSEHOLD_ID, { from: OTHER_PARENT_ID, to: JORDAN_ID, body: "hi", sticker: null, byVoice: false })).toBeNull();
    expect(await store.family.thread(OTHER_HOUSEHOLD_ID, DEMO_PARENT_ID, JORDAN_ID)).toEqual([]);
  });

  it("lists the household's grown-ups only", async () => {
    expect((await store.family.grownUps(DEMO_HOUSEHOLD_ID)).map((g) => g.id)).toEqual([DEMO_PARENT_ID]);
  });

  it("needs words or a sticker, and caps the words", () => {
    expect(messageBody.safeParse({}).success).toBe(false);
    expect(messageBody.safeParse({ sticker: "party" }).success).toBe(true);
    expect(messageBody.safeParse({ sticker: "skull" }).success).toBe(false);
    expect(messageBody.safeParse({ body: "x".repeat(301) }).success).toBe(false);
  });
});

describe("notebook", () => {
  it("writes pages with a revision each, and a wipe removes both", async () => {
    await store.notebook.write(DEMO_HOUSEHOLD_ID, JORDAN_ID, "asking", "2026-10-29: asks why", "memory-keeper", "three why questions");
    await store.notebook.write(DEMO_HOUSEHOLD_ID, JORDAN_ID, "asking", "2026-10-29: asks why\n2026-10-29: likes pictures", "grown-up", null);
    expect(await store.notebook.pages(DEMO_HOUSEHOLD_ID, JORDAN_ID)).toHaveLength(1);
    const revs = await store.notebook.revisions(DEMO_HOUSEHOLD_ID, JORDAN_ID, 10);
    expect(revs.map((r) => r.by)).toEqual(["grown-up", "memory-keeper"]);
    expect(revs[0].before).toBe("2026-10-29: asks why");
    await store.notebook.wipe(DEMO_HOUSEHOLD_ID, JORDAN_ID);
    expect(await store.notebook.pages(DEMO_HOUSEHOLD_ID, JORDAN_ID)).toEqual([]);
    expect(await store.notebook.revisions(DEMO_HOUSEHOLD_ID, JORDAN_ID, 10)).toEqual([]);
  });

  it("ignores another household's kid", async () => {
    await store.notebook.write(OTHER_HOUSEHOLD_ID, JORDAN_ID, "asking", "nope", "grown-up", null);
    expect(await store.notebook.pages(DEMO_HOUSEHOLD_ID, JORDAN_ID)).toEqual([]);
  });

  it("keeps one reading per session start", async () => {
    const read = { sessionStart: "2026-10-29T10:00:00.000Z", sessionEnd: "2026-10-29T10:20:00.000Z", mood: "curious", confidence: "medium" as const, evidence: ["why"], concern: false };
    await store.notebook.saveRead(DEMO_HOUSEHOLD_ID, JORDAN_ID, read);
    await store.notebook.saveRead(DEMO_HOUSEHOLD_ID, JORDAN_ID, { ...read, mood: "happy" });
    const reads = await store.notebook.reads(DEMO_HOUSEHOLD_ID, JORDAN_ID, "2026-10-29T00:00:00.000Z");
    expect(reads.map((r) => r.mood)).toEqual(["happy"]);
  });
});
