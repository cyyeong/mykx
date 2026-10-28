// The flat's plan (board HomeNow): the four camera rooms light up where the kids are, bedrooms and bathrooms are hatched
// "no camera" (nothing may watch them, rule 15), and each person is a pin: a kid is their Kix in their pack's colour, an
// adult is a plain grey person (never named), and a child Muse isn't sure about is a "?".
import type { RoomKind } from "@/lib/home-watch/home-watch";

export interface Pin {
  room: RoomKind;
  label: string;
  who: "child" | "adult" | "unknown";
  pack: string | null;
  colour: string;
  ink: string;
}

const SLOTS: Partial<Record<RoomKind, [number, number][]>> = {
  living: [[96, 196], [140, 214], [60, 222], [118, 162]],
  study: [[228, 92], [252, 100]],
  kitchen: [[280, 150], [312, 172], [248, 172]],
  entrance: [[270, 232], [312, 238]],
};
const FILL: Partial<Record<RoomKind, string>> = { living: "#FFFFFF", study: "#FFFFFF", kitchen: "#FFFFFF", entrance: "#FFFFFF" };

export function FloorPlan({ lit, selected, pins, label }: { lit: Partial<Record<RoomKind, string>>; selected: RoomKind | null; pins: Pin[]; label: string }) {
  const room = (kind: RoomKind) => ({ fill: lit[kind] ?? FILL[kind], stroke: selected === kind ? "#1F66C1" : "none", strokeWidth: 4 });
  const used: Partial<Record<RoomKind, number>> = {};
  return (
    <div className="hn-plan">
      <svg viewBox="0 0 360 268" role="img" aria-label={label}>
        <defs>
          <pattern id="hnHatch" width="7" height="7" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <rect width="7" height="7" fill="#F6F8FF" />
            <line x1="0" y1="0" x2="0" y2="7" stroke="#DCE3F5" strokeWidth="3" />
          </pattern>
        </defs>
        <g fontFamily="var(--font-text), system-ui, sans-serif">
          <rect x="8" y="8" width="96" height="104" fill="url(#hnHatch)" />
          <rect x="104" y="8" width="88" height="104" fill="url(#hnHatch)" />
          <rect x="264" y="8" width="88" height="80" fill="url(#hnHatch)" />
          <rect x="192" y="8" width="72" height="46" fill="url(#hnHatch)" />
          <rect x="264" y="88" width="88" height="24" fill="url(#hnHatch)" />
          <rect x="192" y="54" width="72" height="58" {...room("study")} />
          <rect x="8" y="112" width="200" height="148" {...room("living")} />
          <rect x="208" y="112" width="144" height="88" {...room("kitchen")} />
          <rect x="208" y="200" width="144" height="60" {...room("entrance")} />
          <g fill="none" stroke="#1B2350" strokeWidth="3.5" strokeLinejoin="round">
            <rect x="8" y="8" width="344" height="252" rx="2" />
            <path d="M104 8 V 112 M192 8 V 112 M264 8 V 112 M8 112 H 70 M98 112 H 160 M186 112 H 208 M208 112 V 150 M208 176 V 260 M208 200 H 300 M326 200 H 352 M264 88 H 352 M192 54 H 214 M240 54 H 264 M208 112 H 230 M256 112 H 352" />
          </g>
          <g fontSize="10.5" fontWeight="600" fill="#4A5482" textAnchor="middle">
            {[[56, "Bedroom"], [148, "Bedroom"], [308, "Bedroom"]].map(([x, t]) => (
              <g key={x as number}>
                <text x={x as number} y={x === 308 ? 52 : 64}>{t as string}</text>
                <text x={x as number} y={x === 308 ? 65 : 77} fontSize="9.5" fontWeight="500">no camera</text>
              </g>
            ))}
            <text x="228" y="30" fontSize="9.5">Bath</text>
            <text x="308" y="104" fontSize="9.5">Bath</text>
          </g>
          <g fontSize="12" fontWeight="700" fill="#1B2350">
            <text x="200" y="72">Study</text>
            <text x="18" y="132">Living room</text>
            <text x="218" y="132">Kitchen</text>
            <text x="218" y="220">Entrance</text>
          </g>
          <g fill="#1B2350">
            <circle cx="252" cy="62" r="3.5" />
            <circle cx="198" cy="252" r="3.5" />
            <circle cx="344" cy="120" r="3.5" />
            <circle cx="344" cy="252" r="3.5" />
          </g>
        </g>
      </svg>
      {pins.map((p, i) => {
        const slots = SLOTS[p.room];
        if (!slots) return null;
        const n = (used[p.room] = (used[p.room] ?? -1) + 1);
        const [x, y] = slots[n % slots.length];
        return (
          <span key={i} className={`hn-pin hn-pin--${p.who}`} style={{ left: `${(x / 360) * 100}%`, top: `${(y / 268) * 100}%`, boxShadow: p.who === "child" && p.pack ? `0 0 0 3px ${p.colour}, 0 4px 10px rgba(27,35,80,.25)` : undefined }}>
            {p.who === "child" && p.pack ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={`/art/kix/${p.pack}-800.webp`} alt="" />
            ) : (
              p.who === "adult" ? (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#4A5482" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
                  <circle cx="12" cy="8" r="3.5" />
                  <path d="M5 20c0-3.9 3.1-6 7-6s7 2.1 7 6" />
                </svg>
              ) : (
                <b aria-hidden="true">?</b>
              )
            )}
            <span className="hn-pin-tag" style={{ background: p.who === "child" && p.pack ? p.colour : "#4A5482", color: p.who === "child" && p.pack ? p.ink : "#fff" }}>
              {p.label}
            </span>
          </span>
        );
      })}
    </div>
  );
}
