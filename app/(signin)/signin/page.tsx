import type { Metadata } from "next";
import { SignInScreen } from "@/components/signin/SignInScreen";

export const metadata: Metadata = { title: "Sign in · myKx" };

export default function SignInPage() {
  return <SignInScreen variant="default" />;
}
