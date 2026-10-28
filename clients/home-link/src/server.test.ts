import { request } from "node:http";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createHomeLink } from "./loop.ts";
import { hostAllowed, newRunToken, startServer, type Running } from "./server.ts";
import { TOKEN, fakeCamera, fakeMyKx, grey, tempDir, type FakeCamera, type FakeMyKx } from "./testkit.ts";

const RUN_TOKEN = "run-token-for-tests";
let running: Running;
let cam: FakeCamera;
let my: FakeMyKx;
let tmp: ReturnType<typeof tempDir>;
let link: ReturnType<typeof createHomeLink>;

beforeEach(async () => {
  tmp = tempDir();
  cam = await fakeCamera(await grey(80), "viewer:pw-12345");
  my = await fakeMyKx();
  link = createHomeLink(tmp.dir, { server: my.url, token: null, deviceName: null, cameras: [] }, [], { eager: false });
  running = await startServer({ link, token: RUN_TOKEN, html: "<!doctype html><title>Home Link</title>", port: 0 });
});
afterEach(async () => {
  await running.close();
  await Promise.all([cam.close(), my.close()]);
  tmp.remove();
});

/** A raw request, so the Host header can be anything (fetch won't let a script set it). */
function raw(opts: { path: string; method?: string; host?: string; headers?: Record<string, string>; body?: unknown }): Promise<{ status: number; headers: Record<string, string | string[] | undefined>; text: string }> {
  return new Promise((resolve, reject) => {
    const body = opts.body === undefined ? undefined : JSON.stringify(opts.body);
    const req = request({ host: "127.0.0.1", port: running.port, path: opts.path, method: opts.method ?? "GET", headers: { host: opts.host ?? `127.0.0.1:${running.port}`, ...(body ? { "content-type": "application/json" } : {}), ...opts.headers } }, (res) => {
      const chunks: Buffer[] = [];
      res.on("data", (c: Buffer) => chunks.push(c));
      res.on("end", () => resolve({ status: res.statusCode ?? 0, headers: res.headers, text: Buffer.concat(chunks).toString("utf8") }));
    });
    req.on("error", reject);
    req.end(body);
  });
}
const api = (path: string, o: { method?: string; body?: unknown; headers?: Record<string, string>; host?: string } = {}) => raw({ path, ...o, headers: { "x-hl-token": RUN_TOKEN, ...o.headers } });

describe("who may talk to the settings page", () => {
  it("only listens on this computer", () => {
    expect((running.server.address() as { address: string }).address).toBe("127.0.0.1");
  });

  it("serves the page to this computer's own address, with no token needed for the page itself", async () => {
    const r = await raw({ path: "/" });
    expect(r.status).toBe(200);
    expect(r.text).toContain("Home Link");
    expect((await raw({ path: "/", host: `localhost:${running.port}` })).status).toBe(200);
  });

  it("rejects a request whose Host isn't this machine and port (DNS rebinding)", async () => {
    for (const host of ["evil.example", `evil.example:${running.port}`, `127.0.0.1:${running.port + 1}`, "127.0.0.1", `192.168.1.5:${running.port}`, `[::1]:${running.port}`, `127.0.0.1.evil.example:${running.port}`]) {
      expect((await raw({ path: "/", host })).status, `page via ${host}`).toBe(403);
      expect((await api("/api/state", { host })).status, `api via ${host}`).toBe(403);
    }
    expect(hostAllowed(undefined, 4747)).toBe(false);
    expect(hostAllowed("127.0.0.1:4747", 4747)).toBe(true);
    expect(hostAllowed("localhost:4747", 4747)).toBe(true);
  });

  it("rejects an API call with no token, a wrong token or a near miss", async () => {
    expect((await raw({ path: "/api/state" })).status).toBe(401);
    for (const token of ["", "wrong", RUN_TOKEN.slice(1), `${RUN_TOKEN}x`, RUN_TOKEN.toUpperCase()]) {
      const r = await raw({ path: "/api/state", headers: { "x-hl-token": token } });
      expect(r.status, token).toBe(401);
      expect(JSON.parse(r.text)).toMatchObject({ ok: false, reason: "token" });
    }
    for (const [method, path] of [["POST", "/api/pair"], ["POST", "/api/camera"], ["DELETE", "/api/camera/x"], ["POST", "/api/test/x"], ["GET", "/api/thumb/x"], ["POST", "/api/unpair"]]) {
      expect((await raw({ path, method, body: method === "POST" ? {} : undefined })).status, `${method} ${path}`).toBe(401);
    }
  });

  it("takes an API call with the token", async () => {
    const r = await api("/api/state");
    expect(r.status).toBe(200);
    expect(JSON.parse(r.text)).toMatchObject({ ok: true, paired: false, cameras: [], max: 10 });
  });

  it("rejects a request from another site, and sends no CORS headers", async () => {
    expect((await api("/api/state", { headers: { origin: "https://evil.example" } })).status).toBe(403);
    expect((await api("/api/state", { headers: { "sec-fetch-site": "cross-site" } })).status).toBe(401);
    expect((await api("/api/state", { method: "OPTIONS" })).status).toBe(404);
    const ok = await api("/api/state", { headers: { origin: `http://127.0.0.1:${running.port}`, "sec-fetch-site": "same-origin" } });
    expect(ok.status).toBe(200);
    expect(Object.keys(ok.headers).filter((h) => h.startsWith("access-control"))).toEqual([]);
    expect(String(ok.headers["content-security-policy"])).toContain("default-src 'none'");
    expect(ok.headers["cache-control"]).toBe("no-store");
  });

  it("makes a different token every run", () => {
    expect(newRunToken()).not.toBe(newRunToken());
    expect(newRunToken().length).toBeGreaterThanOrEqual(32);
  });
});

