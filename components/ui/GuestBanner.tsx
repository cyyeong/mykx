"use client";

// The guest site's banner (founder, 29 Oct; lib/guest.ts): on every page, so nobody mistakes a sample reply for live
// AI. Admin pages add that they're read-only. It folds to a corner pill after a few seconds; a tap opens it again.
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { GUEST_NOTE } from "@/lib/guest";
import "./guestBanner.css";

export function GuestBanner() {
  const path = usePathname();
  const [small, setSmall] = useState(false);
  // Shown in full on arrival, then folded to a corner pill so it never sits on a page's title.
  useEffect(() => {
    const t = window.setTimeout(() => setSmall(true), 6000);
    return () => window.clearTimeout(t);
  }, [path]);
  const admin = path.startsWith("/admin");
  return (
    <button type="button" className="gb" data-small={small ? "yes" : "no"} onClick={() => setSmall(!small)} aria-expanded={!small} aria-label={small ? "Guest walkthrough: show what that means" : "Fold the guest banner"}>
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path fill="currentColor" d="M12 2Q13 11 22 12Q13 13 12 22Q11 13 2 12Q11 11 12 2Z" />
      </svg>
      {small ? (
        <span>Guest walkthrough</span>
      ) : (
        <span>
          {GUEST_NOTE}
          {admin ? " Admin is read-only for guests." : " Nothing you change here is saved."}
        </span>
      )}
    </button>
  );
}
