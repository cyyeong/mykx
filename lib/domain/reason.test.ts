import { describe, expect, it } from "vitest";
import { checkReason, modelReason, stems } from "./reason.ts";

const item = {
  type: "mcq" as const,
  answer: 1,
  options: ["No. A life cycle repeats, so it has no first or last stage.", "Yes, because an adult frog cannot change any more."],
  working: ["A life cycle is a repeated pattern of change.", "Adult frogs lay eggs, the eggs hatch into tadpoles, the tadpoles grow into adults, and the adults lay eggs again.", "So there is no first or last stage."],
};

describe("checkReason", () => {
  it("needs words that use the question's ideas", () => {
    expect(checkReason(item, "because i am monk").quality).toBe("off-topic");
    expect(checkReason(item, "").quality).toBe("none");
    expect(checkReason(item, "eggs").quality).toBe("short");
    const r = checkReason(item, "Because the adult frog lays eggs again");
    expect(r.quality).toBe("on-topic");
    expect(r.used).toEqual(expect.arrayContaining(["adult", "frog", "lay", "egg"]));
  });

  it("trims plurals and simple endings", () => {
    expect(stems("tadpoles hatching repeated eggs")).toEqual(["tadpole", "hatch", "repeat", "egg"]);
  });

  it("gives a model reason from the worked steps, skipping error notes", () => {
    expect(modelReason({ working: [...item.working, "Common error: choosing yes."] })).toBe(item.working.join(" "));
    expect(modelReason({})).toBeNull();
  });
});
