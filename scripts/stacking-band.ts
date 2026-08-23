// How much of a stacking row is noise?
//
// project-stacking.ts prints a band of about ±1.7%, computed from the total
// number of matches. That band is wrong, and the stack=1 sanity row is what
// exposed it: like against like has to read 50%, and black-bull read 44.7% —
// five points out, three bands wide, on a row that cannot be biased.
//
// The reason is that the matches are not independent. A row is 20 base decks of
// 400 matches, and the 400 only measure how those two particular forties play
// against each other. Draw a different pair of base decks and you get a different
// answer. So the sample size for the row is 20, not 8000, and the spread that
// matters is the spread *between* base decks.
//
// This measures that spread directly, on the one row whose true value is known.
//
//   npx tsx scripts/stacking-band.ts [project] [bases] [matches]

import { CARDS } from "../data/cards";
import { PRESET_DECKS } from "../data/preset-decks";
import { chooseMove } from "../engine/bot";
import { buildDeckPreferring } from "../engine/deck";
import { applyMove, buildIndex, newMatch } from "../engine/match";
import { RULES, type Card } from "../engine/types";

const index = buildIndex(CARDS);
const PROJECT = process.argv[2] ?? "black-bull";
const BASES = Number(process.argv[3] ?? 60);
const MATCHES = Number(process.argv[4] ?? 200);

const meme = PRESET_DECKS.find((p) => p.id === "meme-lord") ?? PRESET_DECKS[0]!;

function stackedDeck(project: string, stack: number, seed: number, theme: (c: Card) => boolean) {
  const chosen = CARDS.filter((c) => c.type === "project" && c.project === project)
    .slice(0, stack)
    .map((c) => c.id);
  const rest = buildDeckPreferring(
    CARDS.filter((c) => !(c.type === "project" && c.project === project)),
    seed,
    theme,
  );
  return [...chosen, ...rest.slice(0, RULES.deckSize - chosen.length)];
}

function duel(a: readonly string[], b: readonly string[], matches: number) {
  let winsA = 0;
  let decided = 0;
  for (let seed = 0; seed < matches; seed++) {
    const aFirst = seed % 2 === 0;
    let s = newMatch(
      CARDS,
      seed,
      aFirst ? { you: [...a], opponent: [...b] } : { you: [...b], opponent: [...a] },
    );
    let guard = 0;
    while (!s.finished && guard++ < 400) s = applyMove(s, chooseMove(s, index), index);
    if (s.winner === null) continue;
    decided++;
    if ((s.winner === "you") === aFirst) winsA++;
  }
  return (winsA / decided) * 100;
}

const rows: number[] = [];
for (let base = 0; base < BASES; base++) {
  const deck = stackedDeck(PROJECT, 1, meme.seed + base * 1013, meme.prefer);
  const against = stackedDeck(PROJECT, 1, meme.seed + base * 1013 + 500_003, meme.prefer);
  rows.push(duel(deck, against, MATCHES));
}

const mean = rows.reduce((a, b) => a + b, 0) / rows.length;
const variance = rows.reduce((a, b) => a + (b - mean) ** 2, 0) / (rows.length - 1);
const sd = Math.sqrt(variance);
const stderr = sd / Math.sqrt(rows.length);
const sorted = [...rows].sort((a, b) => a - b);

console.log(`${PROJECT}, stack=1 against stack=1 — the row whose true value is 50%\n`);
console.log(`  ${BASES} base decks x ${MATCHES} matches`);
console.log(`  mean across base decks : ${mean.toFixed(1)}%`);
console.log(`  spread between decks   : SD ${sd.toFixed(1)} points, from ${sorted[0]!.toFixed(1)}% to ${sorted.at(-1)!.toFixed(1)}%`);
console.log(`  real band on the mean  : +/- ${(1.96 * stderr).toFixed(1)} points  (${BASES} base decks)`);
console.log(`  band the old script claimed: +/- ${(1.96 * Math.sqrt(0.25 / (BASES * MATCHES)) * 100).toFixed(1)} points  (as if every match were independent)`);
console.log(
  `\n  A row of ${BASES} base decks therefore needs to move about ` +
    `${(1.96 * sd * Math.SQRT2 / Math.sqrt(BASES)).toFixed(1)} points before two rows differ.`,
);
