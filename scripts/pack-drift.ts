// A pack of ten came out entirely epic and legendary. On the printed odds that
// is 0.15^9 — one in twenty-six million — so either the draw is broken or the
// odds a pack *actually* runs are not the odds it prints.
//
// The suspect is the rule that a pack never hands you a card you already own.
// Commons are half of every draw, so commons run out first, and a collection
// far enough along has nothing left to give but the cards that were rare to
// begin with. The odds would then drift on their own, with nothing wrong
// anywhere — which is worse than a bug, because nobody would ever notice it in
// the code.
//
//   npx tsx scripts/pack-drift.ts [packs to open]

import { CARDS } from "../data/cards";
import { PACK_PULL_WEIGHTS, PACK_SIZE, openPack } from "../engine/pack";
import { RARITIES, type Rarity } from "../engine/types";

const PACKS = Number(process.argv[2] ?? 60);
const index = new Map(CARDS.map((c) => [c.id, c] as const));
const isBig = (r: Rarity) => r === "epic" || r === "legendary" || r === "mythic";

const owned: string[] = [];
const rows: { after: number; mix: Record<Rarity, number>; big: number; first: Rarity }[] = [];
const firstOf = (row: { first: Rarity }) => row.first;

for (let i = 0; i < PACKS; i++) {
  const pack = openPack(CARDS, i * 7919 + 13);
  if (pack.length === 0) break;

  const mix = Object.fromEntries(RARITIES.map((r) => [r, 0])) as Record<Rarity, number>;
  for (const id of pack) mix[index.get(id)!.rarity] += 1;
  owned.push(...pack);

  rows.push({
    after: owned.length,
    mix,
    big: pack.filter((id) => isBig(index.get(id)!.rarity)).length,
    first: index.get(pack[0]!)!.rarity,
  });
}

console.log(`${rows.length} packs opened back to back, each drawn against the last\n`);
console.log(`  owned   ${RARITIES.map((r) => r.slice(0, 4).padStart(6)).join("")}   epic+`);
for (const [i, row] of rows.entries()) {
  // Every pack early on, then every fifth once the picture stops moving.
  if (i > 6 && i % 5 !== 0 && i !== rows.length - 1) continue;
  console.log(
    `  ${String(row.after).padStart(5)}   ` +
      RARITIES.map((r) => String(row.mix[r]).padStart(6)).join("") +
      `   ${String(row.big).padStart(4)}/${PACK_SIZE}`,
  );
}

const left = (r: Rarity) =>
  CARDS.filter((c) => c.rarity === r && !owned.includes(c.id)).length;
console.log(`\n  what the set has left for this collection of ${owned.length}:`);
for (const r of RARITIES) {
  const total = CARDS.filter((c) => c.rarity === r).length;
  console.log(`  ${r.padEnd(10)} ${String(left(r)).padStart(4)} of ${total}`);
}
// The rows show whether it drifts; this shows whether it was ever right. The
// guaranteed slot is left out of the count, because it is a promise rather than
// a roll and it pulls the common share down by design.
const free = rows.flatMap((r) => r.mix);
const drawn = Object.fromEntries(RARITIES.map((r) => [r, 0])) as Record<Rarity, number>;
for (const row of rows) for (const r of RARITIES) drawn[r] += row.mix[r];
for (const row of rows) drawn[firstOf(row)] -= 1;
const total = rows.length * (PACK_SIZE - 1);
const weight = RARITIES.reduce((sum, r) => sum + PACK_PULL_WEIGHTS[r], 0);

console.log(`\n  what the table says, and what ${total} free slots actually drew:`);
for (const rarity of RARITIES) {
  const says = (PACK_PULL_WEIGHTS[rarity] / weight) * 100;
  const drew = (drawn[rarity] / total) * 100;
  console.log(
    `  ${rarity.padEnd(10)} says ${says.toFixed(0).padStart(3)}%   drew ${drew.toFixed(1).padStart(5)}%`,
  );
}
console.log(
  `\n  Anywhere those two columns part company, the pack has run out of the cheap` +
    `\n  cards and is handing over what is left instead of what it promised.`,
);
void free;
