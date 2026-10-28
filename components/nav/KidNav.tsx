"use client";

// The one kid navigation shell: a bottom tab bar under 600 px, a left rail from
// 600 px up (design skill §3a). Mounted once in app/(kid)/layout.tsx; hidden on
// task screens (isKidNavHidden). Components read semantic tokens only.
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signKidOut } from "./KidIdle";
import { KID_TABS, isKidNavHidden, kidNavCurrent, type KidTabId } from "./kid-tabs";
import "./kid-tabs.css";

// Stroke icons (Lucide-style, drawn for myKx); Vibe keeps the brand sparkle fill.
const ICONS: Record<KidTabId, { body: React.ReactNode; fill: boolean }> = {
  home: {
    fill: false,
    body: <path d="M3 10.5 12 3l9 7.5M5 9.5V21h5v-6h4v6h5V9.5" />,
  },
  learn: {
    fill: false,
    body: <path d="M2 5.5A2.5 2.5 0 0 1 4.5 3H11v15H4.5A2.5 2.5 0 0 0 2 20.5zm20 0A2.5 2.5 0 0 0 19.5 3H13v15h6.5a2.5 2.5 0 0 1 2.5 2.5zM11 3v15" />,
  },
  ask: {
    fill: false,
    body: <path d="M21 12a8 8 0 0 1-11.6 7.1L4 20.5l1.4-4.9A8 8 0 1 1 21 12zM10 9.5a2.2 2.2 0 1 1 3 2c-.6.3-1 .8-1 1.5M12 15.6h.01" />,
  },
  play: {
    fill: false,
    body: (
      <>
        <rect x="2.5" y="7" width="19" height="11" rx="5.5" />
        <path d="M8 10.5v4M6 12.5h4" />
        <circle cx="15.5" cy="11.5" r="1" />
        <circle cx="17.8" cy="14" r="1" />
      </>
    ),
  },
  treasure: {
    fill: false,
    body: <path d="M6 4h12l4 5.5L12 20 2 9.5zm0 0L12 20M2 9.5h20M9.5 9.5 12 20M14.5 9.5 12 20M6 4l3.5 5.5M18 4l-3.5 5.5" />,
  },
  vibe: {
    fill: true,
    body: <path d="M12 2Q13 11 22 12Q13 13 12 22Q11 13 2 12Q11 11 12 2Z" />,
  },
};

/** `demoLabel` is the server-rendered honesty line (DemoLabel variant "bar"): present for the demo family only. */
export function KidNav({ demoLabel }: { demoLabel?: React.ReactNode }) {
  const pathname = usePathname();
  if (isKidNavHidden(pathname)) return null;
  const current = kidNavCurrent(pathname);
  return (
      <nav className="kidnav" aria-label="Main">
        {/* The honesty label rides inside the bar on phones, for the demo family only; on the
            rail the standalone label sits right of the rail (see demoLabel.css). */}
        {demoLabel}
        <ul className="kidnav-list">
          {KID_TABS.map((tab) => {
            const active = current === tab.id && !tab.soon;
            const icon = ICONS[tab.id];
            const inner = (
              <>
                <svg
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                  className="kidnav-icon"
                  fill={icon.fill ? "currentColor" : "none"}
                  stroke={icon.fill ? "none" : "currentColor"}
                  strokeWidth={icon.fill ? undefined : 2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  {icon.body}
                </svg>
                <span className="kidnav-label">{tab.label}</span>
                {tab.soon && (
                  <span className="kidnav-soon" aria-hidden="true">
                    Soon
                  </span>
                )}
              </>
            );
            // Unbuilt screens render as disabled tabs with a Soon tag (same pattern as the
            // admin sidebar), never a link to a 404. Drop `soon` when the screen lands.
            return (
              <li key={tab.id} className="kidnav-item">
                {tab.soon ? (
                  <span className="kidnav-tab" aria-disabled="true" title={`${tab.label} is coming soon`}>
                    {inner}
                  </span>
                ) : (
                  <Link
                    href={tab.href}
                    aria-current={active ? "page" : undefined}
                    data-active={active ? "true" : undefined}
                    className="kidnav-tab"
                  >
                    {inner}
                  </Link>
                )}
              </li>
            );
          })}
        </ul>
        {/* Sign out sits under the tabs on the rail; on phones it's in the avatar menu and on Me. */}
        <button type="button" className="kidnav-out" onClick={() => void signKidOut()} aria-label="Sign out">
          <svg className="kidnav-icon" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M15 4h4v16h-4M10 8l-4 4 4 4M6 12h11" />
          </svg>
          <span className="kidnav-label">Sign out</span>
        </button>
      </nav>
  );
}
