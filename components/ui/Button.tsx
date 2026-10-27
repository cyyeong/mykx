import Link from "next/link";
import type { ComponentProps } from "react";

export type ButtonVariant = "primary" | "secondary" | "reward";

function classes(variant: ButtonVariant, className?: string): string {
  return ["mk-btn", `mk-btn--${variant}`, className].filter(Boolean).join(" ");
}

/**
 * The design system's pill button (`mk-btn`, app/styles/components.css): one clear action each.
 * Primary is the screen's main action; secondary is frosted and safe over art; reward is only for
 * collecting something earned. Height follows the band's target (56 px Junior, 44 px Teen).
 */
export function Button({
  variant = "primary",
  className,
  type = "button",
  ...rest
}: ComponentProps<"button"> & { variant?: ButtonVariant }) {
  return <button type={type} className={classes(variant, className)} {...rest} />;
}

/** The same pill as a link, for actions that move to another screen. */
export function ButtonLink({
  variant = "primary",
  className,
  ...rest
}: ComponentProps<typeof Link> & { variant?: ButtonVariant }) {
  return <Link className={classes(variant, className)} {...rest} />;
}
