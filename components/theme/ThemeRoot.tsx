"use client";

import { createContext, useCallback, useContext, useState, type ReactNode } from "react";
import { flushSync } from "react-dom";
import type { Band, PackId } from "./packs";

type ThemeContextValue = {
  pack: PackId;
  band: Band;
  /** Switch pack; when `from` is given, the new pack grows out of that element. */
  setPack: (pack: PackId, from?: HTMLElement | null) => void;
  setBand: (band: Band) => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function useTheme(): ThemeContextValue {
  const value = useContext(ThemeContext);
  if (!value) throw new Error("useTheme must be used inside <ThemeRoot>");
  return value;
}

export function ThemeRoot({
  initialPack = "dreamlight",
  initialBand = "junior",
  children,
}: {
  initialPack?: PackId;
  initialBand?: Band;
  children: ReactNode;
}) {
  const [pack, setPackState] = useState<PackId>(initialPack);
  const [band, setBand] = useState<Band>(initialBand);

  const setPack = useCallback(
    (next: PackId, from?: HTMLElement | null) => {
      if (next === pack) return;
      const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      if (!document.startViewTransition || reduce) {
        setPackState(next);
        return;
      }
      const root = document.documentElement;
      if (from) {
        const r = from.getBoundingClientRect();
        root.style.setProperty("--reveal-x", `${r.left + r.width / 2}px`);
        root.style.setProperty("--reveal-y", `${r.top + r.height / 2}px`);
      } else {
        root.style.removeProperty("--reveal-x");
        root.style.removeProperty("--reveal-y");
      }
      document.startViewTransition(() => flushSync(() => setPackState(next)));
    },
    [pack],
  );

  return (
    <ThemeContext value={{ pack, band, setPack, setBand }}>
      <div className="theme-root" data-theme={pack} data-band={band}>
        {children}
      </div>
    </ThemeContext>
  );
}
