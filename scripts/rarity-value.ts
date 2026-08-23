// Does a mythic earn its 280K, or are fourteen commons a better turn?
//
// A mythic costs fourteen times a common and a legendary ten times. Whether the
// card is worth it is a question the set has never been asked directly — rarity
// was priced by feel and then left alone.
//
// Measured by what a card returns rather than by what it says: play it into the
// same position and take the difference in final margin. Every card in the set,
// one at a time, against the same board.
//
// After the card is played both sides coast — they end every remaining turn and
// play nothing. That is not a realistic match and it is not meant to be. Playing
// the rest out with the bot was tried first and the answer moved from "$9.1K per
// $10K" to "$1.3K" between four boards and sixteen, because one extra card
// changes every later decision and the noise swamped the signal. Coasting leaves
// exactly one difference between the two runs: this card. It measures what the
// card is worth on its own, not what it is worth in a fight.
//
// Margin, not market cap, so an attack card scores for what it takes off the
// opponent. The game is won on the higher number, so that is the number.
//
//   npx tsx scripts/rarity-value.ts [seeds per card]

import { CARDS } from "../data/cards";
import { buildDeck } from "../engine/deck";
import { formatMC } from "../engine/format";
import { buildIndex } from "../engine/match";
import { MARKETING_COST, RARITIES, type Rarity } from "../engine/types";
import { board, coast, worthOf } from "./lib/still-life";

const index = buildIndex(CARDS);
const SEEDS = Number(process.argv[2] ?? 6);
/** Which turn the board is built up to. Late boards are nearly full portfolios. */
const AT_TURN = Number(process.argv[3] ?? 5);

const gain = new Map<Rarity, number[]>();
for (const r of RARITIES) gain.set(r, []);
const perCard = new Map<string, number[]>();

for (let seed = 0; seed < SEEDS; seed++) {
  const deck = buildDeck(CARDS, seed);
  const base = board(CARDS, index, seed, AT_TURN, { you: deck, opponent: deck });
  // The control never changes, so it is one match per seed, not one per card.
  const without = coast(structuredClone(base), index);

  for (const card of CARDS) {
    const delta = worthOf(base, card, index, without);
    if (delta === null) continue; // not legal here; not a claim about the card
    gain.get(card.rarity)!.push(delta);
    const own = perCard.get(card.id) ?? [];
    own.push(delta);
    perCard.set(card.id, own);
  }
}

const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / Math.max(1, xs.length);
/** q is 0..1; the list is sorted in place. */
const quantile = (xs: number[], q: number) => {
  const sorted = [...xs].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))]!;
};

console.log(
  `what a card returns, by rarity — ${SEEDS} boards built to turn ${AT_TURN},\n` +
    `every card in the set played once into each\n`,
);
console.log(`  rarity      cost      mean gain    per 10K     median      middle half        n`);
for (const r of RARITIES) {
  const xs = gain.get(r)!;
  if (!xs.length) continue;
  const avg = mean(xs);
  const cost = MARKETING_COST[r];
  console.log(
    `  ${r.padEnd(10)} ${formatMC(cost).padStart(6)}  ${formatMC(avg).padStart(10)}  ` +
      `${formatMC((avg / cost) * 10_000).padStart(9)}  ${formatMC(quantile(xs, 0.5)).padStart(9)}   ` +
      `${(formatMC(quantile(xs, 0.25)) + " to " + formatMC(quantile(xs, 0.75))).padStart(16)}  ` +
      `${String(xs.length).padStart(5)}`,
  );
}
// A tier average cannot be fixed; a named card can.
const named = [...perCard.entries()]
  .filter(([, xs]) => xs.length >= SEEDS / 2)
  .map(([id, xs]) => {
    const card = CARDS.find((c) => c.id === id)!;
    return { card, per10k: (mean(xs) / MARKETING_COST[card.rarity]) * 10_000 };
  })
  .sort((a, b) => a.per10k - b.per10k);

console.log(`\n  the fifteen worst returns in the set, per $10K spent:`);
for (const n of named.slice(0, 15)) {
  console.log(
    `  ${formatMC(n.per10k).padStart(9)}   ${n.card.name.padEnd(26)} ` +
      `${n.card.rarity.padEnd(10)} ${n.card.type}`,
  );
}

console.log(
  `\n  Per 10K is the column that matters: if rarity is priced well it is flat, and` +
    `\n  a mythic buys the same margin per 10K as a common. The middle half is there` +
    `\n  because a mean over cards that do wildly different things hides the spread.`,
);
