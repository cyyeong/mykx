"use client";

// The grown-ups' look (founder, 29 Oct: a designed, grown-up parent area; each grown-up picks their own). Harbour is
// navy, slate and brass; Bloom is plum, blush and sage with serif headings. Kept on this device per grown-up, so two
// parents sharing a tablet each see their own. Never guessed from a name.
import { useCallback, useSyncExternalStore } from "react";

export const PARENT_LOOKS = [
  { id: "harbour", label: "Harbour", note: "Navy, slate and brass" },
  { id: "bloom", label: "Bloom", note: "Plum, blush and sage" },
] as const;
export type ParentLook = (typeof PARENT_LOOKS)[number]["id"];

const DEFAULT: ParentLook = "harbour";
const listeners = new Set<() => void>();
const keyFor = (who: string | null) => `mykx.parentLook:${(who ?? "grown-up").toLowerCase()}`;

function read(who: string | null): ParentLook {
  try {
    const v = window.localStorage.getItem(keyFor(who));
    return v === "bloom" || v === "harbour" ? v : DEFAULT;
  } catch {
    return DEFAULT;
  }
}

function subscribe(fn: () => void) {
  listeners.add(fn);
  const onStorage = (e: StorageEvent) => e.key?.startsWith("mykx.parentLook:") && fn();
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(fn);
    window.removeEventListener("storage", onStorage);
  };
}

export function useParentLook(who: string | null): [ParentLook, (look: ParentLook) => void] {
  const look = useSyncExternalStore(subscribe, () => read(who), () => DEFAULT);
  const set = useCallback(
    (next: ParentLook) => {
      try {
        window.localStorage.setItem(keyFor(who), next);
        window.localStorage.setItem(keyFor(null), next); // the device's last look, for grown-up pages without a name
      } catch {
        // private mode: the look lasts for this page only
      }
      listeners.forEach((l) => l());
    },
    [who],
  );
  return [look, set];
}

/** "morning" | "afternoon" | "evening" by the device's clock; "" on the server (no flash of a wrong greeting). */
export function useDayPart(): string {
  return useSyncExternalStore(
    (fn) => {
      const id = window.setInterval(fn, 60_000);
      return () => window.clearInterval(id);
    },
    () => {
      const h = new Date().getHours();
      return h < 12 ? "morning" : h < 18 ? "afternoon" : "evening";
    },
    () => "",
  );
}

/** "Thursday 29 October" by the device's clock; "" on the server. */
export function useToday(): string {
  return useSyncExternalStore(
    (fn) => {
      const id = window.setInterval(fn, 60_000);
      return () => window.clearInterval(id);
    },
    () => new Date().toLocaleDateString("en-SG", { weekday: "long", day: "numeric", month: "long" }),
    () => "",
  );
}
