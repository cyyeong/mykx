// myKx Home Link: the program a parent runs on a computer at home. It opens a settings page on this computer only
// and, once paired, sends a picture from each saved camera to myKx when the room changes (docs/prd/GUARDIAN.md §2.2).
//   node home-link.ts [--port 4747] [--no-open] [--server https://mykx.vercel.app]
import { spawn } from "node:child_process";
import { readFileSync } from "node:fs";
import { parseArgs } from "node:util";
import { DEFAULT_SERVER, checkServer, configPath, configDir, loadConfig } from "./src/config.ts";
import { createHomeLink } from "./src/loop.ts";
import { DEFAULT_PORT, newRunToken, startServer } from "./src/server.ts";

const HELP = `myKx Home Link

  node home-link.ts [options]

  --port <number>   Port for the settings page (default ${DEFAULT_PORT}). It is only ever reachable from this computer.
  --no-open         Don't open the browser; just print the address.
  --server <url>    myKx's address (default ${DEFAULT_SERVER}). You can also change it on the pairing page.
  --help            Show this.

Settings and camera passwords are kept in ${configPath()} (readable only by you).
Press Ctrl+C to stop.`;

if (Number(process.versions.node.split(".")[0]) < 24) {
  console.error(`Home Link needs Node 24 or newer (this is ${process.versions.node}). Get it from https://nodejs.org.`);
  process.exit(1);
}

let args;
try {
  args = parseArgs({ options: { port: { type: "string" }, "no-open": { type: "boolean" }, server: { type: "string" }, help: { type: "boolean", short: "h" } }, strict: true }).values;
} catch (e) {
  console.error(`${e instanceof Error ? e.message : "Unknown option."}\n\n${HELP}`);
  process.exit(1);
}
if (args.help) {
  console.log(HELP);
  process.exit(0);
}
const port = args.port === undefined ? DEFAULT_PORT : Number(args.port);
if (!Number.isInteger(port) || port < 1 || port > 65535) {
  console.error("--port must be a number from 1 to 65535.");
  process.exit(1);
}
let defaultServer = process.env.MYKX_SERVER || DEFAULT_SERVER;
if (args.server) {
  const checked = checkServer(args.server);
  if (!checked.ok) {
    console.error(checked.message);
    process.exit(1);
  }
  defaultServer = checked.server;
}

const { config, warnings } = loadConfig(configDir(), defaultServer);
// A server given on the command line wins for this run, until a pairing saves another.
if (args.server && !config.token) config.server = defaultServer;
const link = createHomeLink(configDir(), config, warnings, { print: (line) => console.log(line) });
const token = newRunToken();
const html = readFileSync(new URL("./ui/index.html", import.meta.url), "utf8");

let running;
try {
  running = await startServer({ link, token, html, port });
} catch (e) {
  console.error((e as NodeJS.ErrnoException).code === "EADDRINUSE" ? `Port ${port} is already in use. Is Home Link already running? Close it, or start this one with --port <another number>.` : `Home Link couldn't start its settings page (${(e as Error).message}).`);
  process.exit(1);
}

const address = `http://127.0.0.1:${running.port}/#t=${token}`;
console.log(`myKx Home Link is running.\n\n  Settings page: ${address}\n  Settings file: ${configPath()}\n\nPress Ctrl+C to stop.\n`);
link.start();

if (!args["no-open"]) {
  const [program, ...rest] = process.platform === "darwin" ? ["open", address] : process.platform === "win32" ? ["cmd", "/c", "start", "", address] : ["xdg-open", address];
  const child = spawn(program, rest, { stdio: "ignore", detached: true, windowsHide: true });
  child.on("error", () => console.log("Couldn't open the browser. Open the settings page address above yourself."));
  child.unref();
}

let stopping = false;
const stop = () => {
  if (stopping) return;
  stopping = true;
  console.log("\nStopping Home Link. Nothing more will be sent.");
  link.stop();
  void running.close().then(() => process.exit(0));
  setTimeout(() => process.exit(0), 1500).unref();
};
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
