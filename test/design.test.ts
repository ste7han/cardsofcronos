// DESIGN.md against the code it describes.
//
// The document this replaced opened by saying a turn is three actions with no
// per-card cost. The engine had used a marketing budget for a long time by then.
// Nothing failed, because nothing checked: a design document is prose, prose
// does not compile, and the only cost of it being wrong is that somebody designs
// against a game that no longer exists.
//
// So the numbers in it are checked here. Not the prose — the figures that would
// actually move: what a card costs, how long a match is, how many cards there
// are. If one of them changes and the document does not, this fails and says
// which.
//
// It cannot prove the document is true. It can only prove it has not gone stale
// in the ways that have happened before, which is the whole of what went wrong.

import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { CARDS } from "@/data/cards";
import { MARKETING_COST, RULES, SECTORS, TURN_ACTION_COST } from "@/engine/types";
import { PACK_SIZE } from "@/engine/pack";
import { DECK_MINT_SIZE } from "@/engine/mint";
import { PULL_WEIGHTS } from "@/engine/draw";

const DESIGN = readFileSync("DESIGN.md", "utf8");

/** "40000" is written "$40K" in the document, and 400000 as "$400K". */
function short(mc: number): string {
  return `$${mc / 1000}K`;
}

describe("the design document still describes this game", () => {
  it("counts the cards that are actually in the set", () => {
    expect(DESIGN).toContain(`**${CARDS.length} cards**`);
  });

  it("says how long a match is and what a turn gives you", () => {
    expect(DESIGN).toContain(`**${RULES.turns} turns**`);
    expect(DESIGN).toContain(`**N × ${short(RULES.budgetPerTurn)}**`);
    // The two ends of the ramp, both spelled out because the ramp is the point.
    expect(DESIGN).toContain(short(RULES.budgetPerTurn));
    expect(DESIGN).toContain(short(RULES.budgetPerTurn * RULES.turns));
  });

  it("prices every rarity the way the engine does", () => {
    for (const [rarity, cost] of Object.entries(MARKETING_COST)) {
      expect(DESIGN, `${rarity} costs ${short(cost)}`).toContain(short(cost));
    }
    expect(DESIGN).toContain(`**${short(TURN_ACTION_COST)}**`);
  });

  it("names the shape of a hand, a portfolio and a deck", () => {
    expect(DESIGN).toContain(`**${RULES.handSize} cards in hand**`);
    expect(DESIGN).toContain(`**${RULES.deckSize} cards`);
    expect(DESIGN).toContain(`at least ${RULES.minProjects} projects`);
  });

  it("describes the first-move compensation the engine actually pays", () => {
    // The rule with the most history behind it: a seed round, then a budget, then
    // a card played for nothing, and the document was left behind by the last
    // change. So the check is on the shape and not on one number — a document
    // describing a seed round while the engine hands over a card is exactly the
    // drift this file exists to catch, and no assertion about $400K would have
    // noticed it.
    if (RULES.firstMoveFreeCard) {
      expect(DESIGN).toContain("**one card for nothing**");
      expect(DESIGN, "no seed round while the free card is the rule").not.toContain(
        "seed round of **",
      );
    } else {
      expect(DESIGN).toContain(`**${short(RULES.firstMoveSeedMC)}**`);
    }
  });

  it("describes the packs the code opens", () => {
    expect(DESIGN).toContain(`**A pack is ${PACK_SIZE} cards**`);
    expect(DESIGN).toContain(`**${DECK_MINT_SIZE}**`);
    const weights = Object.entries(PULL_WEIGHTS)
      .map(([rarity, weight]) => `${rarity} ${weight}`)
      .join(" · ");
    expect(DESIGN, "the pull table").toContain(weights);
  });

  it("lists exactly the sectors the engine has", () => {
    // Sectors have been renamed once already, from tags that named a single
    // faction each. A document naming a sector the engine dropped is how the
    // last one went wrong.
    //
    // The fenced block under "### Sectors" is what is checked, and it is checked
    // both ways: every sector described, and nothing described that is not one.
    // A looser version of this counted the word "machine" anywhere in the file
    // and failed on "a wallet-generating machine", which is the sort of test
    // that gets weakened rather than fixed.
    const section = DESIGN.slice(DESIGN.indexOf("### Sectors"));
    const block = section.slice(section.indexOf("```") + 3, section.indexOf("```", section.indexOf("```") + 3));
    const named = block
      .split("\n")
      .map((line) => line.trim().split(/\s+/)[0])
      .filter((word): word is string => Boolean(word));

    expect([...named].sort()).toEqual([...SECTORS].sort());
  });
});
