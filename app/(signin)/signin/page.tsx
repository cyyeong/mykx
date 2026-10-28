import type { Metadata } from "next";
import { SignInFlow } from "@/components/signin/MagicName";

export const metadata: Metadata = { title: "Sign in · myKx" };

export default function SignInPage() {
  // Grown-ups sign in here; kids tell Kix their magic name and their door comes (MagicName.tsx).
  return <SignInFlow />;
}
