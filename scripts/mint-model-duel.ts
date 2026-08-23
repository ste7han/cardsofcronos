// How a deck built from the proposed mint plays.
//
// mint-model.ts says what comes out of the mint. This says what it is worth at
// the table: decks built from the new odds against each other, and against decks
// from the mint as it works today — a uniform draw that hands over 5.2 mythics.
//
// The point is not which is stronger. Both sides of a match come from the same
// mint, so a weaker mint makes a slower game rather than a losing one. What
// matters is the spread between a lucky and an unlucky player, and whether the
// game still looks like itself.
//
//   npx tsx scripts/mint-model-duel.ts [mints] [matches per opponent] [odds]

import { CARDS } from "../data/cards";
import { chooseMove } from "../engine/bot";
import { buildDeck } from "../engine/deck";
import { formatMC } from "../engine/format";
import { cardById } from "../engine/helpers";
import { applyMove, buildIndex, newMatch } from "../engine/match";
import { MARKETING_COST, RARITIES, RULES, type Card } from "../engine/types";
import { measureWorth } from "./lib/card-worth";
import { mint, oddsFrom } from "./lib/mint-draw";

const index = buildIndex(CARDS);
const MINTS = Number(process.argv[2] ?? 60);
const COUNT = Number(process.argv[3] ?? 24);
const ODDS = oddsFrom(process.argv[4] ?? "50,30,10,8,2");
const SIZE = 60;
const MIN_PROJECTS = 20;
/** "1,2" means at least one mythic and two legendaries. Empty means no floor. */
const FLOORS = (() => {
  const text = process.argv[5];
  if (!text) return {};
  const [myth = 0, leg = 0] = text.split(",").map(Number);
  return { mythic: myth, legendary: leg };
})();

const worth = measureWorth(index);

/** The best forty, ranked per dollar of marketing budget. Never short on projects. */
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

const newDeck = (seed: number) => keepBest(mint(seed, SIZE, MIN_PROJECTS, ODDS, FLOORS).cards);
const oldDeck = (seed: number) =>
  keepBest(
    // What a mint does today: a uniform draw, topped up to sixty.
    (() => {
      const pool = buildDeck(CARDS, seed).map((id) => cardById(index, id));
      const taken = new Set(pool.map((c) => c.id));
      for (const id of buildDeck(CARDS, seed * 7919 + 3)) {
        if (pool.length === SIZE) break;
        if (!taken.has(id)) {
          taken.add(id);
          pool.push(cardById(index, id));
        }
      }
      return pool;
    })(),
  );

type Outcome = { aWon: boolean | null; mc: number; played: number; wasted: number };

function play(seed: number, a: string[], b: string[], aFirst: boolean): Outcome {
  let state = newMatch(CARDS, seed, aFirst ? { you: a, opponent: b } : { you: b, opponent: a });
  let steps = 0;
  let played = 0;
  let wasted = 0;
  while (!state.finished) {
    const before = state;
    const move = chooseMove(state, index);
    if (move.kind === "playCard") played += 1;
    if (move.kind === "endTurn") wasted += before.budgetThisTurn - before.budgetSpentThisTurn;
    state = applyMove(state, move, index);
    if (++steps > 2000) throw new Error("The match doesn't end.");
  }
  const mc = (state.players.you.mc + state.players.opponent.mc) / 2;
  const out = { mc, played: played / 2, wasted: wasted / 2 };
  if (state.winner === null) return { aWon: null, ...out };
  return { aWon: (state.winner === "you") === aFirst, ...out };
}

const at = (xs: number[], q: number) => {
  const sorted = [...xs].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))]!;
};
const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;

// ---------------------------------------------------------------------------
// What the deck a player builds out of the mint looks like.

const shape = new Map<string, number[]>();
for (const label of ["new", "old"]) shape.set(label, []);
const rarityShape = new Map<string, Map<string, number[]>>();
for (const label of ["new", "old"]) {
  rarityShape.set(label, new Map(RARITIES.map((r) => [r, [] as number[]])));
}

