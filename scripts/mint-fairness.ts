// A minted deck is forty random cards, which is exactly what buildDeck() makes.
// So the spread measured in deck-quality.ts is not a curiosity about the bot any
// more — it is the product. Two people pay the same and one of them gets a deck
// that wins twice as often.
//
// The plan is to guarantee rarities: a rare and an epic in every deck, maybe a
// legendary or a mythic. This asks whether that guarantee guarantees anything.
// One pool of decks is built and measured once, and the candidate rules are then
// applied as filters over the same pool — so every rule is judged on the same
// matches, and the comparison is not paying for the noise four times.
//
// The field can be the presets or a handful of other minted decks. The second is
// what launch day actually looks like — everybody holding forty random cards,
// playing each other — and it is the one that answers "what will two players who
// paid the same experience".
//
//   npx tsx scripts/mint-fairness.ts [decks] [matches per opponent] [presets|minted]

import { CARDS } from "../data/cards";
import { PRESET_DECKS } from "../data/preset-decks";
import { chooseMove } from "../engine/bot";
import { buildDeck, buildDeckPreferring } from "../engine/deck";
import { formatMC } from "../engine/format";
import { cardById } from "../engine/helpers";
import { applyMove, buildIndex, newMatch } from "../engine/match";
import type { Card, Rarity } from "../engine/types";

const index = buildIndex(CARDS);
const DECKS = Number(process.argv[2] ?? 200);
const COUNT = Number(process.argv[3] ?? 30);
const FIELD = process.argv[4] ?? "presets";

const field =
  FIELD === "minted"
    ? // Drawn from a different seed range than the decks under test, so nothing
      // is ever measured against itself.
      Array.from({ length: 8 }, (_, i) => buildDeck(CARDS, 400_000 + i * 911))
    : PRESET_DECKS.map((p) => buildDeckPreferring(CARDS, p.seed, p.prefer));

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

type Deck = {
  rate: number;
  count: Record<Rarity, number>;
  power: number; // launch plus every turn of pump a project would pay out
};

const decks: Deck[] = [];

for (let i = 0; i < DECKS; i++) {
  const cards = buildDeck(CARDS, 90_000 + i * 173).map((id) => cardById(index, id));
  let wins = 0;
  let played = 0;
  for (const other of field) {
    for (let s = 0; s < COUNT; s++) {
      const result = play(s, cards.map((c) => c.id), other, s % 2 === 0);
      if (result === null) continue;
      played += 1;
      if (result) wins += 1;
    }
  }

  const count = { common: 0, rare: 0, epic: 0, legendary: 0, mythic: 0 } as Record<Rarity, number>;
  for (const c of cards) count[c.rarity] += 1;
  const power = cards.reduce(
    (t: number, c: Card) => t + (c.type === "project" ? c.launchMC + c.pumpMC * 5 : 0),
    0,
  );

  decks.push({ rate: wins / played, count, power });
}

const rates = decks.map((d) => d.rate).sort((a, b) => a - b);
const at = (xs: number[], q: number) => xs[Math.min(xs.length - 1, Math.floor(q * xs.length))]!;
const median = (xs: number[]) => at([...xs].sort((a, b) => a - b), 0.5);

// The power band is a rule you could actually enforce at mint time: keep drawing
// until the deck's own launch-and-pump total lands in the middle of the range.
const powers = decks.map((d) => d.power).sort((a, b) => a - b);
const lowBand = at(powers, 0.25);
const highBand = at(powers, 0.75);

const rules: { name: string; keep: (d: Deck) => boolean }[] = [
  { name: "no guarantee at all", keep: () => true },
  { name: "at least one rare and one epic", keep: (d) => d.count.rare >= 1 && d.count.epic >= 1 },
  {
    name: "...and a legendary or a mythic",
    keep: (d) =>
      d.count.rare >= 1 && d.count.epic >= 1 && d.count.legendary + d.count.mythic >= 1,
  },
  {
    name: "one of every rarity",
    keep: (d) =>
      d.count.rare >= 1 && d.count.epic >= 1 && d.count.legendary >= 1 && d.count.mythic >= 1,
  },
  { name: "no more than 16 commons", keep: (d) => d.count.common <= 16 },
  { name: "launch+pump in the middle half", keep: (d) => d.power >= lowBand && d.power <= highBand },
];

console.log(
  `${DECKS} minted decks, each played ${COUNT * field.length} matches against ` +
    `${FIELD === "minted" ? "eight other minted decks" : "the eight presets"}\n`,
);
console.log(`  rule                                decks   worst tenth   median   best tenth   spread`);
for (const rule of rules) {
  const kept = decks.filter(rule.keep).map((d) => d.rate).sort((a, b) => a - b);
  if (kept.length < 8) {
    console.log(`  ${rule.name.padEnd(34)} ${String(kept.length).padStart(5)}   too few decks to say`);
    continue;
  }
  const lo = at(kept, 0.1);
  const hi = at(kept, 0.9);
  const pct = (v: number) => (v * 100).toFixed(1) + "%";
  console.log(
    `  ${rule.name.padEnd(34)} ${String(kept.length).padStart(5)}   ${pct(lo).padStart(11)}   ` +
      `${pct(median(kept)).padStart(6)}   ${pct(hi).padStart(10)}   ` +
      `${((hi - lo) * 100).toFixed(1).padStart(6)}`,
  );
}

console.log(
  `\n  Spread is the gap between the worst tenth and the best tenth of decks that` +
    `\n  pass the rule — what two players can expect to differ by after paying the` +
    `\n  same. A guarantee that does not shrink this column does not guarantee` +
    `\n  anything a player will feel.`,
);
console.log(
  `\n  The power band above runs ${formatMC(lowBand)} to ${formatMC(highBand)} of launch plus five` +
    `\n  turns of pump, taken from the middle half of this very pool.`,
);
