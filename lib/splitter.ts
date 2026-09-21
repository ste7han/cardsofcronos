// The daily tick: push the splitter, then write down what it burned.
//
// Two jobs that look unrelated and are the same job. `contracts/Splitter.sol`
// holds whatever has been paid in until somebody calls `release()`, which swaps
// it for $CROCARD and divides the tokens three ways. Nobody was calling it. And
// `/burn` promises a total anybody can check, built out of transactions — and
// nothing had ever written a row into the burns table, so it would have read
// zero forever with real burns behind it.
//
// One run does both: release what is there, then read the log back and record
// every release it finds, ours or anybody's.
//
// ── IT NEEDS NO PERMISSION ───────────────────────────────────────────────────
//
// `release()` takes no arguments and has no owner check. The splitter has one
// thing it can do and three addresses it was built with, so calling it is not
// authority — it is paying the gas for a swap that was going to happen anyway.
// The key here is the same publisher key the weekly job uses, and this does not
// widen what that key can do: anybody with a funded wallet could call it.
//
// ── IT IS SAFE TO RUN TWICE ──────────────────────────────────────────────────
//
// Releasing an empty splitter reverts, and that is checked for first so it is
// not even attempted. Recording a burn is keyed on the transaction hash and does
// nothing on conflict, so a chunk read twice writes no second row. The cursor is
// the job's memory, not its truth: delete it and the next run rescans and writes
// nothing new.
//
// ── WHY IT READS THE LOG AND NOT ITS OWN RECEIPT ─────────────────────────────
//
// Reading the receipt of the transaction this job just sent would be simpler and
// would miss every release somebody else triggered — and a burn counter that
// only counts the burns we caused is a burn counter that under-reports for a
// reason nobody can see. The log is the whole truth about the contract and this
// reads that.

import { LOG_RPCS, PUBLIC_RPCS, rpc, send } from "@/lib/cronos";
import { hexToBytes } from "@/lib/address";
import { addressOfKey, selector, topicOf } from "@/lib/evm-tx";
import { CONTRACTS } from "@/lib/revenue";
import { cursorOf, recordBurn, setCursor, type Database } from "@/lib/store";

/** The cursor's name in the table. One job, one row. */
export const BURN_CURSOR = "burns";

/**
 * `event Released(uint256 croSpent, uint256 toHolders, uint256 burned, uint256 toPot)`.
 *
 * Four unindexed words, so the whole of it is in `data` and none of it is in the
 * topics. Types only in the signature — a parameter name in here hashes to a
 * topic that matches nothing, and an empty scan looks exactly like a quiet week.
 */
const RELEASED = topicOf("Released(uint256,uint256,uint256,uint256)");

/**
 * How much has to be sitting there before it is worth a swap.
 *
 * A mint is fifteen CRO at the least, so this is not a delay anybody notices.
 * What it prevents is the job paying gas every day to swap the dust a rounding
 * left behind, and taking the slippage on a trade too small to matter.
 */
export const LEAST_WORTH_RELEASING = 10n * 10n ** 18n;

/**
 * The most blocks one `eth_getLogs` may span.
 *
 * Cronos' public endpoints refuse a wider range, and a refusal here reads as an
 * endpoint being down — so the chunk is the limit rather than something to
 * discover. Blocks are 0.42 seconds, which makes a chunk about fourteen minutes.
 */
const CHUNK = 2000;

/**
 * The most chunks one run will read.
 *
 * A day is roughly 205,000 blocks — a hundred and three chunks — so this is a
 * day and a half. Enough to catch up after a run that failed, and bounded so a
 * cursor that somehow ends up far behind cannot turn one tick into an hour of
 * requests against an endpoint that will start refusing them.
 *
 * Falling behind is not a loss. The cursor stays where the run stopped and the
 * next one continues from there.
 */
const MOST_CHUNKS = 150;

