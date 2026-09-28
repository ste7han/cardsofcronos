// Who holds $CROCARD, kept current, and the round that pays them.
//
// Half of every mint, royalty and ranked match is bought as $CROCARD and shared
// out among the people holding it. Doing that needs two things nobody was doing:
// a list of who holds it, and a transaction that opens a round.
//
// ── WHY THE LIST IS A TABLE AND NOT A SCAN ───────────────────────────────────
//
// An ERC20 has no list of its holders. The balances are a mapping, a mapping
// cannot be read without its keys, and the keys only exist in the Transfer log.
// Replaying that log from the token's first block is 37,822 eth_getLogs calls —
// ten minutes against a fast endpoint and hours against a slow one, because
// Cronos answers two thousand blocks at a time and a block is 0.42 seconds.
//
// That is a thing to do once, and scripts/holder-drop.ts does it. From then on
// this reads one day of blocks and applies the differences, which is a hundred
// calls. The table in D1 is a cache of the chain: every number in it is derived,
// losing it costs a rescan rather than a fact.
//
// ── WHO IS NOT PAID ──────────────────────────────────────────────────────────
//
// Anything with code on it. The EbisusBay CROCARD/WCRO pool holds 399 million —
// thirty-nine per cent of the supply — and it is not a holder, it is the
// liquidity. Paying it would send two fifths of every round to nobody, out of
// everybody else's share. A named list would miss the next pool, bridge or
// router, so the rule is code and the list is only what is known today.
//
// Unknown counts as not paid. An address nobody has asked about yet is left out
// of the round rather than included, because the failure that matters here is
// one-directional: leaving somebody out costs them one round and they are in the
// next, and paying a pool cannot be undone.
//
// ── WHAT A HOLDER SEES, AND WHY IT IS BUILT THIS WAY ─────────────────────────
//
// A number that goes up every day and one button. The tree says what somebody
// has earned IN TOTAL, ever; the contract remembers what they have already
// taken; a claim pays the difference. So publishing a bigger tree is the whole
// of "you earned more", and a holder who is not watching loses nothing.
//
// This replaced one tree per round with a separate claim for each. That was
// correct and nobody would have used it: a round a day meant ninety open rounds
// and ninety transactions inside the ninety-day window, so rounds had to be
// weekly to be bearable — and a reward that arrives on a schedule is a payday,
// not something that accrues.
//
// ── THE DAY IS SHARED, THE TREE IS EVERYONE ──────────────────────────────────
//
// Two different questions and they have different answers. What arrived today is
// shared between the people holding the token today. The tree contains everyone
// who has ever earned anything, whatever they hold now — somebody who sold keeps
// what they earned while they held it, and dropping them would both take back
// money they were told was theirs and make the cumulative total go down, which
// the contract refuses outright.
//
// ── WHY THE TREE IS NOT STORED ───────────────────────────────────────────────
//
// The leaves are. A tree is rebuilt from them when somebody asks for a proof,
// which is cheap for a few thousand leaves — and it means there is one source of
// truth rather than a blob that can quietly disagree with the rows it came from.

import { StandardMerkleTree } from "@openzeppelin/merkle-tree";

import { LOG_RPCS, PUBLIC_RPCS, rpc, send } from "@/lib/cronos";
import { hexToBytes, normalise } from "@/lib/address";
import { selector, word } from "@/lib/evm-tx";
import { CONTRACTS, CROCARD, NOT_A_HOLDER } from "@/lib/revenue";
import {
  addEntitlements,
  cursorOf,
  earners,
  liveTree,
  markAdopted,
  markContracts,
  moveBalances,
  payableHolders,
  pendingTree,
  recordTree,
  setCursor,
  treeLeaves,
  unknownHolders,
  type Database,
} from "@/lib/store";

/** The cursor's name in the table. */
export const HOLDER_CURSOR = "holders";

/** keccak of "Transfer(address,address,uint256)". */
const TRANSFER = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";

