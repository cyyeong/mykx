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
      </SoundProvider>
    </ThemeRoot>
  );
}
