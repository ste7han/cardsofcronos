// What a purchase has to prove.
//
// Cards are bought, so the draw has to be honest enough to be worth trusting:
// the odds it prints are the odds it draws, at any collection size, and the same
// seed gives the same cards back so a complaint about one can be looked at.
//
// It used to have a guarantee to prove as well — one slot rare or better in a
// pack of ten. That went with the pack in September 2026, because the token
// order is settled before the mint opens and a fixed sequence cannot promise
// what is inside any ten of it. The tests for the guarantee went with it rather
// than being loosened, since a weakened test for a removed promise is worse than
// no test: it reads as though the promise is still being checked.

import { describe, expect, it } from "vitest";

import { CARDS } from "@/data/cards";
import { buildIndex } from "@/engine/match";
import { MINT_PULL_WEIGHTS, isBackbone, openCards } from "@/engine/pack";
import { RARITIES } from "@/engine/types";

const index = buildIndex(CARDS);

describe("buying cards", () => {
  const BUY = 10;
  const buys = Array.from({ length: 400 }, (_, seed) => openCards(CARDS, seed, BUY));

  it("hands over exactly what was asked for", () => {
    buys.forEach((bought, seed) => {
      expect(bought.length, `seed ${seed}`).toBe(BUY);
    });
    for (const count of [1, 2, 7, 25, 50]) {
      expect(openCards(CARDS, 9, count)).toHaveLength(count);
    }
  });

  it("hands over cards that exist", () => {
    for (const id of buys[0]!) expect(index.get(id), id).toBeTruthy();
  });

  it("refuses a quantity that is not one", () => {
    // Loud rather than returning an empty array. A caller asking for zero or
    // for half a card has a bug, and an empty array looks like a sold-out set.
    for (const bad of [0, -1, 1.5, Number.NaN]) {
      expect(() => openCards(CARDS, 1, bad), `${bad}`).toThrow(/not a number of cards/i);
    }
  });

  it("never gives the same card twice in one purchase", () => {
    // Ten of the same card in one transaction is a bug however you argue it.
    buys.forEach((bought, seed) => {
      expect(new Set(bought).size, `seed ${seed} has a duplicate`).toBe(bought.length);
    });
  });

  it("promises nothing above the odds", () => {
    // The replacement for "always has at least one rare or better". The
    // guarantee is gone, and the way to show it is gone is that its opposite
    // happens: ten straight commons, which the old draw made impossible.
    //
    // Four thousand purchases, not four hundred, and the number is arithmetic
    // rather than taste. Commons are half of every pull, so ten of them is
    // 0.5^10 — about one purchase in a thousand. At four hundred the expected
    // count is 0.4 and this test would fail for being unlucky; at four thousand
    // it is about four, and it finds five.
    const many = Array.from({ length: 4000 }, (_, seed) => openCards(CARDS, seed, BUY));
    const allCommon = many.filter((bought) =>
      bought.every((id) => index.get(id)!.rarity === "common"),
    );
    expect(allCommon.length, "not one purchase of ten commons in four thousand").toBeGreaterThan(0);
  });

  it("draws the rarities the table says it does", () => {
    // Written against the table rather than against numbers copied out of it.
    // The first version asserted "over half commons" and "under 2% mythic",
    // which were the odds of the day; when the odds changed the test failed for
    // being right, and a test that has to be edited to agree with a decision is
    // not checking the decision at all.
    //
    // Every slot counts now. While a pack guaranteed one, that slot had to be
    // taken out of the count or it pulled the common share below its weight.
    const counts = Object.fromEntries(RARITIES.map((r) => [r, 0])) as Record<string, number>;
    for (const bought of buys) for (const id of bought) counts[index.get(id)!.rarity]!++;
    const total = buys.length * BUY;
    const weight = RARITIES.reduce((sum, r) => sum + MINT_PULL_WEIGHTS[r], 0);

    for (const rarity of RARITIES) {
      const expected = MINT_PULL_WEIGHTS[rarity] / weight;
      const actual = counts[rarity]! / total;
      expect(
        Math.abs(actual - expected),
        `${rarity}: table says ${expected}, drew ${actual}`,
      ).toBeLessThan(0.03);
    }

    // And the order the tiers are named in is the order they arrive in.
    for (let i = 1; i < RARITIES.length; i++) {
      expect(counts[RARITIES[i - 1]!]!).toBeGreaterThan(counts[RARITIES[i]!]!);
    }
  });

  it("is the same cards twice from the same seed", () => {
    expect(openCards(CARDS, 77, 10)).toEqual(openCards(CARDS, 77, 10));
    expect(openCards(CARDS, 77, 10)).not.toEqual(openCards(CARDS, 78, 10));
  });

  it("draws against the whole set, however much you already own", () => {
    // This used to check the opposite: that a purchase never repeats a card you
    // have. It was dropped because it silently broke the odds. Commons are half
    // of every draw, so a collection holds all of them by about 460 cards and
    // all the rares by 550, and from there a draw could only hand over what was
    // left — the printed 50/35/9/5/1 quietly became 0/0/40/50/10.
    // scripts/pack-drift.ts walks a collection up and shows the table holding.
    const everything = new Set(CARDS.map((c) => c.id));
    const bought = openCards(CARDS, 31, BUY);
    expect(bought).toHaveLength(BUY);
    expect(bought.every((id) => everything.has(id))).toBe(true);
  });

  it("weights every rarity, so none is unreachable", () => {
    for (const rarity of RARITIES) {
      expect(MINT_PULL_WEIGHTS[rarity], `${rarity} can never be drawn`).toBeGreaterThan(0);
    }
  });

  it("can reach every rarity in practice, not only in the table", () => {
    const seen = new Set(
      Array.from({ length: 4000 }, (_, seed) => index.get(openCards(CARDS, seed, 1)[0]!)!.rarity),
    );
    expect(seen.size).toBe(RARITIES.length);
  });
});

describe("what counts as a card worth having", () => {
  it("is epic and up, which is what the opening screen glows for", () => {
    // isBackbone outlived the guarantee that used it. It is what PackOpening
    // lights a card up for, so it is still load-bearing — just not for a promise
    // any more.
    for (const card of CARDS) {
      expect(isBackbone(card), card.id).toBe(
        card.rarity === "epic" || card.rarity === "legendary" || card.rarity === "mythic",
      );
    }
  });
});
