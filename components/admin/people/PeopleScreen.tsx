"use client";

// Admin "People", ported from the AdminPeople board (canvas row 8): search households and accounts, filter, act on
// a row or in the detail panel, and see this session's actions. Data: GET /api/admin/people and
// POST /api/admin/people/[id] (docs/prd/ACCOUNTS.md §3-4). Admins see account details only: never a child's
// messages, Notebook, answers or secrets. Every action is a server route that writes the audit log.
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { api, type ApiResult } from "@/components/account/api";
import { whenLabel, upperFirst } from "@/components/account/format";
import { Switch } from "@/components/account/Switch";
import { WORLD_SCENE } from "@/components/account/worlds";
import { kixSprite } from "@/components/signin/looks";
import type { PackId } from "@/components/theme/packs";
import type { AccountStatus, AdminAction, HouseholdRow, PersonRow, SecretKind } from "@/lib/auth/schemas";
import "./people.css";

/** PersonRow plus two optional extras the list can use when the server sends them. */
type Person = PersonRow & { secretKind?: SecretKind | null; pack?: PackId | null };
type PeopleResult = { households: (Omit<HouseholdRow, "people"> & { people: Person[] })[]; viewerId?: string | null };
type Row = Person & { householdId: string; household: string };
type Load = { phase: "loading" } | { phase: "error" } | { phase: "signin" } | { phase: "forbidden" } | { phase: "ready"; rows: Row[]; viewerId: string | null };
type Filter = "all" | "parents" | "kids" | "admins" | "locked";
type Notice = { tone: "ok" | "warn"; text: string };
type LogKind = "lock" | "unlock" | "enable" | "disable" | "key" | "mail" | "admin";
type LogEntry = { n: number; rest: string; at: number; kind: LogKind };

const I = {
  user: "M4 21a8 8 0 0 1 16 0M8 7a4 4 0 1 0 8 0a4 4 0 1 0-8 0",
  star: "M12 3l2.6 5.6 6 .7-4.5 4.1 1.2 6L12 16.4 6.7 19.4l1.2-6L3.4 9.3l6-.7z",
  shield: "M12 2l8 3v6c0 5-3.5 9.5-8 11-4.5-1.5-8-6-8-11V5z",
  check: "M3 12a9 9 0 1 0 18 0a9 9 0 1 0-18 0M8 12l3 3 5-6",
  lock: "M5 11h14v10H5zM8 11V7a4 4 0 0 1 8 0v4",
  unlock: "M5 11h14v10H5zM8 11V7a4 4 0 0 1 7.8-1.3",
  slash: "M3 12a9 9 0 1 0 18 0a9 9 0 1 0-18 0M5.6 5.6l12.8 12.8",
  key: "M4 15a4 4 0 1 0 8 0a4 4 0 1 0-8 0M10.8 12.2 20 3M16.5 6.5l3 3M14 9l2 2",
  mail: "M3 5h18v14H3zM3 6l9 7 9-7",
  power: "M12 3v9M6.4 6.4a8 8 0 1 0 11.2 0",
  eyeOff: "M3 3l18 18M10.6 5.1A10 10 0 0 1 12 5c6.5 0 10 7 10 7a17 17 0 0 1-3.2 4.1M6.6 6.6C3.7 8.4 2 12 2 12s3.5 7 10 7c1.8 0 3.4-.5 4.8-1.3M9.9 9.9a3 3 0 0 0 4.2 4.2",
  warn: "M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0zM12 9v4M12 17h.01",
  close: "M6 6l12 12M18 6L6 18",
};
const FILTERS: readonly [Filter, string][] = [
  ["all", "All"],
  ["parents", "Parents"],
  ["kids", "Kids"],
  ["admins", "Admins"],
  ["locked", "Locked"],
];
const NAV = [
  { href: "/admin/skills", label: "Skills" },
  { href: "/admin/knowledge", label: "Add knowledge" },
  { href: "/admin/people", label: "People", current: true },
  { href: "/admin/under-the-hood", label: "Under the hood" },
];

const BADGE: CSSProperties = { display: "inline-flex", alignItems: "center", gap: 5, padding: "2px 10px 2px 8px", borderRadius: "var(--radius-pill)", fontSize: 13, lineHeight: "20px", fontWeight: 700, whiteSpace: "nowrap" };
const STATUS: Record<AccountStatus, { label: string; icon: string; style: CSSProperties }> = {
  active: { label: "Active", icon: I.check, style: { display: "inline-flex", alignItems: "center", gap: 6, fontSize: 14, lineHeight: "20px", fontWeight: 700, color: "var(--success)", whiteSpace: "nowrap" } },
  locked: { label: "Locked", icon: I.lock, style: { ...BADGE, background: "var(--warn)", color: "var(--on-warn)" } },
  disabled: { label: "Disabled", icon: I.slash, style: { ...BADGE, color: "var(--ink-muted)", boxShadow: "inset 0 0 0 1.5px var(--border-control)" } },
};
const DOT: CSSProperties = { display: "grid", placeItems: "center", flex: "none", width: 30, height: 30, marginTop: -4, borderRadius: "50%" };
const QUIET: CSSProperties = { background: "var(--surface)", color: "var(--ink)", boxShadow: "inset 0 0 0 1px var(--line)" };
const KIND: Record<LogKind, [string, CSSProperties]> = {
  lock: [I.lock, { background: "var(--warn)", color: "var(--on-warn)" }],
  unlock: [I.unlock, { background: "var(--success)", color: "var(--on-success)" }],
  enable: [I.power, { background: "var(--success)", color: "var(--on-success)" }],
  disable: [I.slash, { background: "var(--surface)", color: "var(--ink-muted)", boxShadow: "inset 0 0 0 1.5px var(--border-control)" }],
  key: [I.key, QUIET],
  mail: [I.mail, QUIET],
  admin: [I.shield, { background: "var(--ink)", color: "var(--surface-raised)" }],
};
const cell: CSSProperties = { padding: "8px 12px", borderTop: "1px solid var(--line)", verticalAlign: "middle" };
const th: CSSProperties = { padding: 12, textAlign: "left", fontSize: 14, lineHeight: "20px", fontWeight: 700, color: "var(--ink-muted)", whiteSpace: "nowrap" };
const panelCard: CSSProperties = { display: "flex", flexDirection: "column", padding: 18, borderRadius: "var(--radius-md)", background: "var(--surface-raised)", boxShadow: "var(--shadow-raised)" };

