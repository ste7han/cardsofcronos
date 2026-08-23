// A match stored as a seed and a list of moves.
//
// Two things have to hold or none of the rest of PvP can be trusted. The replay
// has to be exact, because it is both the state a server serves and the answer
// when two players disagree. And the clock has to be enforceable without
// anything running in the background, because a correspondence match sits
// untouched for a day at a time and there is nowhere for a cron job to live.

import { describe, expect, it } from "vitest";

import { CARDS } from "@/data/cards";
import { chooseMove } from "@/engine/bot";
import { buildDeck } from "@/engine/deck";
import { applyMove, buildIndex, newMatch } from "@/engine/match";
import { TURN_CLOCK, catchUp, newRecord, playInto, seatOf, stateOf } from "@/engine/record";
import { IllegalMove } from "@/engine/types";
import type { MatchRecord } from "@/engine/record";
import type { Move } from "@/engine/types";

const index = buildIndex(CARDS);
const T0 = 1_700_000_000_000;

function record(mode: "live" | "correspondence" = "correspondence"): MatchRecord {
  return newRecord({
    id: "m1",
    mode,
    stake: 0,
    seats: { you: "alice", opponent: "bob" },
    seed: 4242,
    decks: { you: buildDeck(CARDS, 4242), opponent: buildDeck(CARDS, 9191) },
    now: T0,
  });
}

describe("a match as a record", () => {
  it("replays to exactly the match those moves made", () => {
    // Play a real match out, keeping the moves, then rebuild it from nothing but
    // the seed and that list. If these ever differ, every stored match on the
    // server is a different game from the one the players played.
    const decks = { you: buildDeck(CARDS, 4242), opponent: buildDeck(CARDS, 9191) };
    let live = newMatch(CARDS, 4242, decks);
    const moves: Move[] = [];
    let guard = 0;
    while (!live.finished && guard++ < 2000) {
      const move = chooseMove(live, index);
      moves.push(move);
      live = applyMove(live, move, index);
    }

    const stored: MatchRecord = { ...record(), moves };
    expect(stateOf(stored, CARDS, index)).toEqual(live);
    expect(moves.length).toBeGreaterThan(30); // or the comparison is trivial
  });

  it("knows who is at the table and who is not", () => {
    const r = record();
    expect(seatOf(r, "alice")).toBe("you");
    expect(seatOf(r, "bob")).toBe("opponent");
    expect(seatOf(r, "carol")).toBeNull();
  });

  it("refuses a move from somebody who is not in it", () => {
    const r = record();
    expect(() => playInto(r, "carol", { kind: "endTurn" }, T0, CARDS, index)).toThrow(IllegalMove);
  });

  it("refuses a move from the player who is not to move", () => {
    const r = record();
    const state = stateOf(r, CARDS, index);
    expect(state.toMove).toBe("you");
    // Bob is at the table and it is not his turn.
    expect(() => playInto(r, "bob", { kind: "endTurn" }, T0, CARDS, index)).toThrow(/not .*'s turn/);
  });
});

describe("the clock, with nothing running in the background", () => {
  it("does nothing while there is time left", () => {
    const r = record();
    const same = catchUp(r, T0 + TURN_CLOCK.correspondence - 1, CARDS, index);
    expect(same.moves.length).toBe(0);
    expect(same.deadline).toBe(r.deadline);
  });

  it("ends one turn for each window that closed while nobody looked", () => {
    const r = record();
    const before = stateOf(r, CARDS, index);

    const oneLate = catchUp(r, T0 + TURN_CLOCK.correspondence, CARDS, index);
    expect(oneLate.moves).toEqual([{ kind: "endTurn" }]);
    expect(stateOf(oneLate, CARDS, index).toMove).not.toBe(before.toMove);

    // Three days untouched is three turns further along, and the same three for
    // both players — which is the property that lets the clock be lazy.
    const threeLate = catchUp(r, T0 + 3 * TURN_CLOCK.correspondence, CARDS, index);
    expect(threeLate.moves.length).toBe(3);
    expect(threeLate.deadline).toBe(r.deadline + 3 * TURN_CLOCK.correspondence);
  });

  it("ends the turn rather than the match", () => {
    // Settled in DESIGN.md and worth a test, because the tempting implementation
    // is a forfeit and a forfeit means one bad connection costs a stake.
    const late = catchUp(record(), T0 + 2 * TURN_CLOCK.correspondence, CARDS, index);
    expect(stateOf(late, CARDS, index).finished).toBe(false);
  });

  it("runs a whole match out rather than looping forever on a stalled clock", () => {
    // A player who never moves loses, and the clock has to be able to say so
    // without a background job and without spinning.
    const done = catchUp(record(), T0 + 500 * TURN_CLOCK.correspondence, CARDS, index);
    const state = stateOf(done, CARDS, index);
    expect(state.finished).toBe(true);
  });
});

describe("a move against the clock", () => {
  it("restarts the clock only when the turn changes hands", () => {
    const r = record();
    const state = stateOf(r, CARDS, index);
    const playable = state.players.you.hand.findIndex((_, i) => {
      try {
        applyMove(state, { kind: "playCard", handIndex: i }, index);
        return true;
      } catch {
        return false;
      }
    });
    expect(playable).toBeGreaterThanOrEqual(0);

    const at = T0 + 1000;
    const afterPlay = playInto(r, "alice", { kind: "playCard", handIndex: playable }, at, CARDS, index);
    // Still your turn, so still your original deadline. Playing a card must not
    // buy another twenty-four hours, or a match never has to end.
    expect(afterPlay.deadline).toBe(r.deadline);

    const afterEnd = playInto(afterPlay, "alice", { kind: "endTurn" }, at, CARDS, index);
    expect(afterEnd.deadline).toBe(at + TURN_CLOCK.correspondence);
  });

  it("lands a late move on the turn it actually arrived in", () => {
    // Alice opens the tab, goes to lunch, and presses end turn a day later. By
    // then the clock has already ended that turn for her and it is Bob's.
    const r = record();
    const late = T0 + TURN_CLOCK.correspondence + 1000;
    expect(() => playInto(r, "alice", { kind: "endTurn" }, late, CARDS, index)).toThrow(
      /not .*'s turn/,
    );
  });
});
