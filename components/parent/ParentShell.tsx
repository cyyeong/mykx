"use client";

// The parent dashboard shell (USER_STORIES §8.4 fix 6; boards ParentHarbour and ParentBloom, founder 29 Oct): Today,
// Location, Sentry, Messages and Notebook, and Guild Options (the family's settings page, opened directly). A left
// rail from 600 px, a bottom bar on phones. Today opens with a header in the grown-up's own look (Harbour or Bloom,
// components/parent/look.ts): the art, a greeting and the Tonight summary, then the weekend and the kids' week.
// The tab is in the address (?tab=), so "Back to the dashboard" and a reload land where you were, Today by default.
// Today is the guardian's picture (ParentToday); Messages are family threads with Kix stickers (ParentMessages);
// Notebook is what Kix remembers, editable and wipeable (ParentNotebook).
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "@/components/account/api";
import { HomeNowTab } from "@/components/home-watch/HomeNowTab";
import { WhereTab } from "@/components/location/WhereTab";
import { Art } from "@/components/ui/Art";
import { PARENT_LOOKS, useDayPart, useParentLook, useToday } from "./look";
import { ParentMessages } from "./ParentMessages";
import { ParentNotebook } from "./ParentNotebook";
import { ParentToday } from "./ParentToday";
import { TogetherCard } from "./TogetherCard";
import { TonightCard } from "./TonightCard";
import "./parent.css";

type Tab = "today" | "location" | "sentry" | "messages" | "notebook";

type Kid = { id: string; nickname: string; level: string | null; band: string | null };
type KidsReply = { household?: { name?: string }; kids?: Kid[] };

const ICON: Record<Tab | "guild" | "doors", string> = {
  today: "M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z",
  location: "M12 21s-7-6.2-7-11a7 7 0 1 1 14 0c0 4.8-7 11-7 11zM12 12.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z",
  sentry: "M12 3 4 6v6c0 5 3.4 8.6 8 9.9 4.6-1.3 8-4.9 8-9.9V6zM9 12l2 2 4-4",
  messages: "M21 12a8 8 0 0 1-11.6 7.1L4 20.5l1.4-5A8 8 0 1 1 21 12z",
  notebook: "M6 3h11a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6zM6 3v18M10 8h5M10 12h5",
  guild: "M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM19.4 13.5l1.6 1.2-2 3.4-1.9-.7a7 7 0 0 1-2 1.2l-.3 2h-4l-.3-2a7 7 0 0 1-2-1.2l-1.9.7-2-3.4 1.6-1.2a7 7 0 0 1 0-3l-1.6-1.2 2-3.4 1.9.7a7 7 0 0 1 2-1.2l.3-2h4l.3 2a7 7 0 0 1 2 1.2l1.9-.7 2 3.4-1.6 1.2a7 7 0 0 1 0 3z",
  doors: "M5 21V4a1 1 0 0 1 1-1h12a1 1 0 0 1 1 1v17M3 21h18M14 12h.01",
};

const TABS: { id: Tab; label: string }[] = [
  { id: "today", label: "Today" },
  { id: "location", label: "Location" },
  { id: "sentry", label: "Sentry" },
  { id: "messages", label: "Messages" },
  { id: "notebook", label: "Notebook" },
];
// Older links (?tab=where, ?tab=home) still land on the renamed tabs.
const ALIAS: Record<string, Tab> = { where: "location", home: "sentry" };
const asTab = (v: string | null): Tab => (v && (TABS.some((t) => t.id === v) ? (v as Tab) : ALIAS[v])) || "today";