const isKid = (p: Person) => p.role === "child";
const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join("") || "?";
/** "d•••@example.com": enough to recognise, not enough to copy. */
const maskEmail = (email: string | null) => {
  if (!email) return "No email";
  const [user, domain] = email.split("@");
  return domain ? `${user.slice(0, 1)}•••@${domain}` : "•••";
};
const secretWord = (p: Person) => (p.secretKind === "pictures" ? "picture code" : p.secretKind === "password" ? "password" : "code or password");
const lastLabel = (p: Person) => upperFirst(whenLabel(p.lastSignInAt) ?? "never");

function Icon({ d, size = 20, stroke = 2, style }: { d: string; size?: number; stroke?: number; style?: CSSProperties }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" style={{ width: size, height: size, flex: "none", ...style }}>
      <path fill="none" stroke="currentColor" strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round" d={d} />
    </svg>
  );
}

function Badge({ p, role }: { p: Person; role: "kid" | "parent" | "admin" }) {
  if (role === "kid")
    return (
      <span style={{ ...BADGE, background: "var(--accent-2)", color: "var(--on-accent-2)" }}>
        <Icon d={I.star} size={14} stroke={2.2} />
        Kid{p.level ? ` · ${p.level}` : ""}
      </span>
    );
  if (role === "admin")
    return (
      <span style={{ ...BADGE, background: "var(--ink)", color: "var(--surface-raised)" }}>
        <Icon d={I.shield} size={14} stroke={2.2} />
        Admin
      </span>
    );
  return (
    <span style={{ ...BADGE, background: "var(--surface-raised)", color: "var(--ink)", boxShadow: "inset 0 0 0 1.5px var(--border-control)" }}>
      <Icon d={I.user} size={14} stroke={2.2} />
      Parent
    </span>
  );
}

function Roles({ p }: { p: Person }) {
  return (
    <>
      <Badge p={p} role={isKid(p) ? "kid" : "parent"} />
      {p.isAdmin && <Badge p={p} role="admin" />}
    </>
  );
}

function Status({ status }: { status: AccountStatus }) {
  const s = STATUS[status];
  return (
    <span style={s.style}>
      <Icon d={s.icon} size={15} stroke={2.2} />
      {s.label}
    </span>
  );
}

