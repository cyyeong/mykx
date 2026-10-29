import { describe, expect, it } from "vitest";
import type { SparkToolsRequest, SparkToolsResult } from "../meta/spark.ts";
import { cleanTitle, loadPack, loadSkill, packsForChild, publicItem, publicTrace, readSection, runSkillAgent, runTool, toolDefs, type AgentState } from "./runtime.ts";

const state = (over: Partial<AgentState> = {}): AgentState => ({
  agent: "tutor",
  level: "P3",
  allowed: packsForChild("P3"),
  loaded: [],
  currentItemId: null,
  notebook: [],
  reads: [],
  events: [],
  root: process.cwd(),
  ...over,
});

const run = { model: "muse-spark-1.3", operation: "chat_tools" } as unknown as SparkToolsResult["run"];
const reply = (text: string, calls: { name: string; args: unknown }[] = []): SparkToolsResult => ({
  text,
  finishReason: calls.length ? "tool_calls" : "stop",
  toolCalls: calls.map((c, i) => ({ id: `call_${i}`, type: "function", function: { name: c.name, arguments: JSON.stringify(c.args) } })),
  run,
});

describe("the Skill Engine's packs", () => {
  it("indexes a published pack's sections by id and keeps reviewed items only", () => {
    const p = loadPack("p3-science");
    expect(p?.sections.length).toBeGreaterThan(10);
    expect(p?.sections[0].id).toMatch(/^p3-science\/[a-z0-9-]+#1$/);
    expect(p?.items.every((i) => i.status === "reviewed")).toBe(true);
    expect(packsForChild("P3")).toEqual(["p3-chinese", "p3-english", "p3-maths", "p3-science"]);
    expect(packsForChild("Sec 2")).toEqual(["s2-maths", "s2-science"]);
  });

  it("reads one section, from its heading to the next one of the same level", () => {
    const p = loadPack("p3-science")!;
    const first = p.sections.find((s) => s.file === p.sections[0].file && s.id.endsWith("#1"))!;
    const r = readSection(first.id)!;
    expect(r.text.split("\n")[0]).toContain(first.title);
    const next = p.sections.find((s) => s.file === first.file && s.id.endsWith("#2"));
    if (next) expect(r.text).not.toContain(`# ${next.title}`);
    expect(readSection("p3-science/nope#1")).toBeNull();
  });

  it("never shows an agent an item's answer, working or hints", () => {
    const item = loadPack("p3-science")!.items[0];
    const seen = publicItem(item) as Record<string, unknown>;
    for (const k of ["answer", "accept", "working", "hints", "distractors", "marking"]) expect(seen[k]).toBeUndefined();
  });

  it("makes section titles fit for a child's screen", () => {
    expect(cleanTitle("3. Animal groups (`animal_groups`)")).toBe("Animal groups");
    expect(cleanTitle("Depth limits — what NOT to teach")).toBe("Depth limits — what NOT to teach");
  });
});

describe("the loading policy", () => {
  it("loads the child's own packs only, two at a time, and records every load and refusal", () => {
    const s = state();
    expect(loadSkill(s, "p3-science", "auto")).toEqual({ ok: true });
    expect(loadSkill(s, "p6-maths", "on_demand")).toMatchObject({ ok: false });
    expect(loadSkill(s, "p3-maths", "on_demand")).toEqual({ ok: true });
    expect(loadSkill(s, "p3-english", "on_demand")).toMatchObject({ ok: false, reason: "at most 2 packs at once" });
    expect(s.loaded).toEqual(["p3-science", "p3-maths"]);
    expect(s.events.map((e) => [e.kind, e.pack, e.ok])).toEqual([
      ["load", "p3-science", true],
      ["refuse", "p6-maths", false],
      ["load", "p3-maths", true],
      ["refuse", "p3-english", false],
    ]);
  });

  it("offers each agent its own tools, with load_skill limited to the child's packs", () => {
    const s = state();
    const names = toolDefs(s).map((t) => (t.type === "function" ? t.function.name : ""));
    expect(names).toEqual(["load_skill", "read_reference", "find_items", "check_answer", "notebook_read"]);
    expect(toolDefs(state({ agent: "ask-kix" })).map((t) => (t.type === "function" ? t.function.name : ""))).not.toContain("check_answer");
    const load = toolDefs(s)[0];
    expect(load.type === "function" && (load.function.parameters as { properties: { pack: { enum: string[] } } }).properties.pack.enum).toEqual(packsForChild("P3"));
  });
});

describe("the tools", () => {
  it("refuses a section from a pack that isn't loaded, and reads one that is", () => {
    const s = state();
    const id = loadPack("p3-science")!.sections[0].id;
    expect(runTool(s, "read_reference", JSON.stringify({ section: id }))).toMatch(/^Refused/);
    loadSkill(s, "p3-science", "auto");
    expect(runTool(s, "read_reference", JSON.stringify({ section: id }))).toContain(loadPack("p3-science")!.sections[0].title);
    expect(s.reads).toHaveLength(1);
  });

  it("never checks the child's current question, and marks another one by code", () => {
    const items = loadPack("p3-science")!.items.filter((i) => i.type === "mcq");
    const [current, other] = items;
    const s = state({ currentItemId: current.id });
    loadSkill(s, "p3-science", "auto");
    expect(runTool(s, "check_answer", JSON.stringify({ item_id: current.id, answer: String(current.answer) }))).toMatch(/^Refused/);
    expect(runTool(s, "check_answer", JSON.stringify({ item_id: other.id, answer: String(other.answer) }))).toBe("correct");
    const wrong = ((Number(other.answer) % (other.options?.length ?? 2)) + 1).toString();
    expect(runTool(s, "check_answer", JSON.stringify({ item_id: other.id, answer: wrong }))).toBe("not correct");
    expect(s.events.find((e) => e.tool === "check_answer" && e.kind === "refuse")?.target).toBe(current.id);
  });

  it("finds practice items without answers, skipping the current one", () => {
    const p = loadPack("p3-science")!;
    const s = state({ currentItemId: p.items[0].id });
    loadSkill(s, "p3-science", "auto");
    const found = JSON.parse(runTool(s, "find_items", JSON.stringify({ pack: "p3-science", n: 3 }))) as { id: string; answer?: unknown }[];
    expect(found.length).toBeGreaterThan(0);
    expect(found.some((f) => f.id === p.items[0].id)).toBe(false);
    expect(found.every((f) => f.answer === undefined)).toBe(true);
  });

  it("reads a Notebook page, and refuses tools the agent doesn't have", () => {
    const s = state({ agent: "ask-kix", notebook: [{ slug: "asking", body: "Asks why before trying.", updatedAt: "2026-10-28T00:00:00Z" }] });
    expect(runTool(s, "notebook_read", JSON.stringify({ page: "asking" }))).toBe("Asks why before trying.");
    expect(runTool(s, "check_answer", JSON.stringify({ item_id: "x", answer: "1" }))).toMatch(/not available/);
  });
});

describe("the agent loop", () => {
  it("runs the tools Muse Spark asks for, hands back the results, and returns its answer with a trace", async () => {
    const section = loadPack("p3-science")!.sections[0];
    const calls: SparkToolsRequest[] = [];
    const out = await runSkillAgent({
      agent: "tutor",
      level: "P3",
      autoPack: "p3-science",
      system: "You are Kix.",
      user: { role: "user", content: "why?" },
      call: async (req) => {
        calls.push(structuredClone(req));
        return calls.length === 1 ? reply("", [{ name: "read_reference", args: { section: section.id } }]) : reply("Look at what changes first.");
      },
    });
    expect(out.text).toBe("Look at what changes first.");
    expect(out.rounds).toBe(2);
    expect(String(calls[0].messages[0].content)).toContain(section.id);
    const toolMsg = calls[1].messages.find((m) => m.role === "tool");
    expect(String(toolMsg?.content)).toContain(section.title);
    expect(publicTrace(out.state)).toEqual({ loaded: ["p3-science"], read: [cleanTitle(section.title)] });
    expect(out.state.events.map((e) => e.kind)).toEqual(["load", "tool"]);
  });

  it("makes the model answer once the rounds run out", async () => {
    const section = loadPack("p3-science")!.sections[0].id;
    const choices: (string | undefined)[] = [];
    const out = await runSkillAgent({
      agent: "tutor",
      level: "P3",
      autoPack: "p3-science",
      system: "s",
      user: { role: "user", content: "u" },
      call: async (req) => {
        choices.push(req.toolChoice);
        return req.toolChoice === "none" ? reply("Done.") : reply("", [{ name: "read_reference", args: { section } }]);
      },
    });
    expect(out.text).toBe("Done.");
    expect(choices).toEqual(["auto", "auto", "auto", "none"]);
  });
});