/** Cronos refuses a wider eth_getLogs than this. */
const CHUNK = 2000;

/**
 * The most chunks one run reads.
 *
 * A day is about 205,000 blocks — a hundred and three chunks. This is a day and
 * a half, which is enough to catch up after a run that failed and small enough
 * that a cursor far behind cannot turn one tick into an hour of requests.
 *
 * It is NOT enough to backfill from the token's first block, and deliberately
 * so: that is 37,822 chunks, it is a one-off, and a scheduled job quietly
 * grinding through it for eight months is worse than a script that takes ten
 * minutes. `runHolders` refuses to open a round while the cursor is unset.
 */
const MOST_CHUNKS = 150;

/**
 * How many unchecked addresses get an eth_getCode per run.
 *
 * Asked once per address and remembered. A busy day adds a few dozen new
 * addresses, so this clears the backlog and then does almost nothing.
 */
const CODE_CHECKS = 200;

/**
 * Entitlements below this stay out of the tree.
 *
 * NOT DROPPED — the holder keeps what they earned, in the table, and goes into
 * the tree the day it crosses this line. What this avoids is a leaf for somebody
 * whose whole entitlement is worth less than the gas to claim it, on a tree that
 * every holder's proof is rebuilt from.
 *
 * It is a threshold on the LIFETIME total rather than on a day's share, which is
 * the other thing the cumulative design fixes: under rounds, a small holder fell
 * under the dust line every single round and never accumulated past it.
 */
export const DUST = 10_000_000_000_000_000n; // 0.01 of a token

/**
 * The least that has to have arrived before a new tree is worth publishing.
 *
 * Below this the differences are noise and the transaction is gas spent on
 * nothing. What is not shared out today is still in the contract tomorrow, so
 * waiting costs nobody anything.
 */
export const LEAST_WORTH_SHARING = 1_000n * 10n ** 18n;

/**
 * How long a proposed tree waits before it can be adopted.
 *
 * Mirrors PUBLISH_DELAY in contracts/HolderDrop.sol, which is what actually
 * enforces it — this is only so the table can say when a tree is expected to go
 * live without asking the chain. test/holders.test.ts checks the two agree.
 */
export const PUBLISH_DELAY = 24 * 60 * 60 * 1000;

/** What a run did. */
export interface RanHolders {
  /** Blocks read for balances, or null when none were. */
  from: number | null;
  to: number | null;
  /** Addresses whose balance moved. */
  moved: number;
  /** Addresses asked about for code this run. */
  checked: number;
  /** The tree that went live this run, if one did. */
  adopted: string | null;
  /** The tree proposed this run, and what it promises in total. */
  proposed: string | null;
  promised: string | null;
  /** How many holders are in it. */
  holders: number;
  why?: string;
}

const topicToAddress = (topic: string) => normalise("0x" + topic.slice(26));

/**
 * What each holder earns from an amount that has just arrived.
 *
 * Their share of the token, at this moment, of what came in. Floored, so the
 * shares always add up to a little UNDER what arrived — the remainder stays
 * unpromised in the contract and goes into the next day, rather than being
 * handed to whoever happened to sort last.
 *
 * The denominator is what the PAYABLE holders hold between them and not the
 * supply. The pool holds thirty-nine per cent of this token and is not a holder;
 * dividing by the supply would quietly leave two fifths of every day unshared
 * forever.
 */
export function sharesOf(
  holders: readonly { address: string; balance: bigint }[],
  arrived: bigint,
): Map<string, bigint> {
  const between = holders.reduce((sum, holder) => sum + holder.balance, 0n);
  const shares = new Map<string, bigint>();
  if (between === 0n || arrived <= 0n) return shares;

  for (const holder of holders) {
    const share = (holder.balance * arrived) / between;
    if (share > 0n) shares.set(holder.address, share);
  }
  return shares;
}

/** The tree for a set of leaves. One place, so the builder and the prover agree. */
export function treeOf(
  leaves: readonly (readonly [string, string])[],
): StandardMerkleTree<[string, string]> {
  return StandardMerkleTree.of(
    leaves.map((leaf) => [...leaf] as [string, string]),
    ["address", "uint256"],
  );
}

