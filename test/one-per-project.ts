// One card of each project, picked at run time.
//
// The fixtures used to name "bonk", then "wif", then "popcat" as their stand-in
// project, and each of those broke the moment that project became eight cards.
// The version after that asked for a project with exactly *one* card, which held
// until this set arrived with twelve families and no singletons at all.
//
// Both bets were on the wrong property. What a fixture needs is what the file
// said it needed all along: cards that are **unrelated to each other**. Only one
// card of a project may hold a position, so a board built from two cards of one
// family is a board the engine refuses — and that has nothing to do with how
// many cards the family has.
//
// So: one card per project, whatever the set looks like. This cannot go stale
// the way the last three did.

import type { Aura, Card, ProjectCard } from "@/engine/types";
import { auraOf } from "@/engine/types";

import { CARDS } from "@/data/cards";

const first = new Map<string, string>();
for (const card of CARDS) {
  if (card.type !== "project") continue;
  if (!first.has(card.project)) first.set(card.project, card.id);
}

const distinct = [...first.values()];

if (distinct.length < 8) {
  throw new Error(
    `Test fixtures need at least eight different projects and the set has ${distinct.length}.`,
  );
}

/**
 * Unrelated projects, in set order, one card each.
 *
 * Unrelated is the whole point: only one card of a project may hold a position,
 * so a board built out of two cards of one family is a board the engine will not
 * let you build.
 */
export const SOLO = distinct;

export const [SOLO_A, SOLO_B, SOLO_C] = distinct as [string, string, string];

/**
 * One card of a project in a given sector.
 *
 * Same reason as the rest of this file: a test that needs "a memetility project"
 * should ask for the shape rather than name a card that can be rewritten.
 */
export function soloOfSector(sector: string): string {
  const found = CARDS.find(
    (c) => c.type === "project" && c.sector === sector && distinct.includes(c.id),
  );
  if (!found) {
    throw new Error(`No ${sector} project left for the test fixtures.`);
  }
  return found.id;
}

/**
 * Several unrelated projects in one sector.
 *
 * A test that needs "a meme on each side of the table" needs two of them and
 * needs them to be different projects, and reaching for SOLO_A and SOLO_B does
 * not guarantee either — those are the first two projects in the set, whatever
 * sector they happen to be in. Ask for the shape.
 */
export function solosOfSector(sector: string, count: number): string[] {
  const found = CARDS.filter(
    (c) => c.type === "project" && c.sector === sector && distinct.includes(c.id),
  ).map((c) => c.id);
  if (found.length < count) {
    throw new Error(
      `Test fixtures need ${count} different ${sector} projects and the set has ${found.length}.`,
    );
  }
  return found.slice(0, count);
}

/**
 * A project that has several cards, for the tests that are about families.
 *
 * Named "bonk" and then "wif" in three different files, which is the same bet
 * this file exists to stop anybody making. The tests below it do not care which
 * family they get; they care about two things.
 *
 * One: it has cards at several rarities, which is what an upgrade needs.
 *
 * Two — and this is the one that is easy to miss — **none of its cards points at
 * your own board.** A preview of an upgrade should light exactly the slot it
 * takes over, so a card whose effect also pumps every project you hold lights
 * five more and the test reads as a bug in the preview rather than a badly
 * chosen fixture. Picking the family by that property is the difference between
 * a test that measures the preview and one that measures the card.
 */
const grouped = new Map<string, ProjectCard[]>();
for (const card of CARDS) {
  if (card.type !== "project") continue;
  grouped.set(card.project, [...(grouped.get(card.project) ?? []), card]);
}

const OWN_BOARD = new Set(["ownProject", "allOwnProjects", "allProjects"]);

function touchesOwnBoard(card: ProjectCard): boolean {
  for (const effect of [card.effect, card.payoff?.effect]) {
    if (!effect) continue;
    if ("target" in effect && OWN_BOARD.has(String(effect.target))) return true;
  }
  return false;
}

const families = [...grouped.values()].filter(
  (cards) =>
    cards.length > 1 &&
    new Set(cards.map((c) => c.rarity)).size >= 4 &&
    !cards.some(touchesOwnBoard),
);

