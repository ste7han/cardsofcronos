// The Crooks Finance free mints, worked out from the snapshot and the rank ladder.
//
//   npm run crooks-grants            # what it would give, writing nothing
//   npm run crooks-grants -- --write # into data/granted-mints.json
//
// Reads data/crooks-snapshot.json — who held Crooks Legends and how many — and
// turns it into one grant per address at the rate its rank earns. That file then
// feeds scripts/allowlist.ts, which merges every grant into the merkle tree the
// mint contract checks against.
//
// ── NOT TYPED OUT, AND RE-RUNNABLE ───────────────────────────────────────────
//
// Eighty-six addresses and ten tiers is a list nobody can proofread. So the rate
// is written down once, per rank, and every row is computed — and each generated
// row is stamped so that running this again replaces the previous set instead of
// adding a second one on top. Grants from anywhere else are left exactly as they
// are: they are decisions somebody made, not output.
//
// ── THE ALLOWANCE MAY ONLY GO UP ─────────────────────────────────────────────
//
// The contract counts what an address has already claimed against the allowance
// in its leaf, so publishing a smaller number does not take anything back — it
// quietly stops somebody mid-claim. scripts/allowlist.ts refuses a tree that
// lowers anybody, and this is the step before it: once these mints are live,
// lowering a rank's rate is not a change that can be made.

import { existsSync, readFileSync, writeFileSync } from "node:fs";

import { RANKS, rankOf } from "@/lib/crooks";

/**
 * What each rank earns. Ranks below Officer are absent on purpose rather than
 * set to zero: they earn nothing, and a zero would read as an oversight.
 *
 * Decided by the maker on 28 September 2026. 86 of the 316 holders qualify; the
 * other 230 hold fewer than ten and are out.
 */
const EARNS: Record<string, number> = {
  Officer: 1,
  Captain: 2,
  General: 3,
  "Gang Leader": 4,
  Boss: 6,
  Kingpin: 8,
  Overlord: 10,
  Icon: 12,
  Legend: 15,
  Immortal: 18,
};

/**
 * Wallets that hold Crooks Legends and are not given mints for them.
 *
 * The maker's own, excluded at their request — the same reasoning as the team
 * wallet in lib/revenue.ts: a giveaway that pays its own author is not a
 * giveaway, whatever the arithmetic says.
 */
const EXCLUDED = new Set(["0xc6eda82b712dd1cd8a602d6f0f3d30a733adb63b"]);

/** Stamped on every row this writes, so a re-run replaces rather than repeats. */
const PROGRAMME = "crooks";

interface Grant {
  address: string;
  mints: number;
  why: string;
  at: string;
  programme?: string;
}

interface Granted {
  note?: string;
  grants: Grant[];
}

function main() {
  const snapshot = JSON.parse(readFileSync("data/crooks-snapshot.json", "utf8")) as {
    at: string;
    holders: number;
    held: Record<string, number>;
  };

  const rows: Grant[] = [];
  const perRank = new Map<string, { holders: number; mints: number }>();
  let skipped = 0;

  for (const [address, held] of Object.entries(snapshot.held)) {
    if (EXCLUDED.has(address.toLowerCase())) {
      skipped++;
      continue;
    }
    const rank = rankOf(held);
    const mints = EARNS[rank];
    if (mints === undefined) continue;

    rows.push({
      address,
      mints,
      why: `Crooks Finance ${rank} — held ${held} Crooks Legends when the snapshot was read on ${snapshot.at.slice(0, 10)}.`,
      at: new Date().toISOString().slice(0, 10),
      programme: PROGRAMME,
    });
    const row = perRank.get(rank) ?? { holders: 0, mints: 0 };
    perRank.set(rank, { holders: row.holders + 1, mints: row.mints + mints });
  }

  const total = rows.reduce((sum, row) => sum + row.mints, 0);

  console.log(`\n  ${snapshot.holders} holders in the snapshot, ${rows.length} of them earn mints\n`);
  for (const rank of [...RANKS].reverse()) {
    const row = perRank.get(rank.name);
    if (row === undefined) continue;
    console.log(
      `    ${rank.name.padEnd(15)} ${String(rank.from).padStart(3)}+   ` +
        `${String(row.holders).padStart(3)} × ${String(EARNS[rank.name]).padStart(2)}  =  ${String(row.mints).padStart(4)}`,
    );
  }
  console.log(`\n    ${"total".padEnd(15)}${" ".repeat(13)}${String(total).padStart(4)} mints`);
  if (skipped > 0) console.log(`    ${skipped} wallet(s) excluded by name`);

  if (!process.argv.includes("--write")) {
    console.log("\n  Nothing written. --write puts these in data/granted-mints.json.\n");
    return;
  }

  const granted: Granted = existsSync("data/granted-mints.json")
    ? (JSON.parse(readFileSync("data/granted-mints.json", "utf8")) as Granted)
    : { grants: [] };

  // Everything this did not generate stays exactly as it is.
  const kept = granted.grants.filter((one) => one.programme !== PROGRAMME);
  const replaced = granted.grants.length - kept.length;

  writeFileSync(
    "data/granted-mints.json",
    JSON.stringify({ ...granted, grants: [...kept, ...rows] }, null, 2) + "\n",
  );
  console.log(
    `\n  data/granted-mints.json: ${kept.length} kept, ${replaced} replaced, ${rows.length} written\n`,
  );
}

main();
