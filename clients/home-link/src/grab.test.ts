import { EventEmitter } from "node:events";
import { chmodSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { PassThrough } from "node:stream";
import { afterEach, describe, expect, it } from "vitest";
import { FFMPEG_HELP, GrabError, ffmpegArgs, grabPicture, grabRtsp, grabSnapshot, imageKind } from "./grab.ts";
import { fakeCamera, grey, tempDir, type FakeCamera } from "./testkit.ts";

const cleanup: (() => void | Promise<void>)[] = [];
afterEach(async () => {
  for (const c of cleanup.splice(0)) await c();
});
const camera = async (picture: Buffer, auth?: string): Promise<FakeCamera> => {
  const c = await fakeCamera(picture, auth);
  cleanup.push(() => c.close());
  return c;
};
const kindOf = async (p: Promise<unknown>) => {
  try {
    await p;
    return "no error";
  } catch (e) {
    return e instanceof GrabError ? e.kind : `other: ${String(e)}`;
  }
};

describe("a snapshot address", () => {
  it("returns the picture", async () => {
    const jpeg = await grey(100);
    const cam = await camera(jpeg);
    const got = await grabSnapshot(cam.url);
    expect(Buffer.from(got).equals(jpeg)).toBe(true);
    expect(cam.hits[0].authorization).toBeUndefined();
  });

  it("signs in with Basic, sending the password in a header and never in the address", async () => {
    const jpeg = await grey(100);
    const cam = await camera(jpeg, "admin:p@ss w0rd");
    const withLogin = cam.url.replace("http://", `http://admin:${encodeURIComponent("p@ss w0rd")}@`);
    const got = await grabSnapshot(withLogin);
    expect(Buffer.from(got).equals(jpeg)).toBe(true);
    expect(cam.hits).toHaveLength(1);
    expect(cam.hits[0].url).toBe("/snapshot.jpg");
    expect(cam.hits[0].authorization).toBe(`Basic ${Buffer.from("admin:p@ss w0rd").toString("base64")}`);
  });

  it("hands fetch an address with no user name or password in it", async () => {
    const seen: { url: string; headers: Record<string, string> }[] = [];
    const jpeg = await grey(100);
    const fetchSpy = (async (url: string | URL | Request, init?: RequestInit) => {
      seen.push({ url: String(url), headers: init?.headers as Record<string, string> });
      return new Response(new Uint8Array(jpeg), { status: 200 });
    }) as typeof fetch;
    await grabSnapshot("http://admin:hunter2@192.168.1.23/snap.jpg?x=1", { fetch: fetchSpy });
    expect(seen[0].url).toBe("http://192.168.1.23/snap.jpg?x=1");
    expect(seen[0].url).not.toMatch(/hunter2|admin/);
    expect(seen[0].headers.authorization).toBe(`Basic ${Buffer.from("admin:hunter2").toString("base64")}`);
  });

  it("says plainly when the password is wrong, without repeating it", async () => {
    const cam = await camera(await grey(100), "admin:right");
    const url = cam.url.replace("http://", "http://admin:wrongpw@");
    const err = await grabSnapshot(url).catch((e) => e as GrabError);
    expect(err).toBeInstanceOf(GrabError);
    expect((err as GrabError).kind).toBe("auth");
    expect(JSON.stringify([(err as GrabError).message, (err as GrabError).stack?.split("\n")[0]])).not.toMatch(/wrongpw|right/);
    expect(await kindOf(grabSnapshot(cam.url))).toBe("auth");
  });

  it("explains a camera that only does Digest sign-in", async () => {
    const fetchDigest = (async () => new Response("no", { status: 401, headers: { "www-authenticate": 'Digest realm="x", nonce="y"' } })) as typeof fetch;
    const err = await grabSnapshot("http://u:p@cam/s.jpg", { fetch: fetchDigest }).catch((e) => e as GrabError);
    expect((err as GrabError).kind).toBe("auth");
    expect((err as GrabError).message).toMatch(/Digest/);
  });

  it("tells apart a camera that is down, slow, broken, or not a camera", async () => {
    const cam = await camera(await grey(100));
    cam.mode = "down";
    expect(await kindOf(grabSnapshot(cam.url))).toBe("unreachable");
    cam.mode = "error";
    expect(await kindOf(grabSnapshot(cam.url))).toBe("http");
    cam.mode = "text";
    expect(await kindOf(grabSnapshot(cam.url))).toBe("not-image");
    cam.mode = "hang";
    expect(await kindOf(grabSnapshot(cam.url, { timeoutMs: 150 }))).toBe("timeout");
    expect(await kindOf(grabSnapshot("http://127.0.0.1:9/x.jpg"))).toBe("unreachable");
  });

  it("knows a JPEG, PNG and WebP by their first bytes", () => {
    expect(imageKind(new Uint8Array([0xff, 0xd8, 0xff, 0xe0]))).toBe("jpeg");
    expect(imageKind(new Uint8Array([0x89, 0x50, 0x4e, 0x47]))).toBe("png");
    expect(imageKind(Buffer.from("RIFF1234WEBPVP8 "))).toBe("webp");
    expect(imageKind(Buffer.from("<html>"))).toBeNull();
  });
});

describe("an RTSP address", () => {
  const url = "rtsp://admin:hunter2@192.168.1.23:554/stream1";

  it("asks ffmpeg for one frame over TCP, as a JPEG on stdout", () => {
    const args = ffmpegArgs(url);
    expect(args.join(" ")).toBe(`-hide_banner -loglevel error -rtsp_transport tcp -i ${url} -frames:v 1 -f image2pipe -vcodec mjpeg -`);
    expect(args[args.indexOf("-i") + 1]).toBe(url);
    expect(args.at(-1)).toBe("-");
  });

  it("says how to install ffmpeg when it isn't there (a fake spawn)", async () => {
    const spawnMissing = (() => {
      const child = new EventEmitter() as EventEmitter & { stdout: PassThrough; stderr: PassThrough; kill: () => boolean };
      child.stdout = new PassThrough();
      child.stderr = new PassThrough();
      child.kill = () => true;
      queueMicrotask(() => child.emit("error", Object.assign(new Error("spawn ffmpeg ENOENT"), { code: "ENOENT" })));
      return child;
    }) as unknown as typeof import("node:child_process").spawn;
    const err = await grabRtsp(url, { spawn: spawnMissing }).catch((e) => e as GrabError);
    expect((err as GrabError).kind).toBe("no-ffmpeg");
    expect((err as GrabError).message).toBe(FFMPEG_HELP);
    expect(FFMPEG_HELP).toMatch(/brew install ffmpeg/);
    expect(FFMPEG_HELP).toMatch(/winget install ffmpeg/);
    expect(FFMPEG_HELP).not.toMatch(/hunter2/);
  });

  it("says the same when the program really isn't there", async () => {
    expect(await kindOf(grabRtsp(url, { ffmpeg: "/no/such/ffmpeg-for-home-link-tests" }))).toBe("no-ffmpeg");
    expect(await kindOf(grabPicture(url, { ffmpeg: "/no/such/ffmpeg-for-home-link-tests" }))).toBe("no-ffmpeg");
  });

  describe.skipIf(process.platform === "win32")("with a stand-in for ffmpeg", () => {
    const stand = (body: string): string => {
      const t = tempDir();
      cleanup.push(t.remove);
      const file = join(t.dir, "ffmpeg");
      writeFileSync(file, `#!/usr/bin/env node\n${body}\n`);
      chmodSync(file, 0o755);
      return file;
    };

    it("returns the frame ffmpeg writes", async () => {
      const jpeg = await grey(90);
      const ffmpeg = stand(`process.stdout.write(Buffer.from("${jpeg.toString("base64")}", "base64"));`);
      expect(Buffer.from(await grabRtsp(url, { ffmpeg })).equals(jpeg)).toBe(true);
    });

    it("never repeats the password from ffmpeg's own error", async () => {
      const ffmpeg = stand(`console.error(${JSON.stringify(`${url}: Connection refused`)}); process.exit(1);`);
      const err = await grabRtsp(url, { ffmpeg }).catch((e) => e as GrabError);
      expect((err as GrabError).kind).toBe("unreachable");
      expect((err as GrabError).message).not.toMatch(/hunter2|admin/);
      const denied = stand(`console.error("method DESCRIBE failed: 401 Unauthorized"); process.exit(1);`);
      expect(await kindOf(grabRtsp(url, { ffmpeg: denied }))).toBe("auth");
      const other = stand(`console.error("Invalid data found when processing input ${url}"); process.exit(1);`);
      const e2 = await grabRtsp(url, { ffmpeg: other }).catch((e) => e as GrabError);
      expect((e2 as GrabError).kind).toBe("ffmpeg-failed");
      expect((e2 as GrabError).message).not.toMatch(/hunter2/);
    });

    it("gives up and stops ffmpeg when the stream is silent", async () => {
      const ffmpeg = stand(`setTimeout(() => {}, 60000);`);
      expect(await kindOf(grabRtsp(url, { ffmpeg, timeoutMs: 300 }))).toBe("timeout");
    });
  });
});
