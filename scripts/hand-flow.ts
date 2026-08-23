// What actually happens to a hand over a match.
//
// The draw rule tops you up to RULES.handSize at the start of your turn, and
// nothing caps the hand after that — a drawCards effect can push you past it.
// The question this answers is whether hands clog: do turns end with cards left
// that could not be played, and is a player ever stuck holding cards while
// having plays to spare?
//
//   npx tsx scripts/hand-flow.ts
import { CARDS } from "../data/cards";
import { chooseMove } from "../engine/bot";
import { buildDeck } from "../engine/deck";
import { formatMC } from "../engine/format";
import { cardById } from "../engine/helpers";
import { applyMove, buildIndex, newMatch, playable, whyNot } from "../engine/match";
import { MARKETING_COST, RULES } from "../engine/types";

const index = buildIndex(CARDS);
const MATCHES = 4000;

const handAtTurnStart: number[] = [];
const handAtTurnEnd: number[] = [];
// A "turn" is one player's turn. state.turn counts rounds and both players move
// inside one, so counting round changes counted half the turns while the tallies
// below counted all of them — which is how this printed "163.1% of turns".
// Anything over 100% is the measurement, never the game.
let turnsSeen = 0;
let stuckTurns = 0; // plays left, cards in hand, nothing legal to play
let unusedPlays = 0;
let deckEmptied = 0;
let blockedByEnemyBoard = 0;
let blockedByOwnBoard = 0;
let blockedByPosition = 0;
let blockedByPrice = 0;

for (let seed = 0; seed < MATCHES; seed++) {
  const deck = buildDeck(CARDS, seed);
  let state = newMatch(CARDS, seed, { you: deck, opponent: deck });
  let guard = 0;
  let last = "";
  let beforeEnd = state;

  while (!state.finished && guard++ < 400) {
    const mover = state.toMove;
    const turnKey = `${state.turn}:${mover}`;
    if (turnKey !== last) {
      last = turnKey;
      turnsSeen++;
      const h = state.players[mover].hand.length;
      handAtTurnStart.push(h);
      if (state.players[mover].deck.length === 0) deckEmptied++;
    }
    beforeEnd = state;
    const move = chooseMove(state, index);
    if (move.kind === "endTurn") {
      const side = beforeEnd.players[mover];
      const playsLeft = beforeEnd.budgetThisTurn - beforeEnd.budgetSpentThisTurn;
      handAtTurnEnd.push(side.hand.length);
      if (playsLeft > 0 && side.hand.length > 0) {
        const anyLegal = side.hand.some((id) =>
          playable(beforeEnd, cardById(index, id), mover, index),
        );
        if (!anyLegal) {
          stuckTurns++;
          // Every branch below matches one sentence whyNot() can return, and an
          // unrecognised reason throws. The first version had an else-branch that
          // caught everything, so the two counters it did not know about stayed at
          // zero and printed as "0%" — a finding that was really a dead counter.
          for (const id of side.hand) {
            const reason = whyNot(beforeEnd, cardById(index, id), mover, index);
            if (reason === null) continue;
            if (reason.includes("budget left this turn")) blockedByPrice++;
            else if (reason.includes("opponent's board")) blockedByEnemyBoard++;
            else if (reason.includes("your own")) blockedByOwnBoard++;
            else if (reason.includes("not a step up")) blockedByPosition++;
            else throw new Error(`hand-flow cannot classify this reason: ${reason}`);
          }
        }
        unusedPlays += playsLeft;
      }
    }
    state = applyMove(state, move, index);
  }
}

const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
const pct = (n: number, d: number) => `${((n / d) * 100).toFixed(1)}%`;
const hist = (xs: number[]) => {
  const counts = new Map<number, number>();
  for (const x of xs) counts.set(x, (counts.get(x) ?? 0) + 1);
  return [...counts.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([size, n]) => `${size}:${pct(n, xs.length)}`)
    .join("  ");
};

