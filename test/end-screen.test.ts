// What the last screen of a match says about the money.
//
// This is the sentence a player reads immediately after winning or losing CRO,
// and it was one hardcoded line saying "A friendly match. Nothing was staked"
// for every match — true when it was written, and left behind while the escrow,
// the ranked lobby and lib/finish.ts were built around it. The maker lost a
// ranked match and was told nothing had been at stake.
//
// It is the hardest kind of wrong to catch: everything on the screen is prose,
// so nothing typechecks and no test about behaviour goes near it. So these are
// about the prose, and about the one ending nobody would guess.

import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const screen = readFileSync(
  new URL("../components/pvp/EndScreen.tsx", import.meta.url),
  "utf8",
);
const board = readFileSync(
  new URL("../components/pvp/MatchBoard.tsx", import.meta.url),
  "utf8",
);

/** Just the settlement function, which is where every one of these sentences is. */
function settlementOf(source: string): string {
  const from = source.indexOf("function settlement(");
  expect(from).toBeGreaterThan(-1);
  return source.slice(from, source.indexOf("\n}", from));
}

describe("the end of a match", () => {
  it("reads the stake off the match instead of assuming one", () => {
    // The whole of the bug: a sentence that could not be wrong because it was
    // never asked.
    expect(screen).toContain("stake: number");
    expect(board).toContain("stake={answer.stake}");
  });

  it("does not call a staked match friendly", () => {
    // The bug was never the wording — it was that the wording was
    // unconditional. So this checks where the sentence lives, not whether it
    // exists: it has to sit behind the stake test and nowhere else.
    // Scoped to the function, because the header comment quotes the old
    // sentence to explain it — and a test that reads its own file's prose is a
    // test that passes or fails on documentation.
    const body = settlementOf(screen);
    const friendly = body.indexOf("A friendly match.");
    expect(friendly).toBeGreaterThan(-1);
    expect(body.indexOf("if (stake <= 0)")).toBeLessThan(friendly);
    // Said once, so there is no second copy outside the branch.
    expect(body.split("A friendly match.").length - 1).toBe(1);
  });

  it("answers all four endings", () => {
    // Friendly, won, lost and drawn. A missing branch here renders as the
    // wrong sentence rather than as an error.
    expect(screen).toContain("if (stake <= 0)");
    expect(screen).toContain("if (drawn)");
    expect(screen).toContain("if (won)");
    expect(screen).toContain("went to");
  });

  it("warns that a drawn staked match pays nobody", () => {
    // contracts/MatchEscrow.sol has no draw: `settle` takes a winner and
    // refuses anything else, so both deposits sit until walkAway after thirty
    // days. Somebody not told this is watching for a payout never coming.
    expect(screen).toMatch(/no draw/i);
    expect(screen).toMatch(/thirty days/i);
  });

  it("tells a winner there is nothing to claim", () => {
    // lib/finish.ts pushes the pot with the publisher key. A winner who thinks
    // they have to claim goes looking for a button that is not there.
    expect(screen).toMatch(/nothing to claim/i);
  });

  it("says the rank moved on a staked match, and not on a friendly one", () => {
    // This said nothing about a rank for exactly one commit, because nothing
    // wrote players.rank. lib/elo.ts exists now, so the sentence is back — and
    // the friendly branch has to keep denying it, which is the half that makes
    // the staked claim mean anything.
    expect(screen).toMatch(/your rank moved/i);
    expect(screen).toMatch(/does not touch\s*" \+\s*"your rank|does not touch your rank/i);
  });

  it("quotes no rank number, because none is stored per match", () => {
    // The delta is worked out in lib/finish.ts and kept nowhere. A figure here
    // would be either a second calculation that can disagree with the first or
    // one invented for the screen.
    expect(screen).not.toMatch(/\brank\b[^\n]*\$\{/);
  });
});

describe("the ladder the end screen now points at", () => {
  it("is actually written somewhere", () => {
    // The mirror of the test above, and the reason the sentence came back. If
    // Elo is ever taken out again, this fails and the screen has to stop
    // claiming it.
    const store = readFileSync(new URL("../lib/store.ts", import.meta.url), "utf8");
    const code = store
      .split("\n")
      .filter((line) => !line.trimStart().startsWith("*") && !line.trimStart().startsWith("//"))
      .join("\n");
    expect(code).toMatch(/SET\s+rank\s*=/i);
  });
});