/**
 * Sorted by address, so the same holders always give the same tree.
 *
 * That is what lets a proof be rebuilt from rows in a database instead of stored
 * as a blob beside them. A query that came back in a different order would give
 * a different root for the same facts.
 */
export function leavesOf(holders: readonly { address: string; entitlement: bigint }[]): [string, string][] {
  return holders
    .filter((holder) => holder.entitlement >= DUST)
    .sort((a, b) => (a.address < b.address ? -1 : a.address > b.address ? 1 : 0))
    .map((holder) => [holder.address, holder.entitlement.toString()] as [string, string]);
}

/**
 * Brings the holder table up to date, adopts yesterday's tree and proposes
 * today's.
 *
 * Returns what it did rather than throwing on the ordinary nothing-to-do cases,
 * for the same reason the rest of this cron does: a job that errors on "nobody
 * moved any yesterday" is a job whose alerts get muted.
 */
export async function runHolders(
  db: Database,
  secrets: { publisherKey?: string; rpc?: string },
  now: number,
): Promise<RanHolders> {
  const nothing: RanHolders = {
    from: null,
    to: null,
    moved: 0,
    checked: 0,
    adopted: null,
    proposed: null,
    promised: null,
    holders: 0,
  };

  const rpcs = secrets.rpc ? [secrets.rpc, ...PUBLIC_RPCS] : PUBLIC_RPCS;
  // Logs come from a shorter list, for the reason written at LOG_RPCS: an
  // endpoint that answers an empty array rather than the truth would move the
  // cursor past a day of transfers and the balances would be quietly wrong from
  // then on, with nothing anywhere saying which day it was.
  const logRpcs = secrets.rpc ? [secrets.rpc, ...LOG_RPCS] : LOG_RPCS;
  const seen = await cursorOf(db, HOLDER_CURSOR);

  // Never backfilled. Starting from the head here would give a table of whoever
  // happened to move some since — which looks like a holder list and is not one,
  // and a tree built on it would pay a handful of people everybody's share.
  if (seen === null) {
    return { ...nothing, why: "no holder snapshot yet — run scripts/holder-drop.ts once" };
  }

  const head = Number(BigInt(await rpc<string>(rpcs, "eth_blockNumber", [])));
  let from = seen + 1;
  let read = seen;
  let why: string | undefined;
  const deltas = new Map<string, bigint>();

  for (let chunk = 0; chunk < MOST_CHUNKS && from <= head; chunk++) {
    const to = Math.min(from + CHUNK - 1, head);
    let logs;
    try {
      logs = await rpc<{ topics: string[]; data: string }[]>(logRpcs, "eth_getLogs", [
        {
          address: CROCARD,
          topics: [TRANSFER],
          fromBlock: "0x" + from.toString(16),
          toBlock: "0x" + to.toString(16),
        },
      ]);
    } catch (error) {
      // Stop where it stopped. The cursor is saved at the last chunk actually
      // read, so the next run continues from here rather than past it.
      why = error instanceof Error ? error.message : String(error);
      break;
    }

    for (const log of logs) {
      // Transfer indexes from and to, so the amount is all that is in data.
      const value = BigInt(log.data);
      const sender = topicToAddress(log.topics[1]!);
      const recipient = topicToAddress(log.topics[2]!);
      deltas.set(sender, (deltas.get(sender) ?? 0n) - value);
      deltas.set(recipient, (deltas.get(recipient) ?? 0n) + value);
    }

    read = to;
    from = to + 1;
  }

  if (deltas.size > 0) await moveBalances(db, deltas, now);
  if (read > seen) await setCursor(db, HOLDER_CURSOR, read, now);

  // Whether an address has code, asked once and remembered. The named list is
  // settled without asking — the chain would say the same thing and this way a
  // deliberate exclusion cannot be undone by an endpoint having a bad day.
  const asking = await unknownHolders(db, CODE_CHECKS);
  const answers = new Map<string, boolean>();
  for (const address of asking) {
    if (NOT_A_HOLDER.includes(address) || Object.values(CONTRACTS).includes(address)) {
      answers.set(address, true);
      continue;
    }
    try {
      const code = await rpc<string>(rpcs, "eth_getCode", [address, "latest"]);
      answers.set(address, code !== "0x" && code !== "0x0");
    } catch {
      // Left unknown, which means left out of the share-out. It is asked again
      // next run; a holder waits a day rather than a pool being paid once.
    }
  }
  if (answers.size > 0) await markContracts(db, answers);

  const sofar: RanHolders = {
    ...nothing,
    from: read > seen ? seen + 1 : null,
    to: read > seen ? read : null,
    moved: deltas.size,
    checked: answers.size,
  };

  const tree = await keepTheTreeMoving(db, rpcs, secrets.publisherKey, now);
  const reasons = [why, tree.why].filter(Boolean).join("; ");
  return { ...sofar, ...tree, ...(reasons ? { why: reasons } : {}) };
}