console.log(`${MATCHES} matches, ${turnsSeen} turns\n`);
// Note: the turn-start snapshot is taken after the top-up has already run, so
// it shows what you hold once drawing is done, not what you held before it.
console.log(`hand at turn start   mean ${mean(handAtTurnStart).toFixed(2)}   ${hist(handAtTurnStart)}`);
console.log(`hand at turn end     mean ${mean(handAtTurnEnd).toFixed(2)}   ${hist(handAtTurnEnd)}`);
const overFull = handAtTurnStart.filter((h) => h > RULES.handSize).length;
console.log(`\nturns holding more than ${RULES.handSize} (draw effects, nothing caps it) : ${pct(overFull, turnsSeen)}`);
console.log(`turns ended with budget left and nothing legal      : ${pct(stuckTurns, turnsSeen)}`);
console.log(`budget left unspent, per turn                       : ${formatMC(unusedPlays / turnsSeen)}`);
console.log(`turns beginning with an empty deck                  : ${pct(deckEmptied, turnsSeen)}`);
console.log(`\nwhen stuck, which cards were blocked:`);
const blocked = blockedByPrice + blockedByEnemyBoard + blockedByOwnBoard + blockedByPosition;
console.log(`  too expensive for the budget left       : ${blockedByPrice} (${pct(blockedByPrice, blocked)})`);
console.log(`  needed an opponent project, board empty : ${blockedByEnemyBoard} (${pct(blockedByEnemyBoard, blocked)})`);
console.log(`  needed a project of your own, board empty: ${blockedByOwnBoard} (${pct(blockedByOwnBoard, blocked)})`);
console.log(`  the position is held by a bigger card    : ${blockedByPosition} (${pct(blockedByPosition, blocked)})`);

// ---------------------------------------------------------------------------
// How long does a card sit in a hand?
//
// Nothing hard-blocks a hand, so a clog would show up as age instead: cards the
// bot keeps declining to play. That matters because you draw back only to the
// hand size — every card you hold onto is a card you do not draw. Holding two
// dead cards permanently cuts your draw from three a turn to one.
// ---------------------------------------------------------------------------

const ages: number[] = [];
let cardsEverHeld = 0;
let heldToTheEnd = 0;

for (let seed = 0; seed < 1500; seed++) {
  const deck = buildDeck(CARDS, seed);
  let state = newMatch(CARDS, seed, { you: deck, opponent: deck });
  const firstSeen = new Map<string, number>();
  for (const id of state.players.you.hand) firstSeen.set(id, 0);
  let guard = 0;
  let last = -1;
  while (!state.finished && guard++ < 400) {
    state = applyMove(state, chooseMove(state, index), index);
    if (state.turn !== last) {
      last = state.turn;
      const hand = new Set(state.players.you.hand);
      for (const id of hand) if (!firstSeen.has(id)) firstSeen.set(id, state.turn);
      for (const [id, since] of [...firstSeen]) {
        if (!hand.has(id)) {
          ages.push(state.turn - since);
          cardsEverHeld++;
          firstSeen.delete(id);
        }
      }
    }
  }
  for (const [, since] of firstSeen) {
    ages.push(RULES.turns - since);
    cardsEverHeld++;
    heldToTheEnd++;
  }
}

const sorted = [...ages].sort((a, b) => a - b);
console.log(`\n1500 matches, ${cardsEverHeld} cards passed through a hand`);
console.log(`turns a card sits in hand   mean ${mean(ages).toFixed(2)}   median ${sorted[Math.floor(sorted.length / 2)]}   p90 ${sorted[Math.floor(sorted.length * 0.9)]}`);
console.log(`held 3+ turns : ${pct(ages.filter((a) => a >= 3).length, ages.length)}`);
console.log(`held 5+ turns : ${pct(ages.filter((a) => a >= 5).length, ages.length)}`);
console.log(`never played, still in hand at the end : ${pct(heldToTheEnd, cardsEverHeld)}`);
