// Learned cautions: an admin confirms one (no expiry), edits its words, or retires it. Admins only.
import { z } from "zod";
import { withAuth } from "@/lib/auth/context";
import { fail, ok, readBody } from "@/lib/auth/http";
import { forgetCautions } from "@/lib/synapse/cautions";
import { checkFix } from "@/lib/synapse/checks";
import { synapseAdmin } from "@/lib/synapse/guard";

const body = z.strictObject({ id: z.string().uuid(), action: z.enum(["confirm", "retire", "edit"]), when: z.string().trim().max(110).optional(), check: z.string().trim().max(140).optional() });

export async function POST(request: Request) {
  return withAuth(request, async ({ store, jar }) => {
    const gate = await synapseAdmin(store, jar);
    if (gate.refused) return gate.refused;
    const input = await readBody(request, body);
    if (!input) return fail(400, "invalid");
    const c = (await store.synapse.cautions()).find((x) => x.id === input.id);
    if (!c) return fail(404, "not-found");
    let next = c;
    if (input.action === "confirm") next = { ...c, status: "active", expiresAt: null };
    else if (input.action === "retire") next = { ...c, status: "retired" };
    else {
      const when = input.when ?? c.when;
      const check = input.check ?? c.check;
      const fake = { verdict: "problem", kind: "model-behaviour", fix: { type: "caution", field: null, before: null, after: null, when, check }, test: { kind: "contains", expect: "" }, confidence: 100, evidence: [], rationale: "", kidNote: "" } as const;
      const bad = checkFix({ ...fake, evidence: [] }, null, []).filter((x) => !x.ok);
      if (bad.length) return fail(422, "invalid", { note: `Check failed: ${bad.map((x) => x.name).join(", ")}` });
      next = { ...c, when, check };
    }
    await store.synapse.saveCaution(next);
    forgetCautions();
    await store.audit({ actor: gate.adminId, actorRole: "admin", action: `synapse.caution.${input.action}`, target: c.id, householdId: gate.householdId, detail: { agent: c.agent } });
    return ok({ caution: next });
  });
}
