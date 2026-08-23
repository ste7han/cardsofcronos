// A deck mint with rarity odds set on purpose instead of inherited by accident.
//
// Today a mint draws uniformly from the set, so the chance of a mythic is the
// share of the set that is mythic — 8.7%, which puts 5.2 mythics in a mint of
// sixty. This models the proposal instead: sixty distinct cards, at least twenty
// of them projects, and every card rolled against a fixed rarity table.
//
// Nothing here touches the engine. It is a model of a mint that does not exist
// yet, measured before it is built.
//
//   npx tsx scripts/mint-model.ts [mints] [size] [min projects] [c,r,e,l,m odds]

import { CARDS } from "../data/cards";
import { RARITIES, type Rarity } from "../engine/types";
import { mint, oddsFrom } from "./lib/mint-draw";

const MINTS = Number(process.argv[2] ?? 20_000);
const SIZE = Number(process.argv[3] ?? 60);
const MIN_PROJECTS = Number(process.argv[4] ?? 20);
const ODDS = oddsFrom(process.argv[5] ?? "50,30,10,8,2");

let rerolls = 0;
const counts = new Map<Rarity, number[]>();
for (const rarity of RARITIES) counts.set(rarity, []);
const projectCounts: number[] = [];
let mythicless = 0;
let legendaryless = 0;

for (let i = 0; i < MINTS; i++) {
  const { cards, rerolls: extra } = mint(i * 7919 + 13, SIZE, MIN_PROJECTS, ODDS);
  rerolls += extra;
  for (const rarity of RARITIES) {
    counts.get(rarity)!.push(cards.filter((c) => c.rarity === rarity).length);
  }
  projectCounts.push(cards.filter((c) => c.type === "project").length);
  if (!cards.some((c) => c.rarity === "mythic")) mythicless += 1;
  if (!cards.some((c) => c.rarity === "legendary")) legendaryless += 1;
}

const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
const at = (xs: number[], q: number) => {
  const sorted = [...xs].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))]!;
};

console.log(
  `${MINTS.toLocaleString("en")} mints of ${SIZE}, at least ${MIN_PROJECTS} projects,\n` +
    `odds ${RARITIES.map((r) => `${r} ${(ODDS[r] * 100).toFixed(0)}%`).join(", ")}\n`,
);

console.log(`  rarity      in the set   per mint   unlucky (1 in 10)   lucky (1 in 10)`);
for (const rarity of RARITIES) {
  const xs = counts.get(rarity)!;
  const inSet = CARDS.filter((c) => c.rarity === rarity).length;
  console.log(
    `  ${rarity.padEnd(10)} ${String(inSet).padStart(10)}   ${mean(xs).toFixed(1).padStart(8)}   ` +
      `${String(at(xs, 0.1)).padStart(17)}   ${String(at(xs, 0.9)).padStart(15)}`,
  );
}

console.log(
  `\n  projects per mint        ${mean(projectCounts).toFixed(1)} ` +
    `(floor is ${MIN_PROJECTS}, and it binds in ` +
    `${((projectCounts.filter((n) => n === MIN_PROJECTS).length / MINTS) * 100).toFixed(1)}% of mints)`,
);
console.log(`  mints with no mythic     ${((mythicless / MINTS) * 100).toFixed(1)}%`);
console.log(`  mints with no legendary  ${((legendaryless / MINTS) * 100).toFixed(1)}%`);
if (rerolls > 0) {
  console.log(`  rarity rerolled because the pool was empty: ${rerolls}`);
}

// How long the collection takes, one rarity at a time. A player only ever draws
// a rarity as often as its odds allow, so a rare card in a thin tier is slow
// twice over.
console.log(`\n  rarity      cards   per mint   mints to own them all`);
for (const rarity of RARITIES) {
  const inSet = CARDS.filter((c) => c.rarity === rarity).length;
  const perMint = mean(counts.get(rarity)!);
  const harmonic = Array.from({ length: inSet }, (_, i) => 1 / (i + 1)).reduce((a, b) => a + b, 0);
  console.log(
    `  ${rarity.padEnd(10)} ${String(inSet).padStart(6)}   ${perMint.toFixed(1).padStart(8)}   ` +
      `${Math.round((inSet * harmonic) / perMint).toLocaleString("en").padStart(21)}`,
  );
}
console.log(
  `\n  "Mints to own them all" is the coupon collector: the last few cards of a` +
    `\n  tier take far longer than the first, and a thin tier drawn rarely is slow` +
    `\n  twice over.`,
);
