"use client";

import { useLocalHour } from "./LivingScene";

/** "Good morning/afternoon/evening, Jordan" on the child's own clock (the server's clock is UTC). */
export function Greeting({ name }: { name: string }) {
  const hour = useLocalHour();
  const part = hour === null ? "Hi" : hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
  return <>{name ? `${part}, ${name}` : part}</>;
}
