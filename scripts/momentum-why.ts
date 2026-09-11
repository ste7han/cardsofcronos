// Why does momentum lose? Value per style, measured the way rarity-value.ts does.
//
//   npx tsx scripts/momentum-why.ts [seeds]
//
// scripts/intent-duel.ts says momentum wins 34.6% against the field where every
// other style sits between 47% and 59%. That is the match result; this is the
// reason, or the start of one. Same still-life board as rarity-value.ts: play
// one card into the same position, coast both sides to the end, take the
// difference in final margin. Then group by the style the card belongs to
// instead of by its rarity.
import { CARDS } from "../data/cards";
import { buildDeck } from "../engine/deck";
import { formatMC } from "../engine/format";
import { buildIndex } from "../engine/match";
import { MARKETING_COST, type Card } from "../engine/types";
import { FAMILY_INTENT, INTENTS, type Intent, intentOf } from "./intent";
import { board, coast, worthOf } from "./lib/still-life";

const index = buildIndex(CARDS);
const SEEDS = Number(process.argv[2] ?? 6);
const AT_TURN = 5;

const styleOf = (c: Card): Intent =>
  c.type === "project" ? (FAMILY_INTENT[c.project] ?? "none") : intentOf(c);

const per = new Map<Intent, number[]>();
const perTen = new Map<Intent, number[]>();
for (const i of INTENTS) {
  per.set(i, []);
  perTen.set(i, []);
}

for (let seed = 0; seed < SEEDS; seed++) {
  const deck = buildDeck(CARDS, seed);
  const base = board(CARDS, index, seed, AT_TURN, { you: deck, opponent: deck });
  const without = coast(structuredClone(base), index);
  for (const card of CARDS) {
    const style = styleOf(card);
    if (style === "none") continue;
    const delta = worthOf(base, card, index, without);
    if (delta === null) continue;
    per.get(style)!.push(delta);
    perTen.get(style)!.push(delta / (MARKETING_COST[card.rarity] / 10_000));
  }
}

const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / Math.max(1, xs.length);
const median = (xs: number[]) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)] ?? 0;

console.log(`played on turn ${AT_TURN}, ${SEEDS} seeds, both sides coasting after\n`);
console.log("  style       mean gain     per 10K      median         n");
for (const style of [...INTENTS].sort((a, b) => mean(perTen.get(b)!) - mean(perTen.get(a)!))) {
  const g = per.get(style)!;
  const t = perTen.get(style)!;
  console.log(
    `  ${style.padEnd(10)}${formatMC(mean(g)).padStart(10)}${formatMC(mean(t)).padStart(12)}` +
      `${formatMC(median(g)).padStart(12)}${String(g.length).padStart(10)}`,
  );
}
console.log(
  `\nA card is worth what it adds to the final margin. If a style sits below the` +
    `\nothers here, its cards are simply smaller, and no amount of deck-building` +
    `\nfixes that. If it sits with them, the losing happens somewhere else — in` +
    `\nwhat it cannot answer rather than in what it pays.`,
);
