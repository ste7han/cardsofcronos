import { describe, expect, it } from "vitest";

import { STREAMS } from "@/lib/revenue";

import {
  CROCARD_SUPPLY,
  HOLDER_TIERS,
  cutFor,
  nextTier,
  tierFor,
} from "@/data/holder-tiers";

/**
 * The ladder decides how much of a pot somebody keeps, so every rung of it is
 * money. What these check is not that the numbers are the right numbers — that
 * is the maker's call — but that the ladder behaves like a ladder: reachable at
 * every rung, cheaper as you climb, and never generous to a balance nobody read.
 */
describe("the holder ladder", () => {
  it("is four rungs, carried over from TCG", () => {
    expect(HOLDER_TIERS).toHaveLength(4);
    expect(HOLDER_TIERS.map((tier) => tier.id)).toEqual(["whale", "medium", "small", "none"]);
  });

  it("is built on fractions of a supply read off the chain", () => {
    expect(CROCARD_SUPPLY).toBe(1_000_000_000);
    const at = (id: string) => HOLDER_TIERS.find((tier) => tier.id === id)!.atLeast;
    expect(at("whale")).toBe(10_000_000);
    expect(at("medium")).toBe(1_000_000);
    expect(at("small")).toBe(100_000);
    expect(at("none")).toBe(0);
  });

  it("costs less the higher you climb", () => {
    const cuts = HOLDER_TIERS.map((tier) => tier.cut);
    expect(cuts).toEqual([0.05, 0.1, 0.15, 0.25]);
    for (let i = 1; i < cuts.length; i++) expect(cuts[i]!).toBeGreaterThan(cuts[i - 1]!);
  });

  it("puts every rung within reach of the one below it", () => {
    // A threshold typed under the rung beneath it makes that rung unreachable
    // and nothing on the page would show it.
    for (let i = 1; i < HOLDER_TIERS.length; i++) {
      expect(HOLDER_TIERS[i]!.atLeast).toBeLessThan(HOLDER_TIERS[i - 1]!.atLeast);
    }
  });
});

describe("which rung a balance is on", () => {
  it("lands on the rung it just reaches, and not the one above", () => {
    expect(tierFor(10_000_000).id).toBe("whale");
    expect(tierFor(9_999_999).id).toBe("medium");
    expect(tierFor(1_000_000).id).toBe("medium");
    expect(tierFor(999_999).id).toBe("small");
    expect(tierFor(100_000).id).toBe("small");
    expect(tierFor(99_999).id).toBe("none");
    expect(tierFor(0).id).toBe("none");
  });

  it("treats a balance nobody could read as retail", () => {
    // The expensive rate, deliberately. An RPC that will not answer must not be
    // worth money to the person it would not answer about.
    expect(tierFor(null).id).toBe("none");
    expect(cutFor(null)).toBe(0.25);
  });

  it("charges a whale less than retail on the same pot", () => {
    expect(cutFor(CROCARD_SUPPLY / 100)).toBeLessThan(cutFor(0));
  });

  it("is a cut and not a burn, because only a quarter of it is burned", () => {
    // The field was called `burn` while a ranked match was 100% burn. It is not
    // any more, and a name that describes a quarter of what it does is the trap
    // this codebase keeps a whole section of CLAUDE.md about.
    const rake = STREAMS.find((stream) => stream.id === "rake")!;
    expect(rake.shares.find((share) => share.to === "burn")!.percent).toBe(25);
    expect(rake.shares).toHaveLength(3);
  });

  it("says what the next rung needs, and says nothing at the top", () => {
    expect(nextTier(0)!.id).toBe("small");
    expect(nextTier(100_000)!.id).toBe("medium");
    expect(nextTier(1_000_000)!.id).toBe("whale");
    expect(nextTier(10_000_000)).toBeNull();
    expect(nextTier(null)!.id).toBe("small");
  });
});
