// Does attacking pay?
//
// A mythic project stands at the end of 97% of the matches it is played in, and
// 1.18 positions out of twelve on the table come off per match. Cards that take
// something away exist in the set; whether it is ever right to spend a turn on
// one is a different question, and nothing here has asked it.
//
// Two halves, because either on its own can mislead.
//
// What happens: how often an attack is played, what it takes off, and what
// actually kills a position when one dies. Counted from the state before and
// after each move rather than from the log, because a log line is written by the
// card and the question is what the card did.
//
// What it is worth: the still life, filtered. Every attacking card against every
// other card, in margin per $10K of marketing budget. Margin rather than market
// cap is the whole point here — an attack scores nothing for itself and
// everything for what the other player stops earning, and market cap cannot see
// that at all.
//
//   npx tsx scripts/attack-worth.ts [matches] [boards]

import { CARDS } from "../data/cards";
import { chooseMove } from "../engine/bot";
import { buildDeck } from "../engine/deck";
import { formatMC } from "../engine/format";
import { cardById } from "../engine/helpers";
import { applyMove, buildIndex, newMatch } from "../engine/match";
import { MARKETING_COST } from "../engine/types";
import type { Card, Effect, Player, State } from "../engine/types";
import { validateSet } from "../engine/validation";
import { board, coast, worthOf } from "./lib/still-life";

const index = buildIndex(CARDS);
validateSet(CARDS);

const MATCHES = Number(process.argv[2] ?? 3000);
const BOARDS = Number(process.argv[3] ?? 30);

/** Does this effect take something off the other side of the table? */
function attacks(effect: Effect | undefined): boolean {
  if (!effect) return false;
  switch (effect.kind) {
    case "rug":
    case "damageHolders":
      return String(effect.target).includes("nemy") || effect.target === "allProjects";
    case "cancel":
      return effect.target !== "self";
    case "stealMC":
      return true;
    case "scaleMC":
      return effect.percentage < 0 && effect.target !== "self";
    case "directMC":
      return effect.mc < 0 && effect.target !== "self";
    case "pumpProject":
      return effect.mc < 0 && String(effect.target).includes("nemy");
    default:
      return false;
  }
}

/** An attacking card is one whose ordinary effect or payoff takes something. */
const isAttack = (card: Card) => attacks(card.effect) || attacks(card.payoff?.effect);

const attackIds = new Set(CARDS.filter(isAttack).map((c) => c.id));

// ---------------------------------------------------------------------------
// What happens

let played = 0;
let attacksPlayed = 0;
let holdersOff = 0;
let rugs = 0;
let deniedPump = 0;
let healed = 0;
const killedBy = new Map<string, number>();

const holdersOn = (s: State, p: Player) => s.players[p].projects.reduce((n, x) => n + x.holders, 0);

for (let seed = 0; seed < MATCHES; seed++) {
  let s: State = newMatch(CARDS, seed);
  let guard = 0;
  while (!s.finished && guard++ < 2000) {
    const move = chooseMove(s, index);
    const mover = s.toMove;
    const them: Player = mover === "you" ? "opponent" : "you";
    const cardId = move.kind === "playCard" ? s.players[mover].hand[move.handIndex] : undefined;

    const holdersBefore = holdersOn(s, them);
    const holdersOnBefore = new Map(s.players[mover].projects.map((x) => [x.cardId, x.holders]));
    const positionsBefore = s.players[them].projects.length;
    // What those positions would still have paid, if nothing touched them.
    const turnsLeft = Math.max(0, 10 - s.turn);

    const next = applyMove(s, move, index);

    if (cardId) {
      played++;
      if (attackIds.has(cardId)) attacksPlayed++;
      // Healing on your own side. Counted position by position and only on
      // positions that already existed, because the first version took the total
      // before and after and read every project played as 62 holders of healing
      // a match — a new position brings its own holders with it.
      for (const [id, was] of holdersOnBefore) {
        const now = next.players[mover].projects.find((x) => x.cardId === id)?.holders;
        if (now !== undefined && now > was) healed += now - was;
      }

      const lost = holdersBefore - holdersOn(next, them);
      const gone = positionsBefore - next.players[them].projects.length;
      if (lost > 0) holdersOff += lost;
      if (gone > 0) {
        rugs += gone;
        killedBy.set(cardId, (killedBy.get(cardId) ?? 0) + gone);
        // Rough, and stated as rough: the average pump of what was on that board.
        deniedPump += gone * turnsLeft * 30_000;
      }
    }
    s = next;
  }
}

console.log(`${MATCHES} matches\n`);
console.log(`  cards played           : ${(played / MATCHES).toFixed(1)} per match`);
console.log(
  `  of those, attacks      : ${(attacksPlayed / MATCHES).toFixed(1)} (${((100 * attacksPlayed) / played).toFixed(1)}%)`,
);
console.log(`  holders taken off      : ${(holdersOff / MATCHES).toFixed(2)} per match`);
console.log(`  holders healed back    : ${(healed / MATCHES).toFixed(2)} per match`);
console.log(`  net damage             : ${((holdersOff - healed) / MATCHES).toFixed(2)} per match`);
console.log(`  positions killed       : ${(rugs / MATCHES).toFixed(2)} per match, of twelve on the table`);
console.log(`  attacks per kill       : ${(attacksPlayed / Math.max(1, rugs)).toFixed(1)}`);
console.log(`\n  what kills a position, when one dies:`);
for (const [id, n] of [...killedBy].sort((a, b) => b[1] - a[1]).slice(0, 8)) {
  const card = cardById(index, id);
  console.log(`    ${String(((100 * n) / Math.max(1, rugs)).toFixed(1)).padStart(5)}%  ${card.name} (${card.type})`);
}

// ---------------------------------------------------------------------------
// What it is worth

const per = new Map<string, number[]>();
for (let seed = 0; seed < BOARDS; seed++) {
  const deck = buildDeck(CARDS, seed);
  const base = board(CARDS, index, seed, 5, { you: deck, opponent: deck });
  const without = coast(base, index);
  for (const card of CARDS) {
    const delta = worthOf(base, card, index, without);
    if (delta === null) continue;
    const key = isAttack(card) ? "attack" : "everything else";
    per.set(key, [...(per.get(key) ?? []), (delta / MARKETING_COST[card.rarity]) * 10_000]);
  }
}

const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / Math.max(1, xs.length);
const median = (xs: number[]) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)] ?? 0;

console.log(`\n  margin per $10K of marketing budget, ${BOARDS} boards at turn five:\n`);
console.log(`    group             mean      median        n`);
for (const [key, xs] of per) {
  console.log(
    `    ${key.padEnd(16)}${formatMC(Math.round(mean(xs))).padStart(8)}${formatMC(Math.round(median(xs))).padStart(12)}${String(xs.length).padStart(9)}`,
  );
}
console.log(
  `\n  ${attackIds.size} of ${CARDS.length} cards attack. The still life coasts after the card is\n` +
    `  played, so an attack is credited with every turn of pump it denied — which\n` +
    `  is the most generous reading of one there is.`,
);
