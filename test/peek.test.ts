// "Look at the top N of their deck and take one out."
//
// ── WHAT WAS WRONG ───────────────────────────────────────────────────────────
//
// The engine has taken a `burnIndex` since peekAndBurn was written, and the
// Move type has a field for it. Nothing in either table ever sent one, so every
// human play fell through to `targetIndex ?? 0` and took the top card — unseen
// and unchosen.
//
// engine/bot.ts does not fall through. It calls worstToLeaveThem and takes the
// card that hurts most, with a note saying the top-card version is "the
// mechanic with its whole point removed… worth 0.4 points". So four cards did
// less in a player's hand than the same cards in the bot's, and the printed
// text described the version only the bot got.
//
// No test could see it. test/set.test.ts plays every card and compares the
// position, and the position did not include their deck — so the only trace
// this effect leaves was outside the measurement. That snapshot carries it now.

import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { CARDS } from "@/data/cards";
import { buildIndex, newMatch, peekLookOf, peekedCards } from "@/engine/match";
import { cardById } from "@/engine/helpers";
import type { State } from "@/engine/types";

const index = buildIndex(CARDS);
const table = readFileSync(new URL("../components/game/Game.tsx", import.meta.url), "utf8");

const board = (turn: number): State => {
  const state = structuredClone(newMatch(CARDS, 777)) as State;
  state.turn = turn;
  return state;
};

/** Every card in the set that reveals cards, however it does it. */
const peekers = CARDS.filter(
  (c) => c.effect?.kind === "peekAndBurn" || c.payoff?.effect.kind === "peekAndBurn",
);

describe("which plays owe you a look", () => {
  it("finds the cards that peek at all", () => {
    // Four of them. If a fifth is added this says so, and the table already
    // handles it — the question is asked off the effect, not off a list.
    expect(peekers.length).toBeGreaterThanOrEqual(4);
  });

  it("asks straight away when the card itself peeks", () => {
    const card = peekers.find((c) => c.effect?.kind === "peekAndBurn")!;
    expect(peekLookOf(board(1), card, "you", index)).toBeGreaterThan(0);
  });

  it("waits for a payoff that has not come due", () => {
    // Wallet Tracker peeks from turn five. Showing three cards on turn one and
    // then burning none would be a question with no answer behind it.
    const tracker = cardById(index, "wallet-tracker");
    expect(peekLookOf(board(1), tracker, "you", index)).toBeNull();
    expect(peekLookOf(board(4), tracker, "you", index)).toBeNull();
    expect(peekLookOf(board(5), tracker, "you", index)).toBe(3);
  });

  it("asks nothing of an empty deck", () => {
    const state = board(9);
    state.players.opponent.deck = [];
    expect(peekLookOf(state, cardById(index, "wallet-tracker"), "you", index)).toBeNull();
  });

  it("never offers more than there is", () => {
    const state = board(9);
    state.players.opponent.deck = state.players.opponent.deck.slice(0, 2);
    expect(peekLookOf(state, cardById(index, "wallet-tracker"), "you", index)).toBe(2);
  });
});

describe("the order they are shown in", () => {
  it("puts the card they draw next first", () => {
    // The top of a deck is the END of the array — that is where draw() takes
    // from. Reading it the other way round would let somebody pick the card
    // they wanted gone and burn a different one.
    const state = board(9);
    const deck = state.players.opponent.deck;
    const shown = peekedCards(state, "you", 3);
    expect(shown[0]).toBe(deck[deck.length - 1]);
    expect(shown[1]).toBe(deck[deck.length - 2]);
    expect(shown[2]).toBe(deck[deck.length - 3]);
  });

  it("stops at the bottom of a short deck", () => {
    const state = board(9);
    state.players.opponent.deck = ["a", "b"];
    expect(peekedCards(state, "you", 3)).toEqual(["b", "a"]);
  });
});

describe("the table asks before it plays", () => {
  it("has one door out of the hand", () => {
    // The peek was missed because the play was dispatched from two places and
    // neither asked. Both go through playOrPeek now.
    expect(table).toContain("function playOrPeek(");
    expect(table).toContain("playOrPeek(handIndex)");
    expect(table).toContain("playOrPeek(aiming.handIndex, slot)");
  });

  it("sends the chosen index and not the default", () => {
    // `targetIndex ?? 0` in the engine is what took the top card every time.
    expect(table).toContain("burnIndex: at");
  });

  it("shows which one they draw next", () => {
    // An order nobody can see is a choice nobody can make.
    expect(table).toContain('{at === 0 ? "NEXT" : `${at + 1} DOWN`}');
  });
});
