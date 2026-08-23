// Checks the card set. Runs in the tests and when the dev server boots.
//
// Why this file exists: in Cards of Cronos 110 of 235 cards demonstrably did
// nothing, and nothing in the code noticed. The checks below look specifically
// for cards that by their own data cannot achieve anything — an effect with an
// amount of zero, an aura on a sector that doesn't exist in the set. A card like
// that should break the build, not quietly ride along.

import { assertNever } from "./effects";
import { restrictionOf, rulesText } from "./rules-text";
import type { Aura, AuraKind, Card, Condition, Effect, Restriction, Sector } from "./types";
import { RARITIES, RULES, SECTORS, auraOf, needsChoice } from "./types";

const ID_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;

export class SetError extends Error {
  constructor(public readonly problems: string[]) {
    super(
      `The card set is broken (${problems.length} ${problems.length === 1 ? "problem" : "problems"}):\n` +
        problems.map((p) => `  - ${p}`).join("\n"),
    );
    this.name = "SetError";
  }
}

/** Throws a SetError with every problem at once. Fixing them one by one is a waste of time. */
/** How much flavour text fits on a card before it runs off the bottom. */
export const MAX_FLAVOUR = 85;

/**
 * How long a generated rules line may be.
 *
 * Flavour has had a limit for a while and rules text had none, on the reasoning
 * that rules text is generated and therefore cannot be wrong. It can still be
 * unreadable. Wormhole's mythic pumps all eight sectors, and pumpBySector spells
 * its bonuses out one by one, so the card came out carrying a 253-character
 * sentence — correct, generated, and impossible to read on a card that is 268
 * pixels wide.
 *
 * Higher than MAX_FLAVOUR because rules text wraps into its own block rather
 * than sitting on one line. The point is not to keep it short; it is that
 * nothing silently produces a paragraph.
 */
export const MAX_RULES_LINE = 120;

/**
 * Two *projects* showing the same ticker is the Cards of Cronos lesson in
 * miniature: one name, two meanings, and no way to tell from the screen which
 * one you are looking at. It is invisible statically, which is why it is checked.
 *
 * Eight cards sharing a ticker is fine when they are eight cards of one project.
 * That is what BONK is, and the ticker is exactly what says so. What must not
 * happen is two different things both calling themselves BONK.
 */
function tickerProblems(cards: readonly Card[]): string[] {
  const owners = new Map<string, Set<string>>();
  for (const card of cards) {
    if (!card.ticker) continue;
    // A card that is not a project stands alone, so it owns its ticker by name.
    const owner = card.type === "project" ? card.project : card.id;
    owners.set(card.ticker, (owners.get(card.ticker) ?? new Set()).add(owner));
  }
  return [...owners]
    .filter(([, who]) => who.size > 1)
    .map(
      ([ticker, who]) =>
        `Ticker "${ticker}" is used by ${who.size} different things: ${[...who].join(", ")}.`,
    );
}

/**
 * A project is one thing, so its cards have to agree about what it is. Two cards
 * of BONK in different sectors would make an aura land on one and not the other,
 * which nobody would ever guess from looking at them.
 */
function projectProblems(cards: readonly Card[]): string[] {
  const sectors = new Map<string, Set<string>>();
  const tickers = new Map<string, Set<string>>();
  for (const card of cards) {
    if (card.type !== "project") continue;
    sectors.set(card.project, (sectors.get(card.project) ?? new Set()).add(card.sector));
    tickers.set(card.project, (tickers.get(card.project) ?? new Set()).add(card.ticker));
  }
  const problems: string[] = [];

  // Every card of a project carries the project's name, so WIF is the headline on
  // all eight and the edition is what tells them apart. If one of them drifts to
  // its own name, the family stops reading as a family and nothing else notices.
  const names = new Map<string, Set<string>>();
  const labels = new Set<string>();
  for (const card of cards) {
    if (card.type !== "project") continue;
    names.set(card.project, (names.get(card.project) ?? new Set()).add(card.name));
    const label = card.edition ? `${card.name} ${card.edition}` : card.name;
    if (labels.has(label)) {
      problems.push(`Two cards are both called "${label}"; a log line could mean either.`);
    }
    labels.add(label);
  }
  for (const [project, set] of names) {
    if (set.size > 1) {
      problems.push(`Project "${project}" goes by ${set.size} names: ${[...set].join(", ")}.`);
    }
  }
  const withEditions = new Map<string, number>();
  for (const card of cards) {
    if (card.type !== "project") continue;
    withEditions.set(card.project, (withEditions.get(card.project) ?? 0) + (card.edition ? 1 : 0));
  }
  for (const [project, n] of withEditions) {
    const total = cards.filter((c) => c.type === "project" && c.project === project).length;
    // All of them or none. A project where seven cards carry an edition and one
    // does not reads as a bug on the card that does not.
    if (n !== 0 && n !== total) {
      problems.push(`Project "${project}" has ${n} of ${total} cards numbered; make it all or none.`);
    }
    if (total > 1 && n === 0) {
      problems.push(`Project "${project}" has ${total} cards and none of them is numbered.`);
    }
  }

  for (const [project, set] of sectors) {
    if (set.size > 1) {
      problems.push(`Project "${project}" is in ${set.size} sectors: ${[...set].join(", ")}.`);
    }
  }
  for (const [project, set] of tickers) {
    if (set.size > 1) {
      problems.push(`Project "${project}" has ${set.size} tickers: ${[...set].join(", ")}.`);
    }
  }
  return problems;
}

