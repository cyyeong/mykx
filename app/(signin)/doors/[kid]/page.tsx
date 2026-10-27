import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { SignInScreen } from "@/components/signin/SignInScreen";
import { DEFAULT_SECRET_KIND } from "@/lib/auth/schemas";
import { getDoor, getDoors } from "@/lib/auth/server";

export const metadata: Metadata = { title: "Open your door · myKx" };

async function KidDoor({ params }: { params: Promise<{ kid: string }> }) {
  const [{ kid: kidId }, doors] = await Promise.all([params, getDoors()]);
  if (!doors.signedIn) redirect("/signin");
  const door = await getDoor(kidId);
  if (!door) redirect("/doors");
  const kind = door.secretKind ?? DEFAULT_SECRET_KIND[door.band];
  return (
    <SignInScreen
      variant={kind === "pictures" ? "junior" : "teen"}
      pack={door.pack}
      kid={{ id: door.id, nickname: door.nickname, needsSetup: door.needsSetup }}
    />
  );
}

export default function KidDoorPage({ params }: PageProps<"/doors/[kid]">) {
  return (
    <Suspense fallback={<div style={{ minHeight: "100dvh", background: "#1E1C45" }} />}>
      <KidDoor params={params} />
    </Suspense>
  );
}
