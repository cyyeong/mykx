"use client";

// Inline editing of one knowledge entry (a pattern, trap, cue, question or answer key): a few labelled fields,
// Save and Cancel. Lists ("lines") are edited one per line.
import { useState } from "react";

export type FieldSpec = { k: string; label: string; kind: "text" | "area" | "number" | "select" | "lines"; options?: readonly string[]; wide?: boolean; max?: number; min?: number };
type Value = Record<string, unknown>;

export function EntryEditor({ fields, value, onSave, onCancel, saving }: { fields: readonly FieldSpec[]; value: Value; onSave: (v: Value) => void; onCancel: () => void; saving?: boolean }) {
  const [v, setV] = useState<Value>(value);
  const set = (k: string, x: unknown) => setV((o) => ({ ...o, [k]: x }));
  return (
    <form
      className="ks-edit"
      onSubmit={(e) => {
        e.preventDefault();
        onSave(v);
      }}
    >
      {fields.map((f) => {
        const id = `ke-${f.k}`;
        const raw = v[f.k];
        return (
          <label key={f.k} className={`sk-f${f.wide ? " is-wide" : ""}`} htmlFor={id}>
            <span>{f.label}</span>
            {f.kind === "area" ? (
              <textarea id={id} className="sk-in" rows={3} maxLength={f.max} value={String(raw ?? "")} onChange={(e) => set(f.k, e.target.value)} />
            ) : f.kind === "lines" ? (
              <textarea id={id} className="sk-in" rows={4} value={Array.isArray(raw) ? (raw as string[]).join("\n") : ""} onChange={(e) => set(f.k, e.target.value.split("\n"))} />
            ) : f.kind === "select" ? (
              <select id={id} className="sk-in" value={String(raw ?? "")} onChange={(e) => set(f.k, e.target.value)}>
                {(f.options ?? []).map((o) => (
                  <option key={o}>{o}</option>
                ))}
              </select>
            ) : f.kind === "number" ? (
              <input id={id} className="sk-in" type="number" min={f.min ?? 0} max={f.max} value={Number(raw ?? 0)} onChange={(e) => set(f.k, Math.round(Number(e.target.value)))} />
            ) : (
              <input id={id} className="sk-in" maxLength={f.max} value={String(raw ?? "")} onChange={(e) => set(f.k, e.target.value)} />
            )}
          </label>
        );
      })}
      <div className="sk-row is-wide" style={{ gridColumn: "1 / -1", marginTop: 0 }}>
        <button type="submit" className="sk-btn sk-btn--sm sk-btn--pri" disabled={saving}>
          Save
        </button>
        <button type="button" className="sk-btn sk-btn--sm" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </form>
  );
}

/** Lists edited one per line come back with blanks; the stored entry has none (and options are null when empty). */
export function cleanLines(v: unknown, nullIfEmpty = false): string[] | null {
  const list = Array.isArray(v) ? (v as string[]).map((s) => s.trim()).filter(Boolean) : [];
  return nullIfEmpty && !list.length ? null : list;
}
