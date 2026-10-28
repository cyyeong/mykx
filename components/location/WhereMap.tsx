"use client";

// The parent's map (docs/prd/GUARDIAN.md §2.1): Leaflet 1.9.4 on OneMap tiles, the Singapore Land Authority's basemap
// (its logo and attribution are required and shown). Each kid is their Kix in their pack's colour with an accuracy
// circle and today's trail fading with age; the parent's own places are dashed circles. Leaflet loads in the browser
// only, after mount. Kids are chosen with the chips above (keyboard users never need the markers).
import type { Map as LMap, LayerGroup } from "leaflet";
import { useEffect, useRef, useState } from "react";
import { packColour, readableOn } from "@/lib/home-watch/home-watch";
import { freshness, type MapKid } from "./types";
import type { Place } from "@/lib/location/location";
import "leaflet/dist/leaflet.css";
import "./where.css";

const TILES = "https://www.onemap.gov.sg/maps/tiles/Default/{z}/{x}/{y}.png";
const ATTRIBUTION = '<img src="https://www.onemap.gov.sg/web-assets/images/logo/om_logo.png" alt="" style="height:16px;width:16px;vertical-align:-3px"> OneMap | Map data © contributors, <a href="https://www.sla.gov.sg/" target="_blank" rel="noopener noreferrer">Singapore Land Authority</a>';
const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

export function WhereMap({ kids, places, selectedId }: { kids: MapKid[]; places: Place[]; selectedId: string | null }) {
  const box = useRef<HTMLDivElement>(null);
  const state = useRef<{ L: typeof import("leaflet"); map: LMap; layer: LayerGroup; fitted: boolean; last: string | null } | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let dead = false;
    void import("leaflet").then((mod) => {
      if (dead || !box.current) return;
      const L = (mod as unknown as { default?: typeof import("leaflet") }).default ?? mod;
      const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      const map = L.map(box.current, { zoomControl: false, attributionControl: true, zoomAnimation: !reduce, fadeAnimation: !reduce, markerZoomAnimation: !reduce, center: [1.3896, 103.9], zoom: 15 });
      L.control.zoom({ position: "bottomright" }).addTo(map);
      L.tileLayer(TILES, { minZoom: 11, maxZoom: 19, attribution: ATTRIBUTION, detectRetina: true }).addTo(map);
      state.current = { L, map, layer: L.layerGroup().addTo(map), fitted: false, last: null };
      setReady(true);
    });
    return () => {
      dead = true;
      state.current?.map.remove();
      state.current = null;
    };
  }, []);

  useEffect(() => {
    const s = state.current;
    if (!ready || !s) return;
    const { L, map, layer } = s;
    layer.clearLayers();
    const bounds: [number, number][] = [];

    for (const p of places) {
      bounds.push([p.lat, p.lng]);
      L.circle([p.lat, p.lng], { radius: p.radiusM, color: "#1F66C1", weight: 1.5, opacity: 0.5, dashArray: "4 4", fillColor: "#1F66C1", fillOpacity: 0.06, interactive: false }).addTo(layer);
      // The name sits on the circle's top edge, so a kid standing in the place never covers it.
      L.marker([p.lat + p.radiusM / 111_000, p.lng], { interactive: false, keyboard: false, icon: L.divIcon({ className: "wm-label", html: `<span>${esc(p.name)}</span>`, iconSize: [0, 0] }) }).addTo(layer);
    }

    for (const k of kids) {
      const colour = packColour(k.pack);
      const here = k.latest;
      if (!here) continue;
      const stale = freshness(here.at);
      const paused = Boolean(k.setting.pausedUntil && Date.parse(k.setting.pausedUntil) > Date.now());
      // Today's trail, fading with age: older legs are fainter.
      const pts = k.today;
      for (let i = 1; i < pts.length; i++) {
        L.polyline([[pts[i - 1].lat, pts[i - 1].lng], [pts[i].lat, pts[i].lng]], { color: colour, weight: 4, opacity: 0.2 + 0.75 * (i / pts.length), dashArray: "1 9", lineCap: "round", interactive: false }).addTo(layer);
      }
      bounds.push([here.lat, here.lng]);
      L.circle([here.lat, here.lng], { radius: Math.max(here.accuracyM, 12), color: colour, weight: 1, opacity: 0.4, fillColor: colour, fillOpacity: 0.12, interactive: false }).addTo(layer);
      const art = k.pack ? `/art/kix/${k.pack}-800.webp` : "/art/kix/kix-base-800.webp";
      const cls = `wm-pin${stale === "grey" || paused ? " is-grey" : stale === "amber" ? " is-amber" : ""}${k.id === selectedId ? " is-selected" : ""}`;
      L.marker([here.lat, here.lng], {
        keyboard: false,
        zIndexOffset: k.id === selectedId ? 1000 : 0,
        icon: L.divIcon({ className: "", iconSize: [46, 46], iconAnchor: [23, 23], html: `<div class="${cls}" style="--c:${colour};--t:${readableOn(colour)}"><img src="${art}" alt=""><span class="wm-name">${esc(k.nickname)}</span></div>` }),
      }).addTo(layer);
    }

    const sel = kids.find((k) => k.id === selectedId)?.latest;
    if (!s.fitted && bounds.length) {
      map.fitBounds(bounds, { padding: [48, 48], maxZoom: 16, animate: false });
      s.fitted = true;
    } else if (sel && s.last !== selectedId) map.panTo([sel.lat, sel.lng]);
    s.last = selectedId;
  }, [ready, kids, places, selectedId]);

  return <div ref={box} className="wm-map" role="region" aria-label="Map of where the kids are" />;
}
