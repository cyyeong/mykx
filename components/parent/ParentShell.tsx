"use client";

// The parent dashboard shell (USER_STORIES §8.4 fix 6): Today, Where, Home, Messages,
// Notebook and Family under one bar (bottom on phones, rail from 600 px),
// a Kids' doors button to hand the device over, and an account menu with
// sign out here, sign out everywhere, and the admin entry for admins.
// Today is the guardian's picture (ParentToday); Messages are family threads with Kix stickers
// (ParentMessages); Notebook is what Kix remembers, editable and wipeable (ParentNotebook).
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "@/components/account/api";
import { HomeNowTab } from "@/components/home-watch/HomeNowTab";
import { WhereTab } from "@/components/location/WhereTab";
import { ParentMessages } from "./ParentMessages";
import { ParentNotebook } from "./ParentNotebook";
import { ParentToday } from "./ParentToday";
import "./parent.css";

type Tab = "today" | "where" | "home" | "messages" | "notebook" | "family";

type Kid = { id: string; nickname: string; level: string | null; band: string | null };
type KidsReply = { household?: { name?: string }; kids?: Kid[] };

const TABS: { id: Tab; label: string }[] = [
  { id: "today", label: "Today" },
  { id: "where", label: "Where" },
  { id: "home", label: "Home" },
  { id: "messages", label: "Messages" },
  { id: "notebook", label: "Notebook" },
  { id: "family", label: "Family" },
];

export function ParentShell({ name, isAdmin }: { name: string | null; isAdmin: boolean }) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("today");
  const [kids, setKids] = useState<Kid[] | null>(null);
  const [household, setHousehold] = useState("Your family");
  const [signedOut, setSignedOut] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const menuBox = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let live = true;
    void api<KidsReply>("GET", "/api/family/kids").then((r) => {
      if (!live) return;
      if (r.status === 401 || r.status === 403) {
        setSignedOut(true);
        return;
      }
      if (r.ok && r.data) {
        setKids(r.data.kids ?? []);
        if (r.data.household?.name) setHousehold(r.data.household.name);
      }
    });
    return () => {
      live = false;
    };
  }, []);

  useEffect(() => {
    if (!menuOpen) return;
    const close = (e: PointerEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent ? e.key === "Escape" : !menuBox.current?.contains(e.target as Node)) setMenuOpen(false);
    };
    window.addEventListener("pointerdown", close);
    window.addEventListener("keydown", close);
    return () => {
      window.removeEventListener("pointerdown", close);
      window.removeEventListener("keydown", close);
    };
  }, [menuOpen]);

  const signOut = useCallback(
    async (everywhere: boolean) => {
      setBusy(true);
      const r = await api("POST", "/api/auth/signout", everywhere ? { everywhere: true } : {});
      setBusy(false);
      setMenuOpen(false);
      if (r.ok) router.replace("/signin");
    },
    [router],
  );

  return (
    <div className="pshell" data-theme="anime-sky" data-band="teen">
      <header className="pshell-top">
        <div>
          <p className="pshell-eyebrow">myKx parents</p>
          <h1 className="pshell-title">{household}</h1>
        </div>
        <div className="pshell-actions">
          <Link className="mk-btn mk-btn--secondary pshell-doors" href="/doors">
            Kids&apos; doors
          </Link>
          <div className="pshell-menu" ref={menuBox}>
            <button type="button" className="pshell-avatar" aria-haspopup="menu" aria-expanded={menuOpen} aria-label={name ? `${name}: account menu` : "Account menu"} onClick={() => setMenuOpen((o) => !o)}>
              {(name ?? "?").slice(0, 1).toUpperCase()}
            </button>
            {menuOpen && (
              <div className="pshell-dropdown" role="menu" aria-label="Account">
                {isAdmin && (
                  <Link role="menuitem" className="pshell-item" href="/admin/people" onClick={() => setMenuOpen(false)}>
                    Admin · People
                  </Link>
                )}
                <button role="menuitem" type="button" className="pshell-item" disabled={busy} onClick={() => void signOut(false)}>
                  Sign out here
                </button>
                <button role="menuitem" type="button" className="pshell-item" disabled={busy} onClick={() => void signOut(true)}>
                  Sign out everywhere
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      <main className="pshell-main">
        {signedOut ? (
          <section className="pshell-card" aria-label="Sign in">
            <h2 className="pshell-h2">Sign in to see your family</h2>
            <p className="pshell-p">This device isn&apos;t signed in as a grown-up right now.</p>
            <Link className="mk-btn mk-btn--primary" href="/signin?next=/parent">
              Sign in
            </Link>
          </section>
        ) : tab === "today" ? (
          <section aria-label="Today">
            {kids !== null && kids.length === 0 ? (
              <div className="pshell-card">
                <p className="pshell-p">No kids yet. Add one in Your family to get started.</p>
                <Link className="mk-btn mk-btn--primary" href="/family">
                  Open Your family
                </Link>
              </div>
            ) : (
              <ParentToday />
            )}
          </section>
        ) : tab === "where" ? (
          <section aria-label="Where">
            <WhereTab onTab={setTab} />
          </section>
        ) : tab === "home" ? (
          <section aria-label="Home">
            <HomeNowTab onTab={setTab} />
          </section>
        ) : tab === "messages" ? (
          <section aria-label="Messages">
            <ParentMessages />
          </section>
        ) : tab === "notebook" ? (
          <section aria-label="Notebook">
            <ParentNotebook />
          </section>
        ) : (
          <section aria-label="Family">
            <h2 className="pshell-h2">Family</h2>
            <div className="pshell-card">
              <p className="pshell-p">Codes and passwords, limits, the parent PIN, and removing a kid all live in Your family.</p>
              <Link className="mk-btn mk-btn--primary" href="/family">
                Open Your family
              </Link>
            </div>
          </section>
        )}
      </main>

      <nav className="pshell-bar" aria-label="Parent">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            className="pshell-tab"
            aria-current={tab === t.id ? "page" : undefined}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </nav>
    </div>
  );
}
