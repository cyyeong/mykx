// Server only: Singapore's weather for the outing dates, from NEA's four-day outlook on data.gov.sg (free, no key).
// A few plain lines for the Planner; if the feed is down the Planner just plans without them.
import { dayName } from "./outings.ts";

const OUTLOOK = "https://api-open.data.gov.sg/v2/real-time/api/four-day-outlook";

export async function weatherLines(dates: readonly string[], get: typeof fetch = fetch): Promise<string[]> {
  try {
    const res = await get(OUTLOOK, { signal: AbortSignal.timeout(8_000) });
    if (!res.ok) return [];
    const json = (await res.json()) as { data?: { records?: { forecasts?: { timestamp: string; forecast: { text: string }; temperature: { low: number; high: number }; relativeHumidity?: { high: number } }[] }[] } };
    const forecasts = json.data?.records?.[0]?.forecasts ?? [];
    return dates.flatMap((d) => {
      const f = forecasts.find((x) => x.timestamp.slice(0, 10) === d);
      if (!f) return [];
      return [`${dayName(d)}: ${f.forecast.text.toLowerCase()}, ${f.temperature.low}–${f.temperature.high}°C${f.forecast.text.toLowerCase().includes("shower") ? ", showers likely" : ""}`];
    });
  } catch {
    return [];
  }
}
