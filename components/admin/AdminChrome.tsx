// The admin layout's shell on the server: who is signed in, then the client shell around the content.
import type { ReactNode } from "react";
import { getGrownUp } from "@/lib/auth/server";
import { AdminShell } from "./AdminFrame";

export async function AdminChrome({ children }: { children: ReactNode }) {
  const who = await getGrownUp();
  return <AdminShell who={who?.name ?? null}>{children}</AdminShell>;
}
