# myKx Home Link

A small program a parent runs on a computer at home. Every so often it takes one still picture from each camera you add, works out whether the room changed, and sends only the changed pictures to myKx, where Muse Spark reads them for a plain "who is in which room, doing what" status. It's part of myKx Guardian (`docs/prd/GUARDIAN.md` §2.2). MIT licence.

It has no installer and no build step: Node 24 runs the TypeScript directly.

## What it promises

- **Nothing is sent until you pair it** with your family *and* save at least one camera with the privacy tick-box ticked.
- **Camera passwords stay on this computer.** They live in one settings file that only your user can read. They are never sent to myKx, never written to the activity list or the terminal, and never shown on the settings page (it shows `rtsp://••••@192.168.1.23/stream1`).
- **Home Link only pushes.** myKx never connects into your home network, and Home Link never opens a port to the network: the settings page listens on `127.0.0.1` only.
- **Only when something changes.** A picture is sent when the room looks different from the last picture sent, plus one every 10 minutes so myKx knows the camera is still there. The comparison happens here, on a 64×36 grey thumbnail.
- **No cameras in bathrooms or any bedroom,** or anywhere someone changes. Home Link asks you to confirm this for each camera, refuses those room names, and so does myKx. Tell everyone at home where the cameras are.
- **No sound, ever.** Home Link takes pictures only. There is no live video.
- Pictures are shrunk to 960 px wide at JPEG quality 70 before they leave. myKx reads them and drops them; only a flagged picture is kept, for 24 hours, so you can check it (Right / Not right).
- The activity list on the settings page is in memory only (the last 100 lines) and is gone when you stop the program.

## What you need

- **Node 24 or newer** (<https://nodejs.org>).
- **ffmpeg, only for RTSP cameras.** A camera that gives a snapshot address (a plain picture over HTTP) doesn't need it. ffmpeg isn't bundled with Home Link.
  - Mac: `brew install ffmpeg`
  - Windows: `winget install ffmpeg`
  - Linux: your package manager, for example `sudo apt install ffmpeg`
- From the repository root, `npm install` (Home Link uses the `sharp` package). Or `npm install` inside `clients/home-link/`.

## Run it

```
node clients/home-link/home-link.ts
```

It prints an address like `http://127.0.0.1:4747/#t=…` and opens it in your browser (`--no-open` skips that). The code after `#t=` is made fresh each run and stops other web pages from talking to Home Link, so open the address it prints rather than typing `127.0.0.1:4747` yourself.

Options: `--port 4747`, `--no-open`, `--server https://mykx.vercel.app` (or set `MYKX_SERVER`), `--help`.

## Pair it

1. In myKx, open **Your family → Location and home cameras**.
2. Under **Pair a computer**, name it and choose **Show a pairing code**. The code looks like `K7Q4-MZ2P`. It works once and runs out after 15 minutes.
3. Type the code into Home Link's page and press **Pair this computer**.

If you are testing against another myKx (say `http://localhost:3200`), open **Server address (advanced)** on the pairing card first. Only `https://` is accepted, apart from this computer (`localhost`).

## Add a camera ("Add by address")

1. Press **Add by address** (or an empty slot) and paste the camera's address:
   - a **snapshot address**, such as `http://192.168.1.40/snapshot.jpg`, or
   - an **RTSP address**, such as `rtsp://admin:password@192.168.1.23:554/stream1`.
   A user name and password can go in the address (`http://user:pass@host/…`). For a snapshot address Home Link sends them as a Basic sign-in header, never in the address it requests.
2. Pick the room and how often to check (10 s, 30 s, 60 s or 5 min; the settings file accepts any value from 10 seconds to 10 minutes).
3. Press **Take a test picture** to see what the camera sees. Nothing is sent for a test.
4. Tick the privacy box and press **Save**. Home Link supports up to 10 cameras.

The days and hours the cameras run, and "Pause for an hour", are set in myKx. Outside them Home Link says "Cameras are off right now (your family's hours)" and checks again every 5 minutes.

## Where things are kept

`~/.mykx-home-link/config.json` (set `MYKX_HOME_LINK_DIR` to keep it somewhere else). The folder is private to your user and the file is mode 600. It holds myKx's address, this computer's device token, and each camera's room, address (with its password) and interval. To start over, delete it.

## Stop it

Press **Ctrl+C** in the terminal. Nothing more is sent. To stop for good, remove the computer in myKx (Your family → Location and home cameras → Remove): its token stops working at once and Home Link says "This computer was removed in myKx; pair it again."

## Try it without a camera

```
node clients/home-link/dev/fake-camera.ts            # a pretend camera on http://127.0.0.1:8099
node clients/home-link/dev/fake-camera.ts --auth admin:secret   # wants a user name and password
```

Add `http://127.0.0.1:8099/snapshot/living.jpg` (or `kitchen`, `study`, `entrance`, `all`) as a camera. It cycles through myKx's synthetic pictures (`public/art/sim`), so you'll see "no change" rounds and changes. Add `--hold 1` to change picture on every look.

## Troubleshooting

| You see | Try |
|---|---|
| "That code didn't work" | The code works once and runs out after 15 minutes. Show a new one in myKx. Check the server address under Advanced. |
| "Port 4747 is already in use" | Home Link may already be running. Close it, or use `--port 4748`. |
| "Pictures from an RTSP address need ffmpeg" | Install ffmpeg (above), then try the test picture again. |
| "Can't reach the camera" | Is the computer on the same network as the camera? Open the address in a browser. Home Link tries again every minute. |
| "The camera refused the user name or password" | Check them in the address. Some cameras only offer Digest sign-in for snapshots, which Home Link can't do yet: use the camera's RTSP address, or turn on Basic sign-in in the camera. |
| "That address answered, but not with a still picture" | Use the camera's snapshot address (it returns one JPEG), not a video stream page. |
| "Cameras are off right now" | It's outside the family's camera hours, or paused in myKx. |
| "myKx asked Home Link to slow down" | Normal if you set many cameras to 10 s. Home Link waits and goes on. A camera set to 10 s every time can reach myKx's daily frame limit. |
| The page says "Open the address from the terminal" | Use the full address Home Link printed, including `#t=…`. |

## What isn't built

- **ONVIF discovery.** Cut from this build; the page only has "Add by address".
- **Signed installers** for macOS and Windows (planned).
- **Digest sign-in** for snapshot cameras (Basic only).
- **Audio.** Never: Home Link doesn't record or send sound.
- **Live video.** It sends still pictures only.
- An RTSP address's password is passed to ffmpeg on its command line, so other users of the same computer could see it in the process list for the second or two a picture takes. Prefer a snapshot address on a shared computer.

## Developing

From the repository root: `npm test` runs these tests with the rest (`clients/home-link/src/*.test.ts`). Files:

- `home-link.ts`: the entry point.
- `src/config.ts`: settings file, camera rules, password masking.
- `src/grab.ts`: one picture from a snapshot address or through ffmpeg.
- `src/motion.ts`: the thumbnail, the change test, the picture as uploaded.
- `src/upload.ts`: pair, camera list and frames calls to myKx.
- `src/loop.ts`: the rounds, backing off, the activity list.
- `src/server.ts`: the local settings server and its Host and token checks.
- `ui/index.html`: the settings page (one file, no framework, no external fonts).
- `dev/fake-camera.ts`: the pretend camera.
