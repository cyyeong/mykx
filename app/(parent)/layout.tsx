// Grown-up pages. Each screen sets its own pack and band (parents get Anime Sky, Teen sizing); no sound here.
import { DemoLabel } from "@/components/ui/DemoLabel";

export default function ParentLayout({ children }: LayoutProps<"/">) {
  return (
    <>
      {children}
      <DemoLabel />
    </>
  );
}
