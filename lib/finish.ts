// Closing a finished match, in one place.
//
// Two routes can be the one that notices: the move that ends it, and the poll
// that reads it a second later. Whichever gets there first does the work and the
// other does nothing — which is a property of the UPDATE in finishMatch, not of
// the order they happen to arrive in.
//
// It lives here rather than in either route because "who won" and "write both
// records" is the same answer to the same question, and two copies of it would
// eventually disagree about a draw.

import { seatOf } from "@/engine/record";
import type { MatchRecord } from "@/engine/record";
import type { State } from "@/engine/types";
import { addResult, finishMatch, type Database } from "@/lib/store";

/**
 * If this match has just ended, close it and write both players' records.
 *
 * Safe to call on every read of every match, finished or not. That is the point:
 * a match that ended on the clock rather than on a move has nobody to notice it
 * except the next person to look.
 */
export async function settle(
  db: Database,
  record: MatchRecord,
  state: State,
  now: number,
): Promise<void> {
  if (!state.finished) return;
  if (!(await finishMatch(db, record.id, record.moves, record.deadline, now))) return;

  const you = record.seats.you;
  const opponent = record.seats.opponent;

  if (state.winner === null) {
    await addResult(db, you, "draw", now);
    await addResult(db, opponent, "draw", now);
  } else {
    const winner = record.seats[state.winner];
    const loser = winner === you ? opponent : you;
    await addResult(db, winner, "win", now);
    await addResult(db, loser, "loss", now);
  }
}

export { seatOf };
