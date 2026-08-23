// The lessons, against real boards.
//
// The thing worth testing is not the wording, it is the timing: a lesson that
// fires before it means anything is worse than none, because the player learns
// that this panel is noise and stops reading it. So every test here builds the
// state the lesson is about and checks it is the one that shows.

import { describe, expect, it } from "vitest";

import { chooseMove } from "@/engine/bot";
import { applyMove, newMatch } from "@/engine/match";
import { RULES, type State } from "@/engine/types";
import { LESSON_IDS, nextLesson } from "@/lib/tutorial";
import { INDEX, SET } from "@/lib/set";

const NONE: ReadonlySet<string> = new Set();
const idAt = (state: State, dismissed: ReadonlySet<string> = NONE) =>
  nextLesson(state, INDEX, dismissed)?.id ?? null;

/** A fresh match, both decks built the way the table builds them. */
function fresh(seed = 5): State {
  return newMatch(SET, seed);
}

/** Play on until `stop` says so, or the match ends. */
function playUntil(state: State, stop: (s: State) => boolean, limit = 400): State {
  for (let i = 0; i < limit && !state.finished && !stop(state); i++) {
    state = applyMove(state, chooseMove(state, INDEX), INDEX);
  }
  return state;
}

describe("what the coach says first", () => {
  it("opens on positions, because an empty portfolio earns nothing", () => {
    expect(idAt(fresh())).toBe("positions");
  });

  it("moves on as each lesson is waved away", () => {
    const state = fresh();
    const seen = new Set<string>();
    let guard = 0;

    // Every lesson that applies to a turn-one board, in order, and then quiet.
    let id = idAt(state, seen);
    while (id !== null && guard++ < LESSON_IDS.length + 1) {
      expect(seen.has(id)).toBe(false);
      seen.add(id);
      id = idAt(state, seen);
    }
    expect(id).toBeNull();
    expect(seen.size).toBeGreaterThan(1);
  });

  it("says nothing at all once everything is dismissed", () => {
    expect(idAt(fresh(), new Set(LESSON_IDS))).toBeNull();
  });
});

describe("lessons wait for the board that makes them true", () => {
  it("does not mention a full portfolio on an empty one", () => {
    // The failure this guards is the one that makes a player stop reading: being
    // told about a cap they are nowhere near.
    const state = fresh();
    expect(state.players.you.projects.length).toBe(0);
    expect(idAt(state, new Set(["positions"]))).not.toBe("full");
  });

  it("leads with the full portfolio the moment it is full", () => {
    const state = playUntil(fresh(), (s) => s.players.you.projects.length >= RULES.portfolioSize);
    expect(state.players.you.projects.length).toBe(RULES.portfolioSize);
    // Ahead of everything, dismissed or not: if the portfolio has just filled
    // up, that is what the screen should be about.
    expect(idAt(state)).toBe("full");
  });

  it("only calls the last turn on the last turn", () => {
    let state = fresh();
    const quiet = new Set(LESSON_IDS.filter((id) => id !== "clock"));
    expect(idAt(state, quiet)).toBeNull();

    state = playUntil(state, (s) => s.turn >= RULES.turns);
    expect(idAt(state, quiet)).toBe("clock");
  });
});
