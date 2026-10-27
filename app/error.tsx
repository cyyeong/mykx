"use client";

// Any crash below the root layout lands here: a calm note, try again, or go home. The error itself is not shown.
import { LostScreen } from "@/components/ui/LostScreen";

export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <LostScreen title="Oops, that wobbled" line="Something went wrong on our side. Try again, or head home and pick up from there.">
      <button className="mk-btn" type="button" onClick={reset}>
        Try again
      </button>
    </LostScreen>
  );
}
