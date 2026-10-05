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

describe("the end of a match", () => {
  it("reads the stake off the match instead of assuming one", () => {
    // The whole of the bug: a sentence that could not be wrong because it was
    // never asked.
    expect(screen).toContain("stake: number");
    expect(board).toContain("stake={answer.stake}");
  });

  it("does not call a staked match friendly", () => {
    // The literal sentence that was shown to somebody who had just lost CRO.
    expect(screen).not.toContain("A friendly match. Nothing was staked and nothing moved —");
    // Friendly still has to be said when it is true.
    expect(screen).toContain("A friendly match. Nothing was staked and nothing moved.");
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

  it("claims nothing about a rank, because nothing moves one", () => {
    // players.rank is DEFAULT 1000 and no statement in the repo writes it —
    // Elo is designed in DESIGN.md and not built. The old sentence implied a
    // staked match touches a rank.
    expect(screen).not.toMatch(/touch(es)? a rank/i);
  });
});

describe("the rank the end screen is right not to mention", () => {
  it("is still never written anywhere", () => {
    // The guard on the line above. If Elo is implemented later this fails, and
    // the end screen is then exactly the place that should say so.
    const store = readFileSync(new URL("../lib/store.ts", import.meta.url), "utf8");
    const code = store
      .split("\n")
      .filter((line) => !line.trimStart().startsWith("*") && !line.trimStart().startsWith("//"))
      .join("\n");
    expect(code).not.toMatch(/SET\s+rank\s*=/i);
  });
});
