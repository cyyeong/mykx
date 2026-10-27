// Server side of a print page, shared by the grown-up and kid routes: read the pack on the server, pick the
// paper from the URL (adding a seed when there is none, so the URL always reproduces the paper), inline the
// figures and render. Call inside <Suspense> after the sign-in check (it reads the clock and randomness).
import { notFound, redirect } from "next/navigation";
import { loadFigures, loadPrintBank, type PackSummary } from "@/lib/print/bank";
import { assemblePaper, paperFigures, printableTopics } from "@/lib/print/paper";
import { newSeed, paperHref, readPaperOptions, type GuideMode } from "@/lib/print/params";
import { todayLabel } from "./labels";
import { PaperScreen, type PaperScreenProps } from "./PaperScreen";

interface Props {
  packId: string;
  search: Record<string, string | string[] | undefined>;
  /** Route prefix: "/papers" or "/me/papers". */
  base: string;
  defaultGuide: GuideMode;
  /** Only packs at this level (kids); undefined: any published pack (grown-ups). */
  level?: PackSummary["level"];
  /** Where to go when the pack is not at `level`. */
  elsewhere: string;
  back: PaperScreenProps["back"];
  audience: PaperScreenProps["audience"];
  theme: PaperScreenProps["theme"];
}

export function PaperRoute({ packId, search, base, defaultGuide, level, elsewhere, back, audience, theme }: Props) {
  const bank = loadPrintBank(packId);
  if (!bank) notFound();
  if (level && bank.manifest.level !== level) redirect(elsewhere);
  const page = `${base}/${bank.manifest.id}`;
  const options = readPaperOptions(search, { guide: defaultGuide });
  if (!options.seed) redirect(paperHref(page, { ...options, seed: newSeed() }));
  const withSeed = { ...options, seed: options.seed };
  const paper = assemblePaper(bank, withSeed);
  return (
    <PaperScreen
      paper={paper}
      figures={loadFigures(bank.manifest.id, paperFigures(paper))}
      options={withSeed}
      base={page}
      nextSeed={newSeed()}
      topics={printableTopics(bank)}
      back={back}
      audience={audience}
      theme={theme}
      made={todayLabel()}
    />
  );
}
