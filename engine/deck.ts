// Deck building.
//
// A deck is 40 cards drawn from the set, one copy of each, with at least twelve
// projects. That is the whole rule. There is no points budget: a deck of the
// most expensive cards in the set is legal, and it pays for itself at the table
// instead, because the marketing budget only reaches a mythic late. Measured at
// 51.7% against a random forty, where the old points budget had the same deck at
// 97.2%. Charging for a top-heavy deck once, per turn, beat charging for it
// twice.
//
// You draw a median of 31 cards in a match and 40 at the extreme, so at this deck
// size you see nearly all of it. What you put in is what you get — which is the
// point, and it is what pulls the variance down.

import { cardLabel } from "./format";
import { shuffle } from "./rng";
import type { Card, CardIndex, Rarity } from "./types";
import { RULES } from "./types";

export class DeckError extends Error {
  constructor(public readonly problems: string[]) {
    super(
      `That deck is not legal (${problems.length} ${problems.length === 1 ? "problem" : "problems"}):\n` +
        problems.map((p) => `  - ${p}`).join("\n"),
    );
    this.name = "DeckError";
  }
}

/**
 * Everything wrong with a deck, or an empty list. Reported all at once, because
 * fixing them one at a time is a waste of anyone's afternoon.
 */
export function deckProblems(
  cardIds: readonly string[],
  index: CardIndex,
  /**
   * The cards this player owns, when owning is required to deck a card. Left out
   * everywhere the question does not arise — the bot, the scripts, the set tests
   * — because those build from the whole set by definition.
   *
   * It lives here rather than in the deck builder on purpose. In Cards of Cronos
   * the card check was a UI filter, so a direct call could play anything; a rule
   * that only the screen enforces is not a rule.
   */
  owned?: ReadonlySet<string>,
): string[] {
  const problems: string[] = [];

  if (cardIds.length !== RULES.deckSize) {
    problems.push(`A deck is ${RULES.deckSize} cards; this one has ${cardIds.length}.`);
  }

  const seen = new Set<string>();
  for (const id of cardIds) {
    if (!index.has(id)) {
      problems.push(`"${id}" is not a card in this set.`);
      continue;
    }
    if (seen.has(id)) problems.push(`"${id}" appears more than once; one copy of each.`);
    if (owned && !owned.has(id)) {
      problems.push(`You do not own "${cardLabel(index.get(id)!)}". Open packs, or leave it out.`);
    }
    seen.add(id);
  }

  // No deck budget in this experiment. What a card costs is paid at the table,
  // out of the marketing budget, not once when the deck is built.

  // There is deliberately no cap on how many cards of one project a deck holds.
  // A cap went in and came straight back out: `npx tsx scripts/project-stacking.ts`
  // says a deck with all eight BONKs wins 12.8%, five wins 30.9%, three wins
  // 43.6% and one wins 57.3%. Only one card of a project can hold a position, so
  // every extra copy is a card that sits dead in hand — the game already charges
  // for stacking, and it charges plenty. A rule forbidding it would only forbid
  // a mistake somebody is welcome to make.

  const projects = countProjects(cardIds, index);
  if (projects < RULES.minProjects) {
    problems.push(
      `A deck needs at least ${RULES.minProjects} projects; this one has ${projects}. ` +
        `Only a project can hold a position, and only a position pumps.`,
    );
  }

  return problems;
}

export function countProjects(cardIds: readonly string[], index: CardIndex): number {
  return cardIds.filter((id) => index.get(id)?.type === "project").length;
}

export function isLegalDeck(cardIds: readonly string[], index: CardIndex): boolean {
  return deckProblems(cardIds, index).length === 0;
}

/** Throws a DeckError listing everything wrong. */
export function validateDeck(cardIds: readonly string[], index: CardIndex): void {
  const problems = deckProblems(cardIds, index);
  if (problems.length > 0) throw new DeckError(problems);
}

/**
 * A legal deck built from a seed. Used for the bot and as a fallback, so a match
 * never has to fall back on "play the whole set" and quietly break the rules.
 *
 * Walks the shuffled set and takes a card whenever the rest of the deck can still
 * be filled with commons afterwards — that keeps every intermediate state
 * finishable rather than painting itself into a corner with expensive cards. A
 * second pass tops up from the cheapest cards left, and if even that fails it
 * throws rather than handing back a deck that breaks the rules.
 */
export function buildDeck(cards: readonly Card[], seed: number): string[] {
  const { list: shuffled } = shuffle(cards, seed | 0);
  return fill(shuffled);
}

/**
 * The same builder, but cards matching `prefer` are considered first.
 *
 * A themed deck cannot simply be built from a filtered set: no single sector has
 * forty cards, let alone forty inside the budget. So this biases rather than
 * restricts — the theme fills what it can and the rest of the set finishes the
 * deck. The result is a deck that leans somewhere and is still legal by
 * construction, which matters because these are handed to players.
 */
export function buildDeckPreferring(
  cards: readonly Card[],
  seed: number,
  prefer: (card: Card) => boolean,
): string[] {
  const { list: shuffled } = shuffle(cards, seed | 0);
  const ordered = [...shuffled.filter(prefer), ...shuffled.filter((c) => !prefer(c))];
  return fill(ordered);
}


/**
 * Forty cards off an already-ordered list, projects first up to the floor.
 *
 * Much simpler than it was, because there is no deck budget left to respect. The
 * only rule a generated deck can now break is the twelve-project minimum, so
 * that is the only thing it takes care over.
 */
/**
 * How many cards of one project a *generated* deck takes.
 *
 * Not a rule — a deck may hold as many as it likes and the measurement says
 * doing so is its own punishment. This is the generator declining to build a bad
 * deck: it feeds every preset, every bot opponent and every starter pack, and a
 * generator that hands somebody a deck of eight BONKs at 12.8% is not offering a
 * choice, it is making a mistake on their behalf.
 */
const STACK_WHEN_GENERATING = 2;

function fill(shuffled: readonly Card[]): string[] {
  const deck: string[] = [];
  const chosen = new Set<string>();
  const perProject = new Map<string, number>();

  function take(card: Card): boolean {
    if (chosen.has(card.id)) return false;
    if (card.type === "project") {
      const held = perProject.get(card.project) ?? 0;
      if (held >= STACK_WHEN_GENERATING) return false;
      perProject.set(card.project, held + 1);
    }
    deck.push(card.id);
    chosen.add(card.id);
    return true;
  }

  for (const card of shuffled) {
    if (deck.length >= RULES.minProjects) break;
    if (card.type !== "project") continue;
    take(card);
  }

  for (const card of shuffled) {
    if (deck.length === RULES.deckSize) break;
    take(card);
  }

  if (deck.length !== RULES.deckSize) {
    throw new Error(
      `Could not build a deck: got ${deck.length} of ${RULES.deckSize} cards from a set of ${shuffled.length}.`,
    );
  }

  return deck;
}