if (families.length === 0) {
  throw new Error(
    "Test fixtures need a project family, at four or more rarities, whose cards " +
      "never point at your own board. Every family in the set now does.",
  );
}

export const FAMILY_CARDS: readonly ProjectCard[] = families[0]!;
export const FAMILY = FAMILY_CARDS[0]!.project;

const ORDER = ["common", "rare", "epic", "legendary", "mythic"];
const byRarity = [...FAMILY_CARDS].sort(
  (a, b) => ORDER.indexOf(a.rarity) - ORDER.indexOf(b.rarity),
);

/**
 * The cheapest card of that family, and the dearest one below the mythic.
 *
 * UPGRADE_HIGH also has to be a card that does not reach into the discard. The
 * upgrade test checks that a replaced card lands there, and the legendary this
 * picked carried recoverCard — so it put the card in the discard and then took
 * it straight back out again, and the test read an empty discard as the engine
 * losing the card. Nothing was wrong with either the engine or the card; the
 * fixture picked the one card in the family that undoes what it is measuring.
 */
const TOUCHES_DISCARD = (c: ProjectCard) =>
  c.effect?.kind === "recoverCard" || c.effect?.kind === "peekAndBurn";

export const UPGRADE_LOW: ProjectCard = byRarity[0]!;
export const UPGRADE_HIGH: ProjectCard =
  [...byRarity].reverse().find((c) => c.rarity !== "mythic" && !TOUCHES_DISCARD(c)) ??
  [...byRarity].reverse().find((c) => c.rarity !== "mythic") ??
  byRarity.at(-1)!;

/**
 * A card that carries the biggest aura in the set, and one that carries the
 * smallest.
 *
 * `cancel` takes the largest aura first, which is the thing being tested, and
 * naming two cards to prove it is how the last three fixtures went stale.
 */
// "Biggest" has to mean something, and only some aura kinds carry a size. Since
// TCG's aura became a union — budgetEachTurn, drawEachTurn, morePositions and
// the rest have no bonus at all — asking every aura for its `bonus` is asking a
// question half of them cannot answer. The ones that can are the ones this
// fixture is about.
type SizedAura = Extract<Aura, { bonus: number }>;

const auras = CARDS.flatMap((c) => {
  const aura = auraOf(c);
  if (aura === null || !("bonus" in aura)) return [];
  return [{ id: c.id, aura: aura as SizedAura }];
}).sort((a, b) => a.aura.bonus - b.aura.bonus);

if (auras.length < 2 || auras[0]!.aura.bonus === auras.at(-1)!.aura.bonus) {
  throw new Error("Test fixtures need two cards with auras of different sizes.");
}

export const AURA_SMALLEST = auras[0]!.id;
export const AURA_BIGGEST = auras.at(-1)!.id;

/** A tool whose effect draws a card and moves no market cap. */
export const DRAW_TOOL: string = (() => {
  const found = CARDS.find((c) => c.type === "tool" && c.effect.kind === "drawCards");
  if (!found) throw new Error("Test fixtures need a tool that draws a card.");
  return found.id;
})();

/**
 * A project with plenty of holders, for the tests about damage in proportion.
 *
 * A two-holder project makes "four fifths of the pump" into "half", and half is
 * also what a broken implementation returns. Thick positions make the arithmetic
 * distinguishable.
 */
export const THICK_PROJECT: ProjectCard = CARDS.filter(
  (c): c is ProjectCard => c.type === "project" && c.pumpMC > 0,
).sort((a, b) => b.holders - a.holders)[0]!;

/**
 * A tool that carries a sector aura, and the sector it pumps.
 *
 * The kind is part of the fixture, not an accident of ordering. This asked for
 * the first tool with any aura at all, which was the only one that had one until
 * a second tool was given bankPays — and then the test that checks a sector pump
 * keeps working was handed a tool that does not pump a sector. It said so rather
 * than failing on the arithmetic, which is why this is a two-line fix.
 */
export const AURA_TOOL: string = (() => {
  const found = CARDS.find((c) => c.type === "tool" && c.aura?.kind === "pumpSector");
  if (!found) throw new Error("Test fixtures need a tool with a pumpSector aura.");
  return found.id;
})();
