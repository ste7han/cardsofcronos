// What every aura is actually worth, and what it should cost.
//
// Aura bonuses were set by rarity alone. That is wrong, because an aura pays its
// bonus once per project of its sector that you hold, and the sectors are not
// the same size: the same 10K on meme and on gaming are different cards. This
// prices every aura against the sector it points at.
//
// Value is measured in a deck built around the sector, because that is who an
// aura card is for. A card that also carries a one-off effect is marked, since
// part of its rarity is paid for by that rather than by the aura.
//
//   npx tsx scripts/aura-balance.ts
import { CARDS } from "../data/cards";
import { chooseMove } from "../engine/bot";
import { countProjects, deckProblems } from "../engine/deck";
import { applyMove, buildIndex, newMatch } from "../engine/match";
import type { Rarity, Sector } from "../engine/types";
import { MARKETING_COST, RARITIES, RULES, SECTORS, auraOf } from "../engine/types";

const index = buildIndex(CARDS);

/** Every project of the sector, then the cheapest legal filler. */
function focusedDeck(sectors: readonly Sector[]): string[] {
  const want = new Set(sectors);
  // Capped at the deck size — meme now has more projects than a deck has slots.
  const picks = CARDS.filter((c) => c.type === "project" && want.has(c.sector))
    .map((c) => c.id)
    .slice(0, RULES.deckSize);
  const rest = [...CARDS]
    .filter((c) => !picks.includes(c.id))
    .sort((a, b) => MARKETING_COST[a.rarity] - MARKETING_COST[b.rarity]);
  for (const c of rest) {
    if (picks.length >= RULES.deckSize) break;
    if (c.type === "project" && countProjects(picks, index) < RULES.minProjects) picks.push(c.id);
  }
  for (const c of rest) {
    if (picks.length >= RULES.deckSize) break;
    if (!picks.includes(c.id)) picks.push(c.id);
  }
  const problems = deckProblems(picks, index);
  if (problems.length > 0)
    throw new Error(`focused ${[...want].join("+")} deck is illegal: ${problems.join(" ")}`);
  return picks;
}

/** Projects of `sector` held per turn, in a deck built around it. */
/**
 * How many positions of these sectors you hold per turn, in a deck built around
 * them.
 *
 * Takes a list rather than one sector because a two-sector aura's presence is
 * NOT the sum of its parts, and adding them was this report's answer for an
 * afternoon. A deck focused on defi holds 3.54 defi positions and one focused on
 * infra holds 3.62 infra ones; a deck built around both still holds about the
 * same number of positions in total, because the portfolio cap is what limits
 * it and not the supply of projects in a sector. Summing said 7.16 and priced
 * Pampa at less than half the bonus the still-life measured him needing.
 *
 * So a pair is played out like any other deck and counted once.
 */
function presence(sectors: readonly Sector[]): number {
  const want = new Set(sectors);
  const deck = focusedDeck(sectors);
  let count = 0;
  let snaps = 0;
  for (let seed = 0; seed < 1200; seed++) {
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
          if (card?.type === "project" && want.has(card.sector)) count++;
        }
      }
    }
  }
  return count / snaps;
}

const held = new Map<Sector, number>();
for (const sector of SECTORS) held.set(sector, presence([sector]));

/** Presence for any combination, measured once and kept. */
const pairs = new Map<string, number>();
function presenceOf(sectors: readonly Sector[]): number {
  if (sectors.length === 1) return held.get(sectors[0]!) ?? 0;
  const key = [...sectors].sort().join("+");
  if (!pairs.has(key)) pairs.set(key, presence(sectors));
  return pairs.get(key)!;
}

interface Row {
  id: string;
  name: string;
  rarity: Rarity;
  sector: Sector | string;
  /** Positions the aura can land on. Carried here because a two-sector aura's
   *  label is no longer a key into `held`. */
  per: number;
  bonus: number;
  hasEffect: boolean;
  value: number;
}