/**
 * Adopts what has waited, then proposes what has accrued since.
 *
 * In that order and in one run, which is what makes the delay cost nothing: the
 * tree proposed yesterday goes live today, and today's goes live tomorrow. The
 * live tree is always a day behind, which is a day of accrual on a balance that
 * has been accruing for weeks.
 */
async function keepTheTreeMoving(
  db: Database,
  rpcs: readonly string[],
  publisherKey: string | undefined,
  now: number,
): Promise<{
  adopted: string | null;
  proposed: string | null;
  promised: string | null;
  holders: number;
  why?: string;
}> {
  const drop = CONTRACTS.drop;
  const none = { adopted: null, proposed: null, promised: null, holders: 0 };
  if (drop === null) return { ...none, why: "no drop contract yet" };
  if (!publisherKey) return { ...none, why: "no key to publish with" };

  const key = hexToBytes(publisherKey);
  const why: string[] = [];
  let adopted: string | null = null;

  // 1. Anything waiting that has waited long enough. Asked of the chain rather
  //    than of our own table: the owner can throw a pending root away, and a
  //    table that had not noticed would keep reporting it as on its way.
  const pendingAt = Number(
    BigInt(await rpc<string>(rpcs, "eth_call", [{ to: drop, data: selector("pendingAt()") }, "latest"])),
  );
  if (pendingAt === 0) {
    const waiting = await pendingTree(db);
    if (waiting !== null) {
      // The chain has no pending root and we think one is waiting. Either it was
      // adopted by somebody else or the owner dropped it; either way our row is
      // stale and saying so beats silently proposing on top of it.
      why.push(`tree ${waiting.id} is no longer pending on chain`);
    }
  } else if (now >= pendingAt * 1000) {
    // ── NOT ADOPTED UNTIL WE CAN PROVE IT ────────────────────────────────────
    //
    // Adopting makes the pending root the live one, and a claim is checked
    // against the live root. If the leaves behind it were never stored, adopting
    // takes claiming away from everybody — including the holders who could claim
    // against the root it replaces. That is the one move here that makes things
    // worse, and it is the one that used to happen without a word.
    //
    // A run on 28 September 2026 proposed and then ran out of subrequests before
    // storing the tree. Nothing said so; the next twenty runs reported a tree
    // quietly waiting. scripts/recover-tree.ts is what putting it back took, and
    // this is what stops the next one from ever being adopted unproved.
    const waiting = await pendingTree(db);
    if (waiting === null) {
      why.push(
        `the chain has a root pending since ${new Date(pendingAt * 1000).toISOString()} ` +
          `that this database has no leaves for, so no proof can be made for it. ` +
          `NOT adopted — adopting it would stop everybody claiming. ` +
          `Put it back with scripts/recover-tree.ts, or have the owner call dropPending().`,
      );
      return { ...none, adopted, why: why.join("; ") };
    }
    adopted = await send(rpcs, key, drop, selector("adopt()"));
    await markAdopted(db, waiting.id, now);
  } else {
    why.push(`a tree is waiting until ${new Date(pendingAt * 1000).toISOString()}`);
    if ((await pendingTree(db)) === null) {
      // Same hole, found a day earlier — while there is still time to fix it
      // before the delay runs out and the branch above has to refuse.
      why.push(
        `and this database has no leaves for it, so nobody will be able to claim ` +
          `against it. Put it back with scripts/recover-tree.ts before it goes live`,
      );
    }
    // Nothing else to do: the contract takes one pending root at a time.
    return { ...none, adopted, why: why.join("; ") };
  }

  // 2. What has arrived and is owed to nobody.
  //
  //    MEASURED AGAINST OUR OWN TABLE, not against the contract's `unpromised()`.
  //    Those are different numbers and the difference is what stopped this job
  //    dead for two days.
  //
  //    A holder under the dust line is written into the table and left out of
  //    the tree — deliberately, so a small balance accumulates across rounds
  //    instead of being rounded away every time. That means the table owes more
  //    than the chain has ever promised, by exactly the dust it is holding back.
  //    Sharing out `unpromised()` then builds a tree worth (what the chain
  //    promised + what arrived), while the leaves carry (what the TABLE owes +
  //    what arrived) — bigger by the dust, over what the contract can back, and
  //    refused. Every run, with the gap never closing.
  //
  //    Forty-two addresses and 0.032 $CROCARD did it, against a pot of thirteen
  //    million. The fix is to hand out what is left after what we already owe.
  const [paidSoFar, heldNow] = await Promise.all([
    rpc<string>(rpcs, "eth_call", [{ to: drop, data: selector("paidOut()") }, "latest"]),
    rpc<string>(rpcs, "eth_call", [
      { to: CROCARD, data: selector("balanceOf(address)") + word(drop) },
      "latest",
    ]),
  ]);
  const inTheContract = BigInt(paidSoFar) + BigInt(heldNow);
  const alreadyOwed = (await earners(db)).reduce((sum, one) => sum + one.entitlement, 0n);
  if (alreadyOwed > inTheContract) {
    // The table owes more than has ever reached the contract. Nothing can be
    // shared out on top of that, and saying "nothing arrived" would describe
    // the symptom — this is a table to look at rather than a quiet round.
    why.push(
      `the table says ${alreadyOwed} is owed and the contract has had ${inTheContract}. ` +
        `Nothing proposed; the table needs looking at rather than another run.`,
    );
    return { ...none, adopted, why: why.join("; ") };
  }
  const arrived = inTheContract - alreadyOwed;
  if (arrived < LEAST_WORTH_SHARING) {
    why.push(`only ${arrived} has arrived, which is not worth a tree`);
    return { ...none, adopted, why: why.join("; ") };
  }

  // 3. Share it between the people holding the token now.
  //
  //    FILTERED HERE AS WELL AS AT THE CODE CHECK, and that is the point rather
  //    than belt and braces. The named exclusions used to take effect only
  //    through `unknownHolders` — an address is asked whether it has code once,
  //    and the list short-circuits that question. So a wallet already answered
  //    for could be added to NOT_A_HOLDER and go on being paid, because nothing
  //    would ever ask about it again. That is exactly what happened when the
  //    team wallet was added: `is_contract` was already 0, the list changed, and
  //    the payout would not have.
  //
  //    is_contract still means what it says — whether there is code at the
  //    address — and the team wallet has none. Writing 1 into that column to
  //    make the payout come out right would be recording something untrue to
  //    get an effect, which is how a column stops meaning anything. The list is
  //    the rule; this is where it is applied.
  const holding = (await payableHolders(db)).filter(
    (holder) => !NOT_A_HOLDER.includes(holder.address),
  );
  if (holding.length === 0) {
    why.push("no payable holders in the table");
    return { ...none, adopted, why: why.join("; ") };
  }
  const shares = sharesOf(holding, arrived);

  // 4. And build the tree from everybody who has ever earned anything, which is
  //    a longer list: somebody who sold keeps what they earned while they held.
  //
  //    ADDED UP IN MEMORY, NOT WRITTEN YET. This used to store the new shares
  //    first and propose afterwards, and the two came apart the night the mint
  //    opened: the propose failed, the shares stayed, and the next run added
  //    another round of them on top. Six runs later the table promised
  //    1,149,115 $CROCARD against 206,205 actually sitting in the contract, and
  //    `propose` refused every one of them — correctly, and for a reason that
  //    looked nothing like its cause.
  //
  //    So nothing is written until the chain has accepted it. What the table
  //    holds is then always something the contract has agreed to.
  const owed = new Map<string, bigint>();
  for (const earner of await earners(db)) owed.set(earner.address, earner.entitlement);
  for (const [address, amount] of shares) {
    owed.set(address, (owed.get(address) ?? 0n) + amount);
  }

  const leaves = leavesOf(
    [...owed].map(([address, entitlement]) => ({ address, entitlement })),
  );
  if (leaves.length === 0) {
    why.push("nobody is over the dust line yet");
    return { ...none, adopted, why: why.join("; ") };
  }

  const promised = leaves.reduce((sum, [, amount]) => sum + BigInt(amount), 0n);
  const tree = treeOf(leaves);
  // Checked here as well as on chain. The contract refuses a promise bigger
  // than its balance, and finding that out through a reverted transaction costs
  // gas and tells you "execution reverted" and nothing else.
  //
  // `available` is what the contract itself compares against: everything it has
  // ever paid out, plus what it is holding now.
  const [paidOut, held] = await Promise.all([
    rpc<string>(rpcs, "eth_call", [{ to: drop, data: selector("paidOut()") }, "latest"]),
    rpc<string>(rpcs, "eth_call", [
      { to: CROCARD, data: selector("balanceOf(address)") + word(drop) },
      "latest",
    ]),
  ]);
  const available = BigInt(paidOut) + BigInt(held);
  if (promised > available) {
    why.push(
      `the table says ${promised} is owed and the contract holds ${available}. ` +
        `Nothing proposed; the table needs looking at rather than another run.`,
    );
    return { ...none, adopted, why: why.join("; ") };
  }

  const proposed = await send(
    rpcs,
    key,
    drop,
    selector("propose(bytes32,uint256)") + word(tree.root) + word(promised),
  );

  // Now, and not a line earlier. The chain has accepted the promise, so the
  // table may hold what it promised — that is the whole of the ordering this
  // function exists to get right.
  //
  // ── AND THE TREE BEFORE THE ENTITLEMENTS ─────────────────────────────────
  //
  // These used to be the other way round, which put the cheap loss second. If
  // the run dies between them:
  //
  //   tree first  — the leaves are stored, so every holder can still be given
  //                 a proof. What is wrong is the split of the NEXT round, by
  //                 whatever did not get written. Money, but recoverable, and
  //                 the arithmetic in this function notices on its own.
  //   tree second — the chain holds a root nothing can make proofs for. When it
  //                 is adopted it replaces the live root, so nobody can claim,
  //                 including everyone who could before.
  //
  // It died there on 28 September 2026 and it was the second one.
  const liveAt = now + PUBLISH_DELAY;
  await recordTree(
    db,
    { root: tree.root, promised, proposedAt: now, liveAt, txHash: proposed },
    leaves.map(([address, amount]) => [address, BigInt(amount)] as const),
  );
  await addEntitlements(db, shares, now);

  return {
    adopted,
    proposed,
    promised: promised.toString(),
    holders: leaves.length,
    ...(why.length > 0 ? { why: why.join("; ") } : {}),
  };
}

