// Closing a week and paying its winner, without anybody being awake.
//
// Runs on a schedule. What it does is narrow on purpose:
//
//   1. work out which week has just ended
//   2. read that week's winner out of our own table, by the same rule the board
//      ranks by
//   3. tell PrizePot who won, with the publisher key
//   4. push the prize to them
//   5. write down what was paid, so /tournament can show it
//
// Step three is the only one that needs a key, and that key may name a winner
// and nothing else — see contracts/PrizePot.sol. Step four needs no permission
// at all: `claim` pays the winner rather than the caller, so this is only
// spending gas on somebody else's behalf.
//
// ── IT IS SAFE TO RUN TWICE ──────────────────────────────────────────────────
//
// Everything here is idempotent because the contract makes it so: closing a week
// that is closed reverts, paying one that is paid reverts. So a cron that fires
// twice, a retry after a timeout, or a hand-run while the schedule is also
// running all end in the same place. That is deliberate — the alternative is
// this file tracking what it has done, and a second source of truth about who
// has been paid is the last thing this wants.

import { PUBLIC_RPCS, rpc, send } from "@/lib/cronos";
import { CONTRACTS } from "@/lib/revenue";
import { selector, word } from "@/lib/evm-tx";
import { hexToBytes } from "@/lib/address";
import type { Database } from "@/lib/store";
import { recordPayout, weekOf, winnerOf } from "@/lib/tournament";

/** What a run did, in enough detail to read in a log a week later. */
export interface Ran {
  week: string;
  /** Null when nobody beat the bot that week — which is not a failure. */
  winner: string | null;
  closed: string | null;
  paid: string | null;
  /** Why nothing happened, when nothing did. */
  skipped?: string;
}

/** The week that has just ended, given a moment inside the new one. */
export function lastWeek(now: number): string {
  return weekOf(now - 7 * 86_400_000);
}

/** "2026-W38" as the bytes32 the contract keys weeks by. */
export function weekWord(week: string): string {
  const bytes = new TextEncoder().encode(week);
  if (bytes.length > 32) throw new Error(`A week label must fit in a word: ${week}`);
  let hex = "";
  for (const byte of bytes) hex += byte.toString(16).padStart(2, "0");
  return hex.padEnd(64, "0");
}

/**
 * Closes the week that has just ended and pays whoever won it.
 *
 * Returns what it did rather than throwing on the ordinary nothing-to-do cases,
 * because a scheduled job that throws on "nobody played" is a scheduled job
 * whose alerts get muted.
 */
export async function runWeekly(
  db: Database,
  secrets: { publisherKey?: string; rpc?: string },
  now: number,
): Promise<Ran> {
  const week = lastWeek(now);
  const pot = CONTRACTS.pot;

  if (pot === null) {
    return { week, winner: null, closed: null, paid: null, skipped: "no pot contract yet" };
  }
  if (!secrets.publisherKey) {
    return { week, winner: null, closed: null, paid: null, skipped: "no publisher key set" };
  }

  const best = await winnerOf(db, week);
  if (best === null) {
    // Nobody beat the bot. The pot rolls into next week by doing nothing, which
    // is the whole of the behaviour and needs no code.
    return { week, winner: null, closed: null, paid: null, skipped: "nobody won that week" };
  }

  const rpcs = secrets.rpc ? [secrets.rpc, ...PUBLIC_RPCS] : PUBLIC_RPCS;
  const key = hexToBytes(secrets.publisherKey);
  const label = weekWord(week);

  let closed: string | null = null;
  try {
    closed = await send(
      rpcs,
      key,
      pot,
      selector("closeWeek(bytes32,address)") + label + word(best.wallet),
    );
  } catch (error) {
    // Already closed is the expected answer on a second run and is not a
    // problem. Anything else is, and is reported rather than swallowed.
    const said = error instanceof Error ? error.message : String(error);
    if (!/WeekAlreadyClosed|already/i.test(said)) {
      return { week, winner: best.wallet, closed: null, paid: null, skipped: said };
    }
  }

  // Read before claiming, because claiming zeroes it. `prizes(bytes32)` returns
  // the winner, the amount and whether it has been paid; the amount is the
  // second word. Without this the payout happens and the board says NOT PAID
  // YET forever, which is the row somebody checks first.
  let amount: string | null = null;
  try {
    const prize = await rpc<string>(rpcs, "eth_call", [
      { to: pot, data: selector("prizes(bytes32)") + label },
      "latest",
    ]);
    amount = BigInt("0x" + prize.replace(/^0x/, "").slice(64, 128)).toString();
  } catch {
    // Not fatal. Paying the winner matters more than recording how much, and a
    // run that stopped here would leave them unpaid to protect a table.
  }

  let paid: string | null = null;
  try {
    paid = await send(rpcs, key, pot, selector("claim(bytes32)") + label);
  } catch (error) {
    const said = error instanceof Error ? error.message : String(error);
    if (!/AlreadyPaid|already/i.test(said)) {
      return { week, winner: best.wallet, closed, paid: null, skipped: said };
    }
  }

  if (paid !== null && amount !== null) {
    try {
      await recordPayout(db, {
        week,
        wallet: best.wallet,
        wei: amount,
        txHash: paid,
        at: now,
      });
    } catch (error) {
      // The week is the primary key, so a second run throws here rather than
      // writing a second row. That is the table working and not a failure: the
      // money moved once and it is written down once.
      //
      // Anything else is a failure and is said out loud. It cannot be raised —
      // the winner has already been paid by this point and throwing would make
      // the next run try to pay them again — so it goes to the log, which is
      // where a scheduled job's problems have to be visible from.
      const said = error instanceof Error ? error.message : String(error);
      if (!/UNIQUE|constraint|PRIMARY/i.test(said)) {
        console.error(`[weekly] ${week} was paid in ${paid} but not recorded: ${said}`);
      }
    }
  }

  return { week, winner: best.wallet, closed, paid };
}