const skipped: string[] = [];
const rows: Row[] = [];
for (const card of CARDS) {
  const aura = auraOf(card);
  if (!aura) continue;
  // Champion auras are skipped rather than guessed at. This report prices an
  // aura as bonus-times-positions-held, which has no meaning for one that
  // multiplies — and a made-up number in a balance table is worse than a gap,
  // because the gap is visible and the number is not.
  if (aura.kind !== "pumpSector" && aura.kind !== "pumpSectors") {
    skipped.push(`${card.name} (${aura.kind})`);
    continue;
  }
  // A flat aura over two sectors is priced the same way as over one: the bonus
  // times the positions it can land on. What that number is has to be played
  // out, not added up — see presence().
  const sectors = aura.kind === "pumpSector" ? [aura.sector] : aura.sectors;
  const per = presenceOf(sectors);
  rows.push({
    id: card.id,
    name: card.name,
    rarity: card.rarity,
    sector: sectors.join("+"),
    per,
    bonus: aura.bonus,
    hasEffect: Boolean(card.effect),
    value: aura.bonus * per,
  });
}
if (skipped.length > 0) {
  console.log(`not priced here — this table only understands flat sector auras:`);
  for (const name of skipped) console.log(`  ${name}`);
  console.log();
}

// A card that also carries a one-off effect has part of its rarity paid for by
// that effect, so its aura should not be priced as if the aura were the whole
// card. A quarter off, applied evenly rather than judged card by card.
const EFFECT_DISCOUNT = 0.75;

/**
 * A card's aura value put back on the "pure aura" scale, so the cards in a
 * rarity can be compared before a median is taken from them.
 *
 * Taking the median of the raw values gets legendary wrong: three of its four
 * aura cards carry effects, so their smaller auras drag the median down onto
 * epic's, and a five-point card would buy the same aura as a three-point one.
 * Dividing the discount out first removes that.
 */
const onPureScale = (r: Row) => r.value / (r.hasEffect ? EFFECT_DISCOUNT : 1);

const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  return s.length % 2 ? s[(s.length - 1) / 2]! : (s[s.length / 2 - 1]! + s[s.length / 2]!) / 2;
};

console.log("projects of a sector held per turn, in a deck built around it:");
for (const [sector, per] of [...held.entries()].sort((a, b) => b[1] - a[1])) {
  console.log(`  ${sector.padEnd(9)} ${per.toFixed(2)}`);
}

console.log("\ncard            rarity      sector    bonus    worth/turn   effect");
for (const rarity of RARITIES) {
  const group = rows.filter((r) => r.rarity === rarity);
  if (group.length === 0) continue;
  for (const r of group.sort((a, b) => b.value - a.value)) {
    console.log(
      `  ${r.name.padEnd(13)} ${r.rarity.padEnd(10)} ${r.sector.padEnd(9)} ${(r.bonus / 1000).toFixed(0).padStart(3)}K  ${(r.value / 1000).toFixed(1).padStart(9)}K   ${r.hasEffect ? "yes" : ""}`,
    );
  }
  const values = group.map((r) => r.value);
  const target = median(group.map(onPureScale));
  console.log(
    `  -- ${rarity}: pure-aura median ${(target / 1000).toFixed(1)}K, spread ${(Math.min(...values) / 1000).toFixed(1)}K to ${(Math.max(...values) / 1000).toFixed(1)}K, ${(Math.max(...values) / Math.min(...values)).toFixed(1)}x\n`,
  );
}

console.log("proposed bonus: the rarity's median value, divided by the sector's presence");
console.log("card            sector    now    ->  proposed   worth/turn after");
for (const rarity of RARITIES) {
  const group = rows.filter((r) => r.rarity === rarity);
  if (group.length === 0) continue;
  const target = median(group.map(onPureScale));
  for (const r of group.sort((a, b) => a.name.localeCompare(b.name))) {
    const per = r.per || 1;
    const want = Math.max(
      1000,
      Math.round(((target * (r.hasEffect ? EFFECT_DISCOUNT : 1)) / per) / 1000) * 1000,
    );
    const mark = Math.abs(want - r.bonus) >= 3000 ? "  <-- changes" : "";
    console.log(
      `  ${r.name.padEnd(13)} ${r.sector.padEnd(9)} ${(r.bonus / 1000).toFixed(0).padStart(3)}K  ->  ${(want / 1000).toFixed(0).padStart(4)}K   ${((want * per) / 1000).toFixed(1).padStart(8)}K${mark}`,
    );
  }
}
