// What the server knows about a board that the browser cannot work out.
//
// Two things: whether a wallet may play a board FOR ITS PRIZE, and what that
// prize currently is. Both need the chain, and one of them needs a key.
//
// ── THE LOCK IS ON THE PRIZE AND NOT ON THE OPPONENT ─────────────────────────
//
// Anybody can sit down against the Loaded Lions deck. What holding $LION buys is
// a place on its leaderboard, which is where the money is. That is a better
// shape than locking the opponent: somebody who has never held the token can
// find out whether they even enjoy the matchup before being asked to buy
// anything, and the thing being sold is the prize rather than the game.
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
import { PUBLIC_RPCS, rpc, tokenBalances } from "@/lib/cronos";
import { selector } from "@/lib/evm-tx";
import { asWord } from "@/lib/publisher";
import { CONTRACTS } from "@/lib/revenue";
import { env } from "@/lib/api";

/** The endpoints to ask, with the paid one first when there is one. */
function endpoints(): readonly string[] {
  const secret = env().CRONOS_RPC;
  return secret ? [secret, ...PUBLIC_RPCS] : PUBLIC_RPCS;
}

/**
 * What one board would pay if the week closed now, in base units, or null.
 *
 * Its share of the pot and not the pot. Those stopped being the same number the
 * day there was more than one board, and the pot is the bigger one — so showing
 * it next to a board would be quoting somebody a prize they cannot win.
 */
export async function prizeFor(board: string): Promise<string | null> {
  const pot = CONTRACTS.pot;
  if (pot === null) return null;
  try {
    const answer = await rpc<string>(endpoints(), "eth_call", [
      { to: pot, data: selector("nextPrize(bytes32)") + asWord(board) },
      "latest",
    ]);
    return BigInt(answer).toString();
  } catch {
    return null;
  }
}

/**
 * What a board's own pot is holding, in base units, or null.
 *
 * The balance and not an allocation. A second PrizePot pays one board, so what
 * it holds IS the prize — there is nothing else in it to take a share of, which
 * is the difference between this and `prizeFor` above.
 */
export async function potOf(token: string, pot: string): Promise<string | null> {
  try {
    const answer = await rpc<string>(endpoints(), "eth_call", [
      {
        to: token,
        data: selector("balanceOf(address)") + pot.replace(/^0x/, "").toLowerCase().padStart(64, "0"),
      },
      "latest",
    ]);
    return BigInt(answer).toString();
  } catch {
    return null;
  }
}

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
  // A board you pay for is gated on the payment and nothing else. The $LION
  // holding rule was how this board was held back while there was no way to
  // charge for it; charging for it is the better answer to the same question,
  // and running both would be asking somebody to hold a token AND pay.
  //
  // Read off the deployed contract rather than a flag, so the two can never
  // disagree: no contract means no way to pay, which means the old rule is
  // still the only one there is.
  if (board.entry?.contract != null) return null;
  if (board.needs === null) return null;

  const [held] = await tokenBalances(endpoints(), board.needs.token, [wallet]);

  if (held === null || held === undefined) {
    return "Your balance could not be read, so this score cannot be counted. Try again in a minute.";
  }

  const whole = held / 10n ** 18n;
  if (whole >= BigInt(board.needs.whole)) return null;
  return (
    `The ${board.name} prize needs ${board.needs.whole.toLocaleString("en-US")} $LION and this ` +
    `wallet holds ${whole.toLocaleString("en-US")}. You can still play it.`
  );
}
