// Which cards get drawn and left in hand?
//
// Every card passes the A/B test in test/set.test.ts, which proves a card does
// something when it is played. It does not prove anybody would ever play it. A
// card that is legal, affordable and still declined every time it is drawn is
// dead in a way no test catches.
//
//   npx tsx scripts/never-played.ts [matches]

import { CARDS } from "../data/cards";
import { chooseMove } from "../engine/bot";
import { buildDeck } from "../engine/deck";
import { cardLabel } from "../engine/format";
import { cardById } from "../engine/helpers";
import { applyMove, buildIndex, newMatch, playable } from "../engine/match";
import { MARKETING_COST } from "../engine/types";

const index = buildIndex(CARDS);
const MATCHES = Number(process.argv[2] ?? 1200);

const drawn = new Map<string, number>();
/** Turns the card sat in hand while it was legal and affordable. */
const declined = new Map<string, number>();
const played = new Map<string, number>();
for (const c of CARDS) {
  drawn.set(c.id, 0);
  declined.set(c.id, 0);
  played.set(c.id, 0);
}

for (let seed = 0; seed < MATCHES; seed++) {
  const deck = buildDeck(CARDS, seed);
  let state = newMatch(CARDS, seed, { you: deck, opponent: deck });
  let guard = 0;
  const seenThisMatch = new Set<string>();

  while (!state.finished && guard++ < 400) {
    const mover = state.toMove;
    for (const id of state.players[mover].hand) {
      const key = `${id}:${mover}`;
      if (!seenThisMatch.has(key)) {
        seenThisMatch.add(key);
        drawn.set(id, drawn.get(id)! + 1);
      }
    }

    const before = state;
    const move = chooseMove(state, index);
    if (move.kind === "playCard") {
      const id = before.players[mover].hand[move.handIndex]!;
      played.set(id, played.get(id)! + 1);
    } else if (move.kind === "endTurn") {
      // Ending with a card that could have been played is a decline.
      for (const id of before.players[mover].hand) {
        if (playable(before, cardById(index, id), mover, index)) {
          declined.set(id, declined.get(id)! + 1);
        }
      }
    }
    state = applyMove(state, move, index);
  }
}

const rows = CARDS.map((c) => ({
  id: c.id,
  label: cardLabel(c),
  rarity: c.rarity,
  cost: MARKETING_COST[c.rarity],
  drawn: drawn.get(c.id)!,
  played: played.get(c.id)!,
  declined: declined.get(c.id)!,
})).filter((r) => r.drawn >= 20);

const never = rows.filter((r) => r.played === 0);
const rarely = rows
  .filter((r) => r.played > 0)
  .map((r) => ({ ...r, rate: r.played / r.drawn }))
  .sort((a, b) => a.rate - b.rate);

console.log(`${MATCHES} matches — cards drawn at least 20 times\n`);
console.log(`  cards in the sample        : ${rows.length} of ${CARDS.length}`);
console.log(`  never played even once     : ${never.length}`);

if (never.length) {
  console.log(`\n  never played:`);
  for (const r of never.slice(0, 25)) {
    console.log(`    ${r.label.padEnd(36)} ${r.rarity.padEnd(10)} drawn ${String(r.drawn).padStart(5)}, declined ${r.declined}`);
  }
  if (never.length > 25) console.log(`    … and ${never.length - 25} more`);
}

console.log(`\n  played least often, of the ones that ever are:`);
for (const r of rarely.slice(0, 15)) {
  console.log(
    `    ${r.label.padEnd(36)} ${r.rarity.padEnd(10)} ${(r.rate * 100).toFixed(1)}% of draws`,
  );
}

// Sanity: a set where everything is played equally would put this near 1.
const rates = rarely.map((r) => r.rate);
const spread = Math.max(...rates) / Math.max(0.0001, Math.min(...rates));
console.log(`\n  most-played card is ${spread.toFixed(0)}x more likely to be played than the least.`);
