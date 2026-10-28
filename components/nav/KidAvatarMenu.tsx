"use client";

// The kid's avatar: opens a small menu with Me, Switch profile and Sign out. Both end this kid's session first, so
// Back on a shared tablet never reopens a sibling's world (docs/prd/USER_STORIES.md §8.4, fix 8).
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { signKidOut } from "./KidIdle";
import "./kidAvatarMenu.css";

export function KidAvatarMenu({ nickname }: { nickname: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: PointerEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent ? e.key === "Escape" : !box.current?.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener("pointerdown", close);
    window.addEventListener("keydown", close);
    return () => {
      window.removeEventListener("pointerdown", close);
      window.removeEventListener("keydown", close);
    };
  }, [open]);

  const switchProfile = async () => {
    setLeaving(true);
    await fetch("/api/auth/kid", { method: "DELETE" }).catch(() => null);
    router.replace("/doors");
  };

  return (
    <div className="kam" ref={box}>
      <button type="button" className="kam-avatar" aria-haspopup="menu" aria-expanded={open} aria-label={`${nickname}: open my menu`} onClick={() => setOpen((o) => !o)}>
        {nickname.slice(0, 1).toUpperCase()}
      </button>
      {open && (
        <div className="kam-menu" role="menu" aria-label={`${nickname}'s menu`}>
          <Link role="menuitem" className="kam-item" href="/me">
            Me
          </Link>
          <Link role="menuitem" className="kam-item" href="/messages">
            Messages
          </Link>
          <Link role="menuitem" className="kam-item" href="/me/sharing">
            What my grown-ups see
          </Link>
          <Link role="menuitem" className="kam-item" href="/studio">
            Change my Kix
          </Link>
          <button role="menuitem" type="button" className="kam-item" onClick={switchProfile} disabled={leaving}>
            {leaving ? "Switching…" : "Switch profile"}
          </button>
          <button
            role="menuitem"
            type="button"
            className="kam-item kam-out"
            onClick={() => {
              setLeaving(true);
              void signKidOut();
            }}
            disabled={leaving}
          >
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}