export function validateSet(cards: readonly Card[]): void {
  const problems: string[] = [];

  if (cards.length === 0) problems.push("The set is empty.");
  problems.push(...tickerProblems(cards));
  problems.push(...projectProblems(cards));

  const seen = new Set<string>();
  const sectorsInSet = new Set<Sector>();

  for (const card of cards) {
    if (card.type === "project") sectorsInSet.add(card.sector);
  }

  for (const card of cards) {
    const where = `${card.id} (${card.name})`;

    if (seen.has(card.id)) problems.push(`${where}: id appears twice.`);
    seen.add(card.id);

    if (!ID_PATTERN.test(card.id)) {
      problems.push(`${where}: id must be kebab-case (lowercase, digits, hyphens).`);
    }
    if (!card.name.trim()) problems.push(`${where}: no name.`);
    if (!card.ticker.trim()) problems.push(`${where}: no ticker.`);
    if (!card.flavour.trim()) problems.push(`${where}: no flavour text.`);
    // The card is a fixed 5:7, so there is a real bottom to it. Past this the
    // flavour pushes itself off the card, and a card quietly missing its last
    // line is exactly the kind of thing nobody notices for a year. Measured: 83
    // characters is the longest that fits, so this is where the room runs out.
    if (card.flavour.length > MAX_FLAVOUR) {
      problems.push(
        `${where}: flavour is ${card.flavour.length} characters; ${MAX_FLAVOUR} is what fits on the card.`,
      );
    }
    if (!RARITIES.includes(card.rarity)) {
      problems.push(`${where}: unknown rarity "${card.rarity}".`);
    }

    // Generated, and checked anyway. See MAX_RULES_LINE.
    for (const line of rulesText(card)) {
      if (line.text.length > MAX_RULES_LINE) {
        problems.push(
          `${where}: a rules line is ${line.text.length} characters; ${MAX_RULES_LINE} is the most that reads on a card. Line: "${line.text}"`,
        );
      }
    }

    if (card.type === "project") {
      if (!SECTORS.includes(card.sector)) {
        problems.push(`${where}: unknown sector "${card.sector}".`);
      }
      if (!Number.isFinite(card.launchMC) || card.launchMC <= 0) {
        problems.push(`${where}: launchMC must be positive, is ${card.launchMC}.`);
      }
      if (!Number.isFinite(card.pumpMC) || card.pumpMC < 0) {
        problems.push(`${where}: pumpMC must not be negative, is ${card.pumpMC}.`);
      }
      if (!Number.isInteger(card.holders) || card.holders < 1) {
        problems.push(`${where}: holders must be at least 1, is ${card.holders}.`);
      }
    }

    const aura = auraOf(card);
    if (aura) problems.push(...validateAura(aura, where, sectorsInSet));

    const restriction = restrictionOf(card);
    if (restriction) problems.push(...validateRestriction(restriction, where));

    if (card.payoff) {
      // The payoff effect is an effect, so it answers to every rule an ordinary
      // one does — including the project-target rule above, which it would
      // otherwise slip past by being in a different field.
      problems.push(...validateEffect(card.payoff.effect, `${where} payoff`));
      problems.push(...validateCondition(card.payoff.when, `${where} payoff`, sectorsInSet));
      if (card.type === "project" && "target" in card.payoff.effect) {
        const target = card.payoff.effect.target;
        if (target !== "self" && target !== "opponent" && target !== "both" && needsChoice(target)) {
          problems.push(
            `${where}: a project card cannot have a payoff effect that picks a single project, ` +
              `for the same reason it cannot have an ordinary one.`,
          );
        }
      }
    }

    if (card.type === "event") {
      // An event is something that happened to the market, not something you did.
      // Without this rule the type is decoration on a tactic, and a type that means
      // nothing is a type that quietly drifts.
      const target = "target" in card.effect ? (card.effect.target as string) : null;
      if (target !== "allProjects" && target !== "both") {
        problems.push(
          `${where}: an event has to hit the whole table — target "allProjects" or "both". ` +
            `Aimed at one side it is a tactic, not an event.`,
        );
      }
    }

    if (card.effect) {
      problems.push(...validateEffect(card.effect, where));

      // A move carries one targetIndex. On a project card that index already means
      // "the position to close when the portfolio is full", so an effect that also
      // asks the player to pick a project would be ambiguous — and ambiguity here
      // resolves silently into hitting the wrong thing. Reject it at the set level.
      if (card.type === "project" && "target" in card.effect) {
        const target = card.effect.target;
        if (target !== "self" && target !== "opponent" && target !== "both" && needsChoice(target)) {
          problems.push(
            `${where}: a project card cannot have an effect that picks a single project. ` +
              `That target would clash with choosing which position to close when the portfolio is full.`,
          );
        }
      }
    }
  }

  if (problems.length > 0) throw new SetError(problems);
}

