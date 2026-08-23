import type { Metadata } from "next";

import { Gallery } from "@/components/Gallery";
import { SET } from "@/lib/set";

export const metadata: Metadata = {
  title: "The set — Cards of Cronos",
  description: "Every card in the first set: projects, tactics and influencers.",
};

export default function CardsPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <header className="mb-8">
        <p className="text-[10px] tracking-[0.28em] text-faint">SET 01</p>
        <h1 className="display mt-2 text-4xl sm:text-5xl">THE SET</h1>
        <p className="mt-4 max-w-2xl text-[11px] leading-relaxed text-muted">
          {SET.length} cards. The art is still to come, so what you see below is drawn from each
          card’s own id. The rules text is generated from the
          effect the engine runs — what you read is what happens.
        </p>
      </header>

      <Gallery cards={SET} />
    </div>
  );
}
