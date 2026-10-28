import { describe, expect, it } from "vitest";
import { DEFAULT_PREFS, bearerToken, camerasOn, forbiddenRoom, newDeviceToken, newPairCode, normalizePairCode, roomKindOf, sha256Hex } from "./home-watch.ts";

describe("home watch", () => {
  it("makes readable pair codes and long device tokens, and forgives how a code is typed", () => {
    const code = newPairCode();
    expect(code).toMatch(/^[0-9A-HJKMNP-TV-Z]{4}-[0-9A-HJKMNP-TV-Z]{4}$/);
    expect(normalizePairCode(code.toLowerCase())).toBe(code.replace("-", ""));
    expect(normalizePairCode("k7q4 mz2p")).toBe("K7Q4MZ2P");
    expect(normalizePairCode("O1LI")).toBe("0111");
    const token = newDeviceToken();
    expect(token.startsWith("hl_")).toBe(true);
    expect(sha256Hex(token)).toHaveLength(64);
    expect(bearerToken(new Request("https://x", { headers: { authorization: `Bearer ${token}` } }))).toBe(token);
    expect(bearerToken(new Request("https://x", { headers: { authorization: "Bearer nope" } }))).toBeNull();
  });

  it("knows rooms, and refuses bathrooms and bedrooms", () => {
    expect(roomKindOf("Living room")).toBe("living");
    expect(roomKindOf("Kitchen")).toBe("kitchen");
    expect(roomKindOf("Balcony")).toBe("other");
    for (const r of ["Bedroom", "Master bedroom", "Kids' bed room", "Bathroom", "Toilet"]) expect(forbiddenRoom(r)).toBe(true);
    for (const r of ["Living room", "Study", "Entrance"]) expect(forbiddenRoom(r)).toBe(false);
  });

  it("runs the cameras on the parent's days and hours, Singapore time, unless paused", () => {
    expect(camerasOn(DEFAULT_PREFS, new Date("2026-10-30T07:00:00Z"))).toBe(true); // Fri 15:00
    expect(camerasOn(DEFAULT_PREFS, new Date("2026-10-30T12:00:00Z"))).toBe(false); // Fri 20:00
    expect(camerasOn(DEFAULT_PREFS, new Date("2026-10-31T07:00:00Z"))).toBe(false); // Sat
    expect(camerasOn({ ...DEFAULT_PREFS, camsPausedUntil: "2026-10-30T08:00:00Z" }, new Date("2026-10-30T07:00:00Z"))).toBe(false);
  });
});
