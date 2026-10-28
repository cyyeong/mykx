// Runs the Home simulator locally: serves sim/ and routes /api/send to the same handler Vercel runs.
//   SIM_HOME_LINK_TOKEN=… SIM_PASSCODE=… MYKX_URL=http://localhost:3200 node sim/dev.mjs   (port 3300)
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";
import * as send from "./api/send.js";

const ROOT = fileURLToPath(new URL(".", import.meta.url));
const TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".json": "application/json" };
const port = Number(process.env.PORT ?? 3300);

createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", `http://localhost:${port}`);
  if (url.pathname === "/api/send") {
    const chunks = [];
    for await (const c of req) chunks.push(c);
    const request = new Request(url, { method: req.method, headers: req.headers, body: req.method === "POST" ? Buffer.concat(chunks) : undefined });
    const handler = send[req.method ?? "GET"];
    const out = handler ? await handler(request) : new Response("method", { status: 405 });
    res.writeHead(out.status, Object.fromEntries(out.headers));
    res.end(Buffer.from(await out.arrayBuffer()));
    return;
  }
  const file = normalize(join(ROOT, url.pathname === "/" ? "index.html" : url.pathname));
  if (!file.startsWith(ROOT) || file.includes(`${ROOT}api`)) return void res.writeHead(404).end();
  try {
    const body = await readFile(file);
    res.writeHead(200, { "content-type": TYPES[extname(file)] ?? "application/octet-stream" }).end(body);
  } catch {
    res.writeHead(404).end();
  }
}).listen(port, () => console.log(`Home simulator on http://localhost:${port} → ${process.env.MYKX_URL ?? "https://mykx.vercel.app"}`));
