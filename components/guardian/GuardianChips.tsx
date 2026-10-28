"use client";

// The kid's chips on Home (AGENTS.md rule 15; docs/prd/GUARDIAN.md §2.1): "Sharing where you are" and "Home cameras on"
// while a grown-up has them on, each opening "What my grown-ups see". A row under the header of Home and the study deck;
// renders nothing when nothing is on.
import Link from "next/link";
import { useEffect, useState } from "react";
import { api } from "@/components/account/api";
import { chipsFor, type Mine } from "./SharingScreen";
import "./sharing.css";

export function GuardianChips({ className = "" }: { className?: string }) {
  const [m, setM] = useState<Mine | null>(null);

  useEffect(() => {
    let live = true;
    void api<Mine>("GET", "/api/location/mine").then((r) => live && r.ok && r.data && setM(r.data));
    return () => {
      live = false;
    };
  }, []);

  const chips = m ? chipsFor(m) : [];
  if (!chips.length) return null;
  return (
    <div className={`gchips-row ${className}`.trim()} data-band={m!.band ?? "junior"}>
      {chips.map((c) => (
        <Link key={c.id} href="/me/sharing" className="gchip">
          <span className="ks-dot" style={{ width: 10, height: 10 }} aria-hidden="true" />
          {c.label}
        </Link>
      ))}
    </div>
  );
}
