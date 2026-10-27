import type { Metadata } from "next";
import { PeopleScreen } from "@/components/admin/people/PeopleScreen";

export const metadata: Metadata = { title: "People · myKx admin" };

// The screen reads /api/admin/people in the browser (the route checks the admin flag), so nothing here waits on request data.
export default function AdminPeoplePage() {
  return <PeopleScreen />;
}