const Icon = ({ d, size = 20 }: { d: string; size?: number }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true" className="picon">
    <path d={d} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export function ParentShell({ name, isAdmin }: { name: string | null; isAdmin: boolean }) {
  const router = useRouter();
  const params = useSearchParams();
  // The tab is read from the address every render, so "Back to the dashboard" (?tab=today) always wins.
  const tab = asTab(params.get("tab"));
  const [kids, setKids] = useState<Kid[] | null>(null);
  const [household, setHousehold] = useState("Your family");
  const [signedOut, setSignedOut] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [look, setLook] = useParentLook(name);
  const part = useDayPart();
  const today = useToday();
  const menuBox = useRef<HTMLDivElement>(null);

  // The tab lives in the address without a server round trip; Today keeps the address clean.
  const setTab = useCallback((t: Tab) => {
    window.history.replaceState(null, "", t === "today" ? "/parent" : `/parent?tab=${t}`);
    window.scrollTo({ top: 0 });
  }, []);

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

  const kidCount = kids?.length ?? 0;
  const lookLabel = PARENT_LOOKS.find((l) => l.id === look)!.label;

  return (
    <div className="pshell" data-theme="anime-sky" data-band="teen" data-look={look}>
      <nav className="prail" aria-label="Parent">
        <div className="pbrand">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/wordmark-on-light.svg" alt="myKx" />
          <span>Parents</span>
        </div>
        <div className="ptabs">
          {TABS.map((t) => (
            <button key={t.id} type="button" className="ptab" aria-current={tab === t.id ? "page" : undefined} onClick={() => setTab(t.id)}>
              <Icon d={ICON[t.id]} />
              <span>{t.label}</span>
            </button>
          ))}
          <span className="psep" aria-hidden="true" />
          <Link className="ptab" href="/family">
            <Icon d={ICON.guild} />
            <span>Guild Options</span>
          </Link>
        </div>
        <div className="pfoot">
          <Link className="pdoors" href="/doors">
            <Icon d={ICON.doors} size={16} />
            Kids&apos; doors
          </Link>
          <div className="pme" ref={menuBox}>
            <button type="button" className="pme-btn" aria-haspopup="menu" aria-expanded={menuOpen} aria-label={name ? `${name}: account menu` : "Account menu"} onClick={() => setMenuOpen((o) => !o)}>
              <b>{(name ?? "?").slice(0, 1).toUpperCase()}</b>
              <span>
                {name ?? "Grown-up"}
                <small>Look: {lookLabel}</small>
              </span>
            </button>
            {menuOpen && (
              <div className="pme-menu" role="menu" aria-label="Account">
                <p className="pme-label">Your look</p>
                {PARENT_LOOKS.map((l) => (
                  <button key={l.id} role="menuitemradio" aria-checked={look === l.id} type="button" className="pme-item" onClick={() => setLook(l.id)}>
                    <i className={`pme-swatch pme-swatch--${l.id}`} aria-hidden="true" />
                    <span>
                      {l.label}
                      <small>{l.note}</small>
                    </span>
                  </button>
                ))}
                <span className="pme-rule" aria-hidden="true" />
                {isAdmin && (
                  <Link role="menuitem" className="pme-item" href="/admin/people" onClick={() => setMenuOpen(false)}>
                    Admin
                  </Link>
                )}
                <button role="menuitem" type="button" className="pme-item" disabled={busy} onClick={() => void signOut(false)}>
                  Sign out here
                </button>
                <button role="menuitem" type="button" className="pme-item" disabled={busy} onClick={() => void signOut(true)}>
                  Sign out everywhere
                </button>
              </div>
            )}
          </div>
        </div>
      </nav>

      <div className="pbody">
        {signedOut ? (
          <main className="pmain">
            <section className="pcard" aria-label="Sign in">
              <h2 className="pcard-h">Sign in to see your family</h2>
              <p className="pcard-p">This device isn&apos;t signed in as a grown-up right now.</p>
              <Link className="pbtn" href="/signin?next=/parent">
                Sign in
              </Link>
            </section>
          </main>
        ) : tab === "today" ? (
          <>
            <header className="phero">
              <Art base={`/art/parent/${look}`} alt="" className="phero-art" sizes="(min-width: 1024px) 80vw, 100vw" />
              <div className="phero-in">
                <p className="peyebrow">{today ? `${today} · ${part}` : " "}</p>
                <h1 className="phello">
                  {part ? `Good ${part}` : "Hello"}
                  {name ? `, ${name}` : ""}
                </h1>
                <p className="phh">
                  {household}
                  {kids ? ` · ${kidCount === 0 ? "no kids yet" : kidCount === 1 ? "one kid" : `${kidCount} kids`}` : ""}
                </p>
                <TonightCard />
              </div>
            </header>
            <main className="pmain" aria-label="Today">
              {kids !== null && kids.length === 0 ? (
                <section className="pcard">
                  <h2 className="pcard-h">Add your first kid</h2>
                  <p className="pcard-p">Add a kid in Guild Options to get started: their magic name, their level and their world.</p>
                  <Link className="pbtn" href="/family">
                    Open Guild Options
                  </Link>
                </section>
              ) : (
                <>
                  <TogetherCard />
                  <ParentToday />
                </>
              )}
            </main>
          </>
        ) : (
          <main className="pmain">
            {tab === "location" ? (
              <section aria-label="Location">
                <WhereTab onTab={() => setTab("messages")} />
              </section>
            ) : tab === "sentry" ? (
              <section aria-label="Sentry">
                <HomeNowTab onTab={() => setTab("messages")} />
              </section>
            ) : tab === "messages" ? (
              <section aria-label="Messages">
                <ParentMessages />
              </section>
            ) : (
              <section aria-label="Notebook">
                <ParentNotebook />
              </section>
            )}
          </main>
        )}
      </div>
    </div>
  );
}