/** What a holder can take right now, and the proof for it. */
export interface Owed {
  /** Everything they have earned, as the live tree says it. */
  earned: string;
  /** What they have already taken, as the contract says it. */
  taken: string;
  /** The difference, which is what a claim would pay. */
  claimable: string;
  proof: string[];
  root: string;
}

/**
 * What one wallet can claim, against the tree that is live on chain.
 *
 * Here rather than in a route because two of them ask: the profile wants the
 * number and the claim button wants the proof, and two copies of "what is this
 * wallet owed" is two answers that can disagree about somebody's money.
 *
 * `taken` is asked of the chain and not of a table. It is the one number here
 * that changes without this project doing anything — a holder claims from a
 * wallet, whenever they like — and a cached copy of it would show somebody money
 * they have already had.
 */
/** A tree that has been proposed and is serving out its day of notice. */
export interface Coming {
  /** What this wallet would be owed in total once it goes live, in base units. */
  earned: string;
  /** What the whole tree promises, so a share is a share of something. */
  promised: string;
  /** How many holders are in it. */
  holders: number;
  /** When the contract will let it be adopted. */
  liveAt: number;
}

/**
 * What is queued for this wallet, before it can be claimed.
 *
 * The claim button read only the live tree, so during the contract's day of
 * notice it said "nothing earned yet" to a holder with half a million $CROCARD
 * waiting and a timestamp attached. That is the shape of silence this project
 * keeps writing down: not a failure, just a screen that knows something and
 * does not say it, and the holder concluding the payout does not work.
 *
 * Deliberately no proof. Nothing can be claimed against a root the contract has
 * not adopted, and handing out a proof that reverts would be worse than saying
 * nothing at all.
 */