/**
 * Checks whether an effect can do anything at all by its own numbers. An amount
 * of zero is a card that by definition achieves nothing — exactly the kind of
 * dead card that took a year to spot in the previous project.
 */
export function validateEffect(effect: Effect, where: string): string[] {
  switch (effect.kind) {
    case "directMC": {
      const problems = amount(effect.mc, `${where}: directMC with an amount of zero does nothing.`);
      // A flat amount applied to both players moves both market caps by the same
      // number, so it cannot change who is ahead. It passes the "does the state
      // change" test while being unable to change the outcome — exactly the kind
      // of dead card this file exists to catch. Use scaleMC for a market-wide
      // move: a percentage scales with each player's own MC and does shift the gap.
      if (effect.target === "both") {
        problems.push(
          `${where}: directMC on both players moves both market caps by the same amount, so it cannot change who wins. Use scaleMC for a market-wide swing.`,
        );
      }
      return problems;
    }
    case "scaleMC":
      return effect.percentage !== 0 && Math.abs(effect.percentage) <= 100
        ? []
        : [
            `${where}: scaleMC percentage must be between -100 and 100 and not zero, is ${effect.percentage}.`,
          ];
    case "pumpProject":
      return amount(effect.mc, `${where}: pumpProject with an amount of zero does nothing.`);
    case "pumpBySector": {
      // An empty list, or a sector listed at zero, is a card that does nothing
      // while looking like it does something. Reject both.
      const entries = Object.entries(effect.bonuses) as [Sector, number][];
      if (entries.length === 0) {
        return [`${where}: pumpBySector lists no sectors, so it does nothing.`];
      }
      return entries.flatMap(([sector, mc]) =>
        amount(mc, `${where}: pumpBySector gives ${sector} an amount of zero, which does nothing.`),
      );
    }
    case "damageHolders":
      return count(effect.amount, `${where}: damageHolders must be at least 1.`);
    case "healHolders":
      return count(effect.amount, `${where}: healHolders must be at least 1.`);
    case "rug":
      return [];
    case "stealMC":
      return effect.percentage > 0 && effect.percentage <= 100
        ? []
        : [`${where}: stealMC percentage must be between 1 and 100, is ${effect.percentage}.`];
    case "drawCards":
      return count(effect.amount, `${where}: drawCards must be at least 1.`);
    case "cancel":
      return count(effect.count, `${where}: cancel must take at least 1.`);
    case "extraBudget":
      return amount(effect.mc, `${where}: extraBudget with an amount of zero does nothing.`);
    default:
      return assertNever(effect, "validateEffect");
  }
}

