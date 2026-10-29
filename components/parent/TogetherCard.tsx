"use client";

// Do something together, on Today (board ParentHarbour / ParentBloom): the weekend at a glance from the family's
// latest outing run (GET /api/outings): each day's weather and how many sourced ideas it has, and the plan so far.
// Opens the full page. With no run yet it invites a first search; if the run can't load, it still links through.
import Link from "next/link";
import { useEffect, useState } from "react";
import { api } from "@/components/account/api";

type Run = { dates: string[]; weather: string[]; summary: string; ideas: { day: string }[]; planned: string[] };
type Reply = { run: Run | null; prefs: { homeArea: string } };

const SUN = "M12 4V2M12 22v-2M4 12H2M22 12h-2M5.6 5.6 4.2 4.2M19.8 19.8l-1.4-1.4M5.6 18.4l-1.4 1.4M19.8 4.2l-1.4 1.4M12 17a5 5 0 1 0 0-10 5 5 0 0 0 0 10z";
const RAIN = "M7 18a5 5 0 1 1 .9-9.9A6 6 0 0 1 19 9.5 4 4 0 0 1 18 17.4M9 20l-1 2M13 20l-1 2M17 20l-1 2";
const dayName = (d: string) => new Date(`${d}T12:00:00+08:00`).toLocaleDateString("en-SG", { weekday: "long", timeZone: "Asia/Singapore" });

export function TogetherCard() {
  const [data, setData] = useState<Reply | null | "failed">(null);
  useEffect(() => {
    let live = true;
    void api<Reply>("GET", "/api/outings").then((r) => live && setData(r.ok && r.data ? r.data : "failed"));
    return () => {
      live = false;
    };
  }, []);

  const run = data && data !== "failed" ? data.run : null;
  const area = data && data !== "failed" ? data.prefs.homeArea : null;
  return (
    <article className="pcard ptogether">
      <span className="pkicker">This weekend</span>
      <h2 className="pcard-h">Do something together</h2>
      <p className="pcard-p">{run ? run.summary : `Weekend ideas near ${area ?? "home"}: Muse Spark searches the web for things your family likes, then plans them around the weather.`}</p>
      {run && (
        <div className="pdays">
          {run.dates.map((d) => {
            const w = run.weather.find((x) => x.startsWith(dayName(d))) ?? "";
            const rainy = /shower|rain|thunder/i.test(w);
            return (
              <div key={d} className="pday">
                <span>
                  <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
                    <path d={rainy ? RAIN : SUN} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  {dayName(d)}
                </span>
                <small>
                  {w.split(": ")[1] ?? "Weather to come"} · {run.ideas.filter((i) => i.day === d).length} ideas
                </small>
              </div>
            );
          })}
        </div>
      )}
      <Link className="pbtn" href="/together">
        {run ? (run.planned.length ? `See the plan (${run.planned.length} chosen)` : "See the weekend plan") : "Find weekend ideas"}
      </Link>
    </article>
  );
}
