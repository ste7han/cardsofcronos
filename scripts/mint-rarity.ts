// What a mint of N cards actually hands over, by rarity.
//
// The odds are not set anywhere: a mint draws uniformly from the set, so the
// chance of a mythic is exactly the share of the set that is mythic. Those are
// two different numbers that happen to be the same one, and only by accident —
// how many mythic cards exist is a question about the set, how often a mythic
// drops is a question about the economy.
//
//   npx tsx scripts/mint-rarity.ts [mint size]

import { CARDS } from "../data/cards";
import { RARITIES } from "../engine/types";

const SIZE = Number(process.argv[2] ?? 60);
const n = CARDS.length;

console.log(`${n} cards in the set. A uniform mint of ${SIZE}:\n`);
console.log(`  rarity      cards   share of set   per mint of ${SIZE}`);
for (const rarity of RARITIES) {
  const count = CARDS.filter((c) => c.rarity === rarity).length;
  console.log(
    `  ${rarity.padEnd(10)} ${String(count).padStart(5)}   ` +
      `${((count / n) * 100).toFixed(1).padStart(11)}%   ${((count / n) * SIZE).toFixed(1).padStart(14)}`,
  );
}

const harmonic = Array.from({ length: n }, (_, i) => 1 / (i + 1)).reduce((a, b) => a + b, 0);
console.log(
  `\n  A second mint brings ${(SIZE * (1 - SIZE / n)).toFixed(1)} cards the player does not already own.` +
    `\n  Collecting all ${n} takes about ${Math.round((n * harmonic) / SIZE)} mints.`,
);
