// What the nightly holder round would do, without doing any of it.
//
//   npx tsx scripts/drop-dry-run.ts
//
// The round runs once a day inside the Worker and signs a transaction when it
// decides to. That is a bad place to find out it has decided not to: it refused
// every run for two days with nothing on the site saying so, and the only way to
// see why was to wait for the next one.
//
// So this asks the same question from outside — the live table, the live chain,
// and THE SAME FUNCTIONS the round uses to decide. Nothing here reimplements the
// arithmetic; a copy would agree with itself while the Worker did something
// else, which is the failure it is meant to catch. It holds no key and sends
// nothing, so it cannot propose a tree even by accident.

import { execFileSync } from "node:child_process";

import { PUBLIC_RPCS } from "@/lib/cronos";
import { selector, word } from "@/lib/evm-tx";
import { CONTRACTS, CROCARD, NOT_A_HOLDER } from "@/lib/revenue";
import {
  DUST,
  LEAST_WORTH_SHARING,
  leavesOf,
  sharesOf,
  treeOf,
} from "@/lib/holders";

const DB = "cards-of-cronos";

/** One query against the live D1, read-only, through wrangler. */
function ask<T>(sql: string): T[] {
  const out = execFileSync(
    "npx",
    ["wrangler", "d1", "execute", DB, "--remote", "--json", "--command", sql],
    { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 },
  );
  // wrangler prints its own chatter before the JSON on some versions.
  const body = JSON.parse(out.slice(out.indexOf("[")));
  return body[0].results as T[];
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
      const body = (await response.json()) as { result?: string; error?: { message: string } };
      if (body.result) return BigInt(body.result);
    } catch {
      // next endpoint
    }
  }
  throw new Error(`no endpoint answered ${data.slice(0, 10)} at ${to}`);
}

const units = (n: bigint) =>
  (Number(n / 10n ** 14n) / 10_000).toLocaleString("nl-NL", { maximumFractionDigits: 4 });

async function main() {
  const drop = CONTRACTS.drop;
  if (drop === null) throw new Error("HolderDrop is not deployed");

  console.log("De ronde, zoals hij nu zou lopen\n");

  // 1. Is one still waiting? The round does nothing while a tree is pending.
  const trees = ask<{ id: number; live_at: number; adopted_at: number | null }>(
    "SELECT id, live_at, adopted_at FROM drop_trees ORDER BY id",
  );
  const waiting = trees.find((tree) => tree.adopted_at === null);
  if (waiting) {
    console.log(`  1. boom ${waiting.id} wacht nog tot ${new Date(waiting.live_at).toISOString()}`);
  } else {
    console.log(`  1. geen boom in de wacht — ${trees.length} geadopteerd`);
  }

  // 2. What is there to share, measured the way the round measures it.
  // Derived from the signature, never typed. A hand-written selector is a call
  // that quietly answers for a function that does not exist.
  const paidOut = await call(drop, selector("paidOut()"));
  const held = await call(CROCARD, selector("balanceOf(address)") + word(drop));
  const inTheContract = paidOut + held;

  const rows = ask<{ address: string; balance: string; entitlement: string; is_contract: number | null }>(
    "SELECT address, balance, entitlement, is_contract FROM holders WHERE entitlement <> '0' OR (is_contract = 0 AND balance <> '0')",
  );
  const everyone = rows.map((row) => ({
    address: row.address,
    balance: BigInt(row.balance),
    entitlement: BigInt(row.entitlement),
    isContract: row.is_contract === null ? null : row.is_contract === 1,
  }));

  const alreadyOwed = everyone.reduce((sum, one) => sum + one.entitlement, 0n);
  console.log(`\n  2. het contract heeft gehad  ${units(inTheContract)}`);
  console.log(`     de tabel is al schuldig     ${units(alreadyOwed)}`);

  if (alreadyOwed > inTheContract) {
    console.log(`\n  → ZOU STOPPEN: de tabel ligt ${units(alreadyOwed - inTheContract)} vóór op de keten`);
    return;
  }
  const arrived = inTheContract - alreadyOwed;
  console.log(`     dus te verdelen             ${units(arrived)}`);
  if (arrived < LEAST_WORTH_SHARING) {
    console.log(`\n  → ZOU STOPPEN: minder dan ${units(LEAST_WORTH_SHARING)} is geen boom waard`);
    return;
  }

  // 3. Between whom.
  const holding = everyone.filter(
    (one) => one.isContract === false && one.balance > 0n && !NOT_A_HOLDER.includes(one.address),
  );
  console.log(`\n  3. uitbetaalbare houders      ${holding.length}`);
  if (holding.length === 0) {
    console.log("\n  → ZOU STOPPEN: geen uitbetaalbare houders");
    return;
  }
  const shares = sharesOf(holding, arrived);

  // 4. The tree.
  const owed = new Map<string, bigint>();
  for (const one of everyone) if (one.entitlement > 0n) owed.set(one.address, one.entitlement);
  for (const [address, amount] of shares) owed.set(address, (owed.get(address) ?? 0n) + amount);

  const leaves = leavesOf([...owed].map(([address, entitlement]) => ({ address, entitlement })));
  const promised = leaves.reduce((sum, [, amount]) => sum + BigInt(amount), 0n);

  console.log(`     in de boom               ${owed.size}`);
  console.log(`     boven de stoflijn        ${leaves.length}  (stof: ${units(DUST)})`);
  console.log(`\n  4. zou beloven              ${units(promised)}`);
  console.log(`     contract kan dragen      ${units(inTheContract)}`);

  if (promised > inTheContract) {
    console.log(`\n  → ZOU STOPPEN: belooft ${units(promised - inTheContract)} meer dan er is`);
    return;
  }
  console.log(`     ruimte over              ${units(inTheContract - promised)}`);
  console.log(`\n  → ZOU VOORSTELLEN: wortel ${treeOf(leaves).root}`);
  console.log(`     ${leaves.length} adressen, ${units(promised)} $CROCARD cumulatief`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
