// How much is a theme's median win rate actually worth?
//
// preset-seeds.ts reports the median of sixteen seeds and calls it the theme.
// Two runs of it, on 626 cards and then on 640, produced this:
//
//   THE MACHINE  38% -> 28%   depin unchanged between the runs
//   THE ARCADE   34% -> 33%   gaming gained fourteen cards between the runs
//
// Both of those are the wrong way round, and together they say the median of
// sixteen seeds cannot carry the weight that was put on it. Two things are going
// on and neither is the theme:
//
// First, the seeds are fixed — 7000, 7137, 7274 and so on — so the same seed
// builds a different forty the moment the card pool changes. Adding fourteen
// gaming cards did not add gaming cards to THE MACHINE's decks; it replaced all
// sixteen of them with different draws. Comparing medians across two versions of
// the set is comparing sixteen decks with sixteen other decks.
//
// Second, a median of sixteen samples from a distribution this wide is itself
// noisy. stacking-band.ts already measured the spread between decks at SD 15.9
// points, and the standard error of a median is roughly 1.25 * SD / sqrt(n) —
// about five points here, so nine at 95%. Movements of four to ten points are
// inside that.
//
// So this measures the band directly, by running far more seeds than sixteen and
// then asking what a median of sixteen would have said. If the bootstrap band is
// wide, every conclusion drawn from a sixteen-seed median needs withdrawing.
//
//   npx tsx scripts/theme-band.ts [theme id] [seeds] [matches per seed]

import { CARDS } from "../data/cards";
import { PRESET_DECKS } from "../data/preset-decks";
import { chooseMove } from "../engine/bot";
import { buildDeckPreferring } from "../engine/deck";
import { applyMove, buildIndex, newMatch } from "../engine/match";
import { nextInt } from "../engine/rng";

const index = buildIndex(CARDS);
const THEME = process.argv[2] ?? "hardware";
const SEEDS = Number(process.argv[3] ?? 64);
const PER_SEED = Number(process.argv[4] ?? 300);

const preset = PRESET_DECKS.find((p) => p.id === THEME);
if (!preset) {
  throw new Error(
    `Unknown theme "${THEME}". One of: ${PRESET_DECKS.map((p) => p.id).join(", ")}.`,
  );
}

// The same reference the real sweep uses, so the numbers are comparable.
const REFERENCE_SEEDS = 60;
const referenceDecks = Array.from({ length: REFERENCE_SEEDS }, (_, i) => {
  const theme = PRESET_DECKS[i % PRESET_DECKS.length]!;
  return buildDeckPreferring(CARDS, 40_000 + i * 97, theme.prefer);
});

function winRate(deck: string[]): number {
  let wins = 0;
  let played = 0;
  for (let s = 0; s < PER_SEED; s++) {
    const aFirst = s % 2 === 0;
    const reference = referenceDecks[s % REFERENCE_SEEDS]!;
    let state = newMatch(
      CARDS,
      s,
      aFirst ? { you: deck, opponent: reference } : { you: reference, opponent: deck },
    );
    let steps = 0;
    while (!state.finished) {
      state = applyMove(state, chooseMove(state, index), index);
      if (++steps > 2000) throw new Error("The match doesn't end.");
    }
    if (state.winner === null) continue;
    played++;
    if ((state.winner === "you") === aFirst) wins++;
  }
  return (wins / played) * 100;
}

// Same spacing as preset-seeds.ts, just more of them, so the sixteen it uses are
// a subset of these.
const rates = Array.from({ length: SEEDS }, (_, i) =>
  winRate(buildDeckPreferring(CARDS, 7_000 + i * 137, preset.prefer)),
);

const median = (xs: readonly number[]) => {
  const sorted = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2;
};

const mean = rates.reduce((a, b) => a + b, 0) / rates.length;
const sd = Math.sqrt(rates.reduce((a, b) => a + (b - mean) ** 2, 0) / (rates.length - 1));
const sorted = [...rates].sort((a, b) => a - b);

// What would a sixteen-seed median have said? Resample sixteen of these, many
// times, and look at the spread of the answer. Seeded so the run repeats.
let rngState = 12_345;
const draws: number[] = [];
for (let trial = 0; trial < 4000; trial += 1) {
  const pick: number[] = [];
  for (let i = 0; i < 16; i += 1) {
    const drawn = nextInt(rates.length, rngState);
    rngState = drawn.state;
    pick.push(rates[drawn.value]!);
  }
  draws.push(median(pick));
}
draws.sort((a, b) => a - b);
const lo = draws[Math.floor(draws.length * 0.025)]!;
const hi = draws[Math.floor(draws.length * 0.975)]!;

console.log(`${preset.name} — ${SEEDS} seeds x ${PER_SEED} matches\n`);
console.log(`  median across all ${SEEDS} seeds : ${median(rates).toFixed(1)}%`);
console.log(`  mean                          : ${mean.toFixed(1)}%`);
console.log(`  spread between seeds          : SD ${sd.toFixed(1)}, from ${sorted[0]!.toFixed(1)}% to ${sorted.at(-1)!.toFixed(1)}%`);
console.log(
  `\n  what a 16-seed median reports : ${lo.toFixed(1)}% to ${hi.toFixed(1)}% (95% of the time)`,
);
console.log(`  so the band on that number is : +/- ${((hi - lo) / 2).toFixed(1)} points`);
console.log(
  `\n  A theme has to move more than ${(hi - lo).toFixed(1)} points between two 16-seed runs before it moved at all.`,
);
