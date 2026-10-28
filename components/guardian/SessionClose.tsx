"use client";

// Closes a learning session for the Memory Keeper (/api/session/close): once, quietly, after the quest's done page
// shows. It never blocks or changes the page; the reading is for the grown-up and the Notebook only.
import { useEffect } from "react";

export function SessionClose() {
  useEffect(() => {
    const t = setTimeout(() => void fetch("/api/session/close", { method: "POST", credentials: "same-origin" }).catch(() => undefined), 1500);
    return () => clearTimeout(t);
  }, []);
  return null;
}
