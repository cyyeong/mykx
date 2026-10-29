// Code-checked eval tests (docs/prd/SYNAPSE.md §5.5): exact, contains, not-contains and number are decided here;
// only "judge" needs a model (the Synapse Judge). Pure.
import type { EvalTest } from "./types.ts";

const norm = (s: string) => s.toLowerCase().replace(/[\s ]+/g, " ").replace(/[“”]/g, '"').replace(/[‘’]/g, "'").trim();
const numbers = (s: string) => (s.replace(/(\d),(\d{3})/g, "$1$2").match(/-?\d+(?:\.\d+)?/g) ?? []).map(Number);

/** Pass or fail for a code-checked test; null for a judge test. `final` is the answer line when there is one. */
export function codeCheck(test: EvalTest, text: string, final: string | null = null): boolean | null {
  const t = norm(text);
  const e = norm(test.expect);
  switch (test.kind) {
    case "exact":
      return t === e;
    case "contains":
      return t.includes(e);
    case "not-contains":
      return !t.includes(e);
    case "number": {
      const want = numbers(test.expect)[0];
      if (want === undefined) return false;
      const where = final ?? text.slice(-240);
      return numbers(where).some((n) => Math.abs(n - want) < 1e-9);
    }
    default:
      return null;
  }
}
