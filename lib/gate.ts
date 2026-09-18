// May this wallet play this board?
//
// Server-side, and that is the whole point. engine/deck.ts says it about a
// different rule and it is the same rule: in the first version of this game the
// card check was a UI filter, so a direct call could play anything. A board held
// back for people who hold $LION has to read the chain before it takes a score,
// not just grey out a button.
//
// It lives here rather than in data/boards.ts because that file is imported by
// the browser — the game builds the opponent's deck from it — and reading a
// balance needs an endpoint that may carry a key.

import type { Board } from "@/data/boards";
import { PUBLIC_RPCS, tokenBalances } from "@/lib/cronos";
import { env } from "@/lib/api";

/**
 * Why this wallet may not play this board, or null when it may.
 *
 * READING NOTHING IS BEING LOCKED OUT. An endpoint that will not answer means
 * this cannot tell a holder from anybody else, and the safe direction is the one
 * that refuses — a board opened because a request timed out is a prize anybody
 * can enter for. It says which of the two happened, because "we could not read
 * your balance" and "you do not hold enough" are different sentences and only
 * one of them is about the player.
 */
export async function lockedOut(board: Board, wallet: string): Promise<string | null> {
  if (board.needs === null) return null;

  const secret = env().CRONOS_RPC;
  const rpcs = secret ? [secret, ...PUBLIC_RPCS] : PUBLIC_RPCS;
  const [held] = await tokenBalances(rpcs, board.needs.token, [wallet]);

  if (held === null || held === undefined) {
    return "Your balance could not be read, so this board is shut. Try again in a minute.";
  }

  const whole = held / 10n ** 18n;
  if (whole >= BigInt(board.needs.whole)) return null;
  return (
    `${board.name} needs ${board.needs.whole.toLocaleString("en-US")} $LION and this wallet holds ` +
    `${whole.toLocaleString("en-US")}.`
  );
}
