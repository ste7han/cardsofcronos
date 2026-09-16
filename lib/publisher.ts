// Closing a week and paying its winner, without anybody being awake.
//
// Runs on a schedule. What it does is narrow on purpose:
//
//   1. work out which week has just ended
//   2. read that week's winner out of our own table, by the same rule the board
//      ranks by
//   3. tell PrizePot who won, with the publisher key
//   4. push the prize to them
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

import { PUBLIC_RPCS } from "@/lib/cronos";
import { CONTRACTS } from "@/lib/revenue";
import {
  CRONOS_CHAIN_ID,
  addressOfKey,
  selector,
  signTransaction,
  word,
} from "@/lib/evm-tx";
import { hexToBytes } from "@/lib/address";
import type { Database } from "@/lib/store";
import { weekOf, winnerOf } from "@/lib/tournament";

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

async function rpc(rpcs: readonly string[], method: string, params: unknown[]): Promise<string> {
  let last = "no endpoint answered";
  for (const url of rpcs) {
    try {
      const answer = await fetch(url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
      });
      const found = (await answer.json()) as { result?: string; error?: { message?: string } };
      if (found.error) {
        // A revert is the chain's answer, not a broken endpoint: trying the next
        // RPC would get the same answer and hide it behind a timeout.
        throw new Error(found.error.message ?? "the call was rejected");
      }
      if (typeof found.result === "string") return found.result;
      last = "an endpoint answered with nothing";
    } catch (error) {
      last = error instanceof Error ? error.message : String(error);
      if (/revert|rejected|insufficient|nonce/i.test(last)) throw error;
    }
  }
  throw new Error(last);
}

/** Signs one call to a contract and sends it. Returns the transaction hash. */
async function send(
  rpcs: readonly string[],
  key: Uint8Array,
  to: string,
  data: string,
): Promise<string> {
  const from = addressOfKey(key);
  const [nonceHex, gasPriceHex] = await Promise.all([
    rpc(rpcs, "eth_getTransactionCount", [from, "pending"]),
    rpc(rpcs, "eth_gasPrice", []),
  ]);

  // Estimated rather than guessed, and estimating is also the cheapest way to
  // find out that the call would revert — which is how "the week is already
  // closed" is discovered without paying for it.
  const gasHex = await rpc(rpcs, "eth_estimateGas", [{ from, to, data }]);

  const raw = signTransaction(
    {
      nonce: BigInt(nonceHex),
      gasPrice: (BigInt(gasPriceHex) * 12n) / 10n,
      // A fifth over the estimate. An estimate that is exactly right fails on a
      // block where anything about the state moved.
      gasLimit: (BigInt(gasHex) * 12n) / 10n,
      to,
      value: 0n,
      data,
      chainId: CRONOS_CHAIN_ID,
    },
    key,
  );
  return rpc(rpcs, "eth_sendRawTransaction", [raw]);
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

  let paid: string | null = null;
  try {
    paid = await send(rpcs, key, pot, selector("claim(bytes32)") + label);
  } catch (error) {
    const said = error instanceof Error ? error.message : String(error);
    if (!/AlreadyPaid|already/i.test(said)) {
      return { week, winner: best.wallet, closed, paid: null, skipped: said };
    }
  }

  return { week, winner: best.wallet, closed, paid };
}
