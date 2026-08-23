// THE MACHINE wins 26.2% of its matches against the other presets and THE ARCADE
// 33.5%, against 69.8% for the best two. A player picks a preset before they know
// anything about the game, so a 43-point spread between the best and worst choice
// is not a metagame, it is a trap.
//
// The preset file already says where the fix lives: each preset is one generated
// deck and the seed decides which cards the theme actually got. Seeds were chosen
// by measurement once — and then the set grew from 177 cards to 655, which builds
// an entirely different forty from the same number. The seeds are stale, not the
// themes.
//
// This scores candidate seeds for the weak presets against the opponents that
// matter: the other seven presets, sides swapped. Not against a generated deck,
// which is not what the game fields.
//
//   npx tsx scripts/preset-repair.ts [matches per pairing] [theme id ...]

import { CARDS } from "../data/cards";
import { PRESET_DECKS } from "../data/preset-decks";
import { chooseMove } from "../engine/bot";
import { buildDeckPreferring } from "../engine/deck";
import { applyMove, buildIndex, newMatch } from "../engine/match";

const index = buildIndex(CARDS);
const COUNT = Number(process.argv[2] ?? 150);
const TARGETS = process.argv.slice(3);
const CANDIDATES = [7000, 7137, 7411, 7548, 7685, 7822, 7959, 8233, 8507, 8781, 9021, 9317];

function play(seed: number, a: string[], b: string[], aFirst: boolean): boolean | null {
  let state = newMatch(CARDS, seed, aFirst ? { you: a, opponent: b } : { you: b, opponent: a });
  let steps = 0;
  while (!state.finished) {
    state = applyMove(state, chooseMove(state, index), index);
    if (++steps > 2000) throw new Error("The match doesn't end.");
  }
  if (state.winner === null) return null;
  return (state.winner === "you") === aFirst;
}

for (const preset of PRESET_DECKS) {
  if (TARGETS.length > 0 && !TARGETS.includes(preset.id)) continue;

  // Every other preset on the seed it ships with today: the field as it stands.
  const field = PRESET_DECKS.filter((p) => p.id !== preset.id).map((p) => ({
    name: p.name,
    deck: buildDeckPreferring(CARDS, p.seed, p.prefer),
  }));

  console.log(`\n${preset.name}  (ships with seed ${preset.seed})`);
  console.log(`  seed     win rate against the other seven presets      worst matchup`);

  const scored: { seed: number; rate: number; worst: string; worstRate: number }[] = [];
  for (const seed of CANDIDATES) {
    const deck = buildDeckPreferring(CARDS, seed, preset.prefer);
    let wins = 0;
    let played = 0;
    let worst = "";
    let worstRate = 1;

    for (const other of field) {
      let w = 0;
      let n = 0;
      for (let s = 0; s < COUNT; s++) {
        const result = play(s, deck, other.deck, s % 2 === 0);
        if (result === null) continue;
        n += 1;
        if (result) w += 1;
      }
      wins += w;
      played += n;
      if (w / n < worstRate) {
        worstRate = w / n;
        worst = other.name;
      }
    }

    const rate = wins / played;
    scored.push({ seed, rate, worst, worstRate });
    const mark = seed === preset.seed ? "  <- ships today" : "";
    console.log(
      `  ${String(seed).padStart(5)}   ${(rate * 100).toFixed(1).padStart(10)}%   ` +
        `${(worst + " " + (worstRate * 100).toFixed(0) + "%").padStart(38)}${mark}`,
    );
  }

  const best = scored.reduce((a, b) => (b.rate > a.rate ? b : a));
  const today = scored.find((c) => c.seed === preset.seed);
  console.log(
    `  best is ${best.seed} at ${(best.rate * 100).toFixed(1)}%` +
      (today ? `, ${((best.rate - today.rate) * 100).toFixed(1)} points above today` : ""),
  );
}

console.log(
  `\n  Picking the top of a list of twelve is picking noise as well as signal.` +
    `\n  Anything chosen here has to be re-run at volume before it ships.`,
);
