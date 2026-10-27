"use client";

// The on/off switch from the account boards: a 48 x 28 track inside a 60 x 44 target. State is aria-checked plus
// the knob's position, never colour alone.
export function Switch({
  on,
  labelledBy,
  onToggle,
  disabled,
  className = "",
}: {
  on: boolean;
  labelledBy: string;
  onToggle: () => void;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <button
      className={className}
      type="button"
      role="switch"
      aria-checked={on}
      aria-labelledby={labelledBy}
      onClick={onToggle}
      disabled={disabled}
      style={{ flex: "none", width: 60, height: 44, padding: 0, border: 0, borderRadius: "var(--radius-pill)", background: "transparent", display: "flex", alignItems: "center", justifyContent: "center", cursor: disabled ? "not-allowed" : "pointer", opacity: disabled ? 0.45 : 1 }}
    >
      <span
        style={{
          position: "relative",
          display: "block",
          width: 48,
          height: 28,
          borderRadius: 999,
          transition: "background var(--duration-snappy) ease",
          ...(on ? { background: "var(--accent)" } : { background: "var(--surface)", boxShadow: "inset 0 0 0 1.5px var(--border-control)" }),
        }}
      >
        <span
          style={{
            position: "absolute",
            top: 4,
            left: 4,
            width: 20,
            height: 20,
            borderRadius: "50%",
            transition: "transform var(--duration-snappy) var(--ease-soft)",
            ...(on ? { transform: "translateX(20px)", background: "var(--on-accent)" } : { background: "var(--border-control)" }),
          }}
        />
      </span>
    </button>
  );
}