for (let i = 0; i < 400; i++) {
  for (const [label, build] of [
    ["new", newDeck],
    ["old", oldDeck],
  ] as const) {
    const deck = build(i * 173 + 5).map((id) => cardById(index, id));
    shape.get(label)!.push(deck.reduce((t, c) => t + MARKETING_COST[c.rarity], 0) / deck.length);
    for (const rarity of RARITIES) {
      rarityShape.get(label)!.get(rarity)!.push(deck.filter((c) => c.rarity === rarity).length);
    }
  }
}

console.log(`The forty a player builds out of a mint of ${SIZE}\n`);
console.log(`  mint      ${RARITIES.map((r) => r.slice(0, 4).padStart(6)).join("")}   avg price`);
for (const label of ["old", "new"] as const) {
  console.log(
    `  ${(label === "old" ? "uniform" : "new odds").padEnd(9)} ` +
      RARITIES.map((r) => mean(rarityShape.get(label)!.get(r)!).toFixed(1).padStart(6)).join("") +
      `   ${formatMC(mean(shape.get(label)!)).padStart(9)}`,
  );
}

// ---------------------------------------------------------------------------
// Spread within a mint model, and the two against each other.

console.log(`\nHow they play — ${MINTS} mints each, ${COUNT} matches per pairing\n`);

for (const [label, build] of [
  ["uniform (today)", oldDeck],
  [FLOORS.mythic ? `new odds +${FLOORS.mythic}m${FLOORS.legendary ?? 0}l` : "new odds", newDeck],
] as const) {
  const field = Array.from({ length: 6 }, (_, i) => build(700_000 + i * 911));
  const rates: number[] = [];
  const caps: number[] = [];
  const playedPer: number[] = [];
  const wastedPer: number[] = [];
  for (let i = 0; i < MINTS; i++) {
    const deck = build(i * 173 + 5);
    let wins = 0;
    let played = 0;
    for (const other of field) {
      for (let s = 0; s < COUNT; s++) {
        const out = play(s, deck, other, s % 2 === 0);
        caps.push(out.mc);
        playedPer.push(out.played);
        wastedPer.push(out.wasted);
        if (out.aWon === null) continue;
        played += 1;
        if (out.aWon) wins += 1;
      }
    }
    rates.push(wins / played);
  }
  const lo = at(rates, 0.1);
  const hi = at(rates, 0.9);
  console.log(
    `  ${label.padEnd(16)} unlucky tenth ${(lo * 100).toFixed(1)}%   median ` +
      `${(at(rates, 0.5) * 100).toFixed(1)}%   lucky tenth ${(hi * 100).toFixed(1)}%   ` +
      `spread ${((hi - lo) * 100).toFixed(1)}`,
  );
  console.log(
    `  ${" ".repeat(16)} market cap ${formatMC(mean(caps))}   ` +
      `cards played ${mean(playedPer).toFixed(1)}   budget wasted ${formatMC(mean(wastedPer))}`,
  );
}

// New against old, head to head, so the two mints meet.
let newWins = 0;
let decided = 0;
for (let i = 0; i < MINTS; i++) {
  const mine = newDeck(i * 173 + 5);
  const theirs = oldDeck(i * 331 + 11);
  for (let s = 0; s < COUNT; s++) {
    const out = play(s, mine, theirs, s % 2 === 0);
    if (out.aWon === null) continue;
    decided += 1;
    if (out.aWon) newWins += 1;
  }
}
console.log(
  `\n  new odds against the mint as it works today: ` +
    `${((newWins / decided) * 100).toFixed(1)}% of ${decided} matches`,
);
console.log(
  `\n  Spread is the column that matters. Both players draw from the same mint,` +
    `\n  so odds that make every deck weaker make a slower game, not a worse one —` +
    `\n  but odds that widen the gap between lucky and unlucky make a worse one.`,
);
