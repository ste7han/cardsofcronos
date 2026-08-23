// The three things the engine learned so that project cards could attack:
// a standing rule on the table, budget handed to somebody who did not want it,
// and a pump that goes down.
//
// Every one of these is tested against the outcome rather than against a log
// line. A card that writes "blocked" and then lets the move through is the exact
// failure this project is built to avoid, and the only way to catch it is to try
// the move and see whether the state moved.

import { describe, expect, it } from "vitest";

import { CARDS } from "@/data/cards";
import { applyMove, buildIndex, canTakeProfit, newMatch, pumpOf, whyNot } from "@/engine/match";
import { applyEffect } from "@/engine/effects";
import { describeRestriction, rulesText } from "@/engine/rules-text";
import { IllegalMove } from "@/engine/types";
import type { Card, ProjectCard, State } from "@/engine/types";

// A mutable index, unlike the ReadonlyMap buildIndex hands back: these tests
// register cards that do not exist in the set, because the point is to prove the
// mechanic works before any real card is written against it.
const index: Map<string, Card> = new Map(buildIndex(CARDS));

/** A project card, cloned with something bolted on, registered under a new id. */
function variant(of: string, patch: Partial<ProjectCard>, id: string): ProjectCard {
  const base = CARDS.find((c) => c.id === of);
  if (!base || base.type !== "project") throw new Error(`No project card "${of}".`);
  const made: ProjectCard = { ...base, ...patch, id };
  index.set(id, made as Card);
  return made;
}

/** A match with both hands and boards under our control. */
function rigged(): State {
  const state = newMatch(CARDS, 12345);
  state.players.you.hand = [];
  state.players.opponent.hand = [];
  state.players.you.projects = [];
  state.players.opponent.projects = [];
  state.budgetThisTurn = 10_000_000;
  state.budgetSpentThisTurn = 0;
  return state;
}

/** Put a card on a player's board without going through a move. */
function place(state: State, player: "you" | "opponent", card: ProjectCard): void {
  state.players[player].projects.push({
    cardId: card.id,
    holders: card.holders,
    extraPump: 0,
    earned: card.launchMC,
    playedOnTurn: 1,
  });
}

describe("a standing rule on the table", () => {
  it("stops the opponent taking profit, and says which card is doing it", () => {
    const lock = variant("bonk-dog", { restriction: { kind: "banTakeProfit" } }, "test-lock");
    const state = rigged();

    // Something of yours to bank, so the only thing in the way is the rule.
    place(state, "you", CARDS.find((c) => c.id === "bonk-airdrop") as ProjectCard);
    expect(canTakeProfit(state, "you", index)).toBe(true);

    place(state, "opponent", lock);
    expect(canTakeProfit(state, "you", index)).toBe(false);

    // And the move itself is refused, not merely dimmed. The UI dims; the
    // reducer decides, and a caller that skips the UI has to hit the same wall.
    expect(() => applyMove(state, { kind: "takeProfit", slot: 0 }, index)).toThrow(IllegalMove);
    expect(() => applyMove(state, { kind: "takeProfit", slot: 0 }, index)).toThrow(/BONK/);
  });

  it("stops a whole card type, and names the card in the way", () => {
    const lock = variant("bonk-dog", { restriction: { kind: "banType", cardType: "tactic" } }, "test-ban");
    const state = rigged();
    const tactic = CARDS.find((c) => c.type === "tactic" && !c.effect.kind.includes("rug"))!;

    expect(whyNot(state, tactic, "you", index)).toBeNull();

    place(state, "opponent", lock);
    const blocked = whyNot(state, tactic, "you", index);
    expect(blocked).toContain("BONK");
    expect(blocked).toContain("tactic");

    // A card of another type is untouched: the rule bans one thing, not playing.
    const project = CARDS.find((c) => c.id === "wif-dog")!;
    expect(whyNot(state, project, "you", index)).toBeNull();
  });

  it("lifts the moment the position takes damage, and comes back when healed", () => {
    const lock = variant("bonk-dog", { restriction: { kind: "banTakeProfit" } }, "test-damage");
    const state = rigged();
    place(state, "you", CARDS.find((c) => c.id === "bonk-airdrop") as ProjectCard);
    place(state, "opponent", lock);

    expect(canTakeProfit(state, "you", index)).toBe(false);

    // One holder off. The project is still standing and still pumping; the rule
    // is what breaks. That is the whole point — every attack in the set is a key
    // even when it cannot finish the job.
    state.players.opponent.projects[0]!.holders -= 1;
    expect(canTakeProfit(state, "you", index)).toBe(true);
    expect(() => applyMove(state, { kind: "takeProfit", slot: 0 }, index)).not.toThrow();

    // Healed back to the printed count and it holds again. healHolders never
    // goes above that number, so "undamaged" is the same test in both directions.
    state.players.opponent.projects[0]!.holders = lock.holders;
    expect(canTakeProfit(state, "you", index)).toBe(false);
  });

  it("binds the opponent and never its owner", () => {
    const lock = variant("bonk-dog", { restriction: { kind: "banTakeProfit" } }, "test-own");
    const state = rigged();
    place(state, "you", lock);
    // The card is on your board and you can still bank. A drawback nobody can
    // read off the card is worse than no card at all.
    expect(canTakeProfit(state, "you", index)).toBe(true);
  });

  it("puts the rule on the card face", () => {
    const lock = variant("bonk-dog", { restriction: { kind: "banTakeProfit" } }, "test-face");
    const printed = rulesText(lock).map((line) => line.text);
    expect(printed.join(" ")).toContain("cannot take profit");
    // The way out has to be on the face. A card that says only "while this
    // holds" reads as permanent, and a player who believes that stops looking.
    expect(printed.join(" ")).toContain("undamaged");
    expect(describeRestriction({ kind: "banType", cardType: "event" })).toContain("events");
  });
});

