import { ThemeRoot } from "@/components/theme/ThemeRoot";

export default function KidLayout({ children }: LayoutProps<"/">) {
  // Day 3: initialPack and initialBand come from the signed-in child's profile.
  return <ThemeRoot>{children}</ThemeRoot>;
}
