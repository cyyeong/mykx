import { redirect } from "next/navigation";

// The front door is the door: grown-ups sign in, then each kid opens their own.
export default function Index() {
  redirect("/signin");
}