/** What a run did, in enough detail to read in a log a month later. */
export interface RanDaily {
  /** The transaction that emptied the collection into the splitter, or null. */
  swept: string | null;
  /** Why nothing was swept. "The collection holds nothing" is the usual answer. */
  sweptWhy?: string;
  /** The transaction that released, or null when there was nothing to release. */
  released: string | null;
  /** CRO spent by that release, in wei, once it has been read back out of the log. */
  spent: string | null;
  /** Burns written. Zero is the ordinary answer on a day nobody minted. */
  recorded: number;
  /** The blocks this run read, or null when it read none. */
  from: number | null;
  to: number | null;
  /**
   * Which wallet the key in the environment belongs to, or null when there is no
   * usable key.
   *
   * An address and never the key — it is derived from it, and it is public the
   * moment anything is signed with it. It is here because the failure it catches
   * is silent: a key that is perfectly valid but belongs to the wrong wallet
   * signs perfectly good transactions that the contracts refuse with
   * NotThePublisher, once a day, in a log nobody reads. Seeing the address in the
   * run's own answer turns that into something checkable in one look.
   */
  signer: string | null;
  /**
   * Why nothing happened, when nothing did. Every reason, not the first one.
   *
   * The two halves of this job skip for their own reasons and both are worth
   * reading: "nothing to release" on a run that also discovered it had never
   * scanned before is two facts, and a field that holds one of them reports
   * whichever half happened to run first. That is how a job looks fine in a log
   * for a month.
   */
  skipped?: string;
}

/** One `Released`, as the log gives it. */
interface Released {
  txHash: string;
  block: number;
  croSpent: bigint;
  burned: bigint;
}

/** A word of ABI data at index `n`, as a bigint. */
function wordAt(data: string, n: number): bigint {
  const hex = data.replace(/^0x/, "");
  const at = hex.slice(n * 64, (n + 1) * 64);
  if (at.length !== 64) throw new Error(`A Released log is four words, not ${hex.length / 64}.`);
  return BigInt("0x" + at);
}

/**
 * Releases what is waiting, if it is worth releasing.
 *
 * Returns the transaction hash, or null with the reason. The reason is not an
 * error: "nothing to release" is what most days look like.
 */
async function releaseNow(
  rpcs: readonly string[],
  splitter: string,
  publisherKey: string | undefined,
): Promise<{ tx: string | null; why?: string }> {
  // Asked before it is attempted, so an empty splitter costs one eth_call rather
  // than a failed estimate and a line in the log that reads like a fault.
  const waiting = BigInt(
    await rpc<string>(rpcs, "eth_call", [
      { to: splitter, data: selector("nextRelease()") },
      "latest",
    ]),
  );
  if (waiting === 0n) return { tx: null, why: "nothing to release" };
  if (waiting < LEAST_WORTH_RELEASING) {
    return { tx: null, why: `only ${waiting} wei waiting, which is not worth a swap` };
  }
  if (!publisherKey) return { tx: null, why: "no key to send with" };
  if (signerOf(publisherKey) === null) {
    // Set but unusable. Silence here would look exactly like a quiet day.
    return { tx: null, why: "PUBLISHER_KEY is set but is not a usable private key" };
  }

  return { tx: await send(rpcs, hexToBytes(publisherKey), splitter, selector("release()")) };
}

/**
 * Empties the collection into the splitter.
 *
 * A mint pays the collection, not the splitter: `buy()` keeps the CRO and
 * `release()` on the collection forwards it. Nothing called that until it was
 * noticed the hard way — 150 CRO from the first ten cards sat in the collection
 * while the burn page showed nothing happening, because the daily job knew
 * about the splitter and not about the thing that pays it.
 *
 * Permissionless, like the splitter's own: `release()` on the collection takes
 * no arguments and has no owner check, so this is paying the gas rather than
 * making a decision. It still needs a key to sign with, which is the publisher's
 * — the only key on a server, and one that cannot reach the money either way.
 *
 * Returns the hash or the reason there is none. "Nothing to release" is what
 * most days look like.
 */
async function sweepCollection(
  rpcs: readonly string[],
  publisherKey: string | undefined,
): Promise<{ tx: string | null; why?: string }> {
  const nft = CONTRACTS.nft;
  if (nft === null) return { tx: null, why: "no collection yet" };

  // Asked before it is attempted: `release()` reverts on an empty contract, and
  // a failed estimate reads like a fault rather than like a quiet day.
  const waiting = BigInt(await rpc<string>(rpcs, "eth_getBalance", [nft, "latest"]));
  if (waiting === 0n) return { tx: null, why: "the collection holds nothing" };
  if (!publisherKey) return { tx: null, why: "no key to send with" };
  if (signerOf(publisherKey) === null) {
    return { tx: null, why: "PUBLISHER_KEY is set but is not a usable private key" };
  }

  return { tx: await send(rpcs, hexToBytes(publisherKey), nft, selector("release()")) };
}

