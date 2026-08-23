// Twelve cards in the set hand out less extra budget than the cheapest card in
// the game costs. "+$8K marketing budget" cannot buy anything on its own — the
// cheapest common is $20K — so it only ever does something by topping up a
// leftover that was already there.
//
// The question is whether that happens often enough for the card to be doing
// anything at all. A card that reads as a benefit and never is is the exact
// failure this project was built to avoid: it does not fail loudly, it just
// quietly never matters.
//
// Counted by the only thing that settles it: did the player go on to spend past
// what the turn would have given without the grant?
//
//   npx tsx scripts/extra-budget.ts [matches]

import { CARDS } from "../data/cards";
import { chooseMove } from "../engine/bot";
import { buildDeck } from "../engine/deck";
import { formatMC } from "../engine/format";
import { applyMove, buildIndex, newMatch } from "../engine/match";
import { cardById } from "../engine/helpers";
import type { Card } from "../engine/types";

const index = buildIndex(CARDS);
const MATCHES = Number(process.argv[2] ?? 1500);

const grantOf = (card: Card) =>
  card.effect?.kind === "extraBudget" ? card.effect.mc : null;

type Tally = { played: number; used: number; spentPast: number };
const byCard = new Map<string, Tally>();

for (let seed = 0; seed < MATCHES; seed++) {
  const deck = buildDeck(CARDS, seed);
  let state = newMatch(CARDS, seed, { you: deck, opponent: deck });
  let guard = 0;

  // Cards that granted budget this turn, and what the turn had before they did.
  let granters: string[] = [];
  let grantedTotal = 0;

  while (!state.finished && guard++ < 600) {
    const before = state;
    const move = chooseMove(state, index);

    if (move.kind === "playCard") {
      const card = cardById(index, before.players[before.toMove].hand[move.handIndex]!);
      const grant = grantOf(card);
      if (grant !== null) {
        granters.push(card.id);
        grantedTotal += grant;
      }
    }

    if (move.kind === "endTurn" && granters.length > 0) {
      // Everything above this line the turn could have paid for anyway.
      const withoutGrant = before.budgetThisTurn - grantedTotal;
      const past = Math.max(0, before.budgetSpentThisTurn - withoutGrant);
      for (const id of granters) {
        const tally = byCard.get(id) ?? { played: 0, used: 0, spentPast: 0 };
        tally.played += 1;
        if (past > 0) tally.used += 1;
        tally.spentPast += past;
        byCard.set(id, tally);
      }
      granters = [];
      grantedTotal = 0;
    }

    state = applyMove(state, move, index);
  }
}

const rows = [...byCard.entries()]
  .map(([id, t]) => {
    const card = cardById(index, id);
    return { card, grant: grantOf(card)!, ...t };
  })
  .filter((r) => r.played >= 20)
  .sort((a, b) => a.grant - b.grant);

console.log(`${MATCHES} matches — cards that hand out extra marketing budget\n`);
console.log(`  grant    card                       played   grant reached a card   spent past`);
for (const r of rows) {
  const share = ((r.used / r.played) * 100).toFixed(0) + "%";
  const flag = r.grant < 20_000 ? "  <- smaller than the cheapest card" : "";
  console.log(
    `  ${formatMC(r.grant).padStart(6)}   ${r.card.name.padEnd(24)} ${String(r.played).padStart(6)}   ` +
      `${share.padStart(20)}   ${formatMC(r.spentPast / r.played).padStart(9)}${flag}`,
  );
}
console.log(
  `\n  "Grant reached a card" means the player went on to spend past what the turn` +
    `\n  would have allowed without it. Anything near 0% is a card that reads as a` +
    `\n  benefit and is not one.`,
);
