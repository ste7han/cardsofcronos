// The rarity table for a mint is a dial, not a switch. This turns it.
//
// Steeper odds make a mythic scarce, which is what a rarity is for. They also
// make every deck cheaper, and a cheaper deck escapes the marketing budget:
// measured at 15.7 cards played per match on today's uniform mint against 21.9
// on a 50/30/10/8/2 table. The budget is an equaliser precisely because it stops
// you playing most of your deck, so lifting it lets whatever decides deck
// quality decide more of the match. Today that is luck.
//
// Every row is the same measurement; only the table changed.
//
//   npx tsx scripts/mint-curves.ts [mints] [matches per opponent]

import { CARDS } from "../data/cards";
import { chooseMove } from "../engine/bot";
import { formatMC } from "../engine/format";
import { cardById } from "../engine/helpers";
import { applyMove, buildIndex, newMatch } from "../engine/match";
import { MARKETING_COST, RARITIES, RULES, type Card } from "../engine/types";
import { nextInt } from "../engine/rng";
import { measureWorth } from "./lib/card-worth";
import { mint, oddsFrom } from "./lib/mint-draw";

const index = buildIndex(CARDS);
const MINTS = Number(process.argv[2] ?? 60);
const COUNT = Number(process.argv[3] ?? 24);
const SIZE = 60;
const MIN_PROJECTS = 20;
/** Cards of one project a mint may hand over. Infinity for no cap. */
const CAP = Number(process.argv[4] ?? Infinity);

// The set's own mix is the table a uniform mint uses today, whether anyone chose
// it or not: 31 / 28 / 22 / 11 / 9.
const CURVES: { name: string; odds: string }[] = [
  { name: "today (uniform)", odds: "31,28,22,11,9" },
  { name: "gentle", odds: "40,28,17,10,5" },
  { name: "middle", odds: "45,30,13,9,3" },
  { name: "yours", odds: "50,30,10,8,2" },
  { name: "steep", odds: "60,25,9,5,1" },
];

const worth = measureWorth(index);

function keepBest(cards: Card[]): string[] {
  const per = (c: Card) => (worth.get(c.id) ?? 0) / MARKETING_COST[c.rarity];
  const ranked = [...cards].sort((a, b) => per(b) - per(a));
  const kept: Card[] = ranked.filter((c) => c.type === "project").slice(0, RULES.minProjects);
  const taken = new Set(kept.map((c) => c.id));
  for (const card of ranked) {
    if (kept.length === RULES.deckSize) break;
    if (!taken.has(card.id)) {
      kept.push(card);
      taken.add(card.id);
    }
  }
  return kept.map((c) => c.id);
}

type Outcome = { aWon: boolean | null; mc: number; played: number };

function play(seed: number, a: string[], b: string[], aFirst: boolean): Outcome {
  let state = newMatch(CARDS, seed, aFirst ? { you: a, opponent: b } : { you: b, opponent: a });
  let steps = 0;
  let played = 0;
  while (!state.finished) {
    const move = chooseMove(state, index);
    if (move.kind === "playCard") played += 1;
    state = applyMove(state, move, index);
    if (++steps > 2000) throw new Error("The match doesn't end.");
  }
  const mc = (state.players.you.mc + state.players.opponent.mc) / 2;
  const rest = { mc, played: played / 2 };
  if (state.winner === null) return { aWon: null, ...rest };
  return { aWon: (state.winner === "you") === aFirst, ...rest };
}

const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;

/**
 * What the spread figure is worth.
 *
 * A tenth-to-tenth gap over eighty decks is two order statistics, and order
 * statistics are noisy. Resampling the same decks with replacement says how far
 * the number moves without anything about the game changing — which is the only
 * way to know whether two rows differ. Deterministic, because the whole project
 * is: the resample index walks a fixed stride rather than a random one.
 */
function spreadBand(rates: number[]): { low: number; high: number } {
  const spreads: number[] = [];
  let state = 12_345;
  for (let round = 0; round < 400; round++) {
    const sample: number[] = [];
    for (let i = 0; i < rates.length; i++) {
      // engine/rng, not a hand-rolled one. The first version took an LCG modulo
      // the sample size, and the low bits of an LCG have a period of a handful
      // -- so a "resample" was the same few decks over and over and the band
      // came out with the observed value sitting on its edge instead of in its
      // middle. That is what gave it away.
      const draw = nextInt(rates.length, state);
      state = draw.state;
      sample.push(rates[draw.value]!);
    }
    spreads.push(at(sample, 0.9) - at(sample, 0.1));
  }
  spreads.sort((a, b) => a - b);
  return { low: at(spreads, 0.05) * 100, high: at(spreads, 0.95) * 100 };
}
const at = (xs: number[], q: number) => {
  const sorted = [...xs].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))]!;
};

console.log(
  `${MINTS} mints of ${SIZE} per curve, ${COUNT} matches per pairing, ` +
    `${Number.isFinite(CAP) ? `at most ${CAP} cards of one project` : "no cap per project"}\n`,
);
console.log(
  `  curve             odds (c/r/e/l/m)   mythics   no mythic          spread   played   market cap`,
);

for (const curve of CURVES) {
  const odds = oddsFrom(curve.odds);
  const build = (seed: number) => keepBest(mint(seed, SIZE, MIN_PROJECTS, odds, {}, CAP).cards);
  const field = Array.from({ length: 6 }, (_, i) => build(700_000 + i * 911));

  const rates: number[] = [];
  const caps: number[] = [];
  const cards: number[] = [];
  let mythicsInMint = 0;
  let mintsWithout = 0;

  for (let i = 0; i < MINTS; i++) {
    const drawn = mint(i * 173 + 5, SIZE, MIN_PROJECTS, odds, {}, CAP).cards;
    const mythics = drawn.filter((c) => c.rarity === "mythic").length;
    mythicsInMint += mythics;
    if (mythics === 0) mintsWithout += 1;

    const deck = keepBest(drawn);
    let wins = 0;
    let decided = 0;
    for (const other of field) {
      for (let s = 0; s < COUNT; s++) {
        const out = play(s, deck, other, s % 2 === 0);
        caps.push(out.mc);
        cards.push(out.played);
        if (out.aWon === null) continue;
        decided += 1;
        if (out.aWon) wins += 1;
      }
    }
    rates.push(wins / decided);
  }

  const spread = (at(rates, 0.9) - at(rates, 0.1)) * 100;
  const band = spreadBand(rates);
  console.log(
    `  ${curve.name.padEnd(17)} ${curve.odds.padStart(16)}   ` +
      `${(mythicsInMint / MINTS).toFixed(1).padStart(7)}   ` +
      `${((mintsWithout / MINTS) * 100).toFixed(0).padStart(8)}%   ` +
      `${(spread.toFixed(1) + ` (${band.low.toFixed(0)}-${band.high.toFixed(0)})`).padStart(14)}   ` +
      `${mean(cards).toFixed(1).padStart(6)}   ${formatMC(mean(caps)).padStart(10)}`,
  );
}

console.log(
  `\n  "mythics" is how many land in a mint of ${SIZE}; "no mythic" is the share of` +
    `\n  mints that get none. "spread" is the gap in win rate between the luckiest` +
    `\n  and unluckiest tenth of players — lower is fairer. "played" is cards played` +
    `\n  per player per match, out of a deck of ${RULES.deckSize}.`,
);
console.log(
  `\n  The bracket after each spread is what that figure is worth — resampled from` +
    `\n  the same decks. Two rows have to clear each other's brackets before` +
    `\n  anything about the game has moved.`,
);