describe("what the page can do", () => {
  it("pairs, saves a camera, takes a test picture and removes the camera, and never sees the password", async () => {
    const bad = await api("/api/pair", { method: "POST", body: { code: "NOPE-NOPE", server: my.url } });
    expect(bad.status).toBe(400);
    expect(JSON.parse(bad.text)).toMatchObject({ ok: false });

    expect((await api("/api/pair", { method: "POST", body: { code: "K7Q4-MZ2P", server: my.url } })).status).toBe(200);
    const withLogin = cam.url.replace("http://", "http://viewer:pw-12345@");

    const refused = await api("/api/camera", { method: "POST", body: { room: "Bathroom", url: withLogin, intervalSec: 60, privacyConfirmed: true } });
    expect(refused.status).toBe(400);
    expect(JSON.parse(refused.text)).toMatchObject({ ok: false, field: "room" });

    const saved = await api("/api/camera", { method: "POST", body: { room: "Study", url: withLogin, intervalSec: 30, privacyConfirmed: true } });
    expect(saved.status).toBe(200);
    expect(JSON.parse(saved.text).camera).toMatchObject({ key: "study", address: `http://••••@127.0.0.1:${cam.port}/snapshot.jpg`, intervalSec: 30 });

    const test = await api("/api/test/study", { method: "POST", body: {} });
    expect(JSON.parse(test.text)).toMatchObject({ ok: true, dataUrl: expect.stringMatching(/^data:image\/jpeg;base64,/) });
    const unsaved = await api("/api/test/new", { method: "POST", body: { address: withLogin } });
    expect(JSON.parse(unsaved.text)).toMatchObject({ ok: true });

    await link.tick();
    const thumb = await api("/api/thumb/study");
    expect(thumb.status).toBe(200);
    expect(thumb.headers["content-type"]).toBe("image/jpeg");

    const everything = [(await api("/api/state")).text, test.text, unsaved.text, saved.text, refused.text].join("\n");
    expect(everything).not.toContain("pw-12345");
    expect(everything).not.toContain("viewer");
    expect(everything).not.toContain(TOKEN);

    expect((await api("/api/camera/study", { method: "DELETE" })).status).toBe(200);
    expect((await api("/api/camera/study", { method: "DELETE" })).status).toBe(404);
    expect((await api("/api/thumb/study")).status).toBe(404);
  });

  it("refuses a bad body and a body that is too big", async () => {
    expect((await api("/api/camera", { method: "POST", headers: { "content-type": "application/json" }, body: undefined })).status).toBe(400);
    const huge = await api("/api/camera", { method: "POST", body: { room: "x".repeat(100_000) } });
    expect(huge.status).toBe(413);
  });
});
