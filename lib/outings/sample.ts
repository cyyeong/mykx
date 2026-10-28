// The demo family's stand-in outing run (rule 7: the demo never waits on a live search). It's the real result of a
// Muse Spark web search for Sengkang on 28 Oct 2026, kept as a sample and labelled "Sample" in the UI (rule 8).
import type { OutingRun } from "./outings.ts";

export const DEMO_OUTINGS: OutingRun = {
  at: "2026-10-28T09:00:00.000Z",
  area: "Sengkang",
  radiusKm: 3,
  interests: ["badminton", "swimming", "cycling", "eating out"],
  dates: ["2026-10-31", "2026-11-01"],
  weather: ["Saturday 31 Oct: partly cloudy (day), 26–35°C", "Sunday 1 Nov: thundery showers, 25–33°C, showers likely"],
  summary: "Saturday looks drier than Sunday, so the riverside ride and the hawker supper are planned for Saturday, with the swim and a badminton game indoors for the showers on Sunday.",
  searches: 12,
  source: "sample",
  planned: [],
  refreshes: [],
  ideas: [
    { id: "2026-10-31-sengkang-riverside-park", day: "2026-10-31", when: "9:00–11:00", tag: "Cycling", title: "Cycle the riverside", where: "Sengkang Riverside Park, on the North Eastern Riverine Loop", facts: "The loop is 26 km and links four parks; try the river stretch. Open 24 hours · about 2 km from Sengkang MRT · free", why: "Partly cloudy and the drier day, so the outdoor ride goes on Saturday morning.", sourceUrl: "https://www.nparks.gov.sg/gardens-parks-and-nature/parks-and-nature-reserves/sengkang-riverside-park", sourceHost: "nparks.gov.sg" },
    { id: "2026-10-31-anchorvale-village-hawker-centre", day: "2026-10-31", when: "17:15", tag: "Eating out", title: "Supper at Anchorvale Village Hawker Centre", where: "339 Anchorvale Road, level 2", facts: "30+ stalls, meals from S$3.50 · about 3 minutes from Farmway LRT", why: "Let each child pick one dish for everyone to share after the ride.", sourceUrl: "https://www.lifestyleasia.com/bk/dining/food/anchorvale-village-hawker-centre-opening/amp/", sourceHost: "lifestyleasia.com" },
    { id: "2026-11-01-sengkang-sport-hall", day: "2026-11-01", when: "15:30–17:00", tag: "Badminton", title: "Family badminton, indoors", where: "Sengkang Sport Hall, 57 Anchorvale Road", facts: "Open daily 7am–10pm; book courts on ActiveSG · about 1.5 km from Sengkang MRT", why: "Showers are likely on Sunday afternoon, so this one is indoors.", sourceUrl: "https://www.activesgcircle.gov.sg/facilities/sengkang-sport-hall", sourceHost: "activesgcircle.gov.sg" },
    { id: "2026-11-01-sengkang-swimming-complex", day: "2026-11-01", when: "8:00–10:00", tag: "Swimming", title: "Morning swim and the water slides", where: "Sengkang Swimming Complex, 57 Anchorvale Road", facts: "Sunday 8am–9:30pm · five water slides and a teaching pool · about 1.5 km from Sengkang MRT", why: "An early swim before the Sunday showers arrive.", sourceUrl: "https://www.activesgcircle.gov.sg/facilities/sengkang-swimming-complex", sourceHost: "activesgcircle.gov.sg" },
  ],
};
