// What a wallet has played, and the sums drawn from it.
//
// The arithmetic is the easy half. The half worth testing is what counts as the
// same deck, because that decides whether a win rate means anything: too loose
// and two different decks share a record, too tight and renaming one throws its
// history away.

import { describe, expect, it } from "vitest";

import { byDeck, deckKey, history, tally, type MatchOutcome } from "@/lib/history";

const T0 = 1_700_000_000_000;

const match = (over: Partial<MatchOutcome> = {}): MatchOutcome => ({
  at: T0,
  deckKey: "aaa",
  deckName: "MEME LORD",
  yourMC: 1_000_000,
  theirMC: 900_000,
  won: true,
  ...over,
});

describe("which deck is which", () => {
  it("does not care what order the cards were listed in", () => {
    // The order a deck happens to be stored in is not a property of the deck.
    // Two identical forties built in a different order are one record, not two.
    expect(deckKey(["b", "a", "c"])).toBe(deckKey(["a", "b", "c"]));
  });

  it("does care about a different card", () => {
    // A deck with a card swapped is a different deck. Rolling their results
    // together would hide exactly the change you made the swap to measure.
    expect(deckKey(["a", "b", "c"])).not.toBe(deckKey(["a", "b", "d"]));
  });

  it("survives a rename", () => {
    const rows = byDeck([
      match({ at: T0, deckName: "First name", won: false }),
      match({ at: T0 + 1000, deckName: "Second name", won: true }),
    ]);
    // One deck, two matches, and the name it goes by now — not whichever came
    // out of storage first.
    expect(rows).toHaveLength(1);
    expect(rows[0]!.played).toBe(2);
    expect(rows[0]!.name).toBe("Second name");
  });
});

describe("the sums", () => {
  it("counts wins, losses and draws apart", () => {
    const t = tally([match({ won: true }), match({ won: false }), match({ won: null })]);
    expect([t.played, t.won, t.lost, t.drawn]).toEqual([3, 1, 1, 1]);
    // A draw is not a loss. Counting it as one is the shortcut that makes a
    // win rate quietly wrong.
    expect(t.winRate).toBeCloseTo(1 / 3);
  });

  it("reports zero matches as zero rather than as NaN", () => {
    // The page prints "—" for this, but only because the number behind it is
    // safe to compare against. A NaN here renders as NaN everywhere.
    const t = tally([]);
    expect(t.winRate).toBe(0);
    expect(t.averageMC).toBe(0);
    expect(t.bestMC).toBe(0);
  });

  it("takes the best and the mean from your own market cap", () => {
    const t = tally([match({ yourMC: 1_000_000 }), match({ yourMC: 3_000_000 })]);
    expect(t.bestMC).toBe(3_000_000);
    expect(t.averageMC).toBe(2_000_000);
  });
});

describe("the deck table", () => {
  it("puts the better deck first, and does not let one lucky match win the argument", () => {
    const rows = byDeck([
      match({ deckKey: "lucky", deckName: "ONE MATCH", won: true }),
      ...Array.from({ length: 4 }, () =>
        match({ deckKey: "solid", deckName: "FOUR MATCHES", won: true }),
      ),
    ]);
    // Both are at 100%, so the tie is broken by how much is behind it.
    expect(rows.map((r) => r.name)).toEqual(["FOUR MATCHES", "ONE MATCH"]);
  });
});

describe("reading it back", () => {
  it("holds nothing while nobody is signed in", () => {
    // No window in node, so nobody is signed in — which is the state every
    // visitor arrives in, and history is per wallet.
    expect(history()).toEqual([]);
  });
});
