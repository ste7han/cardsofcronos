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
import { familyProfile, supportAffinity, SUPPORT_SHARE, supportCap } from "./affinity";

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
  /**
   * Collected rather than reported one by one.
   *
   * This used to push a sentence per card, and a deck built from the whole set
   * and then checked against a collection produced thirty-three of them: "You do
   * not own X. Open packs, or leave it out." thirty-three times, run together
   * into a paragraph nobody could read. Thirty-three sentences say one thing,
   * and saying it once with the count is the version somebody can act on.
   */
  const unowned: string[] = [];
  for (const id of cardIds) {
    if (!index.has(id)) {
      problems.push(`"${id}" is not a card in this set.`);
      continue;
    }
    if (seen.has(id)) problems.push(`"${id}" appears more than once; one copy of each.`);
    if (owned && !owned.has(id)) unowned.push(cardLabel(index.get(id)!));
    seen.add(id);
  }

  if (unowned.length === 1) {
    problems.push(`You do not own "${unowned[0]}". Open packs, or leave it out.`);
  } else if (unowned.length > 1) {
    // A few names, so it is recognisable, and the count, so it is measurable.
    // All thirty-three would be the wall this replaced.
    const some = unowned.slice(0, 3).map((name) => `"${name}"`).join(", ");
    problems.push(
      `You do not own ${unowned.length} of these cards${
        unowned.length > 3 ? `, among them ${some}` : `: ${some}`
      }. Open packs, or leave them out.`,
    );
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
/**
 * A deck built FOR one project: every card it has, and a seeded fill around them.
 *
 * buildDeckPreferring caps a deck at two cards of a project, because a second
 * copy cannot hold a position while the first one does and a generator handing
 * somebody eight of the same thing is making a decision for them. That cap is
 * right there and wrong here: a deck for a family has to hold the family.
 *
 * What the stacking costs, measured against THE MACHINE over three base decks:
 * eight of a project against one runs -13 points for WIF, -11 for PNUT and VINE,
 * -5 for BONK, and +4 for SONIC, +2 for TROLL and SOLANA. Four points on average,
 * and positive for the families whose cards work off the board rather than off
 * their own position. types.ts says a deck of eight wins 12.8% against 57.3% for
 * a deck of one; that does not reproduce and the note is stale.
 *
 * Projects are filled before everything else so the twelve-project floor is met
 * before the remaining slots go.
 */
export function buildFamilyDeck(
  cards: readonly Card[],
  family: string,
  seed: number,
): string[] {
  const own = cards.filter((c) => c.type === "project" && c.project === family);
  const deck = own.map((c) => c.id);
  const seen = new Set(deck);
  const { list: shuffled } = shuffle(cards, seed | 0);

  // Projects to the cap. The family is already in, so this is the supporting
  // board around it rather than the deck itself.
  let projects = deck.length;
  for (const card of shuffled) {
    if (projects >= PROJECTS_WHEN_GENERATING) break;
    if (seen.has(card.id) || card.type !== "project") continue;
    if (card.project === family) continue;
    deck.push(card.id);
    seen.add(card.id);
    projects++;
  }

  // Then the support, best fit first. The shuffle is what breaks ties, so two
  // seeds give two different decks out of the same top of the list rather than
  // the same eighteen cards every time.
  const profile = familyProfile(cards, family);
  const support = shuffled
    .filter((c) => !seen.has(c.id) && c.type !== "project")
    .map((c) => ({ card: c, score: supportAffinity(c, profile) }))
    .sort((a, b) => b.score - a.score);
  const slots = RULES.deckSize - deck.length;
  const takenOf = new Map<string, number>();
  for (const { card } of support) {
    if (deck.length === RULES.deckSize) break;
    const type = card.type as keyof typeof SUPPORT_SHARE;
    const held = takenOf.get(type) ?? 0;
    if (held >= supportCap(type, slots)) continue;
    takenOf.set(type, held + 1);
    deck.push(card.id);
    seen.add(card.id);
  }

  // Caps can leave the deck short when a type runs out of cards worth taking.
  // Affinity order again, ignoring the caps, so the deck is still forty.
  for (const { card } of support) {
    if (deck.length === RULES.deckSize) break;
    if (seen.has(card.id)) continue;
    deck.push(card.id);
    seen.add(card.id);
  }

  // 165 support cards is more than eighteen, so this only fires if the set
  // shrinks. Projects finish the deck rather than the build handing back 39.
  for (const card of shuffled) {
    if (deck.length === RULES.deckSize) break;
    if (seen.has(card.id)) continue;
    deck.push(card.id);
    seen.add(card.id);
  }

  if (deck.length !== RULES.deckSize) {
    throw new Error(
      `Could not build a deck for "${family}": got ${deck.length} of ${RULES.deckSize}.`,
    );
  }
  return deck;
}

export function buildDeckPreferring(
  cards: readonly Card[],
  seed: number,
  prefer: (card: Card) => boolean,
  /** Overridden only by scripts/preset-shape.ts, which sweeps it. */
  projectCap: number = PROJECTS_WHEN_GENERATING,
): string[] {
  const { list: shuffled } = shuffle(cards, seed | 0);
  const ordered = [...shuffled.filter(prefer), ...shuffled.filter((c) => !prefer(c))];
  return fill(ordered, projectCap);
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

/**
 * How many projects a *generated* deck takes before it fills with support.
 *
 * Not a rule either — RULES.minProjects is the only floor and there is no
 * ceiling. This is the generator declining to hand somebody forty projects.
 *
 * It had to exist because the set is 79% projects: anything that fills forty
 * slots by shuffling gets a deck of projects whatever theme it was asked for.
 * buildFamilyDeck built 40 of 40, and the presets ran a median of 32.
 *
 * Twenty-two is the maker's call. What it costs is now measured rather than
 * guessed, and the guess was wrong in a way worth writing down: the argument was
 * that the cliff sat between twelve and twenty because THE BANKER already ships
 * at 21. "It ships" is not a measurement. There is no cliff at all.
 *
 * scripts/preset-shape.ts, 400 seeds a pairing, band under a point. Each cap
 * against the same preset built at 32:
 *
 *     12   15.1%      18   25.3%      22   33.1%      26   39.6%
 *
 * A straight line, about eight points a step, never reaching even odds. More
 * projects is simply stronger, so the cap costs raw power and there is no safe
 * shelf to stand on.
 *
 * It is kept anyway, for the other half of the same run. Played as a whole field
 * — which is the shipped game, where the bot is capped too and a 32-project
 * opponent does not exist — 22 is where the field is most even. The worst preset
 * wins 16.3% here against 6.0% at 32, and the spread between best and worst is
 * 56.9 against 74.6. Both climb again at 26 and at 12, so this is a genuine
 * minimum seen from both sides.
 *
 * The real finding sits underneath both tables: a support card is worth less per
 * slot than a project card. Swapping ten of them costs about seventeen points,
 * so roughly 1.7 points a slot. That is a statement about how tactics, events
 * and tools are priced, not about this number — see docs/deferred-fixes.md.
 */
export const PROJECTS_WHEN_GENERATING = 22;

function fill(shuffled: readonly Card[], projectCap: number = PROJECTS_WHEN_GENERATING): string[] {
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

  let projects = deck.length;
  for (const card of shuffled) {
    if (deck.length === RULES.deckSize) break;
    if (card.type === "project" && projects >= projectCap) continue;
    if (take(card) && card.type === "project") projects++;
  }

  // Support alone cannot always finish forty: a theme may leave too few of it in
  // the pool. Projects fill the remainder rather than the build throwing, which
  // is the one case where going over the cap beats handing back nothing.
  if (deck.length < RULES.deckSize) {
    for (const card of shuffled) {
      if (deck.length === RULES.deckSize) break;
      take(card);
    }
  }

  if (deck.length !== RULES.deckSize) {
    throw new Error(
      `Could not build a deck: got ${deck.length} of ${RULES.deckSize} cards from a set of ${shuffled.length}.`,
    );
  }

  return deck;
}
