import type { Metadata } from "next";

import { DeckBuilder } from "@/components/DeckBuilder";
import { RULES } from "@/engine/types";
import { DECK_FROM_COLLECTION } from "@/lib/collection";
import { SET } from "@/lib/set";

export const metadata: Metadata = {
  title: "Deck — Cards of Cronos",
  description: "Build a deck of 40 cards to a marketing curve.",
};

export default function DeckPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      {/* ── THE PROSE MOVED BELOW THE BUILDER ──────────────────────────────
          Four paragraphs stood between the top of the page and the first
          control, so a player arriving to swap two cards read an essay first —
          and on a laptop the whole of the above-the-fold screen was text. It is
          not cut: it answers real questions and it is the only place the budget
          is explained in words. It is just not what somebody came here for.
          Builders first, reading after. */}
      <header className="mb-6">
        <p className="text-[10px] tracking-[0.28em] text-faint">SET 01</p>
        <h1 className="display mt-2 text-4xl sm:text-5xl">YOUR DECK</h1>
      </header>

      <DeckBuilder />

      <section className="mt-12 border-t border-line pt-8">
        <h2 className="text-[10px] tracking-[0.22em] text-faint">HOW A DECK WORKS</h2>
        <p className="mt-4 max-w-2xl text-[11px] leading-relaxed text-muted">
          {RULES.deckSize} cards, one copy of each.{" "}
          {DECK_FROM_COLLECTION
            ? `The set has ${SET.length}; what you can put in a deck is what you have minted.`
            : `All ${SET.length} of them are open to you — the mint is not running, so nothing has to be pulled before it can be played.`}{" "}
          There is no budget on the deck — a card is paid for when you play it, out of the marketing
          budget you are given that turn. So the question is not what you can afford to own, it is
          whether you have something worth doing with every turn's money.
        </p>
        <p className="mt-3 max-w-2xl text-[11px] leading-relaxed text-muted">
          You draw a median of 31 cards in a match, so at this size you see nearly all of it. What
          you build is what you get. One thing the numbers are blunt about: a deck wants projects.
          Only a project can hold a position, and only a position pumps.
        </p>
      </section>
    </div>
  );
}
