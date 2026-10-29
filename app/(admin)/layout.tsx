// Admin pages (founder, 29 Oct): one shell for every admin area, rendered here once, so moving between areas swaps
// only the content panel and the sidebar never reloads. The shared-device PIN gate runs here too (the data routes
// check the same unlock). Every screen uses Anime Sky and Teen sizing; no sound here.
import { GrownUpGate } from "@/components/account/GrownUpGate";
import { AdminChrome } from "@/components/admin/AdminChrome";
import { DemoLabel } from "@/components/ui/DemoLabel";

export default function AdminLayout({ children }: LayoutProps<"/">) {
  return (
    <>
      <GrownUpGate>
        <AdminChrome>{children}</AdminChrome>
      </GrownUpGate>
      <DemoLabel />
    </>
  );
}
