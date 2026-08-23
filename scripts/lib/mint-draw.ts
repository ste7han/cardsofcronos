// A deck mint with rarity odds set on purpose.
//
// Today a mint is buildDeck(): a uniform draw, so the chance of a mythic is the
// share of the set that is mythic. This is the proposed shape instead — N
// distinct cards, a floor on project cards, and every card rolled against a
// rarity table that is a decision rather than a side effect of how the set was
// written.
//
// It lives here rather than in engine/ because no mint exists yet. Two scripts
// measure it: mint-model.ts for what comes out, mint-model-duel.ts for how it
// plays.

import { CARDS } from "../../data/cards";
import { nextInt } from "../../engine/rng";
import { RARITIES, type Card, type Rarity } from "../../engine/types";

export type Odds = Record<Rarity, number>;

/** "50,30,10,8,2" — one weight per rarity, in the order RARITIES lists them. */
export function oddsFrom(text: string): Odds {
  const given = text.split(",").map(Number);
  if (given.length !== RARITIES.length || given.some((n) => !Number.isFinite(n) || n < 0)) {
    throw new Error(
      `Give one non-negative weight per rarity (${RARITIES.join(", ")}), got "${text}".`,
    );
  }
  const total = given.reduce((a, b) => a + b, 0);
  if (total <= 0) throw new Error("The rarity weights add up to nothing.");
  return Object.fromEntries(RARITIES.map((r, i) => [r, given[i]! / total])) as Odds;
}

const byRarity = new Map<Rarity, Card[]>();
const projectsByRarity = new Map<Rarity, Card[]>();
for (const rarity of RARITIES) {
  byRarity.set(rarity, CARDS.filter((c) => c.rarity === rarity));
  projectsByRarity.set(rarity, CARDS.filter((c) => c.rarity === rarity && c.type === "project"));
}

export type MintResult = { cards: Card[]; rerolls: number };

/** A floor per rarity, filled before anything else. Absent means no floor. */
export type Floors = Partial<Record<Rarity, number>>;

/**
 * One mint: `size` distinct cards, at least `minProjects` of them projects.
 *
 * The project floor is filled first — those slots roll a rarity and then take a
 * project of it — and everything after is unrestricted except for
 * `maxPerProject`, which caps how many cards of one project a mint can hand
 * over. That cap is a fairness lever rather than a rule: the deck generator has
 * always had one, and a mint without it hands some players five cards of one
 * project and others a spread. If a rarity has nothing
 * left to give, the rarity is rolled again and the reroll is counted rather than
 * quietly substituted, because a mint that silently hands out the wrong rarity
 * is exactly the kind of fault nobody would ever see.
 */
export function mint(
  seed: number,
  size: number,
  minProjects: number,
  odds: Odds,
  floors: Floors = {},
  maxPerProject = Infinity,
): MintResult {
  let state = seed | 0;
  const cards: Card[] = [];
  const taken = new Set<string>();
  let rerolls = 0;

  const rollRarity = (): Rarity => {
    const draw = nextInt(1_000_000, state);
    state = draw.state;
    let ticket = draw.value / 1_000_000;
    for (const rarity of RARITIES) {
      ticket -= odds[rarity];
      if (ticket < 0) return rarity;
    }
    return RARITIES[RARITIES.length - 1]!;
  };

  const perProject = new Map<string, number>();
  const take = (pool: Card[]): boolean => {
    const free = pool.filter((c) => {
      if (taken.has(c.id)) return false;
      if (c.type !== "project") return true;
      return (perProject.get(c.project) ?? 0) < maxPerProject;
    });
    if (free.length === 0) return false;
    const draw = nextInt(free.length, state);
    state = draw.state;
    const card = free[draw.value]!;
    taken.add(card.id);
    if (card.type === "project") {
      perProject.set(card.project, (perProject.get(card.project) ?? 0) + 1);
    }
    cards.push(card);
    return true;
  };

  // Floors first. A tier drawn at 2% is absent from a third of mints, and the
  // difference between nought and three of the biggest cards in the game is most
  // of what separates a lucky player from an unlucky one. Guaranteeing the first
  // one costs the tier none of its scarcity — the second and third are still
  // down to the roll.
  for (const rarity of RARITIES) {
    const floor = floors[rarity] ?? 0;
    for (let i = 0; i < floor; i++) {
      if (cards.length >= size) break;
      if (!take(byRarity.get(rarity)!)) {
        throw new Error(`The set has fewer ${rarity} cards than the mint floor asks for.`);
      }
    }
  }

  while (cards.length < size) {
    const wantProject = cards.filter((c) => c.type === "project").length < minProjects;
    let placed = false;
    for (let attempt = 0; attempt < 40 && !placed; attempt++) {
      const rarity = rollRarity();
      placed = take(wantProject ? projectsByRarity.get(rarity)! : byRarity.get(rarity)!);
      if (!placed) rerolls += 1;
    }
    if (!placed) {
      throw new Error(
        `A mint of ${size} could not be filled: the set has run out of cards the odds can reach.`,
      );
    }
  }

  return { cards, rerolls };
}
