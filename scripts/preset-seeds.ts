// Is a preset's strength its theme, or the seed it happened to be built with?
//
// Each preset is one generated deck, and the generator's seed decides which
// cards the theme actually got. Picking a seed by hand and never checking it is
// how you hand a player a deck that loses four matches in five for no reason
// anyone can see. This plays every theme on many seeds against a fixed
// reference deck, so the spread across seeds can be compared with the spread
// across themes.
//
// The median it prints carries a band, and that band is wide: a theme's seeds
// spread 25 to 50 points, so the median of sixteen of them is worth about +/- 7.
// Two runs of this script were once read against each other as though the
// difference were real, and every movement in that comparison was inside the
// band. The band is printed beside the median now for exactly that reason, and
// scripts/theme-band.ts measures it properly.
//
// Note also that the seeds are fixed. The same seed builds a different forty as
// soon as the card pool changes, so comparing two runs across two versions of
// the set is comparing sixteen decks with sixteen entirely different decks.
//
//   npx tsx scripts/preset-seeds.ts [matches per seed] [seeds]
import { CARDS } from "../data/cards";
import { PRESET_DECKS } from "../data/preset-decks";
import { chooseMove } from "../engine/bot";
import { buildDeck, buildDeckPreferring } from "../engine/deck";
import { applyMove, buildIndex, newMatch } from "../engine/match";

const index = buildIndex(CARDS);
const perSeed = Number(process.argv[2] ?? 300);
const seedCount = Number(process.argv[3] ?? 12);
const reference = buildDeck(CARDS, 4242);

function winRate(deck: string[]): number {
  let wins = 0;
  let played = 0;
  for (let s = 0; s < perSeed; s++) {
    const aFirst = s % 2 === 0;
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

console.log(`${perSeed} matches per seed, ${seedCount} seeds per theme, against one generated deck\n`);
console.log("theme          best seed   worst      median   spread");

for (const preset of PRESET_DECKS) {
  const results = Array.from({ length: seedCount }, (_, i) => {
    const seed = 7_000 + i * 137;
    return { seed, pct: winRate(buildDeckPreferring(CARDS, seed, preset.prefer)) };
  }).sort((a, b) => b.pct - a.pct);

  const best = results[0]!;
  const worst = results[results.length - 1]!;
  const median = results[Math.floor(results.length / 2)]!;

  // The band on the median, printed beside it, because this number was read
  // across two runs as though it were exact and it is not. See the note above.
  const rates = results.map((r) => r.pct);
  const mean = rates.reduce((a, b) => a + b, 0) / rates.length;
  const sd = Math.sqrt(rates.reduce((a, b) => a + (b - mean) ** 2, 0) / (rates.length - 1));
  const band = 1.253 * (sd / Math.sqrt(rates.length));

  console.log(
    `${preset.name.padEnd(14)} ${best.seed} ${best.pct.toFixed(0).padStart(3)}%  ${worst.pct.toFixed(0).padStart(3)}%  ${median.pct.toFixed(0).padStart(6)}% +/-${(1.96 * band).toFixed(0).padStart(2)}  ${(best.pct - worst.pct).toFixed(0).padStart(5)} points`,
  );
  console.log(`               median seed ${median.seed}`);
}

console.log(
  `\nThe band beside each median is what that median is worth. Two runs of this\n` +
    `script have to differ by about twice it before the theme moved at all — on\n` +
    `${seedCount} seeds that is usually ten points or more. scripts/theme-band.ts measures it\n` +
    `the slow way, by running 64 seeds and resampling, and agrees.`,
);
