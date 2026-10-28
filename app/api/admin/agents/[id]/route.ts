// One agent in Under the hood (founder, 29 Oct): its instructions and every version, the fixed guardrails, what code
// checks, its models and tools. POST saves a draft, publishes, restores or deletes a version (lib/agents/versions.ts
// has the rules: the built-in default can't be deleted). Admins only, behind the parent PIN; every change writes
// audit_log. Platform content only: never a child's messages, Notebook or answers (rule 13).
import { z } from "zod";
import { agentDetail } from "@/lib/agents/catalog";
import { isEditableAgent, MAX_INSTRUCTIONS } from "@/lib/agents/instructions";
import { forgetInstructions } from "@/lib/agents/runtime";
import { applyAgentAction } from "@/lib/agents/versions";
import { requireAdmin } from "@/lib/auth/admin";
import { withAuth } from "@/lib/auth/context";
import { fail, ok, readBody } from "@/lib/auth/http";
import { pinLockedResponse } from "@/lib/auth/pin";
import { AgentVersionsMissingError } from "@/lib/auth/store";

type Ctx = { params: Promise<{ id: string }> };

const text = z.string().max(MAX_INSTRUCTIONS + 200);
const note = z.string().max(200).nullable().optional();
const version = z.number().int().min(1).max(1_000_000);
const actionBody = z.discriminatedUnion("action", [
  z.strictObject({ action: z.literal("save-draft"), instructions: text, note }),
  z.strictObject({ action: z.literal("publish"), instructions: text, note }),
  z.strictObject({ action: z.literal("restore"), version }),
  z.strictObject({ action: z.literal("delete"), version }),
]);

export async function GET(request: Request, { params }: Ctx) {
  const { id } = await params;
  return withAuth(request, async ({ store, jar }) => {
    const locked = await pinLockedResponse(store, jar);
    if (locked) return locked;
    const admin = await requireAdmin(store, jar);
    if (!admin) return fail(403, "not-allowed");
    const detail = await agentDetail(store, id);
    return detail ? ok(detail) : fail(404, "not-found");
  });
}

export async function POST(request: Request, { params }: Ctx) {
  const { id } = await params;
  return withAuth(request, async ({ store, jar }) => {
    const locked = await pinLockedResponse(store, jar);
    if (locked) return locked;
    const admin = await requireAdmin(store, jar);
    if (!admin) return fail(403, "not-allowed");
    if (!isEditableAgent(id)) return fail(404, "not-found");
    const body = await readBody(request, actionBody);
    if (!body) return fail(400, "invalid");
    let result;
    try {
      result = await applyAgentAction(store, id, body, admin.profile.id);
    } catch (e) {
      if (e instanceof AgentVersionsMissingError) return fail(503, "not-configured", { note: "Saving needs the agent_versions table: run supabase/migrations/20261030_agent_versions.sql in Supabase." });
      throw e;
    }
    if (!result.ok) return fail(result.status, result.reason, { note: result.note });
    if (result.publishedChanged) forgetInstructions();
    await store.audit({ actor: admin.profile.id, actorRole: "admin", action: result.audit.action, target: result.row.id, householdId: admin.householdId, detail: result.audit.detail });
    return ok({ done: { action: body.action, version: result.row.version }, ...(await agentDetail(store, id))! });
  });
}
