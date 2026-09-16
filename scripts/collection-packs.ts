// What a pack is worth, once owning a card is required to deck it.
//
// scripts/collection-size.ts asked the same question against a collection drawn
// uniformly out of the set. That is no longer what a collection is. A real one is
// a starter pack — forty cards on generous rates with a guaranteed backbone —
// plus eight cards a pack on rates that are deliberately much harsher. Those two
// distributions are nothing alike, so this measures the real thing.
//
// The opponent is the same as in collection-size.ts on purpose: the bot's themed
// decks, built from the whole set. That is the wall a collection is climbing
// towards, and keeping it identical means the two scripts can be read together.
import { CARDS } from "../data/cards";
import { PRESET_DECKS } from "../data/preset-decks";
import { chooseMove } from "../engine/bot";
import { buildDeckPreferring, deckProblems } from "../engine/deck";
import { applyMove, buildIndex, newMatch } from "../engine/match";
import { openPack } from "../engine/pack";
import { MARKETING_COST, RARITIES, RULES } from "../engine/types";

const index = buildIndex(CARDS);

/** Candidate decks per theme and leaning, so a collection is tried more ways. */
const VARIANTS = 1;
/** Seeds a player uses to pick a deck, and the held-out seeds it is scored on. */
const CHOOSE = 24;
const SCORE = 80;
/** How many different players per row. Each one opens their own packs. */
const PLAYERS = 40;
/** Pairs for the head-to-head at the end. */
const PAIRS = 40;

/**
 * How many packs a player is assumed to start with.
 *
 * Six, because the deck mint this script was written around handed over sixty
 * cards in one go and six packs is the same sixty. That product is gone — the
 * mint is one card or ten and nothing else — so the starter is spelled out in
 * the only thing you can still buy. The number is the old one on purpose: it
 * keeps every row this script has ever printed comparable with the next.
 */
const STARTER_PACKS = 6;

/** A player's cards after opening the starter and then `packs` more. */
function collectionAfter(packs: number, seed: number): string[] {
  const owned: string[] = [];
  for (let i = 0; i < STARTER_PACKS + packs; i++) {
    // A different seed per pack, and the collection so far, so no pack repeats a
    // card — the same rule the shop plays by.
    owned.push(...openPack(CARDS, seed * 7919 + i * 104_729 + 1));
  }
  return owned;
}

/**
 * What the player began with, which is the deck they keep if no pack improves on
 * it. The first STARTER_PACKS packs of the same seed, so it is always a subset of
 * whatever collectionAfter hands back for that player.
 */
const starter = (seed: number): string[] => collectionAfter(0, seed);

/**
 * The decks a player could build out of what they own.
 *
 * This took two goes to get honest, and both failures said the same thing.
 *
 * The first version ranked candidates by how on-theme they were. It reported
 * that owning 136 cards was worth nine points *less* than owning forty. The
 * second built one candidate per theme with the shipped builder, and still lost
 * three points between two packs and four. Both cannot be true: a collection only
 * grows, so every deck you could build before you can still build now.
 *
 * What both were actually finding is that packs are 62% common, so a bigger
 * collection is mostly a bigger pile of commons — and a builder that fills forty
 * slots from the pool without caring what it is taking gets *cheaper* as the pool
 * grows. Average card fell 67K to 52K across those rows. That is my generator
 * drifting down the curve, not a player getting worse at the game.
 *
 * So candidates vary along the curve as well as the theme, which is the choice
 * the deck page actually puts in front of you, and the starter forty is always
 * among them. That last part is what makes the measurement monotone by
 * construction: the worst a collection can do is the deck it started as.
 */
function candidates(collection: readonly string[]): string[][] {
  if (collection.length < RULES.deckSize) return [];
  const cards = collection.map((id) => index.get(id)!);
  const rank = (c: (typeof cards)[number]) => RARITIES.indexOf(c.rarity);

  /** Lean expensive, lean cheap, or take what comes. */
  const LEANINGS: ((a: (typeof cards)[number], b: (typeof cards)[number]) => number)[] = [
    (a, b) => rank(b) - rank(a),
    (a, b) => rank(a) - rank(b),
    () => 0,
  ];

  const decks: string[][] = [];
  for (const preset of PRESET_DECKS) {
    for (const lean of LEANINGS) {
      for (let variant = 0; variant < VARIANTS; variant++) {
        try {
          const ordered = [...cards].sort(lean);
          const deck = buildDeckPreferring(ordered, preset.seed + variant * 31, preset.prefer);
          if (deckProblems(deck, index).length === 0) decks.push(deck);
        } catch {
          // Not enough of the right cards owned to fill forty this way. That is a
          // collection being small, not an error.
        }
      }
    }
  }
  return decks;
}

/** One deck against the wall, over a given range of seeds. */
function trial(deck: readonly string[], from: number, to: number): number {
  let wins = 0;
  let decided = 0;
  for (let seed = from; seed < to; seed++) {
    const aFirst = seed % 2 === 0;
    const other = opponent(seed);
    let s = newMatch(
      CARDS,
      seed,
      aFirst ? { you: [...deck], opponent: other } : { you: other, opponent: [...deck] },
    );
    let guard = 0;
    while (!s.finished && guard++ < 400) s = applyMove(s, chooseMove(s, index), index);
    if (s.winner === null) continue;
    decided++;
    if ((s.winner === "you") === aFirst) wins++;
  }
  return decided === 0 ? 0 : wins / decided;
}

