// The deck a visitor without a wallet is handed.
//
// Worth its own file for one reason: this deck is the only thing some people
// will ever see of the game, and it is assembled from a lookup that can go quiet.
// If the preset it names is renamed, the demo deals nothing and the table reports
// "nothing to play with" — which reads as a rule rather than as a broken lookup.

import { describe, expect, it } from "vitest";

import { deckProblems } from "@/engine/deck";
import { RULES } from "@/engine/types";
import { DEMO_DECK_NAME, DEMO_THEME, demoDeck, demoOpponentTheme } from "@/lib/demo";
import { INDEX } from "@/lib/set";

describe("the demo deck", () => {
  it("names a preset that exists", () => {
    // The module throws at import if it does not, so reaching this line is most
    // of the assertion. The rest says the throw is not hiding an empty theme.
    expect(DEMO_THEME.id).toBeTruthy();
    expect(DEMO_DECK_NAME).toBe(DEMO_THEME.name);
  });

  it("is a legal deck, with no ownership rule applied", () => {
    // `undefined` for owned, on purpose: nobody owns these cards, and a demo
    // that had to pass an ownership check would be a demo nobody can play.
    const cards = demoDeck();
    expect(cards).toHaveLength(RULES.deckSize);
    expect(deckProblems(cards, INDEX, undefined)).toEqual([]);
  });

  it("is the same forty every time", () => {
    // A fixed seed. Two visitors comparing notes should be comparing the same
    // deck, and a demo that quietly differs per load is unsupportable.
    expect(demoDeck()).toEqual(demoDeck());
  });

  it("never plays itself", () => {
    // A mirror is fair and dull, and this is the one match some people see.
    for (let seed = 0; seed < 20; seed++) {
      expect(demoOpponentTheme(seed).id).not.toBe(DEMO_THEME.id);
    }
  });
});
