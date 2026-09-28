// Puts back a tree that reached the chain but never reached the database.
//
//   npx tsx scripts/recover-tree.ts            # works it out, writes nothing
//   npx tsx scripts/recover-tree.ts --sql      # writes db/recover-tree.sql
//
// ── WHAT WENT WRONG, SO THE NEXT PERSON KNOWS WHAT THIS IS FOR ───────────────
//
// The round proposes a tree on chain, then writes the holders' new entitlements,
// then stores the tree and its leaves. Those were three separate piles of
// single-statement calls — 207 reads, 207 writes, 168 inserts — on top of the
// log scans earlier in the same request. A Worker gets a thousand subrequests.
// On 28 September 2026 the round ran out of them partway through the middle
// pile: the propose landed, some entitlements landed, and the tree was never
// stored at all.
//
// A tree on chain that the database cannot produce proofs for is worse than no
// tree. When it is adopted it replaces the live root, and every holder who
// could claim before then cannot claim either.
//
// ── WHY THIS CAN BE TRUSTED ──────────────────────────────────────────────────
//
// It does not guess. The leaves are rebuilt from what is still knowable, and the
// merkle root of the result is compared against the root the contract is
// actually holding. A match is proof: the same root cannot come from a different
// set of leaves. If it does not match, this writes nothing and says so.
//
// What makes the rebuild possible is that the table stood still between the
// previous tree and this run — every round in between was refused — so the
// previous tree's leaves are each holder's entitlement going in. An address that
// has not moved away from that value is one whose write never landed, and the
// share it should have had is what is missing from it.

import { execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";

import { PUBLIC_RPCS } from "@/lib/cronos";
import { selector, word } from "@/lib/evm-tx";
import { CONTRACTS, CROCARD, NOT_A_HOLDER } from "@/lib/revenue";
import { DUST, leavesOf, sharesOf, treeOf } from "@/lib/holders";

/** The sum of the entitlement column before the run, measured while it stood still. */
const PRE_TOTAL = 4143322668831943831067398n;
/** Which tree's leaves are that per-address baseline. */
const BASELINE_TREE = 2;
/** From the RootProposed log, block 96588971. */
const PROPOSED_AT = Date.parse("2026-09-28T00:10:12Z");
const TX = "0xaf2b211bf1b63107ba78b6e64107a2426b0ca49432cf1b91c5cbefb78ca8e56b";
const PUBLISH_DELAY = 24 * 60 * 60 * 1000;

function ask<T>(sql: string): T[] {
  const out = execFileSync(
    "npx",
    ["wrangler", "d1", "execute", "cards-of-cronos", "--remote", "--json", "--command", sql],
    { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 },
  );
  return JSON.parse(out.slice(out.indexOf("[")))[0].results as T[];
}

async function call(to: string, data: string): Promise<bigint> {
  for (const url of PUBLIC_RPCS) {
    try {
      const response = await fetch(url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          method: "eth_call",
          params: [{ to, data }, "latest"],
        }),
      });
      const body = (await response.json()) as { result?: string };
      if (body.result) return BigInt(body.result);
    } catch {
      // next endpoint
    }
  }
  throw new Error(`no endpoint answered ${data.slice(0, 10)}`);
}