/**
 * What this player settles on: the candidate that did best on the seeds they
 * tried, scored on seeds they never saw.
 *
 * Choosing and scoring on the same matches would report the luckiest deck rather
 * than the best one, which is the mistake the seed tuning already made once.
 */
function settledOn(collection: readonly string[], floor: readonly string[]): { pct: number; deck: string[] } | null {
  // What they began with is always on the table. A player who opens packs and
  // likes none of them still has the cards they started with.
  const decks = [...candidates(collection), [...floor]];
  if (decks.length === 0) return null;

  let best = decks[0]!;
  let bestScore = -1;
  for (const deck of decks) {
    const score = trial(deck, 0, CHOOSE);
    if (score > bestScore) {
      bestScore = score;
      best = deck;
    }
  }
  return { pct: trial(best, CHOOSE, CHOOSE + SCORE) * 100, deck: best };
}

const opponent = (seed: number) => {
  const theme = PRESET_DECKS[seed % PRESET_DECKS.length]!;
  return buildDeckPreferring(CARDS, seed + 7919, theme.prefer);
};

const avgCost = (deck: readonly string[]) =>
  deck.reduce((sum, id) => sum + MARKETING_COST[index.get(id)!.rarity], 0) / deck.length;

console.log("if you had to own a card to deck it — a real collection, pack by pack\n");
console.log(`  ${PLAYERS} players a row, each opening their own packs.`);
console.log(`  Each picks a deck on ${CHOOSE} matches and is scored on ${SCORE} they never saw,`);
console.log(`  against the bot's themed decks built from the whole set.`);
console.log(`  The band on a row is about ±${(1.96 * Math.sqrt(0.25 / (PLAYERS * SCORE)) * 100).toFixed(1)}%.\n`);

console.log("packs   owned   spare   decks   avg card   win rate");
for (const packs of [0, 1, 2, 4, 8, 12, 17]) {
  let owned = 0;
  let cost = 0;
  let decks = 0;
  let pct = 0;
  let players = 0;
  for (let player = 0; player < PLAYERS; player++) {
    const seed = player * 1013 + 1;
    const collection = collectionAfter(packs, seed);
    const settled = settledOn(collection, starter(seed));
    if (!settled) continue;
    players++;
    owned += collection.length;
    // Distinct, not built: at forty cards owned every candidate is the same
    // forty in a different order, and reporting "6 decks" there would hide the
    // whole point — a new player has no deck to build.
    decks += new Set(candidates(collection).map((d) => [...d].sort().join(","))).size;
    cost += avgCost(settled.deck);
    pct += settled.pct;
  }
  const size = Math.round(owned / players);
  console.log(
    `${String(packs).padStart(5)}   ${String(size).padStart(5)}   ${String(size - RULES.deckSize).padStart(5)}   ${(decks / players).toFixed(0).padStart(5)}   ${`${Math.round(cost / players / 1000)}K`.padStart(8)}   ${(pct / players).toFixed(1).padStart(7)}%`,
  );
}

console.log("\n  spare = cards owned beyond the forty a deck needs. At zero packs there is nothing");
console.log("  to choose: forty cards owned and forty cards in a deck is one legal deck.");
console.log("  The last row is the whole set, so it is also what owning everything is worth.");

// The rows above each measure a collection against a third party. That answers
// "how good is this deck" but not the question anybody actually asks about a
// game with money in it, which is what happens when the two of them meet.
console.log("\n\nthe day-one player against the collector, head to head\n");

let wins = 0;
let decided = 0;
for (let pair = 0; pair < PAIRS; pair++) {
  const rookieSeed = pair * 1013 + 1;
  const veteranSeed = pair * 2027 + 500_003;
  const rookie = settledOn(collectionAfter(0, rookieSeed), starter(rookieSeed));
  const veteran = settledOn(collectionAfter(17, veteranSeed), starter(veteranSeed));
  if (!rookie || !veteran) continue;

  for (let seed = CHOOSE; seed < CHOOSE + SCORE; seed++) {
    const rookieFirst = seed % 2 === 0;
    let s = newMatch(
      CARDS,
      seed,
      rookieFirst
        ? { you: rookie.deck, opponent: veteran.deck }
        : { you: veteran.deck, opponent: rookie.deck },
    );
    let guard = 0;
    while (!s.finished && guard++ < 400) s = applyMove(s, chooseMove(s, index), index);
    if (s.winner === null) continue;
    decided++;
    if ((s.winner === "you") === rookieFirst) wins++;
  }
}
const rookiePct = (wins / decided) * 100;
console.log(`  ${PAIRS} pairs, ${decided} decided matches, band about ±${(1.96 * Math.sqrt(0.25 / decided) * 100).toFixed(1)}%\n`);
console.log(`  a player with only their starter pack wins ${rookiePct.toFixed(1)}%`);
console.log(`  a player who owns the set wins           ${(100 - rookiePct).toFixed(1)}%`);
