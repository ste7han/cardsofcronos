// What the table says out loud.
//
// Only cues.ts is testable here and that is the half worth testing. The
// synthesis in sfx.ts is oscillators and envelopes, which node has no way to
// hear and which a person has to judge anyway. The mapping is different: it is
// the part where a bug is SILENT, because a cue that never fires sounds exactly
// like a cue that fires correctly at the wrong moment, and neither of them
// throws.
//
// The exhaustive switch in sfx.ts covers the other direction — a cue with no
// sound does not compile — so what is left for a test is whether the right
// things happen at the right moments.
import { describe, expect, it } from "vitest";

import { CARDS } from "@/data/cards";
import { cardById } from "@/engine/helpers";
import { applyMove, budgetForTurn, newMatch, playable } from "@/engine/match";
import { snapshotOfState } from "@/engine/snapshot";
import { buildDeck } from "@/engine/deck";
import { INDEX, SET } from "@/lib/set";
import type { Move, State } from "@/engine/types";
import { RULES } from "@/engine/types";
import { cuesFor, endCue, type Cue } from "@/lib/audio/cues";

/** A match, and the cues one move produces in it. */
function after(state: State, move: Move): { next: State; cues: Cue[] } {
  const was = snapshotOfState(state, INDEX);
  const next = applyMove(state, move, INDEX);
  return { next, cues: cuesFor(was, snapshotOfState(next, INDEX), move) };
}

/**
 * A match with the budget of a late turn.
 *
 * Turn one pays $40K and a hand of five holds cards that cost up to $280K, so on
 * the real turn one the first card in hand is usually unplayable. TCG runs these
 * from the opening because the seat that moves first may play one card for
 * nothing whatever it costs; this game pays nothing for moving first, so the
 * budget has to come from somewhere or every test here fails on the price rather
 * than on the sound.
 *
 * The turn number is left alone. What these tests need is a move that goes
 * through, and the cues do not read the turn.
 */
function freshMatch(seed = 7): State {
  const state = structuredClone(
    newMatch(SET, seed, {
      you: buildDeck(SET, seed),
      opponent: buildDeck(SET, seed + 7919),
    }),
  ) as State;
  state.budgetThisTurn = budgetForTurn(RULES.turns);
  return state;
}

