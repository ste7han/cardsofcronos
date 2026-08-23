// A card that does more when the table agrees.
//
// CLAUDE.md: "Build the deck the card text describes. A card that asks for
// exactly 3 Lunar Projects gets tested with exactly 3. Without that check you
// can't tell whether a card is broken or merely demanding."
//
// So every condition here is tested twice: once with exactly enough for it to
// hold, and once one short. A test that only ever checks the happy side cannot
// tell "fires when it should" from "fires always", and a test that only checks
// the unhappy side cannot tell "does not fire" from "does nothing at all".

import { describe, expect, it } from "vitest";

import { CARDS } from "@/data/cards";
import { SOLO_A } from "./one-per-project";
import { applyMove, buildIndex, newMatch } from "@/engine/match";
import { chooseMove } from "@/engine/bot";
import { holds } from "@/engine/effects";
import { describeCondition, rulesText } from "@/engine/rules-text";
import { validateCondition } from "@/engine/validation";
import { RULES, SECTORS } from "@/engine/types";
import type { Card, Condition, ProjectCard, State } from "@/engine/types";

const index: Map<string, Card> = new Map(buildIndex(CARDS));
const sectorsInSet = new Set(SECTORS);

function rigged(): State {
  const state = newMatch(CARDS, 4242);
  state.players.you.hand = [];
  state.players.opponent.hand = [];
  state.players.you.projects = [];
  state.players.opponent.projects = [];
  state.players.you.mc = 0;
  state.players.opponent.mc = 0;
  state.budgetThisTurn = 10_000_000;
  state.budgetSpentThisTurn = 0;
  return state;
}

function place(state: State, player: "you" | "opponent", card: ProjectCard): void {
  state.players[player].projects.push({
    cardId: card.id,
    holders: card.holders,
    extraPump: 0,
    earned: card.launchMC,
    playedOnTurn: 1,
  });
}

/** A project of a given sector, whatever the set happens to call it. */
function projectOfSector(sector: string): ProjectCard {
  const found = CARDS.find((c) => c.type === "project" && c.sector === sector);
  if (!found || found.type !== "project") throw new Error(`No project in sector ${sector}.`);
  return found;
}

