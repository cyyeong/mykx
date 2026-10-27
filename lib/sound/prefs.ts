// The viewer's sound choices, kept in localStorage (a per-device convenience; per-profile later).
// Shaped for useSyncExternalStore: the snapshot is the raw string, so it is stable between reads.
const KEY = "mykx.sound.v1";
const listeners = new Set<() => void>();

export type SoundPrefs = { on?: boolean; ambience?: boolean; music?: boolean };

export function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  const onStorage = (e: StorageEvent) => {
    if (e.key === KEY) listener();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

export function getSnapshot(): string {
  try {
    return localStorage.getItem(KEY) ?? "";
  } catch {
    return "";
  }
}

export function getServerSnapshot(): string {
  return "";
}

export function parsePrefs(raw: string): SoundPrefs {
  try {
    const value = JSON.parse(raw) as unknown;
    if (!value || typeof value !== "object") return {};
    const { on, ambience, music } = value as Record<string, unknown>;
    return {
      ...(typeof on === "boolean" ? { on } : {}),
      ...(typeof ambience === "boolean" ? { ambience } : {}),
      ...(typeof music === "boolean" ? { music } : {}),
    };
  } catch {
    return {};
  }
}

export function savePrefs(next: SoundPrefs): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // Private mode or blocked storage: the choice lasts until reload.
  }
  listeners.forEach((l) => l());
}
