import { describe, expect, it } from "vitest";

import { CARDS } from "@/data/cards";
import { countProjects, deckProblems } from "@/engine/deck";
import { buildIndex } from "@/engine/match";
import {
  PACK_PULL_WEIGHTS,
  PACK_SIZE,
  isBackbone,
  openPack,
  openSingle,
} from "@/engine/pack";
import { RARITIES, RULES } from "@/engine/types";

const index = buildIndex(CARDS);

/**
 * A pack is bought, not given. What it has to prove is that it stays stingy
 * enough to be worth buying and honest enough to be worth trusting: the odds it
 * prints are the odds it draws, and the one slot it promises is always there.
 */
describe("opening an ordinary pack", () => {
  const packs = Array.from({ length: 400 }, (_, seed) => openPack(CARDS, seed));

  it("is eight cards", () => {
    packs.forEach((pack, seed) => {
      expect(pack.length, `seed ${seed}`).toBe(PACK_SIZE);
    });
  });

  it("never gives the same card twice in one pack", () => {
    packs.forEach((pack, seed) => {
      expect(new Set(pack).size, `seed ${seed} has a duplicate`).toBe(pack.length);
    });
  });

  it("always has at least one rare or better", () => {
    // The one guarantee. Without it a pack can be eight commons, and eight
    // commons is the moment somebody stops buying packs.
    packs.forEach((pack, seed) => {
      const hit = pack.some((id) => index.get(id)!.rarity !== "common");
      expect(hit, `seed ${seed} opened eight commons`).toBe(true);
    });
  });


  it("draws the rarities the table says it does", () => {
    // Written against the table rather than against numbers copied out of it.
    // The first version asserted "over half commons" and "under 2% mythic",
    // which were the odds of the day; when the odds changed the test failed for
    // being right, and a test that has to be edited to agree with a decision is
    // not checking the decision at all.
    //
    // One slot in every pack is guaranteed rare or better, so commons come out
    // below their own weight and everything else above it. That is the pack
    // working, so the guarantee is taken out of the count rather than fudged
    // into the tolerance.
    const counts = Object.fromEntries(RARITIES.map((r) => [r, 0])) as Record<string, number>;
    for (const pack of packs) for (const id of pack.slice(1)) counts[index.get(id)!.rarity]!++;
    const total = packs.length * (PACK_SIZE - 1);
    const weight = RARITIES.reduce((sum, r) => sum + PACK_PULL_WEIGHTS[r], 0);

    for (const rarity of RARITIES) {
      const expected = PACK_PULL_WEIGHTS[rarity] / weight;
      const actual = counts[rarity]! / total;
      expect(Math.abs(actual - expected), `${rarity}: table says ${expected}, drew ${actual}`).toBeLessThan(
        0.03,
      );
    }

    // And the order the tiers are named in is the order they arrive in.
    for (let i = 1; i < RARITIES.length; i++) {
      expect(counts[RARITIES[i - 1]!]!).toBeGreaterThan(counts[RARITIES[i]!]!);
    }
  });

  it("is the same pack twice from the same seed", () => {
    expect(openPack(CARDS, 77)).toEqual(openPack(CARDS, 77));
    expect(openPack(CARDS, 77)).not.toEqual(openPack(CARDS, 78));
  });

  it("draws against the whole set, however much you already own", () => {
    // This used to check the opposite: that a pack never repeats a card you
    // have. It was dropped because it silently broke the odds. Commons are half
    // of every draw, so a collection holds all 202 of them by about 460 cards
    // and all the rares by 550, and from there a pack could only hand over what
    // was left — the printed 50/35/9/5/1 quietly became 0/0/40/50/10.
    // scripts/pack-drift.ts walks a collection up and shows the table drifting.
    const everything = CARDS.map((c) => c.id);
    const pack = openPack(CARDS, 31);
    expect(pack).toHaveLength(PACK_SIZE);
    expect(pack.every((id) => everything.includes(id))).toBe(true);
  });

  it("still never repeats a card inside one pack", () => {
    // Ten of the same card in one wrapper is a bug however you argue it.
    for (let seed = 0; seed < 200; seed++) {
      const pack = openPack(CARDS, seed * 71 + 3);
      expect(new Set(pack).size, `seed ${seed}`).toBe(pack.length);
    }
  });


  it("weights every rarity, so none is unreachable", () => {
    for (const rarity of RARITIES) {
      expect(PACK_PULL_WEIGHTS[rarity], `${rarity} can never be drawn`).toBeGreaterThan(0);
    }
  });
});

/**
 * Cards leave the set. When BONK became eight cards the single `bonk` card
 * stopped existing, every stored pack holding it failed validation, and the
 * caller drew a fresh pack over the top — so a player lost forty cards without
 * being told. These are the tests for the repair.
 */

describe("buying one card", () => {
  it("hands over exactly one card, and one that exists", () => {
    for (let seed = 0; seed < 200; seed++) {
      const drawn = openSingle(CARDS, seed);
      expect(drawn).toHaveLength(1);
      expect(index.get(drawn[0]!)).toBeTruthy();
    }
  });

  it("replays the same seed and differs on a different one", () => {
    expect(openSingle(CARDS, 4242)).toEqual(openSingle(CARDS, 4242));
    const spread = new Set(Array.from({ length: 200 }, (_, s) => openSingle(CARDS, s)[0]));
    expect(spread.size).toBeGreaterThan(20);
  });

  it("promises nothing, unlike a pack", () => {
    // The pack guarantees a rare or better and this deliberately does not. If a
    // single ever stopped producing commons, the two products would have become
    // the same product at two prices — which is the one thing the split of 15
    // against 10 a card cannot survive.
    const rarities = Array.from(
      { length: 4000 },
      (_, seed) => index.get(openSingle(CARDS, seed)[0]!)!.rarity,
    );
    expect(rarities.filter((r) => r === "common").length).toBeGreaterThan(0);
    expect(new Set(rarities).size).toBe(RARITIES.length);
  });

  it("draws at the printed odds rather than flat", () => {
    // 50/35/9/5/1 over four thousand draws: commons have to be the biggest pile
    // by a distance, and mythics the smallest.
    const count = (want: string) =>
      Array.from({ length: 4000 }, (_, seed) => index.get(openSingle(CARDS, seed)[0]!)!.rarity)
        .filter((r) => r === want).length;
    expect(count("common")).toBeGreaterThan(count("rare"));
    expect(count("rare")).toBeGreaterThan(count("epic"));
    expect(count("mythic")).toBeLessThan(count("legendary"));
  });
});