describe("what the table sounds like", () => {
  it("says a card was played, before whatever the card did", () => {
    // The order is the meaning. The hand acts, then the board answers; playing
    // them the other way round tells the story backwards.
    const state = freshMatch();
    // The first card in hand that can actually be played, rather than slot zero.
    // This asked for slot zero and passed for as long as the draw put something
    // playable there; when the set grew it landed on a CAW777 card, which needs a
    // position on the board, and the test failed for a reason that has nothing to
    // do with what it is asking. What it is asking is that playing a card sounds
    // like playing a card before it sounds like anything the card did.
    const slot = state.players.you.hand.findIndex((id) =>
      playable(state, cardById(INDEX, id), "you", INDEX),
    );
    expect(slot).toBeGreaterThanOrEqual(0);
    const { cues } = after(state, { kind: "playCard", handIndex: slot });
    expect(cues[0]).toBe("card-played");
  });

  it("tells throwing a card away apart from playing one", () => {
    // The two cannot be told apart from board states alone — both take a card
    // out of a hand and neither has to touch the table — which is exactly why
    // cuesFor is given the move and makeFlash is not.
    //
    // Wound forward first: throwing a card away costs marketing budget and
    // there is not enough of it on turn one.
    let state = freshMatch();
    while (state.budgetThisTurn - state.budgetSpentThisTurn < 60_000 && state.turn < 8) {
      state = applyMove(state, { kind: "endTurn" }, INDEX);
    }
    if (state.toMove !== "you") state = applyMove(state, { kind: "endTurn" }, INDEX);
    const { cues } = after(state, { kind: "discard", handIndex: 0 });
    expect(cues).toContain("card-discarded");
    expect(cues).not.toContain("card-played");
  });

  it("hears the pump phase as its own thing, not as a card paying out", () => {
    // Ending a turn pays every position. That is the heartbeat of the game and
    // it must not sound like a card doing something, or every turn would sound
    // like the best moment in the match.
    let state = freshMatch();
    // Get a position on the board first, so there is something to pay.
    for (let i = 0; i < 3 && state.players.you.projects.length === 0; i++) {
      try {
        state = applyMove(state, { kind: "playCard", handIndex: 0 }, INDEX);
      } catch {
        break;
      }
    }
    const { cues } = after(state, { kind: "endTurn" });
    expect(cues).toContain("turn-ended");
    // Whatever the market cap did, it was the pump and not a card.
    expect(cues).not.toContain("mc-up");
  });

  it("stays quiet about a move that changed nothing but the turn", () => {
    // A turn ending with an empty board is one sound, not a handful of them. A
    // table that makes five noises for nothing is a table people mute.
    const state = freshMatch();
    const { cues } = after(state, { kind: "endTurn" });
    expect(cues).toEqual(["turn-ended"]);
  });

  it("refuses to guess at the end of a match", () => {
    // A Snapshot has no `finished` flag, so inferring the end from two of them
    // would be guessing at the one sound anybody remembers. It is the caller's
    // to say, and this is the whole of that decision.
    expect(endCue("you")).toBe("match-won");
    expect(endCue("opponent")).toBe("match-lost");
    expect(endCue(null)).toBe("match-drawn");
    expect(endCue("opponent", "opponent")).toBe("match-won");
  });

  it("never returns a cue with no sound, over a whole match", { timeout: 60_000 }, () => {
    // The safety net. Every cue that comes out of a real match has to be one
    // sfx.ts handles — and sfx.ts does not compile with a cue it does not
    // handle, so the pair of them closes the loop.
    const known = new Set<Cue>([
      "card-played",
      "card-discarded",
      "profit-taken",
      "turn-ended",
      "draw",
      "pump",
      "damage",
      "heal",
      "rug",
      "mc-up",
      "mc-down",
      "select",
      "deny",
      "match-won",
      "match-lost",
      "match-drawn",
    ]);

    let seen = 0;
    for (let seed = 0; seed < 30; seed++) {
      let state = freshMatch(seed);
      for (let step = 0; step < 200 && !state.finished; step++) {
        // Whatever is legal: play the first card in hand, or end the turn.
        const move: Move =
          state.players[state.toMove].hand.length > 0 && step % 3 !== 2
            ? { kind: "playCard", handIndex: 0 }
            : { kind: "endTurn" };
        let result;
        try {
          result = after(state, move);
        } catch {
          // Not legal in this position. Ending a turn always is.
          try {
            result = after(state, { kind: "endTurn" });
          } catch {
            break;
          }
        }
        for (const cue of result.cues) {
          expect(known.has(cue)).toBe(true);
          seen += 1;
        }
        state = result.next;
      }
    }
    // The test is worthless if nothing ever fired.
    expect(seen).toBeGreaterThan(500);
  });
});

describe("whose ears", () => {
  it("calls a rug a rug whichever board it happened on", () => {
    // Deliberate. A position leaving the table is the thing this game is named
    // after, and it is loud whoever it happened to.
    const state = freshMatch();
    const was = snapshotOfState(state, INDEX);
    const gone = {
      ...was,
      players: {
        you: was.players.you,
        opponent: { ...was.players.opponent, projects: [] },
      },
    };
    // A board that had something and now has nothing, seen from your seat.
    const withOne = {
      ...gone,
      players: {
        you: gone.players.you,
        opponent: {
          ...gone.players.opponent,
          projects: [
            {
              cardId: CARDS[0]!.id,
              holders: 3,
              extraPump: 0,
              pump: 0,
            } as never,
          ],
        },
      },
    };
    expect(cuesFor(withOne, gone, null)).toContain("rug");
  });
});