describe("budget handed to the other side", () => {
  it("waits for their turn, arrives once, and is gone after", () => {
    const state = rigged();
    const source = CARDS.find((c) => c.id === "bonk-dog")!;

    applyEffect(state, { kind: "extraBudget", target: "opponent", mc: 500_000 }, "you", source, undefined, index);

    // Not on your budget, and not on theirs yet either — theirs has not started.
    expect(state.players.opponent.pendingBudget).toBe(500_000);

    let next = state;
    next.players.you.hand = [];
    next = applyMove(next, { kind: "endTurn" }, index);

    expect(next.toMove).toBe("opponent");
    expect(next.players.opponent.pendingBudget).toBe(0);
    // Their turn is worth its normal budget plus the gift they did not ask for.
    expect(next.budgetThisTurn).toBeGreaterThanOrEqual(500_000);
  });

  it("still lands on your own turn when it is aimed at you", () => {
    const state = rigged();
    const source = CARDS.find((c) => c.id === "bonk-dog")!;
    const before = state.budgetThisTurn;

    applyEffect(state, { kind: "extraBudget", target: "self", mc: 250_000 }, "you", source, undefined, index);

    expect(state.budgetThisTurn).toBe(before + 250_000);
    expect(state.players.you.pendingBudget).toBe(0);
  });
});

describe("a pump that goes down", () => {
  it("lowers what a position pays, and never past zero", () => {
    const state = rigged();
    const card = CARDS.find((c) => c.id === "bonk-chain") as ProjectCard;
    place(state, "opponent", card);

    const full = pumpOf(state, "opponent", 0, index);
    expect(full).toBe(card.pumpMC);

    applyEffect(
      state,
      { kind: "pumpProject", target: "allEnemyProjects", mc: -10_000 },
      "you",
      card,
      undefined,
      index,
    );
    expect(pumpOf(state, "opponent", 0, index)).toBe(full - 10_000);

    // Far past what it was worth. A position can be made worthless; it cannot be
    // made into a leak, which is a rug by instalments and is on no card's text.
    applyEffect(
      state,
      { kind: "pumpProject", target: "allEnemyProjects", mc: -10_000_000 },
      "you",
      card,
      undefined,
      index,
    );
    expect(pumpOf(state, "opponent", 0, index)).toBe(0);
  });
});

describe("the log", () => {
  it("says out loud when a standing rule lands", () => {
    const lock = variant("bonk-dog", { restriction: { kind: "banTakeProfit" } }, "test-log");
    const state = rigged();
    state.players.you.hand = [lock.id];
    state.budgetThisTurn = 10_000_000;

    const after = applyMove(state, { kind: "playCard", handIndex: 0 }, index);
    const said = after.log.map((entry) => entry.text).join(" ");

    // Not "did it log something" — did it say the thing the opponent needs to
    // know. The log had the launch line and nothing about the rule, which from
    // the other side of the table looks like the game refusing moves for no
    // reason.
    expect(said).toContain("cannot take profit");
  });
});

describe("a damaged position", () => {
  it("pays in proportion to the holders it has left, and healing gives it back", () => {
    const card = CARDS.find((c) => c.id === "bonk-chain") as ProjectCard;
    const state = rigged();
    place(state, "opponent", card);

    const full = pumpOf(state, "opponent", 0, index);
    expect(full).toBe(card.pumpMC);

    // One holder off a five-holder position: four fifths of the pump. The
    // project is still standing, still on the board, and already worth less —
    // which is the whole point. Before this, damage that did not kill was
    // damage that did nothing.
    state.players.opponent.projects[0]!.holders = card.holders - 1;
    expect(pumpOf(state, "opponent", 0, index)).toBe(Math.round((full * (card.holders - 1)) / card.holders));

    state.players.opponent.projects[0]!.holders = 1;
    expect(pumpOf(state, "opponent", 0, index)).toBe(Math.round(full / card.holders));

    // Healed back to the printed count and it pays in full again. The same rule
    // read backwards, not a second one.
    state.players.opponent.projects[0]!.holders = card.holders;
    expect(pumpOf(state, "opponent", 0, index)).toBe(full);
  });
});
