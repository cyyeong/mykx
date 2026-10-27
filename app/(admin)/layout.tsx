// Admin pages. Each screen sets its own pack and band (Anime Sky, Teen sizing); no sound here.
import { DemoLabel } from "@/components/ui/DemoLabel";

export default function AdminLayout({ children }: LayoutProps<"/">) {
  return (
    <>
      {children}
      <DemoLabel />
    </>
  );
}
