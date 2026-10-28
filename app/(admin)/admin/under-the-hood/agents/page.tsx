import { redirect } from "next/navigation";

// The agent editor opens on the Kix Tutor; each agent has its own page.
export default function AgentsPage() {
  redirect("/admin/under-the-hood/agents/tutor");
}
