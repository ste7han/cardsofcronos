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
import { formatMC } from "@/engine/format";
import { RULES } from "@/engine/types";
import { post } from "@/lib/discord";
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
  secrets: {
    publisherKey?: string;
    rpc?: string;
    pvpFriendly?: string;
    pvpRanked?: string;
  } = {},
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

  // And said out loud, in the channel that matches what was at stake.
  //
  // Here rather than in a route, and after the finishMatch guard, so it happens
  // exactly once: three routes can be the one that notices a match has ended,
  // and announcing from each of them would put the same result in a channel
  // three times.
  //
  // Nothing here is taken on anybody's word. This server IS the referee — a
  // match is a seed and a list of moves it replayed itself — so unlike the solo
  // feed there is nothing to verify first. It already has.
  await announce(record, state, secrets).catch(() => {
    // A channel that did not hear about it is not a reason to fail a settled
    // match. The result is written, the records are updated and the pot is
    // handled; this is the least important thing in the function.
  });
}

/** Which channel a result belongs in, and what it says. */
async function announce(
  record: MatchRecord,
  state: State,
  secrets: { pvpFriendly?: string; pvpRanked?: string },
): Promise<void> {
  const staked = record.stake > 0;
  const hook = staked ? secrets.pvpRanked : secrets.pvpFriendly;
  if (!hook) return;

  const you = record.seats.you;
  const opponent = record.seats.opponent;
  const yourMC = state.players.you.mc;
  const theirMC = state.players.opponent.mc;

  const winner = state.winner === null ? null : record.seats[state.winner];
  const loser = winner === null ? null : winner === you ? opponent : you;

  await post(hook, [
    {
      title:
        winner === null
          ? `${short(you)} and ${short(opponent)} drew`
          : `${short(winner)} beat ${short(loser!)}`,
      description:
        `**${formatMC(Math.max(yourMC, theirMC))}** against **${formatMC(
          Math.min(yourMC, theirMC),
        )}** after ${RULES.turns} turns` +
        (staked
          ? winner === null
            ? `\n${record.stake} CRO a side. A draw is not settled on chain — the contract has ` +
              `no draw, so both sides take their own deposit back.`
            : `\nPlaying for ${record.stake} CRO a side. The pot goes to the winner, less the ` +
              `cut their holding earns.`
          : "\nFriendly. Nothing was staked."),
      color: staked ? 0xffd700 : 0x9d4edd,
      timestamp: new Date().toISOString(),
    },
  ]);
}

const short = (address: string) => `${address.slice(0, 6)}…${address.slice(-4)}`;

export { seatOf };
