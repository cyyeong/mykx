import type { CSSProperties, ElementType, HTMLAttributes } from "react";
import s from "./GlassPanel.module.css";

type GlassPanelProps = HTMLAttributes<HTMLElement> & {
  as?: "div" | "section" | "header" | "article" | "aside" | "nav" | "span";
  /** Inner outline: 1 px line (default), 2 px accent for the one thing to look at, 2 px control, or none. */
  ring?: "line" | "accent" | "control" | "none";
  /** Adds the pack's raised shadow under the outline. */
  raised?: boolean;
  /** Backdrop blur in px; 16 by default. */
  blur?: number;
  /** Corner radius token; lg by default. */
  radius?: "sm" | "md" | "lg" | "xl" | "pill";
};

/**
 * A frosted panel over art (design system §2: glass only on panels over art). Its styles have zero
 * specificity, so a screen's layout classes, and their media queries, always win.
 */
export function GlassPanel({ as = "div", ring = "line", raised, blur, radius, className, style, ...rest }: GlassPanelProps) {
  const Tag: ElementType = as;
  const vars = {
    ...(blur !== undefined && { "--glass-blur": `${blur}px` }),
    ...(radius && { "--glass-radius": `var(--radius-${radius})` }),
    ...style,
  } as CSSProperties;
  const cls = [s.glass, ring !== "line" && s[ring], raised && s.raised, className].filter(Boolean).join(" ");
  return <Tag className={cls} style={vars} {...rest} />;
}
