// Does stacking one project actually win anything?
//
// A deck cap of three cards per project went in on an argument rather than on a
// number: that without it the best deck would be every BONK and the variety the
// extra cards were meant to buy would be spent on consistency instead. The maker
// asked why anyone should be stopped, which is the right question, and the
// argument had two holes in it.
//
// The precedent was wrong. Pokémon and Magic cap four copies of the same *card*,
// not of the same character; a Pokémon deck may run as many different Charizards
// as it likes. So the games I cited allow exactly the thing I forbade.
//
// And the other rule may already be doing the work. Only one card of a project
// can hold a position, so a deck of eight BONKs has seven cards that cannot be
// played while the eighth is on the table. That is a cost the rules already
// charge, and it is a cost inside the game rather than a notice on the deck page.
//
// So this measures it. If a stacked deck loses, the cap is deleting a choice for
// nothing. If it wins, the cap earns its place — and either way it is a number
// rather than an argument.
//
// The numbers it produced on a single base deck are in the git history and should
// not be trusted in absolute terms; see the note on BASES below for why. The
// direction they showed held up when this was fixed.

import { CARDS } from "../data/cards";
import { PRESET_DECKS } from "../data/preset-decks";
import { chooseMove } from "../engine/bot";
import { buildDeckPreferring } from "../engine/deck";
import { applyMove, buildIndex, newMatch } from "../engine/match";
import { MARKETING_COST, RULES, type Card } from "../engine/types";

const index = buildIndex(CARDS);
/**
 * Base decks per row, and matches against each.
 *
 * Spread over many base decks rather than one, and that is not a detail. The
 * first version built the remaining 39 cards from a single seed with the
 * project's cards removed from the pool — and a different pool shuffles into a
 * different deck, so each project was measured against whatever forty its seed
 * happened to produce. WIF read 24.3% at one card where BONK read 56.4%, which is
 * not a difference two cards in a forty can make. It was the base deck lottery,
 * the same trap that once made every preset look like it won 95%.
 *
 * The second version fixed that and was still wrong: the opponent was the MEME
 * LORD preset, whose seed was tuned to be a good deck, while every challenger was
 * an untuned draw from the same builder. Every row read about 25%, which is the
 * cost of being untuned, not the cost of stacking.
 *
 * So the opponent now comes out of the same generator with a different seed and
 * one card of the project. The stack=1 row is therefore like against like and has
 * to read about 50% — if it does not, this script is broken again.
 */
const BASES = 40;
const MATCHES = 200;
const STACKS = [1, 2, 3, 5, 8] as const;

const cardsOf = (project: string) =>
  CARDS.filter((c) => c.type === "project" && c.project === project);

/**
 * A deck built around one project, taking `stack` of its cards and filling the
 * rest normally. Bypasses deckProblems on purpose — the whole question is what
 * the deck rule should be, so asking the deck rule first would beg it.
 */
function stackedDeck(project: string, stack: number, seed: number, theme: (c: Card) => boolean) {
  const chosen = cardsOf(project).slice(0, stack).map((c) => c.id);
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

const meme = PRESET_DECKS.find((p) => p.id === "meme-lord") ?? PRESET_DECKS[0]!;

console.log("stacking one project against a deck that does not\n");
console.log(`  ${BASES} base decks a row, ${MATCHES} matches each — ${BASES * MATCHES} in total.`);
console.log(`  The band is about ±${(1.96 * Math.sqrt(0.25 / (BASES * MATCHES)) * 100).toFixed(1)}%.`);
console.log(`  Opponent: the same builder, another seed, one card of the project.\n`);

const PROJECT = process.argv[2] ?? "bonk";

console.log(`${PROJECT} cards   spare in hand   avg card   win rate`);
for (const stack of [1, 2, 3, 5, 8]) {
  let pct = 0;
  let cost = 0;
  for (let base = 0; base < BASES; base++) {
    const deck = stackedDeck(PROJECT, stack, meme.seed + base * 1013, meme.prefer);
    const against = stackedDeck(PROJECT, 1, meme.seed + base * 1013 + 500_003, meme.prefer);
    cost += deck.reduce((sum, id) => sum + MARKETING_COST[index.get(id)!.rarity], 0) / deck.length;
    pct += duel(deck, against, MATCHES);
  }
  cost /= BASES;
  pct /= BASES;
  // Every BONK past the first is a card that cannot open its own position. It is
  // not dead any more — a bigger one takes over the position it already holds —
  // but a smaller one drawn after a bigger one still has nowhere to go.
  console.log(
    `${String(stack).padStart(10)}   ${String(stack - 1).padStart(13)}   ${`${Math.round(cost / 1000)}K`.padStart(8)}   ${pct.toFixed(1).padStart(7)}%`,
  );
}

console.log("\n  The stack=1 row is like against like: it has to read about 50%.");
