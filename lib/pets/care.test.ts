// Pets (founder, 29 Oct): bars run down, moods follow them, the right food for each stage, and growth from care.
import { describe, expect, it } from "vitest";
import { adopt, barsNow, care, jobsLeft, moodOf, readyToGrow, type Action, type PetRecord } from "./care.ts";
import { FOODS, PET_IDS, PETS } from "./species.ts";

const T0 = "2026-10-29T08:00:00.000Z";
const later = (h: number) => new Date(Date.parse(T0) + h * 3_600_000).toISOString();
const run = (p: PetRecord, steps: [Action, number][]) => steps.reduce((pet, [a, h]) => care(pet, a, later(h)).pet, p);

describe("the species data", () => {
  it("gives every stage three bars, its jobs, foods from its own tray, and a reason for every wrong tray food", () => {
    for (const id of PET_IDS) {
      const sp = PETS[id];
      sp.stages.forEach((s, i) => {
        expect(new Set(s.bars).size).toBe(3);
        expect(Object.values(s.jobs).reduce((a, b) => a + (b ?? 0), 0)).toBeGreaterThan(0);
        for (const f of s.eats) expect(sp.tray).toContain(f);
        if (s.eats.length) for (const f of sp.tray) if (!s.eats.includes(f)) expect(s.wrong[f], `${id} ${s.label} ${f}`).toBeTruthy();
        if (!s.eats.length) expect(sp.notEating[i]).toBeTruthy();
        if (s.jobs.special) expect(s.special).toBeTruthy();
      });
      expect(sp.stages[3].special?.id).toBe("eggs");
      for (const f of sp.tray) expect(FOODS[f]).toBeTruthy();
    }
  });
});

describe("bars and moods", () => {
  it("run down with time at their own pace and never below zero", () => {
    const p = adopt("frog", T0);
    expect(barsNow(p, later(1))).toEqual({ food: 50, clean: 74, love: 52, warm: 52 });
    expect(barsNow(p, later(100))).toEqual({ food: 0, clean: 0, love: 0, warm: 0 });
  });

  it("make a pet happy, then hungry, sad or cross as they drop; eggs are only ever sad", () => {
    const tadpole: PetRecord = { ...adopt("frog", T0), stage: 1, bars: { food: 80, clean: 90, love: 80, warm: 80 } };
    expect(moodOf(tadpole, T0)).toBe("happy");
    expect(moodOf({ ...tadpole, bars: { ...tadpole.bars, food: 20 } }, T0)).toBe("hungry");
    expect(moodOf({ ...tadpole, bars: { ...tadpole.bars, love: 20 } }, T0)).toBe("sad");
    expect(moodOf({ ...tadpole, bars: { ...tadpole.bars, clean: 30 } }, T0)).toBe("angry");
    expect(moodOf({ ...tadpole, bars: { ...tadpole.bars, food: 30, love: 30 } }, T0)).toBe("angry");
    const spawn = { ...tadpole, stage: 0, bars: { food: 0, clean: 10, love: 10, warm: 10 } };
    expect(moodOf(spawn, T0)).toBe("sad");
  });
});

describe("care", () => {
  it("feeds only the right food for the stage, and says why the wrong one is wrong", () => {
    const tadpole: PetRecord = { ...adopt("frog", T0), stage: 1 };
    const wrong = care(tadpole, { kind: "feed", food: "cricket" }, T0);
    expect(wrong).toMatchObject({ ok: false, reaction: "no" });
    expect(wrong.say).toMatch(/bigger than me/);
    expect(wrong.pet.done).toEqual({});
    const right = care(tadpole, { kind: "feed", food: "algae" }, T0);
    expect(right).toMatchObject({ ok: true, reaction: "yum", pet: { bars: { food: 80 }, done: { feed: 1 } } });
    expect(care({ ...tadpole, stage: 3 }, { kind: "feed", food: "algae" }, T0).say).toMatch(/insects/);
    expect(care(adopt("frog", T0), { kind: "feed", food: "algae" }, T0).say).toMatch(/yolk/);
  });

  it("refuses more of the same care when a bar is full, so growing takes real time", () => {
    const tadpole: PetRecord = { ...adopt("frog", T0), stage: 1 };
    const full = run(tadpole, [[{ kind: "feed", food: "algae" }, 0], [{ kind: "feed", food: "algae" }, 0]]);
    expect(full.bars.food).toBe(100);
    expect(care(full, { kind: "feed", food: "algae" }, T0)).toMatchObject({ ok: false, reaction: "full" });
    expect(care(full, { kind: "feed", food: "algae" }, later(1.5)).ok).toBe(true);
  });

  it("grows to the next stage when the stage's jobs are done and the pet is well cared for", () => {
    let p = adopt("frog", T0);
    expect(jobsLeft(p)).toEqual([{ job: "clean", of: 1, left: 1 }, { job: "warm", of: 2, left: 2 }]);
    p = run(p, [[{ kind: "warm" }, 0], [{ kind: "clean" }, 0.1]]);
    expect(p.stage).toBe(0);
    const grew = care(p, { kind: "warm" }, later(1));
    expect(grew).toMatchObject({ ok: true, reaction: "grew", pet: { stage: 1, done: {} } });
    expect(grew.say).toMatch(/tadpole now/);
  });

  it("waits for a bar to be topped up before growing", () => {
    const p: PetRecord = { ...adopt("frog", T0), stage: 0, done: { warm: 2 }, bars: { food: 60, clean: 80, love: 20, warm: 60 } };
    const o = care(p, { kind: "clean" }, T0);
    expect(o.pet.stage).toBe(0);
    expect(o.say).toMatch(/more time with you/);
    expect(readyToGrow(o.pet, T0)).toBe(false);
    const played = care(o.pet, { kind: "talk" }, T0);
    expect(played.pet.bars.love).toBe(24);
  });

  it("lets an adult lay eggs only when its other jobs are done, starting the next generation", () => {
    const hen: PetRecord = { ...adopt("chicken", T0), stage: 3, bars: { food: 70, clean: 70, love: 70, warm: 70 } };
    expect(care(hen, { kind: "special" }, T0)).toMatchObject({ ok: false, reaction: "wait" });
    const ready = { ...hen, done: { feed: 2, clean: 1, play: 1 } };
    expect(readyToGrow(ready, T0)).toBe(true);
    const laid = care(ready, { kind: "special" }, T0);
    expect(laid).toMatchObject({ ok: true, reaction: "eggs", pet: { stage: 0, generation: 2, done: {} } });
  });

  it("is deterministic: the same care at the same times gives the same pet", () => {
    const steps: [Action, number][] = [[{ kind: "warm" }, 0], [{ kind: "special" }, 0.2], [{ kind: "warm" }, 1], [{ kind: "feed", food: "crumbs" }, 3]];
    expect(run(adopt("chicken", T0), steps)).toEqual(run(adopt("chicken", T0), steps));
  });
});
