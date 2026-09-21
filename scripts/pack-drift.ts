// A pack of ten came out entirely epic and legendary. On the printed odds that
// is 0.15^9 — one in twenty-six million — so either the draw was broken or the
// odds a pack *actually* ran were not the odds it printed.
//
// The suspect was the rule that a pack never hands you a card you already own.
// Commons are half of every draw, so commons run out first, and a collection far
// enough along has nothing left to give but the cards that were rare to begin
// with. The odds would then drift on their own, with nothing wrong anywhere —
// which is worse than a bug, because nobody would ever notice it in the code.
//
// That is what this script showed, and the rule was removed: a purchase draws
// against the whole set now, so a card you hold can come out again. Two things
// changed with it. A pack used to guarantee a rare or better, which pulled the
// common share down by design and had to be subtracted out of any honest count —
// there is no guarantee any more, so every slot here is a free roll. And there
// is no pack: the mint sells a number of cards at one price. Ten at a time is
// kept as the batch size because that is what every earlier run used.
//
// So it is no longer an investigation, it is the check that the answer holds. If
// the two columns at the end ever part company again, something has started
// drawing against the collection.
//
//   npx tsx scripts/pack-drift.ts [purchases]

import { CARDS } from "../data/cards";
import { MINT_PULL_WEIGHTS, openCards } from "../engine/pack";
import { RARITIES, type Rarity } from "../engine/types";

const BUY = 10;
const BUYS = Number(process.argv[2] ?? 60);
const index = new Map(CARDS.map((c) => [c.id, c] as const));
const isBig = (r: Rarity) => r === "epic" || r === "legendary" || r === "mythic";

const owned: string[] = [];
const rows: { after: number; mix: Record<Rarity, number>; big: number }[] = [];

for (let i = 0; i < BUYS; i++) {
  const bought = openCards(CARDS, i * 7919 + 13, BUY);
  if (bought.length === 0) break;

  const mix = Object.fromEntries(RARITIES.map((r) => [r, 0])) as Record<Rarity, number>;
  for (const id of bought) mix[index.get(id)!.rarity] += 1;
  owned.push(...bought);

  rows.push({
    after: owned.length,
    mix,
    big: bought.filter((id) => isBig(index.get(id)!.rarity)).length,
  });
}

console.log(`${rows.length} purchases of ${BUY}, back to back, by one collector\n`);
console.log(`  owned   ${RARITIES.map((r) => r.slice(0, 4).padStart(6)).join("")}   epic+`);
for (const [i, row] of rows.entries()) {
  // Every purchase early on, then every fifth once the picture stops moving.
  if (i > 6 && i % 5 !== 0 && i !== rows.length - 1) continue;
  console.log(
    `  ${String(row.after).padStart(5)}   ` +
      RARITIES.map((r) => String(row.mix[r]).padStart(6)).join("") +
      `   ${String(row.big).padStart(4)}/${BUY}`,
  );
}

const left = (r: Rarity) => CARDS.filter((c) => c.rarity === r && !owned.includes(c.id)).length;
console.log(`\n  what the set has left for this collection of ${owned.length}:`);
for (const r of RARITIES) {
  const total = CARDS.filter((c) => c.rarity === r).length;
  console.log(`  ${r.padEnd(10)} ${String(left(r)).padStart(4)} of ${total}`);
}

// The rows show whether it drifts; this shows whether it was ever right. Every
// slot counts now — there is no guaranteed one to leave out.
const drawn = Object.fromEntries(RARITIES.map((r) => [r, 0])) as Record<Rarity, number>;
for (const row of rows) for (const r of RARITIES) drawn[r] += row.mix[r];
const total = rows.length * BUY;
const weight = RARITIES.reduce((sum, r) => sum + MINT_PULL_WEIGHTS[r], 0);

console.log(`\n  what the table says, and what ${total} slots actually drew:`);
for (const rarity of RARITIES) {
  const says = (MINT_PULL_WEIGHTS[rarity] / weight) * 100;
  const drew = (drawn[rarity] / total) * 100;
  console.log(
    `  ${rarity.padEnd(10)} says ${says.toFixed(0).padStart(3)}%   drew ${drew.toFixed(1).padStart(5)}%`,
  );
}
console.log(
  `\n  These two columns are meant to agree, at every collection size. Where they` +
    `\n  part company, something has started drawing against what is already owned.`,
);
