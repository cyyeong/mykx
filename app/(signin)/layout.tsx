import { SoundProvider } from "@/components/sound/SoundProvider";
import { SoundToggle } from "@/components/sound/SoundToggle";
import { ThemeRoot } from "@/components/theme/ThemeRoot";
import { DemoLabel } from "@/components/ui/DemoLabel";

// Sign-in pages: the door opens with the transform whoosh, so sound is here too.
export default function SignInLayout({ children }: LayoutProps<"/">) {
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
