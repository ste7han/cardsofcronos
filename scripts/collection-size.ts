// If owning a card were required to deck it, what would a collection be worth?
//
// Not more power per card — a BONK is a BONK. More choice: with forty cards your
// deck is those forty, with everything you pick the best forty. This measures
// what that choice is worth in win rate, because "it would be pay to win" is an
// argument and this is a number.
import { CARDS } from "../data/cards";
import { chooseMove } from "../engine/bot";
import { buildDeckPreferring, countProjects, deckProblems } from "../engine/deck";
import { applyMove, buildIndex, newMatch } from "../engine/match";
import { PRESET_DECKS } from "../data/preset-decks";
import { shuffle } from "../engine/rng";
import { RULES } from "../engine/types";

const index = buildIndex(CARDS);

/**
 * The best forty you can manage out of the cards you happen to own.
 *
 * The first version of this took projects first at every collection size, which
 * built the same naive deck whether you owned forty cards or all of them — and
 * duly reported that owning everything was worth nothing. That was the
 * measurement, not the game.
 *
 * A player with a collection builds towards a theme, as close to it as their
 * cards allow. So: try every ready-made theme against the cards owned, keep the
 * one that lands closest to it. Owning more means landing closer.
 */
function deckFromCollection(size: number, seed: number): string[] | null {
  const { list: owned } = shuffle(CARDS, seed);
  const collection = owned.slice(0, size);
  if (collection.length < RULES.deckSize) return null;

  let best: string[] | null = null;
  let bestOnTheme = -1;
  for (const preset of PRESET_DECKS) {
    const ordered = [
      ...collection.filter((c) => preset.prefer(c)),
      ...collection.filter((c) => !preset.prefer(c)),
    ];
    // Projects first up to the floor, then the theme, then whatever is left.
    const deck: string[] = [];
    for (const c of ordered) {
      if (deck.length >= RULES.minProjects) break;
      if (c.type === "project") deck.push(c.id);
    }
    for (const c of ordered) {
      if (deck.length >= RULES.deckSize) break;
      if (!deck.includes(c.id)) deck.push(c.id);
    }
    if (deck.length < RULES.deckSize) continue;
    if (deckProblems(deck, index).length > 0) continue;
    const onTheme = deck.filter((id) => preset.prefer(index.get(id)!)).length;
    if (onTheme > bestOnTheme) {
      bestOnTheme = onTheme;
      best = deck;
    }
  }
  return best;
}

const opponent = (seed: number) => {
  const theme = PRESET_DECKS[seed % PRESET_DECKS.length]!;
  return buildDeckPreferring(CARDS, seed + 7919, theme.prefer);
};

function winRate(make: (seed: number) => string[] | null) {
  let wins = 0, decided = 0, skipped = 0;
  for (let seed = 0; seed < 1500; seed++) {
    const deck = make(seed);
    if (!deck) { skipped++; continue; }
    const aFirst = seed % 2 === 0;
    const other = opponent(seed);
    let s = newMatch(CARDS, seed, aFirst ? { you: deck, opponent: other } : { you: other, opponent: deck });
    let g = 0;
    while (!s.finished && g++ < 400) s = applyMove(s, chooseMove(s, index), index);
    if (s.winner === null) continue;
    decided++;
    if ((s.winner === "you") === aFirst) wins++;
  }
  return { pct: (wins / decided) * 100, skipped };
}

console.log(`if you had to own a card to deck it — against the bot's themed decks\n`);
console.log("cards owned   no legal deck   win rate");
for (const size of [40, 60, 90, 130, CARDS.length]) {
  const r = winRate((seed) => deckFromCollection(size, seed));
  const label = size === CARDS.length ? `all ${size}` : String(size);
  console.log(`  ${label.padStart(9)}   ${((r.skipped / 1500) * 100).toFixed(0).padStart(14)}%   ${r.pct.toFixed(1).padStart(6)}%`);
}
// The floor is not a random forty. Everybody gets the starter deck, which is a
// curated forty, so that is where a new player actually begins.
const best = PRESET_DECKS[0]!;
console.log(`  a deck built from the whole set (${best.name}): ${winRate(() => buildDeckPreferring(CARDS, best.seed, best.prefer)).pct.toFixed(1)}%`);
