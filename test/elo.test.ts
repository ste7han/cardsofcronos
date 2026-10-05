// The rank, and what moves it.
//
// It was designed in DESIGN.md, given a column with a comment explaining why it
// had to be stored, printed in the lobby beside every player's name — and never
// written. Every player sat on 1000. So these are about the arithmetic being
// right, and about the two properties that would be invisible if they were
// wrong: that the ladder does not quietly inflate, and that a result always
// counts for something.

import { describe, expect, it } from "vitest";

import {
  FLOOR,
  K_PLACING,
  K_SETTLED,
  SETTLED_AFTER,
  START,
  after,
  expected,
  kFor,
  move,
} from "@/lib/elo";

describe("what a rating expects", () => {
  it("gives equals an even chance", () => {
    expect(expected(START, START)).toBe(0.5);
  });

  it("gives the stronger player the larger share", () => {
    expect(expected(1200, 1000)).toBeGreaterThan(0.5);
    expect(expected(1000, 1200)).toBeLessThan(0.5);
  });

  it("is symmetrical, so the two shares are one result", () => {
    // If these did not add to one, the ladder would invent or destroy rating on
    // every match — which is the kind of drift nobody notices for a season.
    expect(expected(1340, 970) + expected(970, 1340)).toBeCloseTo(1, 10);
  });
});

describe("the K-factor", () => {
  it("places a new rank faster than it moves a settled one", () => {
    expect(kFor(0)).toBe(K_PLACING);
    expect(kFor(SETTLED_AFTER)).toBe(K_SETTLED);
    expect(K_PLACING).toBeGreaterThan(K_SETTLED);
  });

  it("switches on the match the rest of the game already counts to", () => {
    // Ten is the figure in the players table comment and on the profile. A
    // second, different threshold here would be two rules for one idea.
    expect(kFor(SETTLED_AFTER - 1)).toBe(K_PLACING);
    expect(kFor(SETTLED_AFTER)).toBe(K_SETTLED);
  });
});

describe("one staked match", () => {
  it("takes nothing from a draw between equals", () => {
    expect(move({ mine: START, theirs: START, played: 20, outcome: "draw" })).toBe(0);
  });

  it("pays a draw against somebody above you", () => {
    // Holding a much stronger player is a result, and the pot having paid
    // nobody does not change that.
    expect(move({ mine: 1000, theirs: 1400, played: 20, outcome: "draw" })).toBeGreaterThan(0);
    expect(move({ mine: 1400, theirs: 1000, played: 20, outcome: "draw" })).toBeLessThan(0);
  });

  it("pays more for beating somebody above you than below", () => {
    const up = move({ mine: 1000, theirs: 1400, played: 20, outcome: "win" });
    const down = move({ mine: 1000, theirs: 600, played: 20, outcome: "win" });
    expect(up).toBeGreaterThan(down);
  });

  it("never settles a result at nothing", () => {
    // A heavy favourite beating a much weaker player is worth a fraction of a
    // point, and plain rounding would make it zero — a win that visibly did not
    // count. One is the floor on the magnitude, not on the maths.
    const lopsided = move({ mine: 2000, theirs: 100, played: 50, outcome: "win" });
    expect(lopsided).toBeGreaterThanOrEqual(1);
  });

  it("does not hand out more than K on any single result", () => {
    // The guard against the opposite mistake: rounding away from zero would
    // inflate every delta, and over a season that is a ladder drifting upward
    // for no reason.
    for (const played of [0, 50]) {
      for (const [mine, theirs] of [[1000, 1000], [600, 1400], [1400, 600], [100, 2400]]) {
        for (const outcome of ["win", "loss", "draw"] as const) {
          const delta = move({ mine: mine!, theirs: theirs!, played, outcome });
          expect(Math.abs(delta), `${mine} v ${theirs} ${outcome}`).toBeLessThanOrEqual(
            kFor(played),
          );
        }
      }
    }
  });

  it("moves a win up and a loss down, always", () => {
    for (const [mine, theirs] of [[1000, 1000], [100, 2400], [2400, 100]]) {
      expect(move({ mine: mine!, theirs: theirs!, played: 20, outcome: "win" })).toBeGreaterThan(0);
      expect(move({ mine: mine!, theirs: theirs!, played: 20, outcome: "loss" })).toBeLessThan(0);
    }
  });

  it("takes from the loser what it gives the winner, between settled equals", () => {
    // Not a law of Elo once K differs or rounding bites, but it has to hold in
    // the ordinary case or the ladder is not a zero-sum ordering at all.
    const won = move({ mine: 1100, theirs: 1250, played: 20, outcome: "win" });
    const lost = move({ mine: 1250, theirs: 1100, played: 20, outcome: "loss" });
    expect(won).toBe(-lost);
  });
});

describe("the floor", () => {
  it("catches a rank that would go under it", () => {
    expect(after(FLOOR + 5, -50)).toBe(FLOOR);
  });

  it("leaves an ordinary rank alone", () => {
    expect(after(1000, -16)).toBe(984);
    expect(after(1000, 16)).toBe(1016);
  });

  it("is below where everybody starts, or nobody could fall at all", () => {
    expect(FLOOR).toBeLessThan(START);
  });
});
