import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { KidDoors } from "@/components/signin/KidDoors";
import { getDoors } from "@/lib/auth/server";

export const metadata: Metadata = { title: "Who's learning? · myKx" };

async function Doors() {
  const doors = await getDoors();
  if (!doors.signedIn) redirect("/signin");
  return <KidDoors grownUp={doors.grownUp ?? "a grown-up"} kids={doors.kids} />;
}

export default function DoorsPage() {
  return (
    <Suspense fallback={<div style={{ minHeight: "100dvh", background: "var(--surface)" }} />}>
      <Doors />
    </Suspense>
  );
}
