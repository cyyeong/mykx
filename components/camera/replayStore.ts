// Where the face-free replays live: this browser's own storage (IndexedDB), never the server (AGENTS.md rule 12).
// One record per "possibly losing focus" note, by its start time; kept for 7 days, then deleted. Every call fails
// quietly (private mode, storage off): the note still reaches the grown-up, just without a replay.
import type { NoteReplay } from "@/lib/signals/replay";

const DB = "mykx-replays";
const STORE = "notes";
const KEEP_MS = 7 * 86_400_000;

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE, { keyPath: "from" });
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function run<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return open().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const tx = db.transaction(STORE, mode);
        const req = fn(tx.objectStore(STORE));
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
        tx.oncomplete = () => db.close();
      }),
  );
}

export async function listReplays(): Promise<NoteReplay[]> {
  try {
    const all = await run<NoteReplay[]>("readonly", (s) => s.getAll() as IDBRequest<NoteReplay[]>);
    return all.filter((r) => Date.now() - Date.parse(r.savedAt) < KEEP_MS);
  } catch {
    return [];
  }
}

export async function saveReplay(replay: NoteReplay): Promise<void> {
  try {
    await run("readwrite", (s) => s.put(replay));
    for (const old of (await run<NoteReplay[]>("readonly", (s) => s.getAll() as IDBRequest<NoteReplay[]>)).filter((r) => Date.now() - Date.parse(r.savedAt) >= KEEP_MS)) {
      await run("readwrite", (s) => s.delete(old.from));
    }
  } catch {
    // No storage here: the note still reaches the grown-up, without a replay.
  }
}

/** The replay for a note: the one whose window overlaps the note's. */
export async function replayFor(note: { from: string; to: string }): Promise<NoteReplay | null> {
  const from = Date.parse(note.from);
  const to = Date.parse(note.to);
  return (await listReplays()).find((r) => Date.parse(r.from) < to && Date.parse(r.to) > from) ?? null;
}

export async function deleteReplay(note: { from: string; to: string }): Promise<void> {
  const r = await replayFor(note);
  if (!r) return;
  try {
    await run("readwrite", (s) => s.delete(r.from));
  } catch {
    // Nothing to do.
  }
}
