// Candidate cost tables and ramps, all measured the same way.
//
// The binding constraint is the hand: five cards is the most you can play in a
// turn, so the most you can spend is five cards' worth. With unspent budget
// coming off your market cap, a ramp that outgrows that is a standing tax. And a
// mythic has to be affordable well before turn ten or it is not a card.
import { CARDS } from "../data/cards";
import { chooseMove } from "../engine/bot";
import { buildDeck } from "../engine/deck";
import { applyMove, buildIndex, newMatch } from "../engine/match";
import type { Card, Rarity } from "../engine/types";
import { MARKETING_COST, RARITIES, RULES } from "../engine/types";
import * as types from "../engine/types";

const index = buildIndex(CARDS);
const dear = (a: Card, b: Card) => MARKETING_COST[b.rarity] - MARKETING_COST[a.rarity];
const cheapFirst = [...CARDS].sort((a, b) => MARKETING_COST[a.rarity] - MARKETING_COST[b.rarity]);
const stacked = [
  ...CARDS.filter((c) => c.type === "project").sort(dear).slice(0, 28),
  ...CARDS.filter((c) => c.type !== "project").sort(dear).slice(0, 12),
].map((c) => c.id);
const cheapDeck = (() => {
  const d = cheapFirst.filter((c) => c.type === "project").slice(0, 12).map((c) => c.id);
  for (const c of cheapFirst) { if (d.length === 40) break; if (!d.includes(c.id)) d.push(c.id); }
  return d;
})();
function build(shape: Record<Rarity, number>, share: number): string[] {
  const deck: string[] = [];
  for (const rarity of Object.keys(shape) as Rarity[]) {
    const pool = CARDS.filter((c) => c.rarity === rarity);
    const want = shape[rarity], wantP = Math.round(want * (share / 40));
    const p = pool.filter((c) => c.type === "project").slice(0, wantP);
    const o = pool.filter((c) => c.type !== "project").slice(0, want - p.length);
    for (const c of [...p, ...o]) deck.push(c.id);
  }
  return deck;
}
const curve = build({ common: 16, rare: 12, epic: 8, legendary: 3, mythic: 1 }, 22);
const top = build({ common: 4, rare: 6, epic: 10, legendary: 12, mythic: 8 }, 22);

function rate(a: string[], b: (s: number) => string[], n = 1500) {
  let wins = 0, decided = 0;
  for (let seed = 0; seed < n; seed++) {
    const other = b(40_000 + seed);
    const aFirst = seed % 2 === 0;
    let s = newMatch(CARDS, seed, aFirst ? { you: a, opponent: other } : { you: other, opponent: a });
    let g = 0;
    while (!s.finished && g++ < 400) s = applyMove(s, chooseMove(s, index), index);
    if (s.winner === null) continue;
    decided++;
    if ((s.winner === "you") === aFirst) wins++;
  }
  return (wins / decided) * 100;
}
function health() {
  let cards = 0, pts = 0, waste = 0, mc = 0, n = 0, draws = 0, mythicsPlayed = 0;
  for (let seed = 0; seed < 1200; seed++) {
    const deck = buildDeck(CARDS, seed);
    let s = newMatch(CARDS, seed, { you: deck, opponent: deck });
    let g = 0;
    while (!s.finished && g++ < 400) {
      const m = chooseMove(s, index);
      if (m.kind === "playCard") {
        cards++;
        if (index.get(s.players[s.toMove].hand[m.handIndex]!)!.rarity === "mythic") mythicsPlayed++;
      }
      if (m.kind === "endTurn") { pts++; waste += s.budgetThisTurn - s.budgetSpentThisTurn; }
      s = applyMove(s, m, index);
    }
    n++; mc += Math.max(s.players.you.mc, s.players.opponent.mc);
    if (s.winner === null) draws++;
  }
  return { cards: cards / pts, waste: waste / pts, mc: mc / n, draws: (draws / n) * 100, mythics: mythicsPlayed / n };
}

// The maker's own cost table throughout. What moves is the ramp, the hand and
// how hard unspent budget is charged — the three levers that are not the cards.
// The shape that worked was a low ramp with an expensive legendary — that is what
// punishes a top-heavy deck. So hold those and move only the mythic, which is
// five cards in the whole set and barely changes a deck's shape.
const CONFIGS: Array<[string, number[], number, number, number]> = [
  ["kept: 20/40/80/200/350", [20, 40, 80, 200, 350], 35_000, 1, 5],
  ["mythic 280", [20, 40, 80, 200, 280], 35_000, 1, 5],
  ["mythic 245", [20, 40, 80, 200, 245], 35_000, 1, 5],
  ["mythic 245, legendary 175", [20, 40, 80, 175, 245], 35_000, 1, 5],
  ["mythic 280, ramp 40K", [20, 40, 80, 200, 280], 40_000, 1, 5],
];
console.log("setup                   ramp   affordable from turn   all-exp  all-cheap  curve  top   curve/top  cards  waste  mythics  MC");
for (const [label, costs, ramp, penalty, hand] of CONFIGS) {
  RARITIES.forEach((r, i) => { MARKETING_COST[r] = costs[i]! * 1000; });
  (RULES as { budgetPerTurn: number; handSize: number }).budgetPerTurn = ramp;
  (RULES as { budgetPerTurn: number; handSize: number }).handSize = hand;
  (globalThis as { __penalty?: number }).__penalty = penalty;
  const from = RARITIES.map((r) => {
    const t = Math.ceil(MARKETING_COST[r] / ramp);
    return t > RULES.turns ? "X" : String(t);
  }).join("/");
  const h = health();
  console.log(
    `${label.padEnd(22)} ${String(ramp / 1000).padStart(3)}K   ${from.padEnd(21)} ${rate(stacked, (s) => buildDeck(CARDS, s)).toFixed(0).padStart(5)}%  ${rate(cheapDeck, (s) => buildDeck(CARDS, s)).toFixed(0).padStart(7)}%  ${rate(curve, (s) => buildDeck(CARDS, s)).toFixed(0).padStart(4)}%  ${rate(top, (s) => buildDeck(CARDS, s)).toFixed(0).padStart(3)}%  ${rate(curve, () => top).toFixed(0).padStart(8)}%  ${h.cards.toFixed(2)}  ${(h.waste / 1000).toFixed(0).padStart(4)}K  ${h.mythics.toFixed(2).padStart(6)}  ${(h.mc / 1000).toFixed(0)}K`,
  );
}
