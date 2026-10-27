import { Suspense } from "react";
import { FocusWatch } from "@/components/camera/FocusWatch";
import { SoundProvider } from "@/components/sound/SoundProvider";
import { SoundToggle } from "@/components/sound/SoundToggle";
import { ThemeRoot } from "@/components/theme/ThemeRoot";
import { DemoLabel } from "@/components/ui/DemoLabel";

export default function KidLayout({ children }: LayoutProps<"/">) {
  // Day 3: initialPack and initialBand come from the signed-in child's profile.
  return (
    <ThemeRoot>
      <SoundProvider>
        {children}
        <SoundToggle />
        <DemoLabel />
        {/* Focus camera: learning screens only, when a grown-up turned it on (renders nothing otherwise). It reads
            the current path, so it sits in its own Suspense boundary and never blocks a page. */}
        <Suspense fallback={null}>
          <FocusWatch />
        </Suspense>
      </SoundProvider>
    </ThemeRoot>
  );
}
