// Seed 7548 builds the best deck of twelve for three unrelated themes, and a
// generated deck wins 25.7% against the presets. Both point at the same gap:
// nothing here knows what a good deck looks like. The set has a floor on
// projects and a budget ceiling, and past that a deck is whatever the generator
// happened to draw.
//
// This builds many decks, plays each against the same fixed field, and lines the
// win rate up against everything measurable about the deck's composition. What
// comes out is either a property worth putting in the generator, or a demonstration
// that composition does not decide it — and that is worth knowing too.
//
//   npx tsx scripts/deck-quality.ts [decks] [matches per pairing]

import { CARDS } from "../data/cards";
import { PRESET_DECKS } from "../data/preset-decks";
import { chooseMove } from "../engine/bot";
import { buildDeck, buildDeckPreferring } from "../engine/deck";
import { formatMC } from "../engine/format";
import { cardById } from "../engine/helpers";
import { applyMove, buildIndex, newMatch } from "../engine/match";
import { MARKETING_COST, auraOf, type Card } from "../engine/types";

const index = buildIndex(CARDS);
const DECKS = Number(process.argv[2] ?? 80);
const COUNT = Number(process.argv[3] ?? 40);

const field = PRESET_DECKS.map((p) => buildDeckPreferring(CARDS, p.seed, p.prefer));

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

/** Everything about a deck that can be counted without playing it. */
function shapeOf(cards: Card[]): Record<string, number> {
  const projects = cards.filter((c) => c.type === "project");
  const sectors = new Map<string, number>();
  for (const p of projects) sectors.set(p.sector, (sectors.get(p.sector) ?? 0) + 1);
  const biggest = Math.max(0, ...sectors.values());

  const sum = (pick: (c: Card) => number) => cards.reduce((t, c) => t + pick(c), 0);

  return {
    commons: cards.filter((c) => c.rarity === "common").length,
    rares: cards.filter((c) => c.rarity === "rare").length,
    epics: cards.filter((c) => c.rarity === "epic").length,
    legendaries: cards.filter((c) => c.rarity === "legendary").length,
    mythics: cards.filter((c) => c.rarity === "mythic").length,
    projects: projects.length,
    tactics: cards.filter((c) => c.type === "tactic").length,
    events: cards.filter((c) => c.type === "event").length,
    influencers: cards.filter((c) => c.type === "person").length,
    tools: cards.filter((c) => c.type === "tool").length,
    auras: cards.filter((c) => auraOf(c) !== null).length,
    "distinct projects": new Set(projects.map((p) => p.project)).size,
    "biggest sector": biggest,
    "avg price": sum((c) => MARKETING_COST[c.rarity]) / cards.length,
    "total pump": sum((c) => (c.type === "project" ? c.pumpMC : 0)),
    "total launch": sum((c) => (c.type === "project" ? c.launchMC : 0)),
    "total holders": sum((c) => (c.type === "project" ? c.holders : 0)),
  };
}

type Row = { seed: number; rate: number; shape: Record<string, number> };
const rows: Row[] = [];

for (let i = 0; i < DECKS; i++) {
  const seed = 50_000 + i * 131;
  const deck = buildDeck(CARDS, seed);
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
  rows.push({ seed, rate: wins / played, shape: shapeOf(deck.map((id) => cardById(index, id))) });
}

/** Pearson, so a straight line through the cloud and nothing fancier. */
function correlation(xs: number[], ys: number[]): number {
  const n = xs.length;
  const mx = xs.reduce((a, b) => a + b, 0) / n;
  const my = ys.reduce((a, b) => a + b, 0) / n;
  let top = 0;
  let dx = 0;
  let dy = 0;
  for (let i = 0; i < n; i++) {
    top += (xs[i]! - mx) * (ys[i]! - my);
    dx += (xs[i]! - mx) ** 2;
    dy += (ys[i]! - my) ** 2;
  }
  return dx === 0 || dy === 0 ? 0 : top / Math.sqrt(dx * dy);
}

const rates = rows.map((r) => r.rate);
const keys = Object.keys(rows[0]!.shape);
const scored = keys
  .map((key) => ({ key, r: correlation(rows.map((row) => row.shape[key]!), rates) }))
  .sort((a, b) => Math.abs(b.r) - Math.abs(a.r));

const sorted = [...rows].sort((a, b) => b.rate - a.rate);
const best = sorted.slice(0, 8);
const worst = sorted.slice(-8);
const avg = (rs: Row[], key: string) => rs.reduce((t, r) => t + r.shape[key]!, 0) / rs.length;

console.log(
  `${DECKS} generated decks, each played ${COUNT * field.length} matches against the` +
    ` eight presets\n`,
);
console.log(`  win rate: best ${(sorted[0]!.rate * 100).toFixed(1)}%, worst ` +
  `${(sorted[sorted.length - 1]!.rate * 100).toFixed(1)}%, median ` +
  `${(sorted[Math.floor(DECKS / 2)]!.rate * 100).toFixed(1)}%\n`);

console.log(`  what predicts it            correlation   top eight   bottom eight`);
for (const { key, r } of scored) {
  const hi = avg(best, key);
  const lo = avg(worst, key);
  const fmt = (v: number) => (key.startsWith("avg") ? formatMC(v) : v.toFixed(1));
  console.log(
    `  ${key.padEnd(26)} ${r.toFixed(2).padStart(11)}   ${fmt(hi).padStart(9)}   ${fmt(lo).padStart(12)}`,
  );
}
// A correlation says a line fits; it does not say where to put a rule. Bucketing
// says where to put a rule.
const bucket = (n: number) => (n <= 10 ? "up to 10" : n <= 13 ? "11 to 13" : n <= 16 ? "14 to 16" : "17 or more");
const buckets = new Map<string, number[]>();
for (const row of rows) {
  const key = bucket(row.shape.commons!);
  buckets.set(key, [...(buckets.get(key) ?? []), row.rate]);
}
const median = (xs: number[]) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)]!;

console.log(`\n  commons in the deck    decks    median win rate    best    worst`);
for (const key of ["up to 10", "11 to 13", "14 to 16", "17 or more"]) {
  const xs = buckets.get(key);
  if (!xs || xs.length === 0) continue;
  console.log(
    `  ${key.padEnd(20)} ${String(xs.length).padStart(6)}   ` +
      `${(median(xs) * 100).toFixed(1).padStart(15)}%   ` +
      `${(Math.max(...xs) * 100).toFixed(0).padStart(4)}%   ${(Math.min(...xs) * 100).toFixed(0).padStart(5)}%`,
  );
}

console.log(
  `\n  Correlation runs from -1 to 1. On ${DECKS} decks anything under about 0.25 is` +
    `\n  indistinguishable from nothing, so read the sign only where the number is big.`,
);
