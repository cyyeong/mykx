// Sidekick Studio transform. Always answers: a fresh cut-out Kix, or the ready-made Kix for the
// world when Meta is slow or fails (hard rule 7: the demo never depends on live generation).
import { z } from "zod";
import { PACK_IDS } from "@/components/theme/packs";
import { requireFamily } from "@/lib/auth/guard";
import { runTransform } from "@/lib/studio/transform";

export const maxDuration = 60;

const Body = z.object({
  pack: z.enum(PACK_IDS),
  interests: z.array(z.string().max(40)).max(2).default([]),
});

// Only a signed-in family can spend Meta credit here, 4 transforms a minute per household.
// TODO(Day 3): upload the cut-out to Storage and save kix_url on the kid's profile.
export async function POST(request: Request) {
  const family = await requireFamily(request, "transform", 4);
  if (family.refused) return family.refused;
  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Pick a world and up to two interests." }, { status: 400 });
  const { pack, interests } = parsed.data;

  const result = await runTransform(pack, interests);
  // Day 3: write result.runs to model_runs.
  if (result.ok) {
    return Response.json({
      fallback: false,
      image: `data:image/webp;base64,${result.webp.toString("base64")}`,
      ms: result.ms.total,
      accessories: result.accessoriesFound,
    });
  }
  return Response.json({ fallback: true, image: `/art/kix/${pack}-800.webp`, reason: "Kix is wearing a ready-made look this time." });
}