describe("when the table agrees", () => {
  it("behindBy reads the gap and not either side's own number", () => {
    const state = rigged();
    const condition: Condition = { kind: "behindBy", mc: 500_000 };

    state.players.you.mc = 100_000;
    state.players.opponent.mc = 599_999;
    expect(holds(condition, state, "you", index)).toBe(false); // one short, on purpose

    state.players.opponent.mc = 600_000;
    expect(holds(condition, state, "you", index)).toBe(true);

    // Both players rich, same gap: still true. It is the gap, not the size.
    state.players.you.mc = 9_100_000;
    state.players.opponent.mc = 9_600_000;
    expect(holds(condition, state, "you", index)).toBe(true);

    // And it never reads from the wrong side of the table.
    expect(holds(condition, state, "opponent", index)).toBe(false);
  });

  it("counts projects of a sector, and one short is one short", () => {
    const state = rigged();
    const meme = projectOfSector("meme");
    const condition: Condition = { kind: "ownProjectsInSector", sector: "meme", atLeast: 3 };

    // Two of the sector plus one of another: the other must not count.
    place(state, "you", meme);
    place(state, "you", CARDS.find((c) => c.type === "project" && c.sector === "meme" && c.id !== meme.id) as ProjectCard);
    place(state, "you", projectOfSector("defi"));
    expect(holds(condition, state, "you", index)).toBe(false);

    place(state, "you", CARDS.filter((c) => c.type === "project" && c.sector === "meme")[2] as ProjectCard);
    expect(holds(condition, state, "you", index)).toBe(true);
  });

  it("fires the payoff on top of the base effect, not instead of it", () => {
    const base = CARDS.find((c) => c.id === SOLO_A) as ProjectCard;
    const card: ProjectCard = {
      ...base,
      id: "test-payoff",
      effect: { kind: "directMC", target: "self", mc: 10_000 },
      payoff: { when: { kind: "behindBy", mc: 500_000 }, effect: { kind: "directMC", target: "self", mc: 500_000 } },
    };
    index.set(card.id, card);

    // Not behind: base only. Launch plus the base effect and nothing else.
    const level = rigged();
    level.players.you.hand = [card.id];
    const afterLevel = applyMove(level, { kind: "playCard", handIndex: 0 }, index);
    expect(afterLevel.players.you.mc).toBe(card.launchMC + 10_000);

    // Behind: both. The base is still there, which is the difference between a
    // payoff and a replacement and is the whole reason the card is never blank.
    const behind = rigged();
    behind.players.opponent.mc = 600_000;
    behind.players.you.hand = [card.id];
    const afterBehind = applyMove(behind, { kind: "playCard", handIndex: 0 }, index);
    expect(afterBehind.players.you.mc).toBe(card.launchMC + 10_000 + 500_000);
  });

  it("puts the condition on the card face", () => {
    const base = CARDS.find((c) => c.id === SOLO_A) as ProjectCard;
    const card: ProjectCard = {
      ...base,
      id: "test-face-condition",
      payoff: { when: { kind: "behindBy", mc: 500_000 }, effect: { kind: "directMC", target: "self", mc: 500_000 } },
    };
    const printed = rulesText(card)
      .map((line) => line.text)
      .join(" ");
    expect(printed).toContain("behind");
    expect(printed).toContain("$500K");
  });

  it("refuses a condition that can never be met", () => {
    const tooMany = validateCondition(
      { kind: "ownProjectCount", atLeast: RULES.portfolioSize + 1 },
      "test",
      sectorsInSet,
    );
    expect(tooMany.join(" ")).toContain("never be met");

    const tooLate = validateCondition({ kind: "turnAtLeast", turn: RULES.turns + 1 }, "test", sectorsInSet);
    expect(tooLate.length).toBe(1);

    // And the reachable ones pass, or the check above proves nothing.
    expect(validateCondition({ kind: "ownProjectCount", atLeast: RULES.portfolioSize }, "t", sectorsInSet)).toEqual([]);
    expect(validateCondition({ kind: "turnAtLeast", turn: RULES.turns }, "t", sectorsInSet)).toEqual([]);
  });

  it("makes the bot prefer the card whose payoff is live", () => {
    const base = CARDS.find((c) => c.id === SOLO_A) as ProjectCard;
    const plain: ProjectCard = { ...base, id: "test-plain", project: "test-plain" };
    const withPayoff: ProjectCard = {
      ...base,
      id: "test-live",
      project: "test-live",
      payoff: {
        when: { kind: "behindBy", mc: 500_000 },
        effect: { kind: "directMC", target: "self", mc: 900_000 },
      },
    };
    index.set(plain.id, plain);
    index.set(withPayoff.id, withPayoff);

    // Identical cards but for the payoff, and the payoff is live: the bot has to
    // reach for it. Before it could see one, it valued both the same and picked
    // on a tie-break, which is the whole reason fourteen cards were underpriced
    // in every measurement taken since they were written.
    const behind = rigged();
    behind.players.opponent.mc = 900_000;
    behind.players.you.hand = [plain.id, withPayoff.id];
    const move = chooseMove(behind, index);
    expect(move.kind).toBe("playCard");
    if (move.kind !== "playCard") throw new Error("unreachable");
    expect(behind.players.you.hand[move.handIndex]).toBe(withPayoff.id);

    // Level scores: the payoff is dead, so there is nothing to prefer and the
    // bot must not be reaching for it out of habit.
    const level = rigged();
    level.players.you.hand = [plain.id, withPayoff.id];
    const other = chooseMove(level, index);
    if (other.kind !== "playCard") throw new Error("expected a card to be played");
    expect(level.players.you.hand[other.handIndex]).toBe(plain.id);
  });

  it("describes every condition it can carry", () => {
    // A kind added without a sentence would print "[object Object]" on a card,
    // which is the sort of thing that ships.
    const all: Condition[] = [
      { kind: "behindBy", mc: 500_000 },
      { kind: "ownProjectsInSector", sector: "meme", atLeast: 3 },
      { kind: "ownProjectCount", atLeast: 4 },
      { kind: "turnAtLeast", turn: 7 },
    ];
    for (const condition of all) {
      const said = describeCondition(condition);
      expect(said.length).toBeGreaterThan(8);
      expect(said).not.toContain("object");
    }
  });
});
