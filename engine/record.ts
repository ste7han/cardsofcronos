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

/**
 * How long a player has to move, by mode.
 *
 * Five minutes on a live match and a day on a slow one. The live figure has been
 * up twice — one minute, then two — and both times for the same reason: a turn
 * is a budget to spend across six positions, a hand to read and an opponent's
 * board to read, and a clock that only allows the obvious move is a clock that
 * picks the move for you.
 *
 * How many of each you may have open at once is CONCURRENT in lib/store.ts —
 * one live and five slow, because a live match wants you at the screen and five
 * of those at once is not a thing anybody can do.
 */
export const TURN_CLOCK: Record<MatchMode, number> = {
  live: 5 * 60 * 1000,
  correspondence: 24 * 60 * 60 * 1000,
};

/**
 * How long the opening turn waits for somebody who is not at the table yet.
 *
 * A match begins when the SECOND player sits down, which can be an hour after
 * the first one posted the offer. The joiner is obviously present — they just
 * pressed the button. The host may be anywhere, and used to lose turns to a
 * clock that started without them: `catchUp` ends a turn whose window has
 * passed, so a host who stepped away came back to a game that had been playing
 * itself.
 *
 * So the opening window is longer, and it is a cap rather than the real clock.
 * The real one starts the moment the player to move actually looks at the board
 * — see `arrive`. This is only how long the match is willing to wait before
 * giving up on them and playing on.
 */
export const OPENING_GRACE: Record<MatchMode, number> = {
  live: 10 * 60 * 1000,
  correspondence: 24 * 60 * 60 * 1000,
};

/**
 * The clock, in the words the site uses for it.
 *
 * Derived rather than written out, because it was written out in six places and
 * every one of them said "2 minutes" after the clock had moved. The lobby, the
 * spectator page, the Discord announcement and the match header all read it
 * from here now, so the number cannot be right in the engine and wrong on the
 * screen.
 */
export function clockLabel(mode: MatchMode): string {
  if (mode === "correspondence") return "a day a turn";
  return `${TURN_CLOCK.live / 60_000} min a turn`;
}

/** The same thing in prose, for a sentence rather than a label. */
export function clockPhrase(mode: MatchMode): string {
  if (mode === "correspondence") return "a day a turn";
  return `${TURN_CLOCK.live / 60_000} minutes a turn`;
}

export interface MatchRecord {
  id: string;
  /**
   * The wager in the escrow holding both stakes, or null for a friendly match.
   *
   * It is the id of the OFFER this match came from, not this match's id. The
   * deposits are made against the offer — which exists before anybody has
   * joined it — and a match id is only minted once both decks are in.
   *
   * Those two must stay different: `seed` is derived from the match id, so an
   * id somebody could know before choosing a deck is a shuffle they could work
   * out and build a deck against.
   */
  wager?: string | null;
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
  /**
   * When the clock actually started running, or null while it has not.
   *
   * A fresh match is unarmed: its deadline is the opening grace above, not a
   * turn. It arms when the player to move turns up (`arrive`), when they move
   * (`playInto`), or when the grace runs out without either (`catchUp`) — and
   * once armed it stays armed, so nobody can hold a live match at turn one by
   * reloading the page to push their own deadline out.
   */
  armed: number | null;
}

export function newRecord(args: {
  id: string;
  mode: MatchMode;
  stake: number;
  seats: Record<Player, string>;
  seed: number;
  decks: Record<Player, string[]>;
  wager?: string | null;
  now: number;
}): MatchRecord {
  return {
    id: args.id,
    wager: args.wager ?? null,
    mode: args.mode,
    stake: args.stake,
    seats: args.seats,
    seed: args.seed,
    decks: args.decks,
    moves: [],
    createdAt: args.now,
    deadline: args.now + OPENING_GRACE[args.mode],
    armed: null,
  };
}

/**
 * Start the clock, because the player it belongs to is looking at the board.
 *
 * Returns the record with a real deadline on it, or null when there was nothing
 * to do — already armed, already over, or the person looking is not the one the
 * clock is about. Null rather than the unchanged record so the caller can tell
 * whether it owes the database a write; this runs on every poll.
 */
export function arrive(
  record: MatchRecord,
  seat: Player,
  toMove: Player,
  now: number,
): MatchRecord | null {
  if (record.armed !== null) return null;
  if (record.moves.length > 0) return null;
  if (seat !== toMove) return null;
  return { ...record, armed: now, deadline: now + TURN_CLOCK[record.mode] };
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
 * in DESIGN.md: forfeiting would mean a bad connection costs a stake, and
 * ending the turn is punishment enough on its own — the whole budget for that
 * turn is lost and the waste rule charges for it.
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
  // The grace window expiring arms the clock: whoever it was waiting for is not
  // coming, and from here the match runs on ordinary turns. Recorded as the
  // moment it ran out rather than `now`, which may be days later if nobody
  // looked.
  let armed = record.armed;
  for (let guard = 0; guard < 64 && now >= deadline && !state.finished; guard++) {
    if (armed === null) armed = deadline;
    state = applyMove(state, { kind: "endTurn" }, index);
    moves.push({ kind: "endTurn" });
    deadline += TURN_CLOCK[record.mode];
  }
  return { ...record, moves, deadline, armed };
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
    //
    // Unless it was never running: the first move of a match replaces the
    // opening grace with a real turn, because the grace was only ever a wait for
    // somebody who has now demonstrably arrived. Leaving it in place would hand
    // the opening turn ten minutes instead of five.
    deadline:
      current.armed !== null && after.toMove === before.toMove
        ? current.deadline
        : now + TURN_CLOCK[record.mode],
    // Moving proves you were at the table, so the clock runs from here whatever
    // the opening grace had left on it.
    armed: current.armed ?? now,
  };
}
