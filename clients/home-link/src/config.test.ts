import { readFileSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { forbiddenRoom as serverForbiddenRoom } from "../../../lib/home-watch/home-watch.ts";
import { MAX_CAMERAS, checkServer, configPath, emptyConfig, forbiddenRoom, loadConfig, maskUrl, publicCamera, redact, saveConfig, secretsOf, sourceOf, splitCredentials, validateCamera, type CameraConfig } from "./config.ts";
import { tempDir } from "./testkit.ts";

const ok = { room: "Kitchen", url: "http://192.168.1.31/snap.jpg", intervalSec: 60, privacyConfirmed: true };
const cams = (n: number): CameraConfig[] => Array.from({ length: n }, (_, i) => ({ key: `cam-${i}`, room: `Room ${i}`, url: "http://10.0.0.1/a.jpg", intervalSec: 60, enabled: true, privacyConfirmed: true }));
const dirs: { remove: () => void }[] = [];
const tmp = () => {
  const t = tempDir();
  dirs.push(t);
  return t.dir;
};
afterEach(() => dirs.splice(0).forEach((d) => d.remove()));

describe("rooms no camera may see", () => {
  const rooms = ["Master bedroom", "bed room", "Bedroom 2", "kids BEDROOM", "Bathroom", "Toilet", "Washroom", "Shower room", "WC", "Changing room", "ensuite bath", "Living room", "Kitchen", "Study", "Entrance", "Dining area", "Bedford corridor", "Helper's room", "Garden"];

  it("is refused here exactly as myKx refuses it", () => {
    for (const room of rooms) expect(forbiddenRoom(room), room).toBe(serverForbiddenRoom(room));
  });

  it("covers bathrooms and every kind of bedroom", () => {
    for (const room of ["Master bedroom", "bed room", "Bathroom", "Toilet", "Washroom", "Shower room", "WC", "Changing room"]) expect(forbiddenRoom(room), room).toBe(true);
    for (const room of ["Living room", "Kitchen", "Study", "Entrance"]) expect(forbiddenRoom(room), room).toBe(false);
  });
});

describe("saving a camera", () => {
  it("takes a good one, with a key made from the room", () => {
    const r = validateCamera(ok, []);
    expect(r).toMatchObject({ ok: true, camera: { key: "kitchen", room: "Kitchen", intervalSec: 60, enabled: true, privacyConfirmed: true } });
  });

  it("refuses a bathroom or a bedroom, with words", () => {
    for (const room of ["Master Bedroom", "Bathroom", "Guest bed room"]) {
      expect(validateCamera({ ...ok, room }, [])).toMatchObject({ ok: false, field: "room", message: expect.stringMatching(/bathroom or any bedroom/) });
    }
  });

  it("needs a room of 1 to 40 letters", () => {
    expect(validateCamera({ ...ok, room: "  " }, [])).toMatchObject({ ok: false, field: "room" });
    expect(validateCamera({ ...ok, room: "x".repeat(41) }, [])).toMatchObject({ ok: false, field: "room" });
    expect(validateCamera({ ...ok, room: "x".repeat(40) }, [])).toMatchObject({ ok: true });
  });

  it("stops at 10 cameras, but still lets you change one of them", () => {
    expect(MAX_CAMERAS).toBe(10);
    expect(validateCamera(ok, cams(10))).toMatchObject({ ok: false, field: "cameras" });
    expect(validateCamera(ok, cams(9))).toMatchObject({ ok: true });
    expect(validateCamera({ ...ok, key: "cam-3", room: "Hall" }, cams(10))).toMatchObject({ ok: true, camera: { key: "cam-3", room: "Hall" } });
  });

  it("takes an interval from 10 seconds to 10 minutes, nothing outside", () => {
    for (const intervalSec of [10, 30, 60, 90, 300, 600]) expect(validateCamera({ ...ok, intervalSec }, [])).toMatchObject({ ok: true });
    for (const intervalSec of [9, 0, -5, 601, 3600, Number.NaN, "60"]) expect(validateCamera({ ...ok, intervalSec }, []), String(intervalSec)).toMatchObject({ ok: false, field: "intervalSec" });
  });

  it("uses 60 seconds when none is given", () => {
    expect(validateCamera({ room: "Study", url: ok.url, privacyConfirmed: true }, [])).toMatchObject({ ok: true, camera: { intervalSec: 60 } });
  });

  it("is not saved without the privacy confirmation", () => {
    for (const privacyConfirmed of [false, undefined, "true", 1]) expect(validateCamera({ ...ok, privacyConfirmed }, []), String(privacyConfirmed)).toMatchObject({ ok: false, field: "privacyConfirmed" });
  });

  it("wants an http, https or rtsp address", () => {
    for (const url of ["", "not a url", "ftp://host/x", "file:///etc/passwd", "javascript:alert(1)", "http://", "http://host/a b"]) expect(validateCamera({ ...ok, url }, []), url).toMatchObject({ ok: false, field: "url" });
    for (const url of ["http://h/s.jpg", "https://h/s.jpg", "rtsp://u:p@h:554/x", "rtsps://h/x"]) expect(validateCamera({ ...ok, url }, [])).toMatchObject({ ok: true });
  });

  it("keeps the saved address, and its password, when a change leaves it out", () => {
    const saved: CameraConfig = { key: "kitchen", room: "Kitchen", url: "rtsp://admin:hunter2@10.0.0.5/live", intervalSec: 60, enabled: true, privacyConfirmed: true };
    const r = validateCamera({ key: "kitchen", room: "Kitchen", intervalSec: 30, privacyConfirmed: true }, [saved]);
    expect(r).toMatchObject({ ok: true, camera: { url: saved.url, intervalSec: 30 } });
  });

  it("gives each camera its own key", () => {
    const first = validateCamera(ok, []);
    if (!first.ok) throw new Error("expected ok");
    const second = validateCamera(ok, [first.camera]);
    expect(second).toMatchObject({ ok: true, camera: { key: "kitchen-2" } });
    expect(validateCamera({ ...ok, room: "Café!!" }, [])).toMatchObject({ camera: { key: expect.stringMatching(/^[\w-]{1,40}$/) } });
  });
});

describe("keeping passwords private", () => {
  const url = "rtsp://admin:p%40ss@192.168.1.23:554/stream1";

  it("masks the user name and password in an address", () => {
    expect(maskUrl(url)).toBe("rtsp://••••@192.168.1.23:554/stream1");
    expect(maskUrl("http://u:pw@cam.local/snap.jpg?x=1")).toBe("http://••••@cam.local/snap.jpg?x=1");
    expect(maskUrl("http://192.168.1.40/onvif/snapshot.jpg")).toBe("http://192.168.1.40/onvif/snapshot.jpg");
  });

  it("masks a password in the query too", () => {
    expect(maskUrl("http://cam/snap.jpg?user=admin&pwd=hunter2&size=big")).toBe("http://cam/snap.jpg?user=••••&pwd=••••&size=big");
  });

  it("masks a password that contains an @", () => {
    expect(maskUrl("rtsp://admin:p@ss@host/path")).toBe("rtsp://••••@host/path");
  });

  it("never gives the page the address, only the masked one", () => {
    const pub = publicCamera({ key: "k", room: "Study", url, intervalSec: 60, enabled: true, privacyConfirmed: true });
    expect(JSON.stringify(pub)).not.toMatch(/admin|p%40ss|p@ss/);
    expect(pub).toMatchObject({ address: "rtsp://••••@192.168.1.23:554/stream1", source: "rtsp" });
  });

  it("scrubs a password, in any spelling, out of text", () => {
    const said = `Error opening ${url}: Connection refused (admin / p@ss / p%40ss)`;
    const out = redact(said, url);
    expect(out).not.toMatch(/admin|p%40ss|p@ss/);
    expect(secretsOf(url)).toEqual(expect.arrayContaining(["admin", "p%40ss", "p@ss"]));
  });

  it("moves the credentials out of the address and into a Basic header", () => {
    const { url: clean, authorization } = splitCredentials("http://admin:p%40ss@192.168.1.23/snap.jpg?x=1");
    expect(clean).toBe("http://192.168.1.23/snap.jpg?x=1");
    expect(authorization).toBe(`Basic ${Buffer.from("admin:p@ss").toString("base64")}`);
    expect(splitCredentials("http://cam/x.jpg")).toEqual({ url: "http://cam/x.jpg", authorization: null });
  });

  it("tells a snapshot address from an RTSP one", () => {
    expect([sourceOf("rtsp://h/x"), sourceOf("RTSPS://h/x"), sourceOf("http://h/x"), sourceOf("https://h/x")]).toEqual(["rtsp", "rtsp", "snapshot", "snapshot"]);
  });
});

describe("the settings file", () => {
  it("is written readable only by this user, in a private folder", () => {
    const dir = join(tmp(), "nested", "home-link");
    saveConfig({ ...emptyConfig(), token: "hl_x", cameras: cams(1) }, dir);
    expect(statSync(configPath(dir)).mode & 0o777).toBe(0o600);
    expect(statSync(dir).mode & 0o777).toBe(0o700);
  });

  it("reads back what was saved, password and all", () => {
    const dir = tmp();
    const cam = { key: "study", room: "Study", url: "rtsp://admin:hunter2@10.0.0.5/live", intervalSec: 90, enabled: true, privacyConfirmed: true };
    saveConfig({ server: "http://localhost:3200", token: "hl_abc", deviceName: "Study laptop", cameras: [cam] }, dir);
    expect(loadConfig(dir)).toEqual({ config: { server: "http://localhost:3200", token: "hl_abc", deviceName: "Study laptop", cameras: [cam] }, warnings: [] });
  });

  it("starts fresh when there is no file", () => {
    expect(loadConfig(join(tmp(), "none"))).toEqual({ config: emptyConfig(), warnings: [] });
  });

  it("skips a camera that no longer passes the rules, and says so, without echoing its address", () => {
    const dir = tmp();
    const good = { key: "ok", room: "Study", url: "http://10.0.0.1/a.jpg", intervalSec: 60, enabled: true, privacyConfirmed: true };
    const bad = [
      { key: "b1", room: "Master bedroom", url: "http://u:secretpw@10.0.0.2/a.jpg", intervalSec: 60, enabled: true, privacyConfirmed: true },
      { key: "b2", room: "Hall", url: "http://10.0.0.3/a.jpg", intervalSec: 5, enabled: true, privacyConfirmed: true },
      { key: "b3", room: "Garage", url: "http://10.0.0.4/a.jpg", intervalSec: 60, enabled: true, privacyConfirmed: false },
      { room: "No key", url: "http://10.0.0.5/a.jpg", intervalSec: 60, enabled: true, privacyConfirmed: true },
    ];
    writeFileSync(configPath(dir), JSON.stringify({ server: "https://mykx.vercel.app", token: null, cameras: [good, ...bad, { ...good }] }));
    const { config, warnings } = loadConfig(dir);
    expect(config.cameras.map((c) => c.key)).toEqual(["ok"]);
    expect(warnings).toHaveLength(5);
    expect(warnings.join("\n")).not.toMatch(/secretpw/);
  });

  it("keeps at most 10 cameras from a hand-edited file", () => {
    const dir = tmp();
    writeFileSync(configPath(dir), JSON.stringify({ cameras: cams(12) }));
    const { config, warnings } = loadConfig(dir);
    expect(config.cameras).toHaveLength(10);
    expect(warnings).toHaveLength(2);
  });

  it("starts fresh, with a note, from a file it can't read", () => {
    const dir = tmp();
    writeFileSync(configPath(dir), "{ nope");
    const { config, warnings } = loadConfig(dir);
    expect(config.cameras).toEqual([]);
    expect(warnings[0]).toMatch(/started fresh/);
    expect(readFileSync(configPath(dir), "utf8")).toBe("{ nope");
  });
});

describe("the server address", () => {
  it("must be https, except for this computer", () => {
    expect(checkServer("https://mykx.vercel.app/")).toEqual({ ok: true, server: "https://mykx.vercel.app" });
    expect(checkServer("http://localhost:3200")).toEqual({ ok: true, server: "http://localhost:3200" });
    expect(checkServer("http://127.0.0.1:3200")).toMatchObject({ ok: true });
    for (const bad of ["http://mykx.vercel.app", "http://192.168.1.5:3200", "ftp://x", "nonsense", "https://u:p@mykx.vercel.app", "https://mykx.vercel.app/path"]) expect(checkServer(bad), bad).toMatchObject({ ok: false });
  });
});