/**
 * A condition has to be reachable.
 *
 * "Hold seven projects" in a game with six positions is a card that looks alive
 * and is not, which is the exact failure this whole set is arranged against —
 * and it is worse than a dead effect, because the base effect still fires and
 * hides it. Nobody would ever notice the half that never happens.
 */
export function validateCondition(
  condition: Condition,
  where: string,
  sectorsInSet: ReadonlySet<Sector>,
): string[] {
  switch (condition.kind) {
    case "behindBy":
      return condition.mc > 0
        ? []
        : [`${where}: behindBy must be a positive amount, is ${condition.mc}.`];
    case "ownProjectsInSector": {
      const problems: string[] = [];
      if (!sectorsInSet.has(condition.sector)) {
        problems.push(`${where}: condition names sector "${condition.sector}", which no project in the set has.`);
      }
      if (condition.atLeast < 1 || condition.atLeast > RULES.portfolioSize) {
        problems.push(
          `${where}: condition wants ${condition.atLeast} projects of a sector and a portfolio ` +
            `holds ${RULES.portfolioSize}, so it can never be met.`,
        );
      }
      return problems;
    }
    case "ownProjectCount":
      return condition.atLeast >= 1 && condition.atLeast <= RULES.portfolioSize
        ? []
        : [
            `${where}: condition wants ${condition.atLeast} projects and a portfolio holds ` +
              `${RULES.portfolioSize}, so it can never be met.`,
          ];
    case "turnAtLeast":
      return condition.turn >= 1 && condition.turn <= RULES.turns
        ? []
        : [`${where}: condition wants turn ${condition.turn} and a match is ${RULES.turns} turns.`];
    default:
      return assertNever(condition, "validateCondition");
  }
}

export function validateRestriction(restriction: Restriction, where: string): string[] {
  switch (restriction.kind) {
    case "banType":
      // Everything except a project. Projects are the market cap engine and the
      // only way either player scores; a card that switches them off is not a
      // card, it is the end of the match with extra steps. Tactics, events,
      // tools and influencers are all fair game — taking somebody's answers
      // away is a card, taking their engine away is not.
      return restriction.cardType === "project"
        ? [
            `${where}: banType cannot ban projects. A player who cannot play a ` +
              `project cannot score, and a card that ends the match is not a card.`,
          ]
        : [];
    case "banTakeProfit":
      return [];
    default:
      return assertNever(restriction, "validateRestriction");
  }
}

export function validateAura(aura: Aura, where: string, sectorsInSet: ReadonlySet<Sector>): string[] {
  const kind: AuraKind = aura.kind;
  switch (kind) {
    case "pumpSector": {
      const problems: string[] = [];
      if (!SECTORS.includes(aura.sector)) {
        problems.push(`${where}: aura points at unknown sector "${aura.sector}".`);
      } else if (!sectorsInSet.has(aura.sector)) {
        // No project in this sector: the aura can never apply to anything.
        problems.push(
          `${where}: aura pumps sector "${aura.sector}", but no project in the set has that sector. This card does nothing.`,
        );
      }
      if (!Number.isFinite(aura.bonus) || aura.bonus === 0) {
        problems.push(`${where}: an aura bonus of zero does nothing.`);
      }
      return problems;
    }
    default:
      return assertNever(kind, "validateAura");
  }
}

/**
 * Checks the spread across the rarity tiers. Separate from validateSet, because
 * this is a design agreement rather than a correctness requirement — you want it
 * guarded, but it shouldn't take down the dev server while you work on the set.
 */
export function validateDistribution(
  cards: readonly Card[],
  expected: Readonly<Record<string, number>>,
): void {
  const tally = new Map<string, number>();
  for (const card of cards) {
    tally.set(card.rarity, (tally.get(card.rarity) ?? 0) + 1);
  }
  const problems: string[] = [];
  for (const [rarity, want] of Object.entries(expected)) {
    const got = tally.get(rarity) ?? 0;
    if (got !== want) problems.push(`${rarity}: expected ${want}, counted ${got}.`);
  }
  if (problems.length > 0) throw new SetError(problems);
}

function amount(value: number, complaint: string): string[] {
  if (!Number.isFinite(value)) return [`${complaint} (value is ${value})`];
  if (value === 0) return [complaint];
  return [];
}

function count(value: number, complaint: string): string[] {
  return Number.isInteger(value) && value >= 1 ? [] : [`${complaint} (is ${value})`];
}
