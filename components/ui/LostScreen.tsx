// The page shown for a wrong address or a crash: Kix looking puzzled and a way home for everyone.
// /home sends a kid home, a grown-up to the kids' doors and anyone signed out to sign-in.
import Link from "next/link";
import type { ReactNode } from "react";
import "./lostScreen.css";

export function LostScreen({ title, line, children }: { title: string; line: string; children?: ReactNode }) {
  return (
    <main className="lost">
      <section className="lost-card">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="lost-kix" src="/art/login/kix.webp" alt="Kix" width={160} height={155} />
        <h1 className="lost-title">{title}</h1>
        <p className="lost-line">{line}</p>
        <div className="lost-actions">
          {children}
          <Link className="mk-btn mk-btn--reward" href="/home">
            Take me home
          </Link>
          <Link className="lost-link" href="/family">
            Grown-ups: Your family
          </Link>
        </div>
      </section>
    </main>
  );
}
