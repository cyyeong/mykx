import { Suspense } from "react";
import { FocusWatch } from "@/components/camera/FocusWatch";
import { KidNav } from "@/components/nav/KidNav";
import { SoundProvider } from "@/components/sound/SoundProvider";
import { SoundToggle } from "@/components/sound/SoundToggle";
import { ThemeRoot } from "@/components/theme/ThemeRoot";
import { DemoLabel } from "@/components/ui/DemoLabel";

export default function KidLayout({ children }: LayoutProps<"/">) {
  // Day 3: initialPack and initialBand come from the signed-in child's profile.
  return (
    <ThemeRoot>
      <SoundProvider kidArea>
        <div className="kid-shell">
          <KidNav />
          <div className="kid-shell-main">
            {children}
            {/* Inside the shell so it sits right of the rail from 600 px (see demoLabel.css);
                under 600 px the label rides inside the bar and this pill hides. */}
            <DemoLabel />
          </div>
        </div>
        <SoundToggle />
        {/* Focus camera: learning screens only, when a grown-up turned it on (renders nothing otherwise). It reads
            the current path, so it sits in its own Suspense boundary and never blocks a page. */}
        <Suspense fallback={null}>
          <FocusWatch />
        </Suspense>
      </SoundProvider>
    </ThemeRoot>
  );
}