/** Kids get their world's Kix; grown-ups get initials. Decorative: the name is always beside it. */
function Avatar({ p, size }: { p: Person; size: number }) {
  const ring = size > 40 ? "0 0 0 3px var(--surface-raised), 0 0 0 4.5px var(--line)" : "0 0 0 2px var(--surface-raised), 0 0 0 3px var(--line)";
  if (isKid(p)) {
    const pack = p.pack ?? "dreamlight";
    return (
      <span aria-hidden="true" style={{ position: "relative", display: "block", flex: "none", width: size, height: size, borderRadius: "50%", overflow: "hidden", background: WORLD_SCENE[pack], boxShadow: ring }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={kixSprite(pack)} alt="" style={{ position: "absolute", left: "50%", bottom: -Math.round(size * 0.1), transform: "translateX(-50%)", height: Math.round(size * 1.12), width: "auto", maxWidth: "none" }} />
      </span>
    );
  }
  return (
    <span aria-hidden="true" style={{ display: "grid", placeItems: "center", flex: "none", width: size, height: size, borderRadius: "50%", background: "var(--surface)", boxShadow: "inset 0 0 0 1.5px var(--border-control)", color: "var(--ink)", fontSize: size > 40 ? 18 : 13, lineHeight: 1, fontWeight: 800, letterSpacing: ".02em" }}>
      {initials(p.nickname)}
    </span>
  );
}

function NoticeLine({ notice, cls }: { notice: Notice; cls: string }) {
  const ok = notice.tone === "ok";
  return (
    <p className={cls} style={{ margin: 0, display: "flex", alignItems: "flex-start", gap: 10, padding: "10px 12px", borderRadius: "var(--radius-sm)", background: "var(--surface-raised)", boxShadow: `inset 0 0 0 1.5px var(${ok ? "--success" : "--warn"})`, fontSize: 16, lineHeight: "22px" }}>
      <Icon d={ok ? I.check : I.warn} stroke={2.2} style={{ marginTop: 1, color: ok ? "var(--success)" : "var(--warn)" }} />
      <span>{notice.text}</span>
    </p>
  );
}

function Gate({ title, body, link }: { title: string; body: string; link?: ReactNode }) {
  return (
    <div style={{ ...panelCard, gap: 10, alignItems: "flex-start", maxWidth: 560 }}>
      <h2 style={{ margin: 0, font: "800 22px/28px var(--font-display)" }}>{title}</h2>
      <p style={{ margin: 0, fontSize: 16, lineHeight: "22px", color: "var(--ink-muted)" }}>{body}</p>
      {link}
    </div>
  );
}

function flatten(data: PeopleResult): Row[] {
  return data.households.flatMap((h) => h.people.map((p) => ({ ...p, householdId: h.id, household: h.name })));
}

export function PeopleScreen() {
  const router = useRouter();
  const [load, setLoad] = useState<Load>({ phase: "loading" });
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [sel, setSel] = useState<string | null>(null);
  const [confirm, setConfirm] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [rowNotice, setRowNotice] = useState<Notice | null>(null);
  const [log, setLog] = useState<LogEntry[]>([]);
  const [resetDone, setResetDone] = useState<Record<string, boolean>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const seq = useRef(0);
  const first = useRef(true);
  const query = q.trim();

  const fetchPeople = useCallback(async (term: string) => {
    const mine = ++seq.current;
    const r = await api<PeopleResult>("GET", `/api/admin/people${term ? `?q=${encodeURIComponent(term)}` : ""}`);
    if (mine !== seq.current) return false; // a newer search answered first
    const data = r.data;
    if (r.ok && data && Array.isArray(data.households)) {
      setLoad({ phase: "ready", rows: flatten(data), viewerId: data.viewerId ?? null });
      return true;
    }
    if (r.status === 401) setLoad({ phase: "signin" });
    else if (r.status === 403) setLoad({ phase: "forbidden" });
    else setLoad((prev) => (prev.phase === "ready" ? prev : { phase: "error" }));
    return false;
  }, []);

  // Search on the server as you type (names, nicknames and households), a beat after the last key.
  useEffect(() => {
    const wait = first.current ? 0 : 260;
    first.current = false;
    const t = window.setTimeout(() => void fetchPeople(query), wait);
    return () => window.clearTimeout(t);
  }, [query, fetchPeople]);

  const rows = load.phase === "ready" ? load.rows : [];
  const viewerId = load.phase === "ready" ? load.viewerId : null;
  const synthetic = rows.some((p) => p.synthetic);
  const inFilter = (p: Row, f: Filter) =>
    f === "all" || (f === "parents" && !isKid(p)) || (f === "kids" && isKid(p)) || (f === "admins" && p.isAdmin) || (f === "locked" && p.status === "locked");
  const shown = rows.filter((p) => inFilter(p, filter));
  const selP = rows.find((p) => p.id === sel) ?? null;
  const parentOf = (p: Row) => rows.find((x) => x.householdId === p.householdId && x.role === "parent")?.nickname ?? "Their grown-up";
  const noticeCls = log.length % 2 ? "ap-in" : "ap-in2";

  const select = (id: string) => {
    setSel(id);
    setConfirm(false);
    setNotice(null);
    setRowNotice(null);
    // Below 1440 px the detail panel sits under the list: bring it into view.
    if (window.matchMedia("(max-width: 1439px)").matches) {
      const behavior = window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth";
      window.setTimeout(() => document.getElementById("ap-detail")?.scrollIntoView({ behavior, block: "start" }), 40);
    }
  };

  /** What each action says afterwards, in the audit log and next to where it was taken. */
  const describe = (p: Row, action: AdminAction): { rest: string; kind: LogKind; text: string } => {
    const name = p.nickname;
    switch (action) {
      case "reset-kid-secret": {
        const word = secretWord(p);
        const how = p.secretKind === "pictures" ? `picks a new one with ${name} on their family device` : "sets a new one in Your family";
        return { rest: `reset ${name}'s ${word}`, kind: "key", text: `${name}'s old ${word} no longer works. ${parentOf(p)} ${how}.` };
      }
      case "reset-parent-password":
        return { rest: `sent a password reset email to ${name}`, kind: "mail", text: `Reset email sent to ${maskEmail(p.email)}.` };
      case "lock":
        return { rest: `locked ${name}`, kind: "lock", text: `${name} can't sign in until someone unlocks the account.` };
      case "unlock":
        return { rest: `unlocked ${name}`, kind: "unlock", text: `${name} can sign in again.` };
      case "disable":
        return { rest: `disabled ${name}`, kind: "disable", text: `${name}'s account is disabled. Nothing was deleted.` };
      case "enable":
        return { rest: `enabled ${name}`, kind: "enable", text: `${name} can sign in again.` };
      case "grant-admin":
        return { rest: `made ${name} an admin`, kind: "admin", text: `${name} is now an admin.` };
      case "revoke-admin":
        return { rest: `removed admin access from ${name}`, kind: "admin", text: `${name} is no longer an admin.` };
    }
  };

  const failText = (r: ApiResult<unknown>) =>
    r.reason === "self"
      ? "You can't do that to your own account. Ask another admin."
      : r.reason === "not-allowed"
        ? "That action doesn't apply to this account."
        : r.reason === "not-found"
          ? "That account isn't there any more."
          : "That didn't work. Try again in a moment.";

  const run = async (p: Row, action: AdminAction, where: "row" | "panel") => {
    if (busy) return;
    setBusy(`${p.id}:${action}`);
    setNotice(null);
    setRowNotice(null);
    const r = await api("POST", `/api/admin/people/${p.id}`, { action });
    if (r.ok) {
      const d = describe(p, action);
      await fetchPeople(query);
      setLog((l) => [{ n: l.length + 1, rest: d.rest, at: Date.now(), kind: d.kind }, ...l]);
      if (action === "reset-kid-secret" || action === "reset-parent-password") setResetDone((m) => ({ ...m, [p.id]: true }));
      setConfirm(false);
      setSel(p.id);
      (where === "row" ? setRowNotice : setNotice)({ tone: "ok", text: d.text });
    } else if (r.status === 401) setLoad({ phase: "signin" });
    else if (r.status === 403) setLoad({ phase: "forbidden" });
    else (where === "row" ? setRowNotice : setNotice)({ tone: "warn", text: failText(r) });
    setBusy(null);
  };

  const resetAction = (p: Row): AdminAction => (isKid(p) ? "reset-kid-secret" : "reset-parent-password");
  const resetLabel = (p: Row) => (isKid(p) ? `Reset ${p.nickname}'s ${secretWord(p)}` : `Send ${p.nickname} a password reset email`);
  const lockLabel = (p: Row, self: boolean) =>
    self ? `Lock ${p.nickname} (not available on your own account)` : p.status === "disabled" ? `Lock ${p.nickname} (account is disabled)` : p.status === "locked" ? `Unlock ${p.nickname}` : `Lock ${p.nickname}`;
  const busyFor = (p: Row) => busy?.startsWith(`${p.id}:`) ?? false;

  const rowButtons = (p: Row, titles: boolean) => {
    const self = p.id === viewerId;
    const rl = resetLabel(p);
    const ll = lockLabel(p, self);
    return (
      <>
        <button className="ap-click ap-ibtn" type="button" onClick={() => run(p, resetAction(p), "row")} disabled={p.status === "disabled" || busy !== null} aria-label={rl} title={titles ? rl : undefined}>
          <Icon d={I.key} />
        </button>
        <button className="ap-click ap-ibtn" type="button" onClick={() => run(p, p.status === "locked" ? "unlock" : "lock", "row")} disabled={p.status === "disabled" || self || busy !== null} aria-label={ll} title={titles ? ll : undefined}>
          <Icon d={p.status === "locked" ? I.unlock : I.lock} />
        </button>
        <button className="ap-click ap-ibtn" type="button" onClick={() => select(p.id)} aria-label={`More about ${p.nickname}`} title={titles ? `More about ${p.nickname}` : undefined} aria-controls="ap-detail">
          <svg viewBox="0 0 24 24" aria-hidden="true" style={{ width: 20, height: 20 }}>
            <circle cx="5" cy="12" r="1.8" fill="currentColor" />
            <circle cx="12" cy="12" r="1.8" fill="currentColor" />
            <circle cx="19" cy="12" r="1.8" fill="currentColor" />
          </svg>
        </button>
      </>
    );
  };

  // ---- Detail panel ----
  const detail = (() => {
    if (!selP) return null;
    const p = selP;
    const kid = isKid(p);
    const self = p.id === viewerId;
    const mates = rows.filter((x) => x.householdId === p.householdId && x.id !== p.id);
    const facts: [string, string][] = kid
      ? [
          ["Household", p.household],
          ["Level", p.level ? `${p.level} · ${p.band === "junior" ? "Junior" : "Teen"} look` : "Not set"],
          ["Sign-in", upperFirst(secretWord(p)) + (resetDone[p.id] ? " (reset just now)" : "")],
          ["Last sign-in", lastLabel(p)],
        ]
      : [
          ["Household", p.household],
          ["Email", maskEmail(p.email)],
          ["Sign-in", "Email and password" + (resetDone[p.id] ? " (reset email sent)" : "")],
          ["Last sign-in", lastLabel(p)],
        ];
    const pending = busyFor(p);
    return (
      <>
        <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
          <Avatar p={p} size={56} />
          <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 6 }}>
            <h2 id="ap-detail-h" style={{ margin: 0, font: "800 22px/28px var(--font-display)", overflowWrap: "anywhere" }}>
              {p.nickname}
            </h2>
            <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "6px 8px" }}>
              <Roles p={p} />
              <Status status={p.status} />
            </div>
          </div>
          <button className="ap-click ap-ibtn" type="button" onClick={() => setSel(null)} aria-label="Close details" style={{ margin: "-8px -8px 0 0", color: "var(--ink-muted)" }}>
            <Icon d={I.close} stroke={2.2} />
          </button>
        </div>
        <div role="status" aria-live="polite">
          {notice && <NoticeLine notice={notice} cls={noticeCls} />}
        </div>
        {p.status === "locked" && (
          <p style={{ margin: 0, display: "flex", alignItems: "flex-start", gap: 10, padding: "10px 12px", borderRadius: "var(--radius-sm)", background: "var(--surface)", boxShadow: "inset 0 0 0 1.5px var(--warn)", fontSize: 16, lineHeight: "22px" }}>
            <Icon d={I.lock} style={{ marginTop: 1, color: "var(--warn)" }} />
            <span>Locked. {p.nickname} can&apos;t sign in until the lock ends or someone unlocks the account.</span>
          </p>
        )}
        <dl style={{ margin: 0, display: "flex", flexDirection: "column" }}>
          {facts.map(([k, v]) => (
            <div key={k} style={{ display: "flex", flexWrap: "wrap", alignItems: "baseline", justifyContent: "space-between", gap: "0 12px", padding: "8px 0", boxShadow: "inset 0 -1px 0 var(--line)" }}>
              <dt style={{ fontSize: 14, lineHeight: "22px", fontWeight: 600, color: "var(--ink-muted)" }}>{k}</dt>
              <dd style={{ margin: 0, fontSize: 16, lineHeight: "22px", fontWeight: 600, textAlign: "right", overflowWrap: "anywhere" }}>{v}</dd>
            </div>
          ))}
        </dl>
        <p style={{ margin: 0, display: "flex", alignItems: "flex-start", gap: 10, fontSize: 16, lineHeight: "22px", color: "var(--ink-muted)" }}>
          <Icon d={I.eyeOff} size={18} style={{ marginTop: 2 }} />
          <span>{kid ? `${p.nickname}'s messages, Notebook and answers stay private. Admins can't open them.` : "Admins see account details only, never family messages or children's work."}</span>
        </p>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <h3 style={{ margin: 0, fontSize: 16, lineHeight: "22px", fontWeight: 700 }}>{mates.length ? `Others in ${p.household}` : "Household"}</h3>
          {mates.length > 0 ? (
            <ul style={{ margin: "0 -8px", padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 2 }}>
              {mates.map((m) => (
                <li key={m.id}>
                  <button className="ap-click ap-member" type="button" onClick={() => select(m.id)} style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", minHeight: 48, padding: "4px 8px", border: 0, borderRadius: "var(--radius-sm)", color: "var(--ink)", textAlign: "left", font: "inherit" }}>
                    <Avatar p={m} size={32} />
                    <span style={{ flex: 1, minWidth: 0, fontSize: 16, lineHeight: "22px", fontWeight: 600 }}>{m.nickname}</span>
                    <span style={{ fontSize: 14, lineHeight: "20px", color: "var(--ink-muted)", whiteSpace: "nowrap" }}>
                      {isKid(m) ? `Kid${m.level ? ` · ${m.level}` : ""}` : m.isAdmin ? "Parent · Admin" : "Parent"}
                    </span>
                    <Icon d="M9 6l6 6-6 6" size={16} style={{ color: "var(--ink-muted)" }} />
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <span style={{ fontSize: 16, lineHeight: "22px", color: "var(--ink-muted)" }}>No one else in {p.household}.</span>
          )}
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 10, paddingTop: 14, boxShadow: "inset 0 1px 0 var(--line)" }}>
          <h3 className="ap-sr">Actions</h3>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {p.status === "locked" && (
              <button className="mk-btn mk-btn--primary ap-click" type="button" onClick={() => run(p, "unlock", "panel")} disabled={busy !== null}>
                <Icon d={I.unlock} />
                {pending && busy?.endsWith(":unlock") ? "Unlocking…" : "Unlock"}
              </button>
            )}
            {p.status === "disabled" && (
              <button className="mk-btn mk-btn--primary ap-click" type="button" onClick={() => run(p, "enable", "panel")} disabled={busy !== null}>
                <Icon d={I.power} />
                Enable account
              </button>
            )}
            {p.status !== "disabled" && (
              <button className="mk-btn mk-btn--secondary ap-click" type="button" onClick={() => run(p, resetAction(p), "panel")} disabled={busy !== null}>
                <Icon d={kid ? I.key : I.mail} />
                {kid ? (p.secretKind === "pictures" ? "Reset code" : p.secretKind === "password" ? "Reset password" : "Reset sign-in") : "Send password reset email"}
              </button>
            )}
            {p.status === "active" && (
              <button className="mk-btn mk-btn--secondary ap-click" type="button" onClick={() => run(p, "lock", "panel")} disabled={self || busy !== null}>
                <Icon d={I.lock} />
                Lock
              </button>
            )}
            {p.status !== "disabled" && (
              <button
                className="ap-click ap-danger"
                type="button"
                onClick={() => {
                  if (!self) setConfirm(!confirm);
                  setNotice(null);
                }}
                aria-expanded={confirm}
                disabled={self || busy !== null}
                style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8, minHeight: 44, padding: "0 16px", border: 0, borderRadius: "var(--radius-pill)", font: "600 16px/1 var(--font-text)", whiteSpace: "nowrap" }}
              >
                <Icon d={I.slash} />
                Disable account
              </button>
            )}
          </div>
          {confirm && p.status !== "disabled" && !self && (
            <div className="ap-in" role="group" aria-labelledby="ap-dis-q" style={{ display: "flex", flexDirection: "column", gap: 10, padding: 14, borderRadius: "var(--radius-sm)", background: "var(--surface-raised)", boxShadow: "inset 0 0 0 2px var(--warn)" }}>
              <p id="ap-dis-q" style={{ margin: 0, display: "flex", alignItems: "flex-start", gap: 10, fontSize: 16, lineHeight: "23px", fontWeight: 700 }}>
                <Icon d={I.warn} stroke={2.2} style={{ marginTop: 2, color: "var(--warn)" }} />
                <span>Disable {p.nickname}&apos;s account?</span>
              </p>
              <span style={{ fontSize: 16, lineHeight: "22px", color: "var(--ink-muted)" }}>
                {!kid && mates.some(isKid)
                  ? `${p.nickname} can't sign in, so the kids in ${p.household} can't open their doors either, until an admin enables it again. Nothing is deleted.`
                  : `${p.nickname} can't sign in until an admin enables it again. Nothing is deleted.`}
              </span>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                <button className="ap-click" type="button" onClick={() => run(p, "disable", "panel")} disabled={busy !== null} style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", minHeight: 44, padding: "0 18px", border: 0, borderRadius: "var(--radius-pill)", background: "var(--warn)", color: "var(--on-warn)", font: "600 16px/1 var(--font-text)" }}>
                  {pending && busy?.endsWith(":disable") ? "Disabling…" : "Disable"}
                </button>
                <button className="mk-btn mk-btn--secondary ap-click" type="button" onClick={() => setConfirm(false)}>
                  Cancel
                </button>
              </div>
            </div>
          )}
          {!kid && (
            <div style={{ display: "flex", alignItems: "center", gap: 12, minHeight: 60 }}>
              <span style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 2 }}>
                <span id="ap-admin-l" style={{ fontSize: 16, lineHeight: "22px", fontWeight: 700 }}>
                  Admin
                </span>
                <span style={{ fontSize: 14, lineHeight: "20px", color: "var(--ink-muted)" }}>
                  {p.isAdmin ? "Can manage People, Skills and the audit log. Never sees children's work." : "Off. Turn on to let them manage People and Skills."}
                </span>
              </span>
              <Switch className="ap-click ap-switch" on={p.isAdmin} labelledBy="ap-admin-l" onToggle={() => run(p, p.isAdmin ? "revoke-admin" : "grant-admin", "panel")} disabled={self || busy !== null} />
            </div>
          )}
          {self && <span style={{ fontSize: 14, lineHeight: "20px", color: "var(--ink-muted)" }}>This is you. Another admin has to lock, disable or change admin access on your account.</span>}
        </div>
      </>
    );
  })();

  const gate =
    load.phase === "signin" ? (
      <Gate
        title="Sign in to see People"
        body="Your session has ended. Sign in with an admin account to continue."
        link={
          <Link href="/signin" className="mk-btn mk-btn--primary" style={{ textDecoration: "none" }}>
            Go to sign in
          </Link>
        }
      />
    ) : load.phase === "forbidden" ? (
      <Gate
        title="This page is for admins"
        body="Sign in with an admin account to see People. If you should have access, ask another admin."
        link={
          <Link href="/signin" className="mk-btn mk-btn--primary" style={{ textDecoration: "none" }}>
            Go to sign in
          </Link>
        }
      />
    ) : null;

  return (
    <div className="ap-root" data-theme="anime-sky" data-band="teen" style={{ width: "100%", minHeight: "100dvh", boxSizing: "border-box", position: "relative", overflowX: "clip", background: "var(--surface)", color: "var(--ink)", fontFamily: "var(--font-text)" }}>
      <div className="ap-shell">
        <nav className="ap-nav" aria-label="Admin" style={{ flex: "none", boxSizing: "border-box", display: "flex", background: "var(--surface-raised)" }}>
          <div className="ap-brand" style={{ display: "flex", alignItems: "center", gap: 10 }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/brand/wordmark-on-light.svg" alt="myKx" style={{ height: 24, width: "auto" }} />
            <span style={{ padding: "2px 8px", borderRadius: "var(--radius-pill)", background: "var(--ink)", color: "var(--surface)", fontSize: 11, lineHeight: "18px", fontWeight: 700, letterSpacing: ".04em" }}>ADMIN</span>
          </div>
          <div className="ap-navlist">
            {NAV.map((n) => (
              <Link
                key={n.href}
                href={n.href}
                className="ap-navi"
                aria-current={n.current ? "page" : undefined}
                style={{ display: "block", padding: 12, borderRadius: "var(--radius-sm)", fontSize: 16, lineHeight: "20px", fontWeight: 600, ...(n.current ? { background: "var(--surface)", color: "var(--accent)" } : { color: "var(--ink-muted)" }) }}
              >
                {n.label}
              </Link>
            ))}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <Link href="/family" className="ap-navi" style={{ display: "block", padding: 12, borderRadius: "var(--radius-sm)", fontSize: 15, lineHeight: "20px", fontWeight: 600, color: "var(--ink-muted)" }}>
              ← Back to my family
            </Link>
            <button
              type="button"
              className="ap-navi"
              onClick={async () => {
                await fetch("/api/auth/signout", { method: "POST" }).catch(() => null);
                router.replace("/signin");
              }}
              style={{ display: "block", width: "100%", padding: 12, border: 0, borderRadius: "var(--radius-sm)", background: "transparent", textAlign: "left", font: "600 15px/20px var(--font-text)", color: "var(--ink-muted)", cursor: "pointer" }}
            >
              Sign out
            </button>
          </div>
          <div className="ap-who" hidden={load.phase !== "ready"} style={{ padding: 12, borderRadius: "var(--radius-sm)", background: "var(--surface)", boxShadow: "inset 0 0 0 1px var(--line)", fontSize: 13, lineHeight: "18px", color: "var(--ink-muted)" }}>
            {(() => {
              const me = rows.find((p) => p.id === viewerId);
              return (
                <>
                  Signed in as <strong style={{ color: "var(--ink)" }}>{me ? me.nickname : "an admin"}</strong>
                  {synthetic && (
                    <>
                      <br />
                      Synthetic demo data
                    </>
                  )}
                </>
              );
            })()}
          </div>
        </nav>
        <main className="ap-main" style={{ flex: 1, minWidth: 0, boxSizing: "border-box", display: "flex", flexDirection: "column", gap: 20 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <h1 style={{ margin: 0, font: "800 32px/38px var(--font-display)" }}>People</h1>
            <span className="ap-sub" style={{ display: "flex", alignItems: "flex-start", gap: 8, color: "var(--ink-muted)" }}>
              <Icon d={I.eyeOff} size={18} style={{ marginTop: 3 }} />
              <span>Households and accounts. Admins see account details only, never a child&apos;s messages, Notebook or answers.</span>
            </span>
          </div>

          {gate ?? (
            <>
              <div className="ap-tools" style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 12 }}>
                <div className="ap-search" style={{ minWidth: 0 }}>
                  <label className="ap-sr" htmlFor="ap-q">
                    Search people
                  </label>
                  <div className="ap-field" style={{ display: "flex", alignItems: "center", gap: 8, minHeight: 48, padding: "0 2px 0 16px", borderRadius: "var(--radius-pill)", background: "var(--surface-raised)" }}>
                    <Icon d="M4 11a7 7 0 1 0 14 0a7 7 0 1 0-14 0M21 21l-4.3-4.3" style={{ color: "var(--ink-muted)" }} />
                    <input
                      className="ap-input"
                      id="ap-q"
                      type="search"
                      autoComplete="off"
                      value={q}
                      onChange={(e) => {
                        setQ(e.target.value);
                        setRowNotice(null);
                      }}
                      placeholder="Name or household"
                      style={{ flex: 1, minWidth: 0, height: 44, padding: 0, border: 0, background: "transparent", color: "var(--ink)", font: "400 16px/1 var(--font-text)" }}
                    />
                    {q.length > 0 && (
                      <button className="ap-click ap-ibtn" type="button" onClick={() => setQ("")} aria-label="Clear search">
                        <Icon d={I.close} size={18} stroke={2.2} />
                      </button>
                    )}
                  </div>
                </div>
                <div className="ap-chips" role="group" aria-label="Show" style={{ display: "flex", gap: 8 }}>
                  {FILTERS.map(([id, label]) => {
                    const on = id === filter;
                    return (
                      <button
                        key={id}
                        className="ap-click ap-chip"
                        type="button"
                        onClick={() => {
                          setFilter(id);
                          setRowNotice(null);
                        }}
                        aria-pressed={on}
                        style={{ display: "inline-flex", alignItems: "center", gap: 8, minHeight: 44, padding: "0 12px 0 16px", border: 0, borderRadius: "var(--radius-pill)", font: "600 16px/1 var(--font-text)", whiteSpace: "nowrap" }}
                      >
                        {label}
                        <span
                          style={{
                            minWidth: 22,
                            padding: "2px 6px",
                            boxSizing: "border-box",
                            borderRadius: 999,
                            fontSize: 13,
                            lineHeight: "16px",
                            fontWeight: 700,
                            textAlign: "center",
                            fontVariantNumeric: "tabular-nums",
                            ...(on ? { background: "rgba(255, 255, 255, 0.22)", color: "inherit" } : { background: "var(--surface)", color: "var(--ink-muted)", boxShadow: "inset 0 0 0 1px var(--line)" }),
                          }}
                        >
                          {rows.filter((p) => inFilter(p, id)).length}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="ap-split" style={{ display: "grid", gap: 20, alignItems: "start" }}>
                <div style={{ display: "flex", flexDirection: "column", gap: 12, minWidth: 0 }}>
                  <div role="status" aria-live="polite">
                    {rowNotice && <NoticeLine notice={rowNotice} cls={noticeCls} />}
                  </div>
                  {load.phase === "loading" && (
                    <div className="ap-skel" aria-busy="true" style={{ display: "flex", flexDirection: "column", gap: 2, padding: 12, borderRadius: "var(--radius-md)", background: "var(--surface-raised)", boxShadow: "inset 0 0 0 1px var(--line), var(--shadow-raised)" }}>
                      <span className="ap-sr" role="status">
                        Loading people…
                      </span>
                      {[0, 1, 2, 3, 4].map((i) => (
                        <span key={i} className="ap-skel-row" aria-hidden="true">
                          <span className="ap-skel-dot" />
                          <span className="ap-skel-line" style={{ width: `${34 - i * 3}%` }} />
                          <span className="ap-skel-line" style={{ width: "18%", marginLeft: "auto" }} />
                        </span>
                      ))}
                    </div>
                  )}
                  {load.phase === "error" && (
                    <div role="alert" style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 10, padding: 24, borderRadius: "var(--radius-md)", background: "var(--surface-raised)", boxShadow: "inset 0 0 0 1px var(--line)" }}>
                      <span style={{ fontSize: 18, lineHeight: "24px", fontWeight: 700 }}>We couldn&apos;t load People.</span>
                      <span style={{ fontSize: 16, lineHeight: "22px", color: "var(--ink-muted)" }}>Check your connection, then try again.</span>
                      <button
                        className="mk-btn mk-btn--secondary ap-click"
                        type="button"
                        onClick={() => {
                          setLoad({ phase: "loading" });
                          void fetchPeople(query);
                        }}
                      >
                        Try again
                      </button>
                    </div>
                  )}
                  {load.phase === "ready" && shown.length > 0 && (
                    <>
                      {/* Expanded and medium: a real table that scrolls in its own box */}
                      <div className="ap-tablebox" style={{ overflowX: "auto", borderRadius: "var(--radius-md)", background: "var(--surface-raised)", boxShadow: "inset 0 0 0 1px var(--line), var(--shadow-raised)" }}>
                        <table style={{ width: "100%", minWidth: 740, borderCollapse: "separate", borderSpacing: 0, fontSize: 16, lineHeight: "22px" }}>
                          <caption className="ap-sr">{`Accounts: ${shown.length} of ${rows.length} shown. Select a name to see account details.`}</caption>
                          <thead>
                            <tr>
                              <th className="ap-stick" scope="col" style={{ ...th, background: "var(--surface-raised)" }}>
                                Name
                              </th>
                              <th scope="col" style={th}>
                                Role
                              </th>
                              <th scope="col" style={th}>
                                Household
                              </th>
                              <th scope="col" style={th}>
                                Status
                              </th>
                              <th scope="col" style={th}>
                                Last sign-in
                              </th>
                              <th scope="col" style={{ ...th, padding: "12px 20px 12px 12px", textAlign: "right" }}>
                                Actions
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            {shown.map((p) => (
                              <tr key={p.id} className="ap-row" data-selected={sel === p.id ? "true" : "false"}>
                                <th className="ap-stick" scope="row" style={{ ...cell, textAlign: "left", whiteSpace: "nowrap" }}>
                                  <button className="ap-click" type="button" onClick={() => select(p.id)} aria-pressed={sel === p.id} style={{ display: "flex", alignItems: "center", gap: 10, minHeight: 44, padding: "0 4px 0 0", border: 0, borderRadius: "var(--radius-sm)", background: "transparent", color: "var(--ink)", textAlign: "left", font: "600 16px/22px var(--font-text)" }}>
                                    <Avatar p={p} size={36} />
                                    <span>{p.nickname}</span>
                                  </button>
                                </th>
                                <td style={cell}>
                                  <span style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                                    <Roles p={p} />
                                  </span>
                                </td>
                                <td style={{ ...cell, whiteSpace: "nowrap" }}>{p.household}</td>
                                <td style={{ ...cell, whiteSpace: "nowrap" }}>
                                  <Status status={p.status} />
                                </td>
                                <td style={{ ...cell, whiteSpace: "nowrap", color: "var(--ink-muted)" }}>{lastLabel(p)}</td>
                                <td style={{ ...cell, padding: "8px 8px 8px 12px", whiteSpace: "nowrap", textAlign: "right" }}>
                                  <span style={{ display: "inline-flex", gap: 2 }}>{rowButtons(p, true)}</span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                      {/* Compact: the same accounts as a card list */}
                      <ul className="ap-cards" aria-label="Accounts" style={{ margin: 0, padding: 0, listStyle: "none", flexDirection: "column", gap: 10 }}>
                        {shown.map((p) => (
                          <li key={p.id} className="ap-card" data-selected={sel === p.id ? "true" : "false"} style={{ display: "flex", flexDirection: "column", gap: 8, padding: "10px 10px 6px 14px", borderRadius: "var(--radius-md)", background: "var(--surface-raised)" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                              <button className="ap-click" type="button" onClick={() => select(p.id)} aria-pressed={sel === p.id} style={{ flex: 1, minWidth: 0, display: "flex", alignItems: "center", gap: 10, minHeight: 44, padding: 0, border: 0, borderRadius: "var(--radius-sm)", background: "transparent", color: "var(--ink)", textAlign: "left", font: "600 17px/22px var(--font-text)" }}>
                                <Avatar p={p} size={36} />
                                <span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.nickname}</span>
                              </button>
                              <Status status={p.status} />
                            </div>
                            <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "6px 8px" }}>
                              <Roles p={p} />
                              <span style={{ fontSize: 16, lineHeight: "22px", color: "var(--ink-muted)" }}>{p.household}</span>
                            </div>
                            <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: "0 8px", paddingTop: 4, boxShadow: "inset 0 1px 0 var(--line)" }}>
                              <span style={{ fontSize: 14, lineHeight: "20px", color: "var(--ink-muted)" }}>Last sign-in {whenLabel(p.lastSignInAt) ?? "never"}</span>
                              <span style={{ display: "flex", gap: 2, marginLeft: "auto" }}>{rowButtons(p, false)}</span>
                            </div>
                          </li>
                        ))}
                      </ul>
                    </>
                  )}
                  {load.phase === "ready" && shown.length === 0 && (
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 10, padding: 24, borderRadius: "var(--radius-md)", background: "var(--surface-raised)", boxShadow: "inset 0 0 0 1px var(--line)" }}>
                      <span style={{ fontSize: 18, lineHeight: "24px", fontWeight: 700 }}>{query ? `No one matches “${query}”.` : "No one here right now."}</span>
                      <span style={{ fontSize: 16, lineHeight: "22px", color: "var(--ink-muted)" }}>Search covers names and households. Kids are listed by nickname.</span>
                      <button
                        className="mk-btn mk-btn--secondary ap-click"
                        type="button"
                        onClick={() => {
                          setQ("");
                          setFilter("all");
                        }}
                      >
                        Show everyone
                      </button>
                    </div>
                  )}
                </div>

                <div className="ap-aside" style={{ gap: 16, minWidth: 0 }}>
                  {/* Account details: opens when a row is selected */}
                  <section id="ap-detail" aria-labelledby="ap-detail-h" style={{ ...panelCard, gap: 16, scrollMarginTop: 16 }}>
                    {detail ?? (
                      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                        <h2 id="ap-detail-h" style={{ margin: 0, font: "800 20px/26px var(--font-display)" }}>
                          Account details
                        </h2>
                        <span style={{ fontSize: 16, lineHeight: "22px", color: "var(--ink-muted)" }}>Pick someone in the list to see their account, household and actions.</span>
                      </div>
                    )}
                  </section>
                  {/* Audit log: every action above is written to it on the server; this lists this session's */}
                  <section aria-labelledby="ap-log-h" style={{ ...panelCard, gap: 6 }}>
                    <div style={{ display: "flex", flexWrap: "wrap", alignItems: "baseline", justifyContent: "space-between", gap: "2px 12px" }}>
                      <h2 id="ap-log-h" style={{ margin: 0, font: "700 18px/24px var(--font-display)" }}>
                        Audit log
                      </h2>
                      <span style={{ fontSize: 14, lineHeight: "20px", color: "var(--ink-muted)" }}>This session, newest first</span>
                    </div>
                    {log.length === 0 ? (
                      <p style={{ margin: "4px 0 0", fontSize: 16, lineHeight: "22px", color: "var(--ink-muted)" }}>Every action you take here is saved to the audit log. Yours will show here.</p>
                    ) : (
                      <ol style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column" }}>
                        {log.slice(0, 8).map((e, i) => (
                          <li key={e.n} className={i === 0 ? noticeCls : undefined} style={{ display: "flex", alignItems: "flex-start", gap: 10, padding: "10px 0", boxShadow: "inset 0 -1px 0 var(--line)" }}>
                            <span aria-hidden="true" style={{ ...DOT, ...KIND[e.kind][1] }}>
                              <Icon d={KIND[e.kind][0]} size={15} stroke={2.2} />
                            </span>
                            <span style={{ flex: 1, minWidth: 0, fontSize: 16, lineHeight: "22px" }}>
                              <strong style={{ fontWeight: 700 }}>You</strong> {e.rest} <span style={{ color: "var(--ink-muted)", whiteSpace: "nowrap" }}>· {whenLabel(new Date(e.at).toISOString())}</span>
                            </span>
                          </li>
                        ))}
                      </ol>
                    )}
                  </section>
                </div>
              </div>
            </>
          )}
          {synthetic && (
            <p style={{ margin: 0, display: "flex", alignItems: "center", gap: 8, fontSize: 13, lineHeight: "18px", color: "var(--ink-muted)" }}>
              <span style={{ padding: "1px 8px", borderRadius: "var(--radius-pill)", background: "var(--ink)", color: "var(--surface-raised)", fontSize: 11, lineHeight: "18px", fontWeight: 700, letterSpacing: ".04em" }}>DEMO</span>
              Demo households are synthetic data, not real families.
            </p>
          )}
        </main>
      </div>
    </div>
  );
}
