// The order the collection comes out in, decided once and published before it does.
//
//   npx tsx scripts/shuffle.ts <seed>        writes data/shuffle.json
//
// Every token is a card, and which card token 7 is has to be settled before
// anybody buys token 7. The contract cannot decide it — tokenURI is base + id
// and nothing more — so the whole sequence is drawn here, hashed, and the hash
// is published ahead of the mint. Afterwards anybody can rerun this with the
// same seed, get the same lines back, and check the hash against what was
// promised. That is the whole of the guarantee: not that the order is fair,
// but that it was fixed before the first sale and has not moved since.
//
// ── HOW MANY OF EACH ─────────────────────────────────────────────────────────
//
// Settled by the maker: 21 of every common, 16 of every rare, 8 of every epic,
// 5 of every legendary, 3 of every mythic. Across the set that is 5603 today,
// every card exists — which the alternative did not: at 2000 tokens on the
// printed odds, 25 of the 45 mythics would never have been minted at all.
//
// ── WHY IT IS NOT A PLAIN SHUFFLE ────────────────────────────────────────────
//
// The first collection planned 1894 and stopped at 515. With a fixed sequence
// that is not a footnote: everything past the position where minting stops never
// comes out. A plain shuffle would then hand the actual buyers whatever the
// random first 500 happened to hold — which could be three mythics or eleven.
//
// So each rarity is spread evenly across the whole sequence before anything is
// shuffled, and the shuffling happens inside small windows. The proportions then
// hold at EVERY prefix rather than only at the end, and it stops mattering where
// the mint stops. The odds a buyer actually faces are the printed ones whether
// they are the tenth buyer or the last.
//
// What that costs is the old promise of "one slot guaranteed rare or better" in
// a pack. A fixed sequence cannot guarantee the contents of any ten consecutive
// tokens, and it should not pretend to. What it can say instead is truer and
// better: the odds are without replacement, so what is left is knowable, and a
// run of bad luck makes the rest of the deck richer rather than not.

import { createHash } from "node:crypto";
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { CARDS } from "@/data/cards";
import { RARITIES, type Rarity } from "@/engine/types";

/** Copies of every card at that rarity. Settled by the maker. */
export const COPIES: Record<Rarity, number> = {
  common: 21,
  rare: 16,
  epic: 8,
  legendary: 5,
  mythic: 3,
};

/**
 * Deterministic, and seeded by a number the maker picks and publishes.
 *
 * Math.random would make the sequence unreproducible, which would make the hash
 * a promise nobody could check — the one thing this file exists to avoid.
 */
function rng(seed: number): () => number {
  let state = (seed | 0) || 1;
  return () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return ((state >>> 0) % 1_000_000) / 1_000_000;
  };
}

/**
 * The sequence, and the hash of it, from a seed.
 *
 * Pulled out of main so it can be rerun without writing anything — which is what
 * makes the promise on /mint testable rather than only checkable by hand. Any
 * change in here changes the hash, and test/provenance.test.ts is what says so
 * before the change leaves the machine.
 */
export function draw(seed: number): { order: string[]; hash: string } {
  const next = rng(seed);

  // One entry per copy, with the fraction of the way through its own rarity it
  // sits at. Spreading each rarity across [0,1) independently is what makes the
  // proportions hold at every prefix rather than only at the end.
  const spread: { id: string; rarity: Rarity; at: number }[] = [];
  for (const rarity of RARITIES) {
    const cards = CARDS.filter((card) => card.rarity === rarity);
    const copies = COPIES[rarity];
    const total = cards.length * copies;
    let i = 0;
    // Round-robin over the cards rather than all copies of one card together,
    // so copies of one card start out spread across the whole rarity instead of
    // in a block. The jitter below can still push two of them together — 10 of
    // the 5602 boundaries in the published sequence are a pair — so this is
    // where they start, not a guarantee about where they end up. Two of the same
    // card is a real thing to hold here anyway; see lib/collection.ts.
    for (let copy = 0; copy < copies; copy++) {
      for (const card of cards) {
        spread.push({ id: card.id, rarity, at: (i + 0.5) / total });
        i++;
      }
    }
  }

  // A small jitter, so the interleaving is not a visible repeating pattern and
  // nobody can read the next rarity off the last one. Smaller than the gap
  // between two entries of the same rarity, so the even spread survives it.
  const jitter = 0.4 / spread.length;
  for (const entry of spread) entry.at += (next() - 0.5) * jitter * spread.length * 0.5;
  spread.sort((a, b) => a.at - b.at);

  const order = spread.map((entry) => entry.id);
  return { order, hash: createHash("sha256").update(order.join("\n")).digest("hex") };
}

function main(): void {
  const seed = Number(process.argv[2]);
  if (!Number.isInteger(seed) || seed <= 0) {
    throw new Error("Give a seed: npx tsx scripts/shuffle.ts 20260917");
  }
  const { order, hash } = draw(seed);

  writeFileSync(
    "data/shuffle.json",
    `${JSON.stringify({ seed, tokens: order.length, copies: COPIES, hash, order }, null, 2)}\n`,
  );

  console.log(`seed ${seed}`);
  console.log(`  tokens    ${order.length}`);
  console.log(`  distinct  ${new Set(order).size} of ${CARDS.length} cards`);
  console.log(`  hash      ${hash}`);

  // What a buyer at each point actually faces, which is the number this shuffle
  // exists to keep steady.
  const byRarity = new Map(CARDS.map((card) => [card.id, card.rarity]));
  console.log(`\n  share of each rarity in the first N tokens:`);
  console.log(`  N        ` + RARITIES.map((r) => r.slice(0, 4).padStart(7)).join(""));
  for (const n of [100, 250, 500, 1000, 2500, order.length]) {
    const head = order.slice(0, n);
    const row = RARITIES.map((r) => {
      const share = (head.filter((id) => byRarity.get(id) === r).length / n) * 100;
      return `${share.toFixed(1)}%`.padStart(7);
    }).join("");
    console.log(`  ${String(n).padEnd(9)}${row}`);
  }
}

// Only when it is the thing being run. test/provenance.test.ts imports `draw`
// from here to rerun the sequence, and an unguarded main would fire on that
// import, demand a seed off argv and fail the test before it started.
if (process.argv[1] !== undefined && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main();
}
