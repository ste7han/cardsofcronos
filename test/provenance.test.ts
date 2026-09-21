// The one number on /mint a buyer is invited to trust.
//
// The mint page publishes a sha256 over the whole token sequence and tells the
// reader to rerun the shuffle and compare. That instruction is worth printing
// only if it actually works, and everything it depends on is the kind of thing
// that moves quietly: the seed, the copy counts, the jitter constant, the order
// RARITIES happens to be in, and the set itself.
//
// So this reruns it. Not a snapshot of the file against itself — that would pass
// with a broken shuffle — but the sequence drawn again from the published seed
// and hashed, which is the reader's own check done here first.

import { describe, expect, it } from "vitest";

import { CARDS } from "@/data/cards";
import shuffle from "@/data/shuffle.json";
import { RARITIES } from "@/engine/types";
import { COPIES, HASH, SEED, TOKENS } from "@/lib/provenance";
import { COPIES as DRAWN_WITH, draw } from "@/scripts/shuffle";

describe("the provenance commitment", () => {
  it("is what the published seed actually produces", () => {
    // The reader's instruction, executed. If this fails, the hash on the page
    // is a promise that anybody could disprove in one command.
    const { order, hash } = draw(SEED);
    expect(hash).toBe(HASH);
    expect(order).toEqual(shuffle.order);
  });

  it("was drawn at the copy counts it publishes", () => {
    // The page prints these beside the hash. Drawing at one set of counts and
    // printing another is a page that is wrong about the thing it is proving.
    expect(COPIES).toEqual(DRAWN_WITH);
  });

  it("holds every card in the set, and nothing that is not in it", () => {
    // A card added after the shuffle was drawn would never be minted, and a
    // card removed would leave tokens pointing at metadata for a card the game
    // does not have. Both are silent.
    const inSet = new Set(CARDS.map((card) => card.id));
    const minted = new Set(shuffle.order);
    expect([...minted].filter((id) => !inSet.has(id))).toEqual([]);
    expect([...inSet].filter((id) => !minted.has(id))).toEqual([]);
  });

  it("prints each card exactly as often as its rarity says", () => {
    const counts = new Map<string, number>();
    for (const id of shuffle.order) counts.set(id, (counts.get(id) ?? 0) + 1);
    for (const card of CARDS) {
      expect(counts.get(card.id), card.id).toBe(COPIES[card.rarity]);
    }
  });

  it("matches the supply the collection was deployed with", () => {
    // maxSupply is immutable on chain. Read back from Cronos after deploying on
    // 21 September 2026 and written down here, because the contract is the one
    // place this number can no longer be corrected.
    expect(TOKENS).toBe(5603);
    expect(shuffle.order).toHaveLength(5603);
  });

  it("keeps the odds steady at every prefix, which is why it is not a plain shuffle", () => {
    // The first collection planned 1894 and stopped at 515. With a fixed
    // sequence, where the mint stops decides what the buyers got — unless the
    // rarities are spread, which is the whole reason this shuffle is shaped the
    // way it is. Two points apart in the low thousands, since that is where a
    // mint realistically stops.
    const byRarity = new Map(CARDS.map((card) => [card.id, card.rarity]));
    const shareAt = (n: number, rarity: string) =>
      shuffle.order.slice(0, n).filter((id) => byRarity.get(id) === rarity).length / n;

    for (const rarity of RARITIES) {
      const whole = shareAt(TOKENS, rarity);
      for (const n of [250, 500, 1000, 2500]) {
        // Within three points of the eventual share. A plain shuffle at n=250
        // would swing far wider than this on the thin tiers.
        expect(Math.abs(shareAt(n, rarity) - whole), `${rarity} at ${n}`).toBeLessThan(0.03);
      }
    }
  });

  it("never hands the same card three times to somebody buying ten", () => {
    // This one was written the wrong way round first. It asserted that two of a
    // card are never adjacent, because that is what scripts/shuffle.ts claimed —
    // and the sequence has ten such pairs in 5602 boundaries, because the jitter
    // is applied after the round-robin that spreads them. The comment was wrong,
    // not the shuffle, and both have been corrected.
    //
    // What does hold is the useful part, and it holds because of the even
    // spread rather than by luck: ten consecutive tokens never contain three of
    // anything. So the worst a buyer of ten can do is one duplicate pair.
    let worst = 0;
    for (let i = 0; i + 10 <= shuffle.order.length; i++) {
      const counts = new Map<string, number>();
      for (const id of shuffle.order.slice(i, i + 10)) {
        const seen = (counts.get(id) ?? 0) + 1;
        counts.set(id, seen);
        if (seen > worst) worst = seen;
      }
    }
    expect(worst).toBeLessThanOrEqual(2);
  });
});