/**
 * Reads the splitter's log and writes down every burn it finds.
 *
 * Lifted out of the daily job in September 2026, when the burn page grew a
 * button anybody can press. A release used to happen only on a schedule, so
 * recording it on the same schedule was the same thing; the moment a stranger
 * could set one going, a burn could be hours old before the page that exists to
 * show burns had heard of it. Somebody pressed the button, watched the money
 * leave, and saw nothing appear.
 *
 * So the minute job calls it too. Both callers share one cursor and
 * `recordBurn` keys on the transaction hash, so two runs overlapping costs a
 * repeated read and writes nothing twice.
 *
 * It never throws. A scan that could not finish stops at the last chunk it
 * actually read and says so — the cursor does not move past a range nobody
 * looked at, which is the only property here that matters.
 */
export async function recordBurns(
  db: Database,
  secrets: { rpc?: string },
  now: number,
): Promise<{
  recorded: number;
  from: number | null;
  to: number | null;
  /** What each release transaction spent, for a caller that just sent one. */
  spentBy: Record<string, string>;
  why?: string;
}> {
  const splitter = CONTRACTS.splitter;
  const nothing = { recorded: 0, from: null, to: null, spentBy: {} };
  if (splitter === null) return { ...nothing, why: "no splitter contract yet" };

  const rpcs = secrets.rpc ? [secrets.rpc, ...PUBLIC_RPCS] : PUBLIC_RPCS;
  const logRpcs = secrets.rpc ? [secrets.rpc, ...LOG_RPCS] : LOG_RPCS;

  let why: string | undefined;
  let head: number;
  try {
    head = Number(BigInt(await rpc<string>(rpcs, "eth_blockNumber", [])));
  } catch (error) {
    return { ...nothing, why: error instanceof Error ? error.message : "the head was unreadable" };
  }

  const seen = await cursorOf(db, BURN_CURSOR);

  // Never run: start at the head rather than at the beginning. Reading the whole
  // chain finds nothing — the splitter is younger than almost all of it — and
  // costs a day of being rate-limited to find that out.
  if (seen === null) {
    await setCursor(db, BURN_CURSOR, head, now);
    return { ...nothing, why: `first run, starting at block ${head}` };
  }

  let from = seen + 1;
  let recorded = 0;
  let read = from - 1;
  const spentBy: Record<string, string> = {};

  for (let chunk = 0; chunk < MOST_CHUNKS && from <= head; chunk++) {
    const to = Math.min(from + CHUNK - 1, head);
    let found: Released[];
    try {
      found = await releasedBetween(logRpcs, splitter, from, to);
    } catch (error) {
      // Stop where it stopped. The cursor is saved below at the last chunk that
      // was actually read, so the next run starts here rather than past it.
      why = error instanceof Error ? error.message : String(error);
      break;
    }

    for (const one of found) {
      // The splitter does not know which stream paid it. Mints, royalties and a
      // match's cut all arrive as CRO in the same balance and leave in the same
      // swap, so "splitter" is the honest answer and naming one of the three
      // would be a guess printed as a fact.
      const written = await recordBurn(db, {
        txHash: one.txHash,
        stream: "splitter",
        wei: one.croSpent.toString(),
        burned: one.burned.toString(),
        at: await minedAt(rpcs, one.block),
      });
      if (written) recorded++;
      spentBy[one.txHash] = one.croSpent.toString();
    }

    read = to;
    from = to + 1;
  }

  if (read > seen) await setCursor(db, BURN_CURSOR, read, now);

  return {
    recorded,
    from: read > seen ? seen + 1 : null,
    to: read > seen ? read : null,
    spentBy,
    ...(why ? { why } : {}),
  };
}

/**
 * Waits for a transaction to be in a block, briefly.
 *
 * Only so that the scan below covers it on this run instead of tomorrow's.
 * Failing to see it is not a failure: the cursor does not move past a block that
 * was not read, so the next run finds it.
 */
async function settled(rpcs: readonly string[], tx: string): Promise<boolean> {
  for (let tries = 0; tries < 8; tries++) {
    try {
      const receipt = await rpc<{ blockNumber?: string } | null>(
        rpcs,
        "eth_getTransactionReceipt",
        [tx],
      );
      if (receipt !== null && typeof receipt === "object") return true;
    } catch {
      // An endpoint that has not seen it yet is not an error to report.
    }
    await new Promise((wake) => setTimeout(wake, 1500));
  }
  return false;
}

/** Every `Released` the splitter logged between two blocks, inclusive. */
async function releasedBetween(
  rpcs: readonly string[],
  splitter: string,
  from: number,
  to: number,
): Promise<Released[]> {
  const logs = await rpc<{ transactionHash: string; blockNumber: string; data: string }[]>(
    rpcs,
    "eth_getLogs",
    [
      {
        address: splitter,
        topics: [RELEASED],
        fromBlock: "0x" + from.toString(16),
        toBlock: "0x" + to.toString(16),
      },
    ],
  );

  return logs.map((log) => ({
    txHash: log.transactionHash.toLowerCase(),
    block: Number(BigInt(log.blockNumber)),
    croSpent: wordAt(log.data, 0),
    burned: wordAt(log.data, 2),
  }));
}

