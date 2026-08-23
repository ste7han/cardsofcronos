// How often does a sector actually sit on your board?
//
// A sector aura is worth bonus x (projects of that sector you hold, each turn).
// The bonus alone therefore says nothing about what a card is worth: the same
// 10K on a sector with 25 projects and one with 4 are different cards. This
// measures the multiplier so aura strength can be set against it.
//
//   npx tsx scripts/sector-presence.ts
import { CARDS } from "../data/cards";
import { chooseMove } from "../engine/bot";
import { buildDeck } from "../engine/deck";
import { countProjects, deckProblems } from "../engine/deck";
import { applyMove, buildIndex, newMatch } from "../engine/match";
import type { Sector } from "../engine/types";
import { MARKETING_COST, RULES, SECTORS } from "../engine/types";

const index = buildIndex(CARDS);
const MATCHES = 3000;

const held: Record<string, number> = Object.fromEntries(SECTORS.map((s) => [s, 0]));
let turns = 0;

for (let seed = 0; seed < MATCHES; seed++) {
  const deck = buildDeck(CARDS, seed);
  let state = newMatch(CARDS, seed, { you: deck, opponent: deck });
  let guard = 0;
  let lastTurn = -1;
  while (!state.finished && guard++ < 400) {
    state = applyMove(state, chooseMove(state, index), index);
    if (state.turn !== lastTurn) {
      lastTurn = state.turn;
      turns++;
      for (const pos of state.players.you.projects) {
        const card = index.get(pos.cardId);
        if (card?.type === "project") held[card.sector] = (held[card.sector] ?? 0) + 1;
      }
    }
  }
}

// The numbers above come from generated decks, which do not stack a sector on
// purpose. An aura on a small sector is really a card for someone who builds
// around it, so measure that case too: every project of the sector, then filled
// up with the cheapest cards that keep the deck legal.
function focusedDeck(sector: Sector): string[] {
  // Capped at the deck size: meme has more projects than a deck has slots now,
  // which this quietly assumed could never happen. A sector outgrowing a deck is
  // the sector being healthy, not an error.
  const picks = CARDS.filter((c) => c.type === "project" && c.sector === sector)
    .map((c) => c.id)
    .slice(0, RULES.deckSize);
  const rest = [...CARDS]
    .filter((c) => !picks.includes(c.id))
    .sort((a, b) => MARKETING_COST[a.rarity] - MARKETING_COST[b.rarity]);
  // Projects first, so the twelve-project floor is met before cheap filler.
  for (const c of rest) {
    if (picks.length >= RULES.deckSize) break;
    if (c.type === "project" && countProjects(picks, index) < RULES.minProjects) picks.push(c.id);
  }
  for (const c of rest) {
    if (picks.length >= RULES.deckSize) break;
    if (!picks.includes(c.id)) picks.push(c.id);
  }
  return picks;
}

const focused: Record<string, number> = {};
for (const sector of SECTORS) {
  const deck = focusedDeck(sector);
  const problems = deckProblems(deck, index);
  if (problems.length > 0) throw new Error(`focused ${sector} deck is illegal: ${problems.join(" ")}`);
  let count = 0;
  let snaps = 0;
  for (let seed = 0; seed < 1000; seed++) {
    let state = newMatch(CARDS, seed, { you: deck, opponent: deck });
    let guard = 0;
    let last = -1;
    while (!state.finished && guard++ < 400) {
      state = applyMove(state, chooseMove(state, index), index);
      if (state.turn !== last) {
        last = state.turn;
        snaps++;
        for (const pos of state.players.you.projects) {
          const card = index.get(pos.cardId);
          if (card?.type === "project" && card.sector === sector) count++;
        }
      }
    }
  }
  focused[sector] = count / snaps;
}

const inSet: Record<string, number> = Object.fromEntries(SECTORS.map((s) => [s, 0]));
for (const c of CARDS) if (c.type === "project") inSet[c.sector] = (inSet[c.sector] ?? 0) + 1;

console.log(`${MATCHES} matches, ${turns} board snapshots\n`);
console.log("sector      in set   held per turn   focused deck   focus multiplier");
const rows = [...SECTORS].sort((a, b) => (held[b] ?? 0) - (held[a] ?? 0));
for (const s of rows) {
  const per = (held[s] ?? 0) / turns;
  const foc = focused[s] ?? 0;
  console.log(
    `${s.padEnd(10)}  ${String(inSet[s]).padStart(6)}   ${per.toFixed(3).padStart(13)}   ${foc.toFixed(3).padStart(12)}   ${(foc / per).toFixed(1).padStart(16)}x`,
  );
}
