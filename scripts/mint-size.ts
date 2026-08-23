// If a deck mint hands out exactly forty cards, the player has no deck to build:
// forty cards is a deck, and whatever came out of the mint is what they play.
// Every rarity guarantee measured in mint-fairness.ts leaves the spread between
// the luckiest and unluckiest tenth at about 35 points.
//
// So this asks the other question: does handing out MORE than forty help? Mint
// N cards, let the player keep the best forty, and see whether choice closes the
// gap that a guarantee could not.
//
// The player here ranks cards by what they were measured to be worth **per
// dollar of marketing budget**, not by raw worth. That distinction is the whole
// measurement: the first version ranked on raw worth, which is what the
// still-life reports once it has handed the card its own price back. Given the
// whole set to choose from it therefore picked the forty most expensive cards in
// the game — a deck you cannot afford to play before turn eight — and reported a
// win rate of 0.0%. A bigger collection cannot make a player weaker, so that was
// the chooser and not the game.
//
// Even repaired this is a crude player. It is a ceiling on choice, not a model of
// a good one.
//
// Past one mint the same script answers the harder question: does the second
// mint, and the tenth, keep buying win rate? Pass sizes to find out — a
// collection of 120 is two mints, 655 is the whole set.
//
//   npx tsx scripts/mint-size.ts [mints per size] [matches per opponent] [sizes...]

import { CARDS } from "../data/cards";
import { chooseMove } from "../engine/bot";
import { buildDeck } from "../engine/deck";
import { cardById } from "../engine/helpers";
import { applyMove, budgetForTurn, buildIndex, newMatch } from "../engine/match";
import { MARKETING_COST, RULES, type Card, type State } from "../engine/types";
import { board, coast, worthOf } from "./lib/still-life";

const index = buildIndex(CARDS);
const MINTS = Number(process.argv[2] ?? 120);
const COUNT = Number(process.argv[3] ?? 24);
const SIZES =
  process.argv.length > 4 ? process.argv.slice(4).map(Number) : [40, 48, 56, 64, 80];

// ---------------------------------------------------------------------------
// What each card is worth, by the still-life measure: play it into a board and
// let the clock run out with both sides passing and their budget marked spent.
// Cheap, deterministic, and it ranks cards without a bot's opinion in it.

const worth = new Map<string, number>();
for (const turn of [3, 6]) {
  for (let seed = 0; seed < 4; seed++) {
    const base = board(CARDS, index, seed, turn);
    const without = coast(structuredClone(base), index);
    for (const card of CARDS) {
      const delta = worthOf(base, card, index, without);
      if (delta === null) continue;
      worth.set(card.id, (worth.get(card.id) ?? 0) + delta);
    }
  }
}

// ---------------------------------------------------------------------------

const field = Array.from({ length: 8 }, (_, i) => buildDeck(CARDS, 400_000 + i * 911));

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

/** Take the best forty, but never fewer projects than a legal deck needs. */
function keepBest(cards: Card[]): string[] {
  // Worth per dollar of marketing budget — and this is the thing to fix before
  // the numbers below mean anything.
  //
  // Ranked this way the best forty comes out as 21 commons, 16 rares, 3 epics
  // and nothing above, all of them projects. deck-quality measures a deck of
  // that shape at a 14.8% median win rate. So the oracle builds a losing deck,
  // which is why choosing from a bigger mint scores *worse* here than taking
  // the mint as dealt — an impossible result, and the tell that the objective
  // is wrong rather than the answer surprising.
  //
  // It reads the other way round from the failure in the header above. Ranking
  // on raw worth picked the forty most expensive cards; ranking per dollar
  // picks the forty cheapest. Neither is what wins, because the scarce thing is
  // not money — it is the six portfolio positions. A common is the best value
  // per dollar in the set and among the worst per position.
  //
  // This used to look like it worked, for the wrong reason: the still life
  // charged every card for closing a position on a full board, which suppressed
  // cheap cards hardest and accidentally kept the ranking sane. Fixing that
  // measurement exposed this one.
  const per = (c: Card) => (worth.get(c.id) ?? 0) / MARKETING_COST[c.rarity];
  const ranked = [...cards].sort((a, b) => per(b) - per(a));
  const projects = ranked.filter((c) => c.type === "project");
  const kept: Card[] = projects.slice(0, RULES.minProjects);
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

/** Mint `size` distinct cards. Same shuffle the deck builder uses. */
function mint(seed: number, size: number): Card[] {
  const pool = buildDeck(CARDS, seed).map((id) => cardById(index, id));
  if (size <= pool.length) return pool.slice(0, size);
  // Past forty, keep drawing from fresh shuffles until the mint is full.
  const taken = new Set(pool.map((c) => c.id));
  let extra = 1;
  while (pool.length < size && extra < 40) {
    for (const id of buildDeck(CARDS, seed * 7919 + extra * 104_729)) {
      if (pool.length === size) break;
      if (!taken.has(id)) {
        taken.add(id);
        pool.push(cardById(index, id));
      }
    }
    extra += 1;
  }
  return pool;
}

const at = (xs: number[], q: number) => xs[Math.min(xs.length - 1, Math.floor(q * xs.length))]!;

console.log(
  "\n  WARNING: the chooser ranks by worth per dollar, which builds a deck of\n" +
    "  21 commons and no legendaries — a shape measured at a 14.8% win rate.\n" +
    "  The table below is not usable until the objective is per position rather\n" +
    "  than per dollar. Left running rather than deleted so the fix can be\n" +
    "  checked against it.\n",
);
console.log(
  `${MINTS} mints per size, each deck played ${COUNT * field.length} matches ` +
    `against eight minted decks\n`,
);
console.log(`  collection     deck is    worst tenth   median   best tenth   spread`);

for (const size of SIZES) {
  const rates: number[] = [];
  for (let i = 0; i < MINTS; i++) {
    const cards = mint(90_000 + i * 173, size);
    const deck = size === RULES.deckSize ? cards.map((c) => c.id) : keepBest(cards);
    let wins = 0;
    let played = 0;
    for (const other of field) {
      for (let s = 0; s < COUNT; s++) {
        const result = play(s, deck, other, s % 2 === 0);
        if (result === null) continue;
        played += 1;
        if (result) wins += 1;
      }
    }
    rates.push(wins / played);
  }
  rates.sort((a, b) => a - b);
  const lo = at(rates, 0.1);
  const hi = at(rates, 0.9);
  const pct = (v: number) => (v * 100).toFixed(1) + "%";
  const label = size === RULES.deckSize ? "the mint" : `best 40`;
  console.log(
    `  ${String(size).padStart(12)}   ${label.padStart(8)}   ` +
      `${pct(lo).padStart(11)}   ${pct(at(rates, 0.5)).padStart(6)}   ${pct(hi).padStart(10)}   ` +
      `${((hi - lo) * 100).toFixed(1).padStart(6)}`,
  );
}

console.log(
  `\n  The chooser is an oracle: it ranks cards by what they were measured to be` +
    `\n  worth, which no player can see. Whatever it cannot fix, choice cannot fix.`,
);
