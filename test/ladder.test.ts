// Which matches are on the ladder, and which are not.
//
// DESIGN.md: a rank "moves only on staked matches", which is what keeps it
// something you had to pay to lose. That rule lives in one line of lib/finish.ts
// and nothing about it typechecks — a friendly match leaking onto the ladder
// would look exactly like a working ladder, and the only sign would be ranks
// drifting for people who never staked anything.
//
// Read off the source rather than by settling a match: settle() reaches the
// chain, the Discord channels and the escrow, and standing all of that up to
// assert one branch would test the scaffolding instead of the rule.

import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const finish = readFileSync(new URL("../lib/finish.ts", import.meta.url), "utf8");
const elo = readFileSync(new URL("../lib/elo.ts", import.meta.url), "utf8");

describe("the ladder", () => {
  it("refuses a friendly match", () => {
    expect(finish).toContain("if (record.stake <= 0) return;");
  });

  it("moves both sides on a win and on a draw", () => {
    // A drawn staked match pays nobody — the escrow has no draw — and both
    // ranks still move. Forgetting the draw branch would silently make a draw
    // the one staked result with no consequence.
    expect(finish).toContain('await moveRanks(db, record, you, opponent, "draw", now);');
    expect(finish).toContain('await moveRanks(db, record, winner, loser, "win", now);');
  });

  it("works both deltas out before it writes either", () => {
    // Reading the second rank after writing the first would price the second
    // half of the match against a rank the first half had already changed: the
    // same match counted twice against itself.
    const body = finish.slice(finish.indexOf("async function moveRanks"));
    const reads = body.indexOf("Promise.all([playerOf");
    const firstWrite = body.indexOf("recordStaked(db, first");
    expect(reads).toBeGreaterThan(-1);
    expect(reads).toBeLessThan(firstWrite);
  });

  it("gives the second player the opposite result", () => {
    // One outcome is passed in and the other is derived. Passing "win" twice
    // would hand both players the win, and both ranks would climb for ever.
    expect(finish).toContain('outcome: outcome === "draw" ? "draw" : "loss",');
  });

  it("cannot turn a played match into an unrecorded one", () => {
    // Called after addResult and never instead of it, like the pot. The result
    // is what the game is; the rank is a consequence.
    const body = finish.slice(finish.indexOf("async function moveRanks"));
    expect(body).toContain("catch");
    expect(body).toContain("its ranks did not move");
  });
});

describe("the ten that two things count to", () => {
  it("is one constant, not two", () => {
    // It was written out in components/Profile.tsx as well as being the figure
    // the players table counts to. Two copies of a threshold is how one of them
    // ends up being changed.
    const profile = readFileSync(new URL("../components/Profile.tsx", import.meta.url), "utf8");
    expect(profile).toContain('from "@/lib/elo"');
    expect(profile).not.toContain("const TIERS_OPEN_AFTER");
    expect(elo).toContain("export const SETTLED_AFTER");
  });
});