/**
 * When a block was mined, in milliseconds.
 *
 * One call per block that actually had a release in it, which is a handful a
 * month — not per block scanned. The alternative is stamping every burn with
 * the moment the job ran, and a catch-up scan would then date a week of burns
 * to the same afternoon.
 */
async function minedAt(rpcs: readonly string[], block: number): Promise<number> {
  const head = await rpc<{ timestamp: string } | null>(rpcs, "eth_getBlockByNumber", [
    "0x" + block.toString(16),
    false,
  ]);
  if (head === null) throw new Error(`Block ${block} could not be read.`);
  return Number(BigInt(head.timestamp)) * 1000;
}

/**
 * Releases what is waiting and records every release the chain knows about.
 *
 * Returns what it did rather than throwing on the ordinary nothing-to-do cases,
 * for the same reason lib/publisher.ts does: a scheduled job that errors on "no
 * mints yesterday" is a scheduled job whose alerts get muted, and a muted alert
 * is worse than no alert.
 */
export async function runDaily(
  db: Database,
  secrets: { publisherKey?: string; rpc?: string },
  now: number,
): Promise<RanDaily> {
  const splitter = CONTRACTS.splitter;
  const signer = signerOf(secrets.publisherKey);
  const nothing: RanDaily = {
    swept: null,
    released: null,
    spent: null,
    recorded: 0,
    from: null,
    to: null,
    signer,
  };
  if (splitter === null) return { ...nothing, skipped: "no splitter contract yet" };

  const rpcs = secrets.rpc ? [secrets.rpc, ...PUBLIC_RPCS] : PUBLIC_RPCS;
  // Logs come from a shorter list. An endpoint that answers eth_getLogs with an
  // empty array instead of the truth would move the cursor past a day of burns
  // that then never come back — see LOG_RPCS.
  const logRpcs = secrets.rpc ? [secrets.rpc, ...LOG_RPCS] : LOG_RPCS;

  // The collection first, so what a mint paid is in the splitter before the
  // splitter is asked what it holds. The other order is a release that misses
  // today's mints and catches them tomorrow, every day, forever.
  let swept: string | null = null;
  let sweptWhy: string | undefined;
  try {
    const out = await sweepCollection(rpcs, secrets.publisherKey);
    swept = out.tx;
    sweptWhy = out.why;
    if (swept !== null) await settled(rpcs, swept);
  } catch (error) {
    // Reported, not thrown. A sweep that failed leaves the money where it is
    // and the splitter may still have something of its own to release.
    sweptWhy = error instanceof Error ? error.message : String(error);
  }

  let released: string | null = null;
  let why: string | undefined;
  try {
    const went = await releaseNow(rpcs, splitter, secrets.publisherKey);
    released = went.tx;
    why = went.why;
    if (released !== null) await settled(rpcs, released);
  } catch (error) {
    // Reported and not thrown, because the scan below is worth doing either way:
    // a release that failed does not stop yesterday's from being recorded.
    why = error instanceof Error ? error.message : String(error);
  }

  // The log scan, which is worth doing whether or not the release above worked
  // — and which anybody can now create work for from the burn page, so it also
  // runs on the minute job. See recordBurns.
  const scan = await recordBurns(db, { rpc: secrets.rpc }, now);
  if (scan.why) why = also(why, scan.why);

  return {
    swept,
    released,
    // What that release actually spent, once the log for it has been read.
    spent: released === null ? null : (scan.spentBy[released] ?? null),
    recorded: scan.recorded,
    signer,
    from: scan.from,
    to: scan.to,
    ...(sweptWhy ? { sweptWhy } : {}),
    ...(why ? { skipped: why } : {}),
  };
}

/**
 * The address a key belongs to, or null when there is no usable key.
 *
 * Null covers a key that is missing and a key that is not a key — a truncated
 * paste, a stray quote, an empty secret that every listing shows as set. Both
 * are worth reporting as "no signer" rather than as a crash in a scheduled job,
 * and which of the two it was is in the reasons.
 */
function signerOf(key: string | undefined): string | null {
  if (!key) return null;
  try {
    return addressOfKey(hexToBytes(key));
  } catch {
    return null;
  }
}

/** Both reasons, when there are two. */
function also(first: string | undefined, second: string): string {
  return first === undefined ? second : `${first}; ${second}`;
}
