// The settings page's local server. It listens on 127.0.0.1 only. Two checks guard every request against a web page
// in the same browser reaching in (DNS rebinding, cross-site requests): the Host header must be this machine and
// port, and every /api call must carry the random per-run token that only the printed address knows. No CORS headers.
import { randomBytes, timingSafeEqual } from "node:crypto";
import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import type { AddressInfo } from "node:net";
import type { HomeLink } from "./loop.ts";

export const DEFAULT_PORT = 4747;
const MAX_BODY = 64 * 1024;

export const newRunToken = (): string => randomBytes(24).toString("base64url");

/** `127.0.0.1:4747` and `localhost:4747`, nothing else. */
export function hostAllowed(host: string | undefined, port: number): boolean {
  return host === `127.0.0.1:${port}` || host === `localhost:${port}`;
}

function tokenOk(given: string | string[] | undefined, want: string): boolean {
  if (typeof given !== "string") return false;
  const a = Buffer.from(given);
  const b = Buffer.from(want);
  return a.length === b.length && timingSafeEqual(a, b);
}

const SECURITY_HEADERS = {
  "cache-control": "no-store",
  "x-content-type-options": "nosniff",
  "referrer-policy": "no-referrer",
  "x-frame-options": "DENY",
  "content-security-policy": "default-src 'none'; img-src 'self' blob: data:; style-src 'unsafe-inline'; script-src 'unsafe-inline'; connect-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",
};

function send(res: ServerResponse, status: number, body: string | Buffer, type: string) {
  res.writeHead(status, { ...SECURITY_HEADERS, "content-type": type });
  res.end(body);
}
const json = (res: ServerResponse, status: number, body: unknown) => send(res, status, JSON.stringify(body), "application/json; charset=utf-8");

async function readJson(req: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req) {
    size += (chunk as Buffer).length;
    if (size > MAX_BODY) throw new Error("too-big");
    chunks.push(chunk as Buffer);
  }
  if (!chunks.length) return {};
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

export interface Running {
  server: Server;
  port: number;
  close(): Promise<void>;
}

export function startServer(opts: { link: HomeLink; token: string; html: string; port?: number }): Promise<Running> {
  const { link, token, html } = opts;
  let port = opts.port ?? DEFAULT_PORT;

  const handle = async (req: IncomingMessage, res: ServerResponse) => {
    if (!hostAllowed(req.headers.host, port)) return send(res, 403, "Wrong host.", "text/plain; charset=utf-8");
    // A page on another site always sends Origin on a POST; refuse anything that isn't this page.
    const origin = req.headers.origin;
    if (origin && origin !== `http://127.0.0.1:${port}` && origin !== `http://localhost:${port}`) return send(res, 403, "Wrong origin.", "text/plain; charset=utf-8");
    const url = new URL(req.url ?? "/", `http://127.0.0.1:${port}`);
    const method = req.method ?? "GET";

    if (!url.pathname.startsWith("/api/")) {
      if (method !== "GET" && method !== "HEAD") return send(res, 405, "Not allowed.", "text/plain; charset=utf-8");
      if (url.pathname === "/") return send(res, 200, html, "text/html; charset=utf-8");
      if (url.pathname === "/favicon.ico") return send(res, 204, "", "image/x-icon");
      return send(res, 404, "Not found.", "text/plain; charset=utf-8");
    }

    const site = req.headers["sec-fetch-site"];
    if (!tokenOk(req.headers["x-hl-token"], token) || (typeof site === "string" && site !== "same-origin")) return json(res, 401, { ok: false, reason: "token", message: "Open the address Home Link printed in the terminal; it ends with a code." });

    const parts = url.pathname.split("/").filter(Boolean).slice(1);
    const [name, key] = parts;
    try {
      if (method === "GET" && name === "state" && !key) return json(res, 200, { ok: true, ...link.state() });
      if (method === "GET" && name === "thumb" && key) {
        const picture = link.thumb(decodeURIComponent(key));
        return picture ? send(res, 200, picture, "image/jpeg") : json(res, 404, { ok: false, reason: "not-found" });
      }
      if (method === "POST" && name === "pair" && !key) {
        const body = (await readJson(req)) as { code?: unknown; server?: unknown };
        const r = await link.pair(typeof body.code === "string" ? body.code : "", typeof body.server === "string" ? body.server : undefined);
        return json(res, r.ok ? 200 : 400, r);
      }
      if (method === "POST" && name === "unpair" && !key) {
        link.unpair();
        return json(res, 200, { ok: true });
      }
      if (method === "POST" && name === "camera" && !key) {
        const r = await link.saveCamera(await readJson(req));
        return json(res, r.ok ? 200 : 400, r);
      }
      if (method === "DELETE" && name === "camera" && key) return link.removeCamera(decodeURIComponent(key)) ? json(res, 200, { ok: true }) : json(res, 404, { ok: false, reason: "not-found" });
      if (method === "POST" && name === "test" && key) {
        const body = (await readJson(req)) as { address?: unknown };
        const id = decodeURIComponent(key);
        const r = await link.testPicture(id === "new" ? null : id, typeof body.address === "string" ? body.address : undefined);
        return json(res, r.ok ? 200 : 400, r);
      }
      return json(res, 404, { ok: false, reason: "not-found" });
    } catch (e) {
      if (e instanceof Error && e.message === "too-big") return json(res, 413, { ok: false, reason: "too-big" });
      if (e instanceof SyntaxError) return json(res, 400, { ok: false, reason: "invalid", message: "That wasn't understood." });
      return json(res, 500, { ok: false, reason: "error", message: "Something went wrong in Home Link." });
    }
  };

  return new Promise((resolve, reject) => {
    const server = createServer((req, res) => void handle(req, res));
    server.once("error", reject);
    // 127.0.0.1 only: never the network.
    server.listen(port, "127.0.0.1", () => {
      port = (server.address() as AddressInfo).port;
      server.off("error", reject);
      resolve({ server, port, close: () => new Promise((done) => { server.closeAllConnections(); server.close(() => done()); }) });
    });
  });
}
