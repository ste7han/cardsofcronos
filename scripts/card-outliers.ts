// Which cards are weak for what they cost — measured where they are actually played.
//
//   npx tsx scripts/card-outliers.ts          12 seeds
//   npx tsx scripts/card-outliers.ts 24       slower, steadier
//
// THIS EXISTS BECAUSE rarity-value.ts MEASURES EVERY CARD AT TURN FIVE, and a card
// cannot be played before you can pay for it. Budget is turn x $40K and the ladder
// is 20/40/80/200/280K, so a common is affordable on turn one and a mythic not
// until turn seven. Measuring a mythic at turn five is measuring a card nobody has
// ever played: the board is smaller, fewer holders have been lost, and everything
// that scales with a match having happened reads low.
//
// That is not a small correction. Loaded Lions' mythic looked weak at turn five
// and sat third of twenty-six at turn eight, which is the first turn it can be
// bought. The card that needed changing needed changing for a different reason.
//
// So each rarity is measured at its own first affordable turn. What comes out is
// a ranking within a rarity — a card well below its own peers is either priced
// wrong or doing something the still life cannot see, and both are worth a look.
//
// WHAT THIS CANNOT SEE, and it matters before anybody acts on the numbers:
//
//   - Conditions. A payoff gated on something the still life never sets up reads
//     as nothing. That is a true finding about a dead card and a false one about
//     a card whose condition a real match meets.
//   - Restrictions. banRoom is worth $1696K by its own measurement and scores
//     zero here, because a standing rule on the opponent does nothing on a board
//     where nobody takes another turn.
//   - Anything that pays across turns. Both sides coast after the card is played,
//     so a pump is worth one turn of itself rather than the three a position
//     survives.
//   - STANDINGS, and this one runs the other way: a standing effect is paid every
//     turn while the position is undamaged, and coasting hands it every remaining
//     turn with nobody to damage it. So the top of a list is as suspect as the
//     bottom. The five epics carrying a $74K standing measure between $929K and
//     $1155K against an epic average of $389K, and in 600 real matches they are
//     played on turn five rather than turn two and only a quarter to a half are
//     still undamaged at the end.
//
// Read the bottom of a list as a question, not a verdict.
//
// RUN ON 2026-09-14 IT FLAGGED FOURTEEN CARDS AND EVERY ONE OF THEM WAS FINE.
// Cross-checked against 500 real matches: all fourteen get played between 66% and
// 100% of the times they are held. The list was five burnForDamage and
// discardCards and peekAndBurn — everything aimed at an opponent who never takes
// another turn — two banRoom mythics, which the engine values at $1696K and this
// scores near zero, and three extraBudget cards, which hand you money on a board
// where there is nothing left to spend it on.
//
// That is not a failure of this script. It is the shape of what it cannot see,
// arriving as a list of names, which is more useful than a warning: these are the
// cards a still life cannot judge. scripts/never-played.ts is the instrument that
// judges them, and it says nothing in this set is dead.
//
// THE TOP OF THE LIST WENT THE SAME WAY. tectonic-v came out at 297% of its
// rarity and is the most conservative card of its kind in the set: 36K per holder
// where the five other per-holder epics pay 42K, and a standing identical to four
// of them. Splitting it showed the standing alone worth $910K of the $1155K. The
// number was the coast, not the card.

import { CARDS } from "../data/cards";
import { buildDeck } from "../engine/deck";
import { formatMC } from "../engine/format";
import { buildIndex } from "../engine/match";
import { MARKETING_COST, RARITIES, RULES, type Rarity } from "../engine/types";
import { board, coast, worthOf } from "./lib/still-life";

const index = buildIndex(CARDS);
const SEEDS = Number(process.argv[2] ?? 12);

/** The first turn a card of this rarity can be paid for. */
function firstAffordable(rarity: Rarity): number {
  const cost = MARKETING_COST[rarity];
  for (let turn = 1; turn <= RULES.turns; turn++) {
    if (turn * RULES.budgetPerTurn >= cost) return turn;
  }
  return RULES.turns;
}

const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / Math.max(1, xs.length);

console.log(`${SEEDS} seeds, each rarity played on the first turn it can be afforded\n`);

const flagged: string[] = [];

for (const rarity of RARITIES) {
  const turn = firstAffordable(rarity);
  const cost = MARKETING_COST[rarity];

  const rows: { id: string; name: string; what: string; gain: number }[] = [];
  for (const card of CARDS) {
    if (card.type !== "project" || card.rarity !== rarity) continue;
    const gains: number[] = [];
    for (let seed = 0; seed < SEEDS; seed++) {
      const deck = buildDeck(CARDS, seed);
      const base = board(CARDS, index, seed, turn, { you: deck, opponent: deck });
      const delta = worthOf(base, card, index, coast(structuredClone(base), index));
      if (delta !== null) gains.push(delta);
    }
    if (gains.length === 0) continue;
    const c = card as { effect?: { kind: string }; payoff?: unknown; restriction?: { kind: string } };
    rows.push({
      id: card.id,
      name: card.name,
      what:
        (c.effect?.kind ?? "—") +
        (c.payoff ? " +payoff" : "") +
        (c.restriction ? ` +${c.restriction.kind}` : ""),
      gain: mean(gains),
    });
  }
  if (rows.length === 0) continue;

  rows.sort((a, b) => b.gain - a.gain);
  const avg = mean(rows.map((r) => r.gain));

  console.log(
    `--- ${rarity}  (${formatMC(cost)}, first playable on turn ${turn})  ` +
      `${rows.length} cards, average ${formatMC(avg)}`,
  );

  // The bottom five and the top three. The whole list is 80 project cards at
  // common and nobody reads 80 lines.
  const show = [...rows.slice(0, 3), null, ...rows.slice(-5)];
  for (const r of show) {
    if (r === null) {
      console.log(`      …`);
      continue;
    }
    const share = r.gain / avg;
    console.log(
      `  ${formatMC(r.gain).padStart(8)}  ${(share * 100).toFixed(0).padStart(4)}%  ` +
        `${r.id.padEnd(20)}${r.what}`,
    );
    // Two thirds of what its own rarity returns, which is far enough out that
    // something is either wrong or interesting.
    if (share < 0.67) flagged.push(`${r.id.padEnd(20)}${(share * 100).toFixed(0)}% of ${rarity} — ${r.what}`);
  }
  console.log();
}

if (flagged.length === 0) {
  console.log("Nothing sits below two thirds of its own rarity.");
} else {
  console.log(`${flagged.length} below two thirds of their own rarity:`);
  for (const f of flagged) console.log(`  ${f}`);
  console.log(
    `\nCheck each against the list at the top of this file before changing anything.\n` +
      `A restriction or a condition reads as nothing here and may be the strongest\n` +
      `card in the set.`,
  );
}
