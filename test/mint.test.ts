import { describe, expect, it } from "vitest";

import { CARDS } from "@/data/cards";
import { PULL_WEIGHTS } from "@/engine/draw";
import { buildIndex } from "@/engine/match";
import {
  DECK_MINT_MAX_PER_PROJECT,
  DECK_MINT_MIN_PROJECTS,
  DECK_MINT_SIZE,
  mintDeck,
} from "@/engine/mint";
import { RARITIES } from "@/engine/types";

const index = buildIndex(CARDS);
const mints = Array.from({ length: 300 }, (_, seed) => mintDeck(CARDS, seed * 977 + 1));

describe("minting a deck", () => {
  it("hands over the size it advertises", () => {
    for (const minted of mints) expect(minted).toHaveLength(DECK_MINT_SIZE);
  });

  it("never gives the same card twice in one mint", () => {
    for (const minted of mints) expect(new Set(minted).size).toBe(minted.length);
  });

  it("clears the project floor", () => {
    for (const minted of mints) {
      const projects = minted.filter((id) => index.get(id)!.type === "project").length;
      expect(projects).toBeGreaterThanOrEqual(DECK_MINT_MIN_PROJECTS);
    }
  });

  it("caps how many cards of one project it hands over", () => {
    // The lever that matters. Without it one player gets five cards of the same
    // project and another gets a spread, and the gap between the luckiest and
    // unluckiest tenth of players widens by about ten points.
    for (const minted of mints) {
      const perProject = new Map<string, number>();
      for (const id of minted) {
        const card = index.get(id)!;
        if (card.type !== "project") continue;
        perProject.set(card.project, (perProject.get(card.project) ?? 0) + 1);
      }
      const worst = Math.max(...perProject.values());
      expect(worst).toBeLessThanOrEqual(DECK_MINT_MAX_PER_PROJECT);
    }
  });

  it("draws the rarities the table says it does", () => {
    // Against the table, not against numbers copied out of it, so changing the
    // odds changes what this expects instead of breaking it.
    const counts = Object.fromEntries(RARITIES.map((r) => [r, 0])) as Record<string, number>;
    for (const minted of mints) for (const id of minted) counts[index.get(id)!.rarity]!++;
    const total = mints.length * DECK_MINT_SIZE;
    const weight = RARITIES.reduce((sum, r) => sum + PULL_WEIGHTS[r], 0);

    for (const rarity of RARITIES) {
      const expected = PULL_WEIGHTS[rarity] / weight;
      const actual = counts[rarity]! / total;
      expect(
        Math.abs(actual - expected),
        `${rarity}: table says ${expected}, drew ${actual}`,
      ).toBeLessThan(0.04);
    }
  });

  it("is the same mint twice from the same seed", () => {
    expect(mintDeck(CARDS, 4242)).toEqual(mintDeck(CARDS, 4242));
    expect(mintDeck(CARDS, 4242)).not.toEqual(mintDeck(CARDS, 4243));
  });



  it("draws against the whole set, however much you already own", () => {
    // A mint of sixty is sixty every time. It used to shrink as a collection
    // filled and empty out once the set was complete, which broke the odds it
    // prints — see the note on openPack.
    expect(mintDeck(CARDS, 5)).toHaveLength(DECK_MINT_SIZE);
    expect(mintDeck(CARDS, 9_999)).toHaveLength(DECK_MINT_SIZE);
  });
});
