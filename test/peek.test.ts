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
import { applyMove, budgetForTurn, buildIndex, newMatch, peekLookOf, peekedCards } from "@/engine/match";
import { viewFor, watchView } from "@/engine/view";
import { cardById } from "@/engine/helpers";
import { RULES, type State } from "@/engine/types";

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

// ── THE PAUSE IS A MOVE ──────────────────────────────────────────────────────
//
// The solo table could lay the cards out itself; the PvP one cannot, because
// viewFor redacts their deck on purpose. The obvious fix — server reveals three
// and remembers it did — is state beside the move list, and the note on
// State.pending says why this codebase will not have that: a match is its seed
// and its moves, replayed on demand.
//
// So the question is a move. These are about it behaving the same way twice.
describe("playing a card that peeks", () => {
  const playTracker = (turn: number) => {
    const state = board(turn);
    state.players.you.hand = ["wallet-tracker", ...state.players.you.hand];
    state.budgetThisTurn = budgetForTurn(RULES.turns);
    state.budgetSpentThisTurn = 0;
    state.toMove = "you";
    return applyMove(state, { kind: "playCard", handIndex: 0 }, index);
  };

  it("asks instead of taking the top card", () => {
    const after = playTracker(5);
    expect(after.awaiting).toEqual({
      kind: "burn",
      player: "you",
      cardId: "wallet-tracker",
      look: 3,
    });
    // And nothing has left their deck yet.
    expect(after.players.opponent.deck.length).toBe(35);
    expect(after.players.opponent.discard.length).toBe(0);
  });

  it("does not ask when the payoff has not come due", () => {
    expect(playTracker(1).awaiting).toBeNull();
  });

  it("takes the one named, not the one on top", () => {
    // The whole bug: `targetIndex ?? 0` took the top card every time.
    const asked = playTracker(5);
    const deck = asked.players.opponent.deck;
    const second = deck[deck.length - 2];
    const done = applyMove(asked, { kind: "burn", index: 1 }, index);
    expect(done.awaiting).toBeNull();
    expect(done.players.opponent.discard).toContain(second);
    expect(done.players.opponent.deck).not.toContain(second);
  });

  it("refuses everything else while it is waiting", () => {
    // A card half-played while the board moves underneath it, and an answer
    // arriving against a deck that had changed.
    const asked = playTracker(5);
    expect(() => applyMove(asked, { kind: "playCard", handIndex: 0 }, index)).toThrow(
      /waiting/i,
    );
    expect(() => applyMove(asked, { kind: "discard", handIndex: 0 }, index)).toThrow(
      /waiting/i,
    );
  });

  it("refuses a card that was never on offer", () => {
    const asked = playTracker(5);
    expect(() => applyMove(asked, { kind: "burn", index: 3 }, index)).toThrow();
    expect(() => applyMove(asked, { kind: "burn", index: -1 }, index)).toThrow();
  });

  it("answers itself when the turn ends", () => {
    // The rule the maker chose: walk away, or let the clock run out in a
    // correspondence match, and the top card goes. No punishment and no card
    // wasted — the outcome everybody already knew.
    const asked = playTracker(5);
    const deck = asked.players.opponent.deck;
    const top = deck[deck.length - 1];
    const ended = applyMove(asked, { kind: "endTurn" }, index);
    expect(ended.awaiting).toBeNull();
    expect(ended.players.opponent.discard).toContain(top);
  });

  it("comes out the same way twice", () => {
    // The reason the pause is a move at all. Two moves replayed are one state.
    const once = applyMove(playTracker(5), { kind: "burn", index: 2 }, index);
    const twice = applyMove(playTracker(5), { kind: "burn", index: 2 }, index);
    expect(JSON.stringify(twice)).toBe(JSON.stringify(once));
  });
});

describe("who gets to see them", () => {
  const asked = () => {
    const state = board(5);
    state.players.you.hand = ["wallet-tracker", ...state.players.you.hand];
    state.budgetThisTurn = budgetForTurn(RULES.turns);
    state.budgetSpentThisTurn = 0;
    state.toMove = "you";
    return applyMove(state, { kind: "playCard", handIndex: 0 }, index);
  };

  it("shows them to the player who paid for the look", () => {
    expect(viewFor(asked(), "you", index).peek).toHaveLength(3);
  });

  it("shows the other seat nothing, though the state has the answer", () => {
    // They poll the same route against the same match. Redacting by whose
    // question it is, not by whose turn it happens to be.
    expect(viewFor(asked(), "opponent", index).peek).toEqual([]);
  });

  it("shows nothing at all when nothing is waiting", () => {
    expect(viewFor(board(5), "you", index).peek).toEqual([]);
  });

  it("gives a spectator no field it could arrive in", () => {
    // Redaction by shape, the rule engine/view.ts already holds for hands.
    expect("peek" in watchView(asked(), index)).toBe(false);
  });
});

describe("both tables ask the same way", () => {
  const pvp = readFileSync(new URL("../components/pvp/MatchBoard.tsx", import.meta.url), "utf8");

  it("reads the question off the engine, not off a useState", () => {
    // The solo table held this in local state for a day. Two mechanisms for one
    // card is the trap CLAUDE.md calls one name, two meanings.
    expect(table).toContain('state.awaiting !== null && state.awaiting.player === "you"');
    expect(table).not.toContain("setPeeking");
  });

  it("answers with a burn move on both", () => {
    expect(table).toContain('doMove({ kind: "burn", index: at })');
    expect(pvp).toContain('send({ kind: "burn", index: at })');
  });

  it("shows which one they draw next, on both", () => {
    for (const [where, source] of [["solo", table], ["pvp", pvp]] as const) {
      expect(source, where).toContain('{at === 0 ? "NEXT" : `${at + 1} DOWN`}');
    }
  });
});
