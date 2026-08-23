// Seed 7548 builds the best deck for three different themes and 7959 builds one
// of the worst for two. If a seed is good across themes, the seed is not picking
// lucky cards — it is landing on a shape. This prints the shape.
//
//   npx tsx scripts/deck-shape.ts [theme id]

import { CARDS } from "../data/cards";
import { PRESET_DECKS } from "../data/preset-decks";
import { buildDeckPreferring } from "../engine/deck";
import { formatMC } from "../engine/format";
import { buildIndex } from "../engine/match";
import { cardById } from "../engine/helpers";
import { MARKETING_COST, RARITIES } from "../engine/types";

const index = buildIndex(CARDS);
const THEME = process.argv[2] ?? "hardware";
const CANDIDATES = [7000, 7137, 7411, 7548, 7685, 7822, 7959, 8233, 8507, 8781, 9021, 9317];

const preset = PRESET_DECKS.find((p) => p.id === THEME);
if (!preset) throw new Error(`No preset with id ${THEME}. Try one of: ${PRESET_DECKS.map((p) => p.id).join(", ")}`);

console.log(`${preset.name} — the same theme built on twelve seeds\n`);
console.log(`  seed   ${RARITIES.map((r) => r.slice(0, 4).padStart(5)).join("")}   projects   avg cost   biggest sector`);

for (const seed of CANDIDATES) {
  const deck = buildDeckPreferring(CARDS, seed, preset.prefer).map((id) => cardById(index, id));
  const byRarity = RARITIES.map((r) => deck.filter((c) => c.rarity === r).length);
  const projects = deck.filter((c) => c.type === "project").length;
  const cost = deck.reduce((sum, c) => sum + MARKETING_COST[c.rarity], 0) / deck.length;

  const sectors = new Map<string, number>();
  for (const card of deck) {
    if (card.type !== "project") continue;
    sectors.set(card.sector, (sectors.get(card.sector) ?? 0) + 1);
  }
  const top = [...sectors.entries()].sort((a, b) => b[1] - a[1])[0];

  console.log(
    `  ${String(seed).padStart(5)}   ${byRarity.map((n) => String(n).padStart(5)).join("")}   ` +
      `${String(projects).padStart(8)}   ${formatMC(cost).padStart(8)}   ` +
      `${(top ? `${top[0]} ${top[1]}` : "none").padStart(14)}`,
  );
}
console.log(`\n  Rarity columns are in order: ${RARITIES.join(", ")}.`);