export async function comingTo(db: Database, wallet: string): Promise<Coming | null> {
  const pending = await pendingTree(db);
  if (pending === null) return null;

  const leaves = await treeLeaves(db, pending.id);
  const mine = leaves.find(([address]) => address === wallet);
  if (mine === undefined) return null;

  return {
    earned: mine[1],
    // A string, like every other amount that crosses to a browser: JSON has no
    // bigint, and JSON.stringify throws on one rather than rounding it.
    promised: pending.promised.toString(),
    holders: pending.holders,
    liveAt: pending.liveAt,
  };
}

export async function owedTo(
  db: Database,
  wallet: string,
  takenBy: (wallet: string) => Promise<bigint | null>,
): Promise<Owed | null> {
  const live = await liveTree(db);
  if (live === null) return null;

  const leaves = await treeLeaves(db, live.id);
  const mine = leaves.find(([address]) => address === wallet);
  if (mine === undefined) return null;

  const tree = treeOf(leaves);
  // Matched on what the leaf contains rather than on its index. The rows come
  // back in the order the tree was built from, but a proof handed out against
  // the wrong leaf is a claim that reverts with BadProof and tells the holder
  // nothing about why.
  let proof: string[] | null = null;
  for (const [i, leaf] of tree.entries()) {
    if (leaf[0] === mine[0] && leaf[1] === mine[1]) {
      proof = tree.getProof(i);
      break;
    }
  }
  if (proof === null) return null;

  const had = await takenBy(wallet);
  // Unknown is treated as "everything is already taken". An endpoint that would
  // not answer must not put a number on the page that the chain is going to
  // refuse: the holder cannot tell those two apart, and only one is worth gas.
  const taken = had ?? BigInt(mine[1]);
  const earned = BigInt(mine[1]);

  return {
    earned: earned.toString(),
    taken: taken.toString(),
    claimable: (earned > taken ? earned - taken : 0n).toString(),
    proof,
    root: live.root,
  };
}

/** What a wallet has taken from the drop, asked of the chain. Null if unreadable. */
export function takenOnChain(rpcs: readonly string[]) {
  return async (wallet: string): Promise<bigint | null> => {
    const drop = CONTRACTS.drop;
    if (drop === null) return null;
    try {
      return BigInt(
        await rpc<string>(rpcs, "eth_call", [
          { to: drop, data: selector("taken(address)") + word(wallet) },
          "latest",
        ]),
      );
    } catch {
      return null;
    }
  };
}
