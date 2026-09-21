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
import { settleMatch } from "@/lib/escrow";
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
  secrets: { publisherKey?: string; rpc?: string } = {},
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

    // And the money, if there was any.
    //
    // AFTER the records and never instead of them. The result is what the game
    // is; the pot is a consequence. A settlement that could not be sent — a bad
    // RPC, a nonce clash, a key that has been rotated — must not undo a match
    // that has been played, so this is awaited for its answer and not for its
    // success.
    //
    // Nothing retries it here. What gets a stuck pot out is the players
    // themselves: after thirty days either of them can walk away with their own
    // deposit, which is the exit contracts/MatchEscrow.sol exists to have.
    if (record.wager) {
      const sent = await settleMatch(record.wager, winner, secrets).catch((error: unknown) => ({
        tx: null,
        why: error instanceof Error ? error.message : "the settlement could not be sent",
      }));
      if (sent.tx === null) {
        console.error(`[settle] ${record.id} finished but its pot was not settled: ${sent.why}`);
      }
    }
  }

  // A draw on a staked match is deliberately not settled. The contract has no
  // draw: `settle` takes a winner and refuses anything else. Both sides get
  // their own deposit back through walkAway, which is slow and correct, and a
  // draw in this game needs both market caps to land on the same figure.
}

export { seatOf };
