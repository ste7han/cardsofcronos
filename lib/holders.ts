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
// ── WHY THE TREE IS NOT STORED ───────────────────────────────────────────────
//
// The rows are. A tree is rebuilt from them when somebody asks for a proof,
// which is cheap for a few thousand leaves — and it means there is one source of
// truth rather than a blob that can quietly disagree with the rows it came from.

import { StandardMerkleTree } from "@openzeppelin/merkle-tree";

import { PUBLIC_RPCS, rpc, send } from "@/lib/cronos";
import { hexToBytes, normalise } from "@/lib/address";
import { selector, word } from "@/lib/evm-tx";
import { CONTRACTS, CROCARD, NOT_A_HOLDER } from "@/lib/revenue";
import {
  cursorOf,
  dropRounds,
  markContracts,
  moveBalances,
  payableHolders,
  recordRound,
  roundEntries,
  setCursor,
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
 * Shares below this are left out of the tree.
 *
 * A claim costs gas — about 0.034 CRO at the gas price this was written at — and
 * below some amount the transaction costs more than it moves. Putting those
 * holders in hands them a share they would lose money taking. What is left out
 * stays in the contract and is shared again next round, by which time it may be
 * worth taking.
 */
export const DUST = 10_000_000_000_000_000n; // 0.01 of a token

/**
 * The least a round may share out.
 *
 * Below this every share is dust, the tree comes out empty and the transaction
 * is gas spent on nothing. What is not shared today is still in the contract
 * tomorrow, so waiting costs nobody anything.
 */
export const LEAST_WORTH_SHARING = 1_000n * 10n ** 18n;

/**
 * How long between rounds.
 *
 * A WEEK AND NOT A DAY, and that is about the holder rather than about gas. Each
 * round is claimed separately — the contract keeps `claimed[round][holder]` — so
 * a round a day would mean a holder facing ninety open rounds inside the ninety
 * day claim window and ninety transactions to collect what they are owed. Nobody
 * does that, and the shares would expire unclaimed.
 *
 * Weekly gives thirteen inside the window and matches the rhythm the rest of the
 * game already has. The job still runs daily; it just has nothing to do on six
 * of the seven days, and the CRO it is not sharing out is not going anywhere.
 */
export const BETWEEN_ROUNDS = 7 * 86_400_000;

/** What a run did. */
export interface RanHolders {
  /** Blocks read for balances, or null when none were. */
  from: number | null;
  to: number | null;
  /** Addresses whose balance moved. */
  moved: number;
  /** Addresses asked about for code this run. */
  checked: number;
  /** The round opened, or null when none was. */
  round: number | null;
  tx: string | null;
  /** How many holders it promised something to. */
  paid: number;
  why?: string;
}

const topicToAddress = (topic: string) => normalise("0x" + topic.slice(26));

/**
 * A round number that cannot collide and reads as a date: 20260918.
 *
 * The contract refuses a round that is already open, so this is also what stops
 * two runs on the same day from opening two rounds — without a counter, and
 * without this file having an opinion about what the last round was.
 */
export function roundFor(now: number): number {
  const day = new Date(now);
  return (
    day.getUTCFullYear() * 10_000 + (day.getUTCMonth() + 1) * 100 + day.getUTCDate()
  );
}

/**
 * Shares of `total`, floored, in the order the tree is built from.
 *
 * Floored so the tree always promises a little UNDER the round rather than over:
 * the contract refuses a claim that would take more than the round holds, and a
 * tree that promised more would pay the first holders and fail the last. The few
 * wei left over stay in the contract and go into a later round.
 *
 * Sorted by address so the tree is the same tree for the same input, which is
 * what makes a proof rebuildable from the rows rather than from a stored blob.
 */
export function sharesOf(
  holders: readonly { address: string; balance: bigint }[],
  total: bigint,
): [string, string][] {
  const supply = holders.reduce((sum, holder) => sum + holder.balance, 0n);
  if (supply === 0n) return [];

  return [...holders]
    .sort((a, b) => (a.address < b.address ? -1 : a.address > b.address ? 1 : 0))
    .map(
      (holder) => [holder.address, ((holder.balance * total) / supply).toString()] as [string, string],
    )
    .filter(([, share]) => BigInt(share) >= DUST);
}

/** The tree for a set of shares. One place, so the builder and the prover agree. */
export function treeOf(shares: readonly (readonly [string, string])[]): StandardMerkleTree<[string, string]> {
  return StandardMerkleTree.of(
    shares.map((share) => [...share] as [string, string]),
    ["address", "uint256"],
  );
}

/**
 * Brings the holder table up to date and opens a round if there is one to open.
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
    round: null,
    tx: null,
    paid: 0,
  };

  const rpcs = secrets.rpc ? [secrets.rpc, ...PUBLIC_RPCS] : PUBLIC_RPCS;
  const seen = await cursorOf(db, HOLDER_CURSOR);

  // Never backfilled. Starting from the head here would give a table of whoever
  // happened to move some since — which looks like a holder list and is not one,
  // and a round built on it would pay a handful of people everybody's share.
  if (seen === null) {
    return {
      ...nothing,
      why: "no holder snapshot yet — run scripts/holder-drop.ts once",
    };
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
      logs = await rpc<{ topics: string[]; data: string }[]>(rpcs, "eth_getLogs", [
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
      // Left unknown, which means left out of the round. It is asked again next
      // run; a holder waits one round rather than a pool being paid once.
    }
  }
  if (answers.size > 0) await markContracts(db, answers);

  const so_far: RanHolders = {
    ...nothing,
    from: read > seen ? seen + 1 : null,
    to: read > seen ? read : null,
    moved: deltas.size,
    checked: answers.size,
    ...(why ? { why } : {}),
  };

  const opened = await openRound(db, rpcs, secrets.publisherKey, now);
  return { ...so_far, ...opened, why: [why, opened.why].filter(Boolean).join("; ") || undefined };
}

/** Opens a round for whatever the drop is holding and nobody is owed yet. */
async function openRound(
  db: Database,
  rpcs: readonly string[],
  publisherKey: string | undefined,
  now: number,
): Promise<{ round: number | null; tx: string | null; paid: number; why?: string }> {
  const drop = CONTRACTS.drop;
  const none = { round: null, tx: null, paid: 0 };
  if (drop === null) return { ...none, why: "no drop contract yet" };
  if (!publisherKey) return { ...none, why: "no key to open a round with" };

  // Asked of our own table rather than the chain. The contract refuses a round
  // number that is already open, which stops a duplicate, but it has no opinion
  // about how often — that is this file's decision and this is where it lives.
  const [newest] = await dropRounds(db, 1);
  if (newest !== undefined && now - newest.openedAt < BETWEEN_ROUNDS) {
    const days = Math.ceil((BETWEEN_ROUNDS - (now - newest.openedAt)) / 86_400_000);
    return { ...none, why: `round ${newest.round} was opened less than a week ago; ${days}d to go` };
  }

  // What the contract would allocate. Read rather than assumed, and read as late
  // as possible: anything that lands between this and the transaction is
  // allocated to the round without being in the tree, and comes back through
  // sweep() when the round expires rather than being paid twice.
  const free = BigInt(
    await rpc<string>(rpcs, "eth_call", [
      { to: drop, data: selector("unallocated()") },
      "latest",
    ]),
  );
  if (free < LEAST_WORTH_SHARING) {
    return { ...none, why: `only ${free} to share, which is not worth a round` };
  }

  const holders = await payableHolders(db);
  if (holders.length === 0) return { ...none, why: "no payable holders in the table" };

  const shares = sharesOf(holders, free);
  if (shares.length === 0) return { ...none, why: "every share would be dust" };

  const round = roundFor(now);
  const tree = treeOf(shares);

  const tx = await send(
    rpcs,
    hexToBytes(publisherKey),
    drop,
    selector("openRound(uint256,bytes32)") + word(BigInt(round)) + word(tree.root),
  );

  const promised = shares.reduce((sum, [, share]) => sum + BigInt(share), 0n);
  await recordRound(
    db,
    { round, root: tree.root, promised, holders: shares.length, txHash: tx, openedAt: now },
    shares.map(([address, share]) => [address, BigInt(share)] as const),
  );

  return { round, tx, paid: shares.length };
}

/** One round's share, with what is needed to take it. */
export interface Owed {
  round: number;
  /** Base units, as a decimal string. */
  amount: string;
  proof: string[];
  root: string;
  openedAt: number;
}

/**
 * How many rounds back to look for what a wallet is owed.
 *
 * A round a week and a claim window of ninety days means thirteen can be open at
 * once. Twenty is room for the window to be lengthened without this quietly
 * dropping the oldest — which would look, to the holder it happened to, exactly
 * like a share that was never theirs.
 */
const LOOK_BACK = 20;

/**
 * What a wallet can still take, round by round, with the proof for each.
 *
 * Here rather than in a route because two of them ask: the profile wants the
 * total and the claim page wants the proofs, and two copies of "which rounds
 * does this wallet still have something in" is two answers that can disagree
 * about somebody's money.
 *
 * The tree is rebuilt from the rows rather than stored. That is cheap for a few
 * thousand leaves and means a proof cannot disagree with the entry it came from.
 */
export async function owedTo(
  db: Database,
  wallet: string,
  claimed: (round: number, wallet: string) => Promise<boolean>,
): Promise<Owed[]> {
  const rounds = await dropRounds(db, LOOK_BACK);
  const owed: Owed[] = [];

  for (const round of rounds) {
    const entries = await roundEntries(db, round.round);
    const mine = entries.find(([address]) => address === wallet);
    if (mine === undefined) continue;

    const tree = treeOf(entries);
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
    if (proof === null) continue;

    // Already taken is not owed. Without this a holder is shown money they have
    // had for weeks, and the claim they make on it reverts and says nothing.
    if (await claimed(round.round, wallet)) continue;

    owed.push({
      round: round.round,
      amount: mine[1],
      proof,
      root: round.root,
      openedAt: round.openedAt,
    });
  }

  return owed;
}

/**
 * Whether a wallet has already taken a round, asked of the chain.
 *
 * Here rather than in a route so both routes ask the same question the same way
 * — and because a route file that exports something other than its HTTP methods
 * is a route file the framework has opinions about.
 *
 * UNKNOWN COUNTS AS CLAIMED. An endpoint that would not answer must not put a
 * share on the page that the chain is going to refuse: the holder cannot tell
 * those two apart, and only one of them is worth their gas.
 */
export function claimedOnChain(rpcs: readonly string[]) {
  return async (round: number, wallet: string): Promise<boolean> => {
    const drop = CONTRACTS.drop;
    if (drop === null) return false;
    try {
      const answer = await rpc<string>(rpcs, "eth_call", [
        {
          to: drop,
          data: selector("claimed(uint256,address)") + word(BigInt(round)) + word(wallet),
        },
        "latest",
      ]);
      return BigInt(answer) !== 0n;
    } catch {
      return true;
    }
  };
}
