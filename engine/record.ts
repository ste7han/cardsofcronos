// A match, as the thing a server stores.
//
// Not a State. A State is forty kilobytes of board, hands, decks and log, and
// storing it means storing a snapshot that can disagree with the rules that made
// it — change a card and every stored match is quietly playing a game that no
// longer exists. A record is a seed, two decks and a list of moves, which is a
// few hundred bytes and replays into a State on demand. The engine has no
// Math.random anywhere, so the replay is the same every time, on any machine.
//
// That is also the audit. When two players disagree about what happened, the
// answer is not a log anybody wrote — it is the record, replayed.
//
// The clock is lazy on purpose. Correspondence gives a player twenty-four hours,
// and nothing has to run in the background to enforce it: whoever next looks at
// the match brings it up to date, appending an end-of-turn for every window that
// closed while nobody was looking. A match that nobody opens for three days is
// three turns further along the moment somebody does, and it is the same three
// turns for both of them.

import { applyMove, applyMoveAs, newMatch } from "./match";
import type { Card, CardIndex, Move, Player, State } from "./types";
import { IllegalMove } from "./types";

export type MatchMode = "live" | "correspondence";

/** How long a player has to move, by mode. */
export const TURN_CLOCK: Record<MatchMode, number> = {
  live: 60_000,
  correspondence: 24 * 60 * 60 * 1000,
};

export interface MatchRecord {
  id: string;
  mode: MatchMode;
  /** What is at stake per side. Zero is a friendly match, and for now the only
   * value lib/pvp.ts will accept: there is nowhere on Cronos to hold a stake
   * yet, and a stake nobody holds is not a stake. The unit is decided with the
   * escrow, not here. */
  stake: number;
  /** Whose player id sits on which side of the table. */
  seats: Record<Player, string>;
  seed: number;
  decks: Record<Player, string[]>;
  /** Every move made, in order. The match is this list and nothing else. */
  moves: Move[];
  createdAt: number;
  /** When the player to move runs out of time. */
  deadline: number;
}

export function newRecord(args: {
  id: string;
  mode: MatchMode;
  stake: number;
  seats: Record<Player, string>;
  seed: number;
  decks: Record<Player, string[]>;
  now: number;
}): MatchRecord {
  return {
    id: args.id,
    mode: args.mode,
    stake: args.stake,
    seats: args.seats,
    seed: args.seed,
    decks: args.decks,
    moves: [],
    createdAt: args.now,
    deadline: args.now + TURN_CLOCK[args.mode],
  };
}

/** The match as a State, by replaying every move from the seed. */
export function stateOf(record: MatchRecord, cards: readonly Card[], index: CardIndex): State {
  let state = newMatch(cards, record.seed, record.decks);
  for (const move of record.moves) {
    state = applyMove(state, move, index);
  }
  return state;
}

/** Which side of the table a player id sits on, or null if they are not in it. */
export function seatOf(record: MatchRecord, playerId: string): Player | null {
  if (record.seats.you === playerId) return "you";
  if (record.seats.opponent === playerId) return "opponent";
  return null;
}

/**
 * Bring the clock up to now, ending a turn for every window that has closed.
 *
 * When the clock runs out the turn ends and the match does not, which is settled
 * in DESIGN.md: at one minute, forfeiting would mean a bad connection costs a
 * stake, and ending the turn is punishment enough on its own — the whole budget
 * for that turn is lost and the waste rule charges for it.
 *
 * Returns a new record; the old one is untouched, like everything else here.
 */
export function catchUp(
  record: MatchRecord,
  now: number,
  cards: readonly Card[],
  index: CardIndex,
): MatchRecord {
  let state = stateOf(record, cards, index);
  if (state.finished) return record;

  const moves = [...record.moves];
  let deadline = record.deadline;
  // Bounded rather than while(true): a clock this loop cannot advance would spin
  // forever on a server, and a match is twenty turns, so twenty missed windows
  // is already more than a whole match.
  for (let guard = 0; guard < 64 && now >= deadline && !state.finished; guard++) {
    state = applyMove(state, { kind: "endTurn" }, index);
    moves.push({ kind: "endTurn" });
    deadline += TURN_CLOCK[record.mode];
  }
  return { ...record, moves, deadline };
}

/**
 * Apply one move on behalf of a player id.
 *
 * The clock is brought up to date first, so a move arriving after the deadline
 * lands on the turn it actually arrived in rather than the one the player was
 * looking at when they pressed the button.
 */
export function playInto(
  record: MatchRecord,
  playerId: string,
  move: Move,
  now: number,
  cards: readonly Card[],
  index: CardIndex,
): MatchRecord {
  const seat = seatOf(record, playerId);
  if (!seat) throw new IllegalMove("You are not in this match.");

  const current = catchUp(record, now, cards, index);
  const before = stateOf(current, cards, index);
  if (before.finished) throw new IllegalMove("The match is over; no further moves are possible.");

  // applyMoveAs and not applyMove: this is the one path a request reaches, and
  // it is the only place that knows the move came from a person rather than
  // from the bot or a replay.
  const after = applyMoveAs(before, seat, move, index);

  return {
    ...current,
    moves: [...current.moves, move],
    // The clock only restarts when the turn actually changed hands. Playing a
    // card does not buy you another twenty-four hours.
    deadline: after.toMove === before.toMove ? current.deadline : now + TURN_CLOCK[record.mode],
  };
}
