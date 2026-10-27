import { redirect } from "next/navigation";

// Home lands on Day 2; until then the Studio is the front door.
export default function Index() {
  redirect("/studio");
}
