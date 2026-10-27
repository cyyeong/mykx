import type { Metadata } from "next";
import { PeopleScreen } from "@/components/admin/people/PeopleScreen";
import { GrownUpGate } from "@/components/account/GrownUpGate";

export const metadata: Metadata = { title: "People · myKx admin" };

// The screen reads /api/admin/people in the browser (the route checks the admin flag and the PIN unlock).
export default function AdminPeoplePage() {
  return (
    <GrownUpGate>
      <PeopleScreen />
    </GrownUpGate>
  );
}
