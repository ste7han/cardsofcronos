// Does one way of playing beat another, and by how much?
//
//   npx tsx scripts/intent-duel.ts          800 matches per pairing
//   npx tsx scripts/intent-duel.ts 2000     more, and slower
//
// THIS REPLACES A TABLE THAT COULD NOT BE CHECKED. scripts/intent.ts carried a
// matrix in a comment saying takes beat everything and community lost to
// everything, with nothing in the repository that produced it. Two things were
// wrong with trusting it.
//
// Its diagonal did not hold up. A style against itself has the same cards on
// both sides of the table, so it has to land near 50% — and that table had takes
// at 35% and momentum at 65%. Whatever produced those numbers was measuring
// something other than which style wins, most likely a seat: moving first is a
// disadvantage in this game (see RULES.firstMoveFreeCard) and a run that does
// not swap sides hands that disadvantage to whoever is written on the left.
//
// And it described a game that no longer exists. It was taken when 136 of the
// 272 project cards did nothing at all and locks had a single card, carrying the
// one restriction the engine measures at minus fifteen thousand.
//
// So: sides swapped every match, many deck seeds per style rather than one, and
// the diagonal printed as the check on the rest of the table rather than left
// out of it. If a style is not near 50% against itself, the number beside it is
// not worth reading either.

import { CARDS } from "../data/cards";
import { chooseMove } from "../engine/bot";
import { buildDeckPreferring } from "../engine/deck";
import { applyMove, buildIndex, newMatch } from "../engine/match";
import type { Card } from "../engine/types";
import { FAMILY_INTENT, INTENTS, type Intent, intentOf } from "./intent";

const index = buildIndex(CARDS);
const count = Number(process.argv[2] ?? 800);

/**
 * What style a card belongs to.
 *
 * A project card is read off its family rather than off its own effect, because
 * a family is the unit a player actually builds around: eight cards of one
 * subject, and the two or three that carry a restriction are what make the other
 * five worth holding. Everything else is read off the card, which is all there
 * is to read.
 */
const styleOf = (card: Card): Intent =>
  card.type === "project" ? (FAMILY_INTENT[card.project] ?? "none") : intentOf(card);

// One deck per style is one deck's luck. A different seed for every match means
// the number is what that style is worth on average rather than what one
// shuffle was worth — the same correction preset-duel.ts already makes for its
// reference deck, for the same reason.
const DECK_SEEDS = 40;
const decks = new Map<Intent, string[][]>();
for (const style of INTENTS) {
  decks.set(
    style,
    Array.from({ length: DECK_SEEDS }, (_, i) =>
      buildDeckPreferring(CARDS, 7_000 + i * 131, (c) => styleOf(c) === style),
    ),
  );
}

/** True when the deck that was asked to move first won. Null on a draw. */
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

/**
 * Row against column, sides swapped every match.
 *
 * The mirror uses two different deck seeds, so a style against itself is still
 * two different forty-card decks rather than the same one twice. Anything else
 * would measure the seat and nothing else.
 */
function duel(row: Intent, col: Intent): { rate: number; played: number } {
  const rowDecks = decks.get(row)!;
  const colDecks = decks.get(col)!;
  let wins = 0;
  let played = 0;
  for (let s = 0; s < count; s++) {
    const a = rowDecks[s % DECK_SEEDS]!;
    // Offset on the mirror so the two sides are never the same deck.
    const b = colDecks[(s + (row === col ? 1 : 0)) % DECK_SEEDS]!;
    const result = play(s, a, b, s % 2 === 0);
    if (result === null) continue;
    played++;
    if (result) wins++;
  }
  return { rate: wins / played, played };
}

const pct = (n: number) => `${(n * 100).toFixed(1)}%`.padStart(7);

console.log(`${count} matches per pairing, sides swapped every match, ${DECK_SEEDS} deck seeds per style\n`);
console.log("row wins against column\n");
console.log("            " + INTENTS.map((i) => i.padStart(7)).join("  "));

const mirrors: [Intent, number][] = [];
const overall = new Map<Intent, { wins: number; played: number }>();
for (const i of INTENTS) overall.set(i, { wins: 0, played: 0 });

for (const row of INTENTS) {
  const cells: string[] = [];
  for (const col of INTENTS) {
    const { rate, played } = duel(row, col);
    cells.push(pct(rate));
    if (row === col) mirrors.push([row, rate]);
    const o = overall.get(row)!;
    o.wins += rate * played;
    o.played += played;
  }
  console.log(`  ${row.padEnd(10)}${cells.join("  ")}`);
}

console.log("\nthe diagonal is the check on everything else:");
let suspect = 0;
for (const [style, rate] of mirrors) {
  const off = Math.abs(rate - 0.5) * 100;
  const verdict = off <= 5 ? "fair" : off <= 10 ? "wide" : "BROKEN — do not read this row";
  if (off > 5) suspect++;
  console.log(`  ${style.padEnd(10)}${pct(rate)}  ${off.toFixed(1)} points off even — ${verdict}`);
}

console.log("\noverall, every style against the whole field:");
for (const [style, o] of [...overall].sort((a, b) => b[1].wins / b[1].played - a[1].wins / a[1].played)) {
  console.log(`  ${style.padEnd(10)}${pct(o.wins / o.played)}`);
}

if (suspect > 0) {
  console.log(
    `\n${suspect} of ${INTENTS.length} styles are more than five points off even against themselves.`,
  );
  console.log("Read the table with that in mind, or raise the match count and run it again.");
}
