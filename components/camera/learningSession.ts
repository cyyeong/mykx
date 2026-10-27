"use client";

// Where the focus camera may run: learning only, never browsing pages or games (founder decision, 28 Oct).
// The question player is matched by route. A screen that holds a learning session in place (the teen study deck
// once "Start session" runs one) calls useLearningSession(active) while it's going.
import { useEffect, useSyncExternalStore } from "react";

/** Route prefixes that are learning. */
export const LEARNING_ROUTES = ["/question/"] as const;

export const isLearningRoute = (pathname: string | null) => Boolean(pathname && LEARNING_ROUTES.some((p) => pathname.startsWith(p)));

let open = 0;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => void listeners.delete(listener);
}

/** True while any screen has a learning session open. */
export function useLearningSessionOpen(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => open > 0,
    () => false,
  );
}

/** Marks a learning session as open while `active` is true (and the calling screen is mounted). */
export function useLearningSession(active: boolean): void {
  useEffect(() => {
    if (!active) return;
    open += 1;
    emit();
    return () => {
      open -= 1;
      emit();
    };
  }, [active]);
}
