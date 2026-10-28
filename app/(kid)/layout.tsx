import { Suspense } from "react";
import { FocusWatch } from "@/components/camera/FocusWatch";
import { GuardianWatch } from "@/components/guardian/GuardianWatch";
import { KidIdle } from "@/components/nav/KidIdle";
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
          <KidNav demoLabel={<DemoLabel variant="bar" />} />
          <div className="kid-shell-main">
            {children}
            {/* Inside the shell so it sits right of the rail from 600 px (see demoLabel.css);
                under 600 px the label rides inside the bar and this pill hides. */}
            <DemoLabel />
          </div>
          {/* Inside the shell so it zooms with the screen when a short window scales it (kid-tabs.css). */}
          <SoundToggle />
          {/* Kix as guardian: screen-time heartbeats, and a kind break or wind-down when it's time. It reads the
              path too, so it gets its own Suspense boundary. */}
          <Suspense fallback={null}>
            <GuardianWatch />
          </Suspense>
          {/* Signs the kid out after 15 minutes idle, with a "Still there?" card in the last minute. */}
          <KidIdle />
        </div>
        {/* Focus camera: learning screens only, when a grown-up turned it on (renders nothing otherwise). It reads
            the current path, so it sits in its own Suspense boundary and never blocks a page. */}
        <Suspense fallback={null}>
          <FocusWatch />
        </Suspense>
      </SoundProvider>
    </ThemeRoot>
  );
}