async function main() {
  const drop = CONTRACTS.drop;
  if (drop === null) throw new Error("HolderDrop is not deployed");

  const wantRoot = "0x" + (await call(drop, selector("pendingRoot()"))).toString(16).padStart(64, "0");
  const wantTotal = await call(drop, selector("pendingPromised()"));
  const pendingAt = await call(drop, selector("pendingAt()"));
  if (pendingAt === 0n) {
    console.log("Er hangt niets aan het contract. Niets te herstellen.");
    return;
  }

  const known = ask<{ id: number }>(
    `SELECT id FROM drop_trees WHERE root = '${wantRoot}'`,
  );
  if (known.length > 0) {
    console.log(`De boom staat al in de database, als ${known[0]!.id}. Niets te doen.`);
    return;
  }

  console.log("wortel aan het contract :", wantRoot);
  console.log("belooft                 :", wantTotal.toString());
  console.log("wordt live              :", new Date(Number(pendingAt) * 1000).toISOString(), "\n");

  const inTheContract =
    (await call(drop, selector("paidOut()"))) +
    (await call(CROCARD, selector("balanceOf(address)") + word(drop)));
  const arrived = inTheContract - PRE_TOTAL;

  const rows = ask<{ address: string; balance: string; entitlement: string; is_contract: number | null }>(
    "SELECT address, balance, entitlement, is_contract FROM holders " +
      "WHERE entitlement <> '0' OR (is_contract = 0 AND balance <> '0')",
  );
  const post = new Map(rows.map((row) => [row.address, BigInt(row.entitlement)]));
  const holding = rows
    .map((row) => ({
      address: row.address,
      balance: BigInt(row.balance),
      entitlement: BigInt(row.entitlement),
      isContract: row.is_contract === null ? null : row.is_contract === 1,
    }))
    .filter(
      (holder) =>
        holder.isContract === false &&
        holder.balance > 0n &&
        !NOT_A_HOLDER.includes(holder.address),
    );

  const shares = sharesOf(holding, arrived);
  const before = new Map(
    ask<{ address: string; amount: string }>(
      `SELECT address, amount FROM drop_leaves WHERE tree = ${BASELINE_TREE}`,
    ).map((row) => [row.address, BigInt(row.amount)] as const),
  );

  // Which writes landed. An address with a leaf in the baseline tree started at
  // that value, so it landed if it has moved. An address without one started
  // under the dust line by definition, so it landed if it is now above it.
  const owed = new Map(post);
  const missed: string[] = [];
  for (const [address, share] of shares) {
    if (share === 0n) continue;
    const was = before.get(address);
    const landed = was === undefined ? (post.get(address) ?? 0n) >= DUST : (post.get(address) ?? 0n) !== was;
    if (!landed) {
      missed.push(address);
      owed.set(address, (owed.get(address) ?? 0n) + share);
    }
  }

  const leaves = leavesOf([...owed].map(([address, entitlement]) => ({ address, entitlement })));
  const total = leaves.reduce((sum, [, amount]) => sum + BigInt(amount), 0n);
  const root = treeOf(leaves).root;

  console.log(`${missed.length} adressen kregen hun aandeel niet weggeschreven`);
  console.log(`${leaves.length} bladeren, samen ${total}`);
  console.log("gereconstrueerde wortel :", root);

  if (root !== wantRoot || total !== wantTotal) {
    console.log("\n❌ dit is niet de boom die aan het contract hangt. Er wordt niets geschreven.");
    process.exit(1);
  }
  console.log("\n✅ identiek aan de keten, wortel en bedrag");

  if (!process.argv.includes("--sql")) {
    console.log("\n--sql schrijft db/recover-tree.sql. Nu is er niets geschreven.");
    return;
  }

  const q = (value: string) => `'${value.replace(/'/g, "''")}'`;
  const lines = [
    `-- The tree proposed at ${new Date(PROPOSED_AT).toISOString()}, put back.`,
    `-- Its root matches what HolderDrop is holding, which is what makes this safe.`,
    `INSERT INTO drop_trees (root, promised, holders, proposed_at, live_at, adopted_at, tx_hash)`,
    `  VALUES (${q(root)}, ${q(total.toString())}, ${leaves.length}, ${PROPOSED_AT}, ${PROPOSED_AT + PUBLISH_DELAY}, NULL, ${q(TX)});`,
    ...leaves.map(
      ([address, amount]) =>
        `INSERT INTO drop_leaves (tree, address, amount) SELECT id, ${q(address)}, ${q(amount)} FROM drop_trees WHERE root = ${q(root)};`,
    ),
    `-- And the entitlements whose write never landed, set to what the tree promises them.`,
    ...missed.map(
      (address) => `UPDATE holders SET entitlement = ${q(owed.get(address)!.toString())} WHERE address = ${q(address)};`,
    ),
  ];

  const out = new URL("../db/recover-tree.sql", import.meta.url);
  writeFileSync(out, lines.join("\n") + "\n");
  console.log(`\ndb/recover-tree.sql: 1 boom, ${leaves.length} bladeren, ${missed.length} rechtzettingen`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
