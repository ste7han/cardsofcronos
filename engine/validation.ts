// Checks the card set. Runs in the tests and when the dev server boots.
//
// Why this file exists: in Cards of Cronos 110 of 235 cards demonstrably did
// nothing, and nothing in the code noticed. The checks below look specifically
// for cards that by their own data cannot achieve anything — an effect with an
// amount of zero, an aura on a sector that doesn't exist in the set. A card like
// that should break the build, not quietly ride along.

import { assertNever } from "./effects";
import { restrictionOf, rulesText } from "./rules-text";
import type {
  Aura,
  AuraKind,
  Card,
  Condition,
  Effect,
  PerHolder,
  Restriction,
  Sector,
} from "./types";
import { RARITIES, RULES, SECTORS, auraOf, needsChoice } from "./types";

/**
 * Cards that ship without a flavour line, on purpose, and are allowed to.
 *
 * A card with nothing written on it is normally a card somebody forgot, which is
 * why validateSet refuses one. These seven are not forgotten: they are real
 * people, named by the maker, and the line under their name would be a sentence
 * about somebody who can read it.
 *
 * The cards they replaced were nameless — "The Obsidian Finance Founder" — and
 * carried invented lines like "Three years of the same avatar and the same
 * two-line updates." That was fine above a placeholder and is not fine above a
 * name. CLAUDE.md has the rule already: sourced or it is not written.
 *
 * A list rather than a flag on the card, and a list here rather than a `?` on
 * the type, because both of those would let the eighth card slip through
 * silently. This one has to be edited by hand, it is read out by the test in
 * test/set.test.ts, and it is meant to shrink to nothing.
 */
export const AWAITING_FLAVOUR: ReadonlySet<string> = new Set([
  "kris",
  "ryan-wyatt",
  "alex",
  "haten",
  "schwiz",
  "jkcrypto",
  "artik",
]);

/**
 * Project families whose eight cards ship without a line, for the same reason.
 *
 * By family and not by card, because listing 120 ids would be a wall nobody
 * reads and the point of the list is that somebody reads it. A family named here
 * is a family waiting for what it is known for; a card outside one still fails.
 *
 * These fifteen went in on 2026-09-08 with a name, a ticker, a sector, a rarity
 * and the set's own median numbers. What each project is actually known for is
 * the maker's to write, and until then the line is empty rather than invented.
 */
export const AWAITING_FLAVOUR_FAMILIES: ReadonlySet<string> = new Set([
  "caw",
  "mery",
  "capybara",
  "loaf",
  "ballz",
  "ryoshi",
  "bobs",
  "sloth",
  "corgi",
  "puush",
  "croarmy",
]);

const ID_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;

export class SetError extends Error {
  constructor(public readonly problems: string[]) {
    super(
      `The card set is broken (${problems.length} ${
        problems.length === 1 ? "problem" : "problems"
      }):\n` + problems.map((p) => `  - ${p}`).join("\n")
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
 *
 * A person is keyed by name for the same reason a project is keyed by its
 * family. This said "a card that is not a project stands alone" until 2026-09-01,
 * which was true of every person in the set on the day it was written and
 * stopped being true the moment five of them grew ladders — Ansem at common and
 * Ansem at mythic are one person, and the ticker is what says so. A person is
 * their name here the way a project is its family; two different people both
 * calling themselves BLKNOIZ is still the thing being caught.
 */
function tickerProblems(cards: readonly Card[]): string[] {
  const owners = new Map<string, Set<string>>();
  for (const card of cards) {
    if (!card.ticker) continue;
    const owner =
      card.type === "project"
        ? card.project
        : card.type === "person"
        ? card.name
        : card.id;
    owners.set(card.ticker, (owners.get(card.ticker) ?? new Set()).add(owner));
  }
  return [...owners]
    .filter(([, who]) => who.size > 1)
    .map(
      ([ticker, who]) =>
        `Ticker "${ticker}" is used by ${who.size} different things: ${[
          ...who,
        ].join(", ")}.`
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
    sectors.set(
      card.project,
      (sectors.get(card.project) ?? new Set()).add(card.sector)
    );
    tickers.set(
      card.project,
      (tickers.get(card.project) ?? new Set()).add(card.ticker)
    );
  }
  const problems: string[] = [];

  // Every card of a project carries the project's name, so WIF is the headline on
  // all eight and the moment is what tells them apart. If one of them drifts to
  // its own name, the family stops reading as a family and nothing else notices.
  const names = new Map<string, Set<string>>();
  const labels = new Set<string>();
  for (const card of cards) {
    if (card.type !== "project") continue;
    names.set(
      card.project,
      (names.get(card.project) ?? new Set()).add(card.name)
    );
    const label = card.moment ? `${card.name} · ${card.moment}` : card.name;
    if (labels.has(label)) {
      problems.push(
        `Two cards are both called "${label}"; a log line could mean either.`
      );
    }
    labels.add(label);
  }
  for (const [project, set] of names) {
    if (set.size > 1) {
      problems.push(
        `Project "${project}" goes by ${set.size} names: ${[...set].join(
          ", "
        )}.`
      );
    }
  }
  const withMoments = new Map<string, number>();
  for (const card of cards) {
    if (card.type !== "project") continue;
    withMoments.set(
      card.project,
      (withMoments.get(card.project) ?? 0) + (card.moment ? 1 : 0)
    );
  }
  for (const [project, n] of withMoments) {
    const total = cards.filter(
      (c) => c.type === "project" && c.project === project
    ).length;
    // All of them or none. A project where three cards name a moment and one does
    // not reads as a bug on the card that does not.
    if (n !== 0 && n !== total) {
      problems.push(
        `Project "${project}" has ${n} of ${total} cards naming a moment; make it all or none.`
      );
    }
    if (total > 1 && n === 0) {
      problems.push(
        `Project "${project}" has ${total} cards and no moment on any of them.`
      );
    }
  }

  for (const [project, set] of sectors) {
    if (set.size > 1) {
      problems.push(
        `Project "${project}" is in ${set.size} sectors: ${[...set].join(
          ", "
        )}.`
      );
    }
  }
  for (const [project, set] of tickers) {
    if (set.size > 1) {
      problems.push(
        `Project "${project}" has ${set.size} tickers: ${[...set].join(", ")}.`
      );
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
  // Project families for the champion auras, keyed on ticker. Same reason as
  // sectorsInSet: an aura pointing at something the set does not contain is a
  // card that does nothing, and it has to be caught here rather than noticed in
  // a match.
  const projectsInSet = new Set<string>();
  // The invariant those auras rest on: one ticker, one family. It holds across
  // all 155 families today, and a champion keyed on a ticker two families share
  // would quietly double both. Checked rather than trusted.
  const familyOfTicker = new Map<string, string>();

  for (const card of cards) {
    if (card.type === "project") {
      sectorsInSet.add(card.sector);
      projectsInSet.add(card.ticker);
      const seen = familyOfTicker.get(card.ticker);
      if (seen !== undefined && seen !== card.project) {
        problems.push(
          `Ticker "${card.ticker}" belongs to both "${seen}" and "${card.project}". ` +
            `A champion aura naming it would multiply both families.`
        );
      }
      familyOfTicker.set(card.ticker, card.project);
    }
  }

  for (const card of cards) {
    const where = `${card.id} (${card.name})`;

    if (seen.has(card.id)) problems.push(`${where}: id appears twice.`);
    seen.add(card.id);

    if (!ID_PATTERN.test(card.id)) {
      problems.push(
        `${where}: id must be kebab-case (lowercase, digits, hyphens).`
      );
    }
    if (!card.name.trim()) problems.push(`${where}: no name.`);
    if (!card.ticker.trim()) problems.push(`${where}: no ticker.`);
    const waiting =
      AWAITING_FLAVOUR.has(card.id) ||
      (card.type === "project" && AWAITING_FLAVOUR_FAMILIES.has(card.project));
    if (!card.flavour.trim() && !waiting) problems.push(`${where}: no flavour text.`);
    // The card is a fixed 5:7, so there is a real bottom to it. Past this the
    // flavour pushes itself off the card, and a card quietly missing its last
    // line is exactly the kind of thing nobody notices for a year. Measured: 83
    // characters is the longest that fits, so this is where the room runs out.
    if (card.flavour.length > MAX_FLAVOUR) {
      problems.push(
        `${where}: flavour is ${card.flavour.length} characters; ${MAX_FLAVOUR} is what fits on the card.`
      );
    }
    if (!RARITIES.includes(card.rarity)) {
      problems.push(`${where}: unknown rarity "${card.rarity}".`);
    }

    // Generated, and checked anyway. See MAX_RULES_LINE.
    for (const line of rulesText(card)) {
      if (line.text.length > MAX_RULES_LINE) {
        problems.push(
          `${where}: a rules line is ${line.text.length} characters; ${MAX_RULES_LINE} is the most that reads on a card. Line: "${line.text}"`
        );
      }
    }

    if (card.type === "project") {
      if (!SECTORS.includes(card.sector)) {
        problems.push(`${where}: unknown sector "${card.sector}".`);
      }
      if (!Number.isFinite(card.launchMC) || card.launchMC <= 0) {
        problems.push(
          `${where}: launchMC must be positive, is ${card.launchMC}.`
        );
      }
      if (!Number.isFinite(card.pumpMC) || card.pumpMC < 0) {
        problems.push(
          `${where}: pumpMC must not be negative, is ${card.pumpMC}.`
        );
      }
      if (!Number.isInteger(card.holders) || card.holders < 1) {
        problems.push(
          `${where}: holders must be at least 1, is ${card.holders}.`
        );
      }
    }

    const aura = auraOf(card);
    if (aura)
      problems.push(...validateAura(aura, where, sectorsInSet, projectsInSet));

    const restriction = restrictionOf(card);
    if (restriction) problems.push(...validateRestriction(restriction, where));

    if (card.type === "project" && card.standing) {
      problems.push(...validateStanding(card.standing, `${where} standing`));
    }

    if (card.type === "project" && card.useless) {
      // The word has to be true. Anything at all on the card makes it a lie, and
      // a card whose text disagrees with what it does is the one failure this
      // whole file exists to prevent.
      const does = [
        card.effect && "an effect",
        card.payoff && "a payoff",
        card.restriction && "a standing rule",
        card.standing && "a standing effect",
        card.toll && "a toll",
        card.onTheirPlay && "a reaction",
        card.onYourPlay && "a fee on your own plays",
        card.type === "project" && card.uptime && "uptime",
        card.type === "project" && card.mutual && "a shared lock",
      ].filter(Boolean);
      if (does.length > 0) {
        problems.push(
          `${where}: it says "Useless." and carries ${does.join(", ")}. ` +
            `The word is only allowed on a card that really does nothing.`
        );
      }
    }

    if (card.type === "project" && card.loyalty) {
      // The ceiling is set against how long a position actually stands, not
      // against how long a match is: median two turns, mean 2.73, and 44% of
      // positions are gone within one. At 25% that made the whole family worth
      // 2.3 points, because most of the growth was never reached. A rate has to
      // be large to pay inside two turns, and the card is still worth nothing to
      // a player who keeps rotating.
      if (card.loyalty < 5 || card.loyalty > 45) {
        problems.push(
          `${where}: a loyalty of ${card.loyalty}% a turn — between 5 and 45.`
        );
      }
    }

    if (card.type === "project" && card.freePlays) {
      // Two is a turn played for nothing on top of the budget, which is already
      // the largest thing a standing rule does here. Three would be a hand that
      // never has to choose.
      if (card.freePlays < 1 || card.freePlays > 2) {
        problems.push(
          `${where}: ${card.freePlays} free plays a turn — one or two.`
        );
      }
    }

    if (card.type === "project" && card.severance) {
      // A side closes 20.2 positions a match, so this is collected far more often
      // than a played effect and is capped far lower. Above a third, closing a
      // mature position would pay more than holding it, and the portfolio
      // already wants closing badly enough.
      // A cut off both tables collects about twice as often as one off theirs
      // alone, so the ceiling differs with the target rather than being one
      // number pretending both cards are the same card.
      const ceiling = card.severance.from === "theirs" ? 80 : 45;
      if (
        card.severance.percentage < 3 ||
        card.severance.percentage > ceiling
      ) {
        problems.push(
          `${where}: a severance of ${card.severance.percentage}% from "${card.severance.from}" — between 3 and ${ceiling}.`
        );
      }
    }

    if (card.type === "project" && card.discount) {
      // Never free. Below five it rounds away on the cheap half of the set, and
      // above forty a common costs less than the change in your pocket.
      if (card.discount < 5 || card.discount > 40) {
        problems.push(
          `${where}: a discount of ${card.discount}% — between 5 and 40.`
        );
      }
    }

    if (card.type === "project" && card.shield) {
      // Never the whole of a loss. A player who cannot lose market cap has taken
      // the other half of the game off the table, and every family that takes it
      // with them.
      if (card.shield < 5 || card.shield > 50) {
        problems.push(
          `${where}: a shield of ${card.shield}% — between 5 and 50.`
        );
      }
    }

    if (card.type === "project" && card.leverage) {
      // Half again is as far as this goes. It multiplies everything, including
      // what is done to you, and a number past that stops being a decision and
      // becomes the only thing that happened in the match.
      if (card.leverage < 5 || card.leverage > 50) {
        problems.push(
          `${where}: leverage of ${card.leverage}% — between 5 and 50.`
        );
      }
    }

    if (card.type === "project" && card.morePositions) {
      // Half a board again is as far as this goes. Every position pumps every
      // turn, so room is worth more than almost anything a card can print, and a
      // number that doubled the board would end matches rather than shape them.
      if (card.morePositions < 1 || card.morePositions > 3) {
        problems.push(
          `${where}: ${card.morePositions} more positions on a board of ` +
            `${RULES.portfolioSize} — between 1 and 3.`
        );
      }
    }

    if (card.type === "project" && card.toll) {
      // A toll compounds against a player who is doing well, and there is no
      // cap on how much they can gain in a turn. Ten percent of everything is
      // already the largest standing thing in the set.
      if (card.toll.percentage < 1 || card.toll.percentage > 15) {
        problems.push(
          `${where}: a toll of ${card.toll.percentage}% — it takes a cut of every gain ` +
            `they make, so the ceiling is 15.`
        );
      }
    }

    if (card.type === "project" && card.oracle) {
      // A market cap moves several million over a match, counting both
      // directions, so a point here is worth far more than a point of anything
      // else that reads a number. Held to single figures for that reason and
      // measured before the ceiling was chosen.
      if (card.oracle < 1 || card.oracle > 9) {
        problems.push(
          `${where}: an oracle of ${card.oracle}% — between 1 and 9.`
        );
      }
    }

    if (card.type === "project" && card.tip) {
      // A match spends about $2M of marketing, but a tip only collects while its
      // position is standing and only one position of a project can stand — so
      // it catches about a third of that. Measured: 6.2 payments a match
      // totalling $74.7K at an average rate of ten points. The ceiling is set
      // against what it actually collects rather than against what it is a
      // percentage of.
      if (card.tip < 1 || card.tip > 40) {
        problems.push(`${where}: a tip of ${card.tip}% — between 1 and 40.`);
      }
    }

    if (card.type === "project" && card.onYourPlay) {
      // 2.29 cards a turn is what the set measures, so a rate here is paid a
      // little over twice a turn for as long as the position survives. Held
      // lower than onTheirPlay's ceiling for exactly that reason: you decide how
      // busy you are and they do not.
      if (card.onYourPlay.mc < 1 || card.onYourPlay.mc > 90_000) {
        problems.push(
          `${where}: ${card.onYourPlay.mc} per card you play — a turn holds 2.29 of them ` +
            `on average, so the ceiling is 90000.`
        );
      }
    }

    if (card.type === "project" && card.onTheirPlay) {
      if (card.onTheirPlay.mc < 1 || card.onTheirPlay.mc > 150_000) {
        problems.push(
          `${where}: ${card.onTheirPlay.mc} per card they play — a turn can hold several, ` +
            `so the ceiling is 150000.`
        );
      }
    }

    if (card.payoff) {
      // The payoff effect is an effect, so it answers to every rule an ordinary
      // one does — including the project-target rule above, which it would
      // otherwise slip past by being in a different field.
      problems.push(...validateEffect(card.payoff.effect, `${where} payoff`));
      problems.push(
        ...validateCondition(card.payoff.when, `${where} payoff`, sectorsInSet)
      );

      // "When that project pumps X" has to have a project to be about. Without
      // an aimed effect nothing is chosen, holds answers false every time, and
      // the payoff is decoration — which is exactly the failure this condition
      // was written to replace, so it is not allowed to repeat it.
      if (
        card.payoff.when.kind === "targetPumpsAtLeast" ||
        card.payoff.when.kind === "targetHeldFor"
      ) {
        const aims =
          card.effect &&
          "target" in card.effect &&
          card.effect.target !== undefined &&
          card.effect.target !== "self" &&
          card.effect.target !== "opponent" &&
          card.effect.target !== "both" &&
          needsChoice(card.effect.target);
        if (!aims) {
          problems.push(
            `${where}: the payoff asks about "that project" and the effect does not aim ` +
              `at one — so there is no "that project" and the payoff can never fire.`
          );
        }
      }
      // A payoff may aim at a chosen position, but not on its own: the move
      // carries one targetIndex and the engine hands the same one to both
      // halves. So a payoff that needs aiming is only answerable when the
      // effect needs the same aiming — otherwise nothing chose, and the bot,
      // which reads the requirement off the effect alone, would hand it nothing.
      //
      // This used to forbid it outright, on the same reasoning that forbade an
      // aimed effect on a project at all. That reasoning was about the move type
      // and has been fixed; this half of it is about the card and has not.
      if ("target" in card.payoff.effect) {
        const target = card.payoff.effect.target;
        const effectTarget =
          card.effect && "target" in card.effect
            ? card.effect.target
            : undefined;
        if (
          target !== undefined &&
          target !== "self" &&
          target !== "opponent" &&
          target !== "both" &&
          needsChoice(target) &&
          target !== effectTarget
        ) {
          problems.push(
            `${where}: the payoff aims at "${target}" and the effect does not, but a move ` +
              `carries one target. Point the effect at the same thing, or aim the payoff ` +
              `at a whole board.`
          );
        }
      }
    }

    if (card.type === "event") {
      // An event is something that happened to the market, not something you did.
      // Without this rule the type is decoration on a tactic, and a type that means
      // nothing is a type that quietly drifts.
      const target =
        "target" in card.effect ? (card.effect.target as string) : null;
      if (target !== "allProjects" && target !== "both") {
        problems.push(
          `${where}: an event has to hit the whole table — target "allProjects" or "both". ` +
            `Aimed at one side it is a tactic, not an event.`
        );
      }
    }

    if (card.effect) {
      // Does anything on this card take a share of a market cap rather than an
      // amount? If so, handing both players the same figure is not dead — it
      // makes the share bigger.
      const cashedIn = [card.effect, card.payoff?.effect].some(
        (e) =>
          e?.kind === "stealMC" ||
          e?.kind === "scaleMC" ||
          e?.kind === "comebackMC"
      );
      problems.push(...validateEffect(card.effect, where, cashedIn));

      // This used to forbid a project card from carrying an effect that picks a
      // single project, because a move had one targetIndex and on a project card
      // it already meant "the position to close when the portfolio is full".
      // The rule was right and its reason is gone: a move now carries closeIndex
      // for the close and targetIndex for the aim, so a project may ask both.
      // Left as a note rather than deleted, because the rule looked like a design
      // decision and was actually a limit of the move type — worth knowing.
    }
  }

  if (problems.length > 0) throw new SetError(problems);
}

/**
 * Checks whether an effect can do anything at all by its own numbers. An amount
 * of zero is a card that by definition achieves nothing — exactly the kind of
 * dead card that took a year to spot in the previous project.
 */
/**
 * Is this a thing a rate can be counted against?
 *
 * `per` started as a sector or "any" and has since learned "table", "sectors",
 * "theirs" and "turn". Both places that check it were a chain of `!==`, and both
 * grew a duplicated line as that chain got longer — twice, in two hours, on two
 * different evenings' work. One list checked from two places instead, so adding
 * a seventh value is one edit rather than two chains that look alike.
 */
function isRate(per: string): boolean {
  return (
    per === "any" ||
    per === "table" ||
    per === "sectors" ||
    per === "theirs" ||
    per === "turn" ||
    per === "holders" ||
    per === "plays" ||
    per === "spent" ||
    SECTORS.includes(per as Sector)
  );
}

export function validateEffect(
  effect: Effect,
  where: string,
  /**
   * Does something else on this card read a market cap as a number?
   *
   * Only the "both players gain" rule needs it, and only because that rule is
   * about the card rather than the effect. Optional, so every other caller is
   * unchanged and a missing answer means the strict reading.
   */
  cashedIn = false
): string[] {
  switch (effect.kind) {
    case "directMC": {
      const problems = amount(
        effect.mc,
        `${where}: directMC with an amount of zero does nothing.`
      );
      // A rate is capped lower than an amount, because the board multiplies it:
      // six positions is the portfolio, so five besides the card itself.
      if (effect.per && Math.abs(effect.mc) > 150_000) {
        problems.push(
          `${where}: ${effect.mc} per project is a rate, and five of a sector is a ` +
            `reachable board — the ceiling is 150000.`
        );
      }
      if (effect.per && !isRate(effect.per)) {
        problems.push(
          `${where}: directMC names sector "${effect.per}", which is not a sector.`
        );
      }
      // A flat amount applied to both players moves both market caps by the same
      // number, so it cannot change who is ahead. It passes the "does the state
      // change" test while being unable to change the outcome — exactly the kind
      // of dead card this file exists to catch. Use scaleMC for a market-wide
      // move: a percentage scales with each player's own MC and does shift the gap.
      //
      // Unless something else on the card is paid a *share* of a market cap. Then
      // the flat amount is not the point: inflating both sides and then taking a
      // percentage of the bigger number is a real gain, and a card built that way
      // is doing something this rule was written before anybody had tried. Give
      // first and keep the better half is a tactic, not a dead card.
      if (effect.target === "both" && !cashedIn) {
        problems.push(
          `${where}: directMC on both players moves both market caps by the same amount, so it cannot change who wins. Use scaleMC for a market-wide swing.`
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
      return amount(
        effect.mc,
        `${where}: pumpProject with an amount of zero does nothing.`
      );
    case "pumpBySector": {
      // An empty list, or a sector listed at zero, is a card that does nothing
      // while looking like it does something. Reject both.
      const entries = Object.entries(effect.bonuses) as [Sector, number][];
      if (entries.length === 0) {
        return [`${where}: pumpBySector lists no sectors, so it does nothing.`];
      }
      return entries.flatMap(([sector, mc]) =>
        amount(
          mc,
          `${where}: pumpBySector gives ${sector} an amount of zero, which does nothing.`
        )
      );
    }
    case "damageHolders":
      return [
        ...(effect.amount === "all"
          ? []
          : count(
              effect.amount,
              `${where}: damageHolders must be at least 1.`
            )),
        ...validatePerHolder(effect.perHolder, `${where} perHolder`),
      ];
    case "healHolders":
      return [
        ...(effect.amount === "full"
          ? []
          : count(effect.amount, `${where}: healHolders must be at least 1.`)),
        ...validatePerHolder(effect.perHolder, `${where} perHolder`),
      ];
    case "after": {
      const problems: string[] = [];
      // One turn is not a wait — it resolves at the end of the turn it was
      // played on, which is what every other effect already does. And past the
      // length of a match it is a card that never happens.
      if (effect.turns < 2 || effect.turns >= RULES.turns) {
        problems.push(
          `${where}: after ${effect.turns} turns — under 2 is not a wait at all, and ` +
            `a match is ${RULES.turns} turns long.`
        );
      }
      // No timers inside timers. Nothing needs it, and the log of a card that
      // sets going a card that sets something else going is unreadable.
      if (
        effect.effect.kind === "after" ||
        effect.ifGone?.kind === "after" ||
        effect.now?.kind === "after"
      ) {
        problems.push(`${where}: an "after" cannot wrap another one.`);
      }
      if (effect.now)
        problems.push(...validateEffect(effect.now, `${where} now`));
      problems.push(...validateEffect(effect.effect, `${where} after`));
      if (effect.ifGone) {
        problems.push(...validateEffect(effect.ifGone, `${where} ifGone`));
        // "If it is gone" is about a marked position, so there has to be one.
        if (!effect.marks) {
          problems.push(
            `${where}: ifGone asks whether the marked position is still there, and ` +
              `nothing was marked — set "marks" to say which position to watch.`
          );
        }
      }
      // An effect that aims at a project lands on the mark, so the two have to
      // agree about whose board they are talking about.
      if (effect.marks && "target" in effect.effect) {
        const t = effect.effect.target;
        if (
          t !== undefined &&
          t !== "self" &&
          t !== "opponent" &&
          t !== "both" &&
          needsChoice(t) &&
          t !== effect.marks
        ) {
          problems.push(
            `${where}: it marks "${effect.marks}" and the effect aims at "${t}". One ` +
              `choice, one mark — point them at the same board.`
          );
        }
      }
      return problems;
    }
    case "attach": {
      const problems = validateEffect(effect.every, `${where} every`);
      // The same shortlist standing effects answer to, and for the same reason:
      // this fires up to nine times, and the ones left out are the ones that
      // leave nothing behind to fire at. Nothing takes a position every turn.
      if (
        !STANDING_ALLOWED.has(effect.every.kind) &&
        effect.every.kind !== "scalePump"
      ) {
        problems.push(
          `${where}: "${effect.every.kind}" cannot be attached. It would happen every ` +
            `turn, and that one does not survive being repeated.`
        );
      }
      // A tick lands on the position it hangs on, one at a time, so its own
      // target has to be the single-position form of the same board. Hanging on
      // every position you own and ticking "ownProject" is right; ticking
      // "enemyProject" would reach across the table from a mark on your side.
      const side =
        effect.target === "ownProject" || effect.target === "allOwnProjects"
          ? "ownProject"
          : effect.target === "enemyProject" ||
            effect.target === "allEnemyProjects"
          ? "enemyProject"
          : null;
      if (side === null) {
        problems.push(
          `${where}: "${effect.target}" covers both boards, and a tick has to know ` +
            `whose position it is standing on.`
        );
      } else if (side === "enemyProject" && !aimsAtAPosition(effect.every)) {
        // A tick on their board resolves as them, so an effect that pays "self"
        // would pay the person it was hung on rather than the one who hung it.
        // Having a `target` field is not the test — directMC has one and it
        // names a player.
        problems.push(
          `${where}: "${effect.every.kind}" on their board would resolve as theirs. ` +
            `A tick hung on the opponent has to aim at the position it stands on.`
        );
      } else if ("target" in effect.every) {
        const t = effect.every.target;
        if (
          t !== undefined &&
          t !== "self" &&
          t !== "opponent" &&
          t !== "both" &&
          t !== side
        ) {
          problems.push(
            `${where}: it hangs on "${effect.target}" and the tick aims at "${t}". ` +
              `A tick lands on the position it is attached to, so it wants "${side}".`
          );
        }
      }
      return problems;
    }
    case "scalePump":
      // Zero does nothing, and a hundred percent down is a position deleted by
      // instalments with nothing on the card saying so.
      return effect.percentage !== 0 &&
        effect.percentage >= -50 &&
        effect.percentage <= 50
        ? []
        : [
            `${where}: scalePump must be between -50 and 50 and not zero, is ${effect.percentage}.`,
          ];
    case "peekAndBurn":
      // More than a handful is a card that reads their whole deck, and one is
      // not a look, it is a coin flip you are told the answer to.
      return effect.look >= 2 && effect.look <= 5
        ? []
        : [
            `${where}: peekAndBurn shows ${effect.look} cards; between 2 and 5.`,
          ];
    case "unbankedMC":
      // A board holds a median of $391K unbanked on turn five and $1264K on turn
      // ten, so 60% of it late is most of a mythic on its own. The ceiling is
      // where peakMC's is, and for the same reason.
      return effect.percentage > 0 && effect.percentage <= 60
        ? []
        : [
            `${where}: unbankedMC must be between 1 and 60, is ${effect.percentage}.`,
          ];
    case "peakMC":
      // Paid on a number that never comes down, so a percentage here compounds
      // across a match in a way scaleMC's does not.
      return effect.percentage > 0 && effect.percentage <= 30
        ? []
        : [
            `${where}: peakMC must be between 1 and 30, is ${effect.percentage}.`,
          ];
    case "benchmark":
      // A card that only draws level needs no number; one that overtakes has to
      // say by how much, and not by more than a whole position is worth.
      return effect.target === "ownProject" &&
        (effect.plus === undefined ||
          (effect.plus > 0 && effect.plus <= 100_000))
        ? []
        : [
            `${where}: benchmark lifts one of your own, and any plus has to be ` +
              `between 1 and 100000.`,
          ];
    case "merge":
    case "fork":
      // Neither carries a number. What they are worth is whatever is on the
      // table, which is the point of both of them.
      return [];
    case "budgetToMC":
      // A hundred percent is a card that hands back everything you did not spend
      // and turns budget into a savings account, which is the rule it exists to
      // bend rather than break.
      return effect.percentage > 0 && effect.percentage <= 60
        ? []
        : [
            `${where}: budgetToMC must be between 1 and 60, is ${effect.percentage}.`,
          ];
    case "burnForDamage": {
      const wrong =
        effect.target === "ownProject" || effect.target === "allOwnProjects"
          ? []
          : [`${where}: burnForDamage burns your own, not "${effect.target}".`];
      // A whole-board burn that hands the cards back would let a player replay
      // their entire portfolio off one card, every turn, forever. The two halves
      // are each fine and the pair is not, which is exactly the kind of thing
      // nothing else here would ever have caught.
      if (effect.target === "allOwnProjects" && effect.returns) {
        wrong.push(
          `${where}: a whole-board burn cannot also hand the cards back.`
        );
      }
      // Zero is not "no keep", it is a keep of nothing written out — and a card
      // whose rules text turns on whether a number is present should not have a
      // second way of saying absent.
      if (effect.keep !== undefined && (effect.keep < 1 || effect.keep > 200)) {
        wrong.push(
          `${where}: a keep of ${effect.keep}% — between 1 and 200, or leave it out.`
        );
      }
      return wrong;
    }
    case "refundMC":
      // A match spends a few hundred thousand on marketing, so this is a
      // percentage of a number that only grows — worth nothing on turn one and a
      // great deal by turn ten, which is the shape a rebate should have.
      return effect.percentage > 0 && effect.percentage <= 90
        ? []
        : [
            `${where}: refundMC must be between 1 and 90, is ${effect.percentage}.`,
          ];
    case "mcPerPositionGone": {
      // A match costs 25 positions by the end — 3 by turn six, 9 by turn eight,
      // 17 by turn ten — and 82.5% of them are closed by their own owner making
      // room rather than destroyed. So this is the most reliable counter in the
      // game and the most back-loaded, and a card built on it is worth almost
      // nothing when it lands early.
      //
      // The ceiling is on the one-shot. A standing version pays this every turn
      // and is held far lower by the cards themselves.
      const ceiling = 55_000;
      return effect.mc > 0 && effect.mc <= ceiling
        ? []
        : [
            `${where}: mcPerPositionGone must be between $1 and ${ceiling}, is ${effect.mc}.`,
          ];
    }
    case "mcPerHolderLost": {
      // Capped against the measurement rather than a feeling. An ordinary match
      // costs 18 holders by the end — 4 by turn six, 10 by turn eight, 15 by
      // turn ten, and the worst quarter runs past 28. So the multiplier here is
      // the biggest in the set, and $30K a holder is already half a million on a
      // late board. The ceiling was $60K, chosen before any of that was known.
      const ceiling = 30_000;
      return effect.mc > 0 && effect.mc <= ceiling
        ? []
        : [
            `${where}: mcPerHolderLost must be between $1 and ${ceiling}, is ${effect.mc}.`,
          ];
    }
    case "rug":
      return [];
    case "stealMC": {
      const problems: string[] = [];
      // A rate is capped lower than an amount, because the board multiplies it.
      // Eight projects of one sector is a reachable board, so a 13% rate is
      // already the whole of the opponent's market cap — the ceiling here is on
      // what the card can grow into, not on what it prints.
      const ceiling = effect.per ? 12 : 100;
      if (!(effect.percentage > 0 && effect.percentage <= ceiling)) {
        problems.push(
          `${where}: stealMC percentage must be between 1 and ${ceiling}` +
            `${effect.per ? " when it is a per-sector rate" : ""}, is ${
              effect.percentage
            }.`
        );
      }
      if (effect.per && !SECTORS.includes(effect.per)) {
        problems.push(
          `${where}: stealMC names sector "${effect.per}", which is not a sector.`
        );
      }
      return problems;
    }
    case "comebackMC":
      // Capped at the whole gap, which is the design rule stated as a number: a
      // comeback card can pull you level and never put you ahead.
      //
      // It was capped at half on the argument that more would make falling
      // behind a plan and two in a hand would turn a losing board into a winning
      // one. The second half of that is wrong and the first follows from it:
      // these cards eat their own fuel. A card that closes the gap leaves the
      // next one nothing to work with, so they cannot be stacked however large
      // the percentage is. What half a gap actually bought was a ladder worth a
      // third of its tier — a common costing $20K and paying $9K at the median
      // turn-one deficit, which is a card you lose money on.
      return effect.percentage > 0 && effect.percentage <= 100
        ? []
        : [
            `${where}: comebackMC percentage must be between 1 and 100, is ` +
              `${effect.percentage}.`,
          ];

    case "recoverCard":
      // Three is the whole of an early discard pile — it holds 0.6 cards after
      // three turns and 2.9 after five — so more than that is a card whose text
      // promises something the match cannot supply for most of its length.
      if (effect.amount < 1 || effect.amount > 3) {
        return [
          `${where}: recoverCard brings back ${effect.amount} — between 1 and 3, ` +
            `because a discard pile holds 2.9 cards after five turns.`,
        ];
      }
      return [];
    case "drawCards":
      return count(effect.amount, `${where}: drawCards must be at least 1.`);
    case "discardCards":
      return count(
        effect.amount,
        `${where}: discardCards must take at least 1.`
      );
    case "takeOver":
      // Nothing to check: it carries no number and no target. Listed rather than
      // folded into a default, so adding a variant still breaks this switch.
      return [];
    case "cancel":
      return count(effect.count, `${where}: cancel must take at least 1.`);
    case "extraBudget":
      if (effect.per) {
        if (Math.abs(effect.mc) > 60_000) {
          return [
            `${where}: ${effect.mc} of budget per project is a rate, and the board ` +
              `multiplies it — the ceiling is 60000.`,
          ];
        }
        if (!isRate(effect.per)) {
          return [
            `${where}: extraBudget names sector "${effect.per}", which is not a sector.`,
          ];
        }
      }
      return amount(
        effect.mc,
        `${where}: extraBudget with an amount of zero does nothing.`
      );
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
  /**
   * What the first player is handed before a card is played. Defaults to the
   * rule in force; a caller passes it only to ask what the rule would say at a
   * different value.
   *
   * A parameter rather than a straight read of RULES, and the reason is a test.
   * The aheadBy floor below is dormant while the seed is zero, so proving it
   * still has teeth means asking it about a non-zero seed — and the test that
   * did that by assigning to RULES was mutating a constant every other test file
   * reads. That is a leak waiting for the day vitest stops isolating files, and
   * the failure it produces is a match somewhere else deciding differently for
   * no reason anyone can see.
   */
  firstMoveSeedMC: number = RULES.firstMoveSeedMC
): string[] {
  switch (condition.kind) {
    case "behindBy":
      return condition.mc > 0
        ? []
        : [`${where}: behindBy must be a positive amount, is ${condition.mc}.`];
    case "theirHandAtMost":
      return Number.isSafeInteger(condition.cards) && condition.cards >= 0
        ? []
        : [
            `${where}: theirHandAtMost must be a whole number, is ${condition.cards}.`,
          ];
    case "holdersLostAtLeast":
      // An ordinary match costs 18 holders by the end and 4 by turn six, so a
      // threshold past 30 is a condition that never holds — the silent kind of
      // dead card this set exists to refuse.
      return condition.holders > 0 && condition.holders <= 30
        ? []
        : [
            `${where}: holdersLostAtLeast must be between 1 and 30, is ${condition.holders}.`,
          ];
    case "bankedAtLeast":
      return Number.isSafeInteger(condition.count) && condition.count > 0
        ? []
        : [
            `${where}: bankedAtLeast must be a positive whole number, is ${condition.count}.`,
          ];
    case "aheadBy":
      // Two rules, and the second one is the one nobody sees coming.
      //
      // The player who moves first starts on RULES.firstMoveSeedMC, which is
      // payment for having to commit to the table before there is a table to
      // read. It is not a lead — but the engine cannot tell the difference,
      // because being ahead is one market cap minus the other. So a gate at or
      // below the seed is open on turn one, for the first player, for free, and
      // the card that carries it reads "when you are ahead" while meaning "when
      // you moved first".
      //
      // This is caught here rather than left to a test because the seed moves.
      // It has moved four times, it goes up every time the set learns to fight
      // harder, and each move drags the floor under every gate in this ladder
      // without touching a single card. Birdeye sat at 350K and was handed 30K
      // a match the moment the seed passed it; what found that was a test about
      // something else entirely, failing for a reason it could not name.
      if (condition.mc <= 0) {
        return [
          `${where}: aheadBy must be a positive amount, is ${condition.mc}.`,
        ];
      }
      return condition.mc > firstMoveSeedMC
        ? []
        : [
            `${where}: aheadBy wants ${condition.mc} and the player who moves first is ` +
              `handed ${firstMoveSeedMC} before anyone has played a card, so this ` +
              `fires on turn one for moving first rather than for being ahead. Put the ` +
              `gate above the seed, or lower the seed.`,
          ];
    case "ownProjectsInSector": {
      const problems: string[] = [];
      if (!sectorsInSet.has(condition.sector)) {
        problems.push(
          `${where}: condition names sector "${condition.sector}", which no project in the set has.`
        );
      }
      if (condition.atLeast < 1 || condition.atLeast > RULES.portfolioSize) {
        problems.push(
          `${where}: condition wants ${condition.atLeast} projects of a sector and a portfolio ` +
            `holds ${RULES.portfolioSize}, so it can never be met.`
        );
      }
      return problems;
    }
    case "bankedAtMost":
      // Zero is the interesting one — never sold. Past a handful it is a
      // condition that has never once been false, which is a payoff pretending.
      return condition.count >= 0 && condition.count <= 3
        ? []
        : [
            `${where}: bankedAtMost ${condition.count} — between 0 and 3, or it is always true.`,
          ];
    case "turnAtMost":
      // Above the last turn it is always true; below one it can never be.
      return condition.turn >= 1 && condition.turn < RULES.turns
        ? []
        : [
            `${where}: turnAtMost ${condition.turn} is always true or never, of ${RULES.turns}.`,
          ];
    case "targetHeldFor":
      return condition.turns >= 2 && condition.turns <= RULES.turns
        ? []
        : [
            `${where}: targetHeldFor ${condition.turns} — one is every position the turn ` +
              `it lands, and more than ${RULES.turns} cannot happen.`,
          ];
    case "upgraded":
      // Nothing to bound. Either the card took a position over or it did not,
      // and both answers happen often enough to be worth printing.
      return [];
    case "playedThisTurnAtLeast":
      // One is every card there is. Above four is a turn that happens 14% of the
      // time at four and vanishingly less above it — measured, not guessed:
      // 64% of turns place two cards, 31% three, 14% four.
      return condition.cards >= 2 && condition.cards <= 4
        ? []
        : [
            `${where}: playedThisTurnAtLeast ${condition.cards} — between 2 and 4.`,
          ];
    case "playedThisTurnAtMost":
      // A turn holds 2.29 cards on average and exactly one on 29% of them, so
      // asking for one is a real condition. Past three it holds nearly always
      // and stops being a condition at all.
      return condition.cards >= 1 && condition.cards <= 3
        ? []
        : [
            `${where}: playedThisTurnAtMost must be between 1 and 3, is ${condition.cards}.`,
          ];
    case "yourHandAtLeast":
      return condition.cards >= 1 && condition.cards <= RULES.handSize
        ? []
        : [
            `${where}: a hand holds ${RULES.handSize}, so ${condition.cards} is out of reach.`,
          ];
    case "discardAtLeast":
      return condition.count >= 1
        ? []
        : [
            `${where}: discardAtLeast ${condition.count} is true before anything has happened.`,
          ];
    case "targetPumpsAtLeast":
      // Only sanity on the amount here. Whether the card is even aimed somewhere
      // is a question about the card and not about the condition, so it is asked
      // in validateSet where the effect is in reach.
      return condition.mc > 0
        ? []
        : [
            `${where}: targetPumpsAtLeast wants ${condition.mc}, which every position beats.`,
          ];
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
        : [
            `${where}: condition wants turn ${condition.turn} and a match is ${RULES.turns} turns.`,
          ];
    default:
      return assertNever(condition, "validateCondition");
  }
}

/**
 * Which effects a project is allowed to fire every turn, and why the list is short.
 *
 * A played effect happens once and the board absorbs it. The same effect on a
 * clock is a different card: over ten turns it fires up to nine times, and the
 * ones left out here are the ones that would leave nothing behind to fire at.
 * Taking a position every turn empties a board; rugging every turn does it
 * faster; anything that needs the player to choose a target cannot be asked at
 * the end of a turn nobody is looking at.
 *
 * A whitelist rather than a blacklist on purpose, the way the rest of this
 * engine works: a new effect kind is not standing-legal until somebody has
 * thought about what it does nine times in a row.
 */
const STANDING_ALLOWED = new Set<Effect["kind"]>([
  "stealMC",
  "directMC",
  "comebackMC",
  "damageHolders",
  "healHolders",
  "extraBudget",
  "drawCards",
  "discardCards",
  // Money that sits there is worth something every turn it sits there, which is
  // the one shape a buyback has — a one-off conversion is a card, a standing one
  // is a policy.
  "budgetToMC",
  // A percentage of your own market cap, every turn. Bounded by the market cap
  // it is a percentage of, which is the only thing on this list that limits
  // itself — five percent for six turns is a third more, not a runaway.
  "scaleMC",
  // Paid for what the match has cost so far, every turn. It reads the count
  // fresh each time rather than banking anything, so nine firings are nine
  // honest readings of a number that grows on its own — which is the whole of
  // what outliving something looks like. Rates on a standing version are held
  // far below the one-shot ceiling by the cards that carry it.
  "mcPerPositionGone",
  // A share of what the board has produced and nobody has banked, every turn.
  //
  // The same shape as mcPerPositionGone and safe for the same reasons: it reads
  // `earned` fresh each turn and takes nothing out of it, so there is always
  // something left to fire at. And it cannot feed itself — it pays market cap,
  // and market cap is not what `earned` counts, so nine firings are nine
  // readings of a number this effect does not move. That is a weaker loop than
  // scaleMC, which is already on this list and does read its own output.
  //
  // It is bounded twice over: by what the board's pump rates can produce, and by
  // the player, who can shut it off entirely by banking. Nothing else here comes
  // with its own off switch.
  //
  // Held to low rates for the reason mcPerPositionGone is. The number it reads
  // runs from a median $40K on turn two to $1264K on turn ten, so a percentage
  // that is fair in the middle of a match is large at the end of one.
  "unbankedMC",
]);

export function validateStanding(effect: Effect, where: string): string[] {
  const problems = validateEffect(effect, where);
  if (!STANDING_ALLOWED.has(effect.kind)) {
    problems.push(
      `${where}: "${effect.kind}" cannot stand. A standing effect fires up to ` +
        `nine times in a match, and that one does not survive being repeated.`
    );
  }
  // Only the two that aim at a position can ask to be aimed; the rest carry a
  // TargetPlayer, which never needs choosing.
  if (
    (effect.kind === "damageHolders" || effect.kind === "healHolders") &&
    needsChoice(effect.target)
  ) {
    problems.push(
      `${where}: "${effect.kind}" targets "${effect.target}", which needs a ` +
        `position chosen, and nothing is choosing at the end of a turn. ` +
        `A standing effect has to aim itself.`
    );
  }
  return problems;
}

/**
 * The rider on a holder effect, and why the two kinds are capped differently.
 *
 * A rider multiplies by however many holders moved, and a card aimed at a whole
 * board can move twelve at once — six positions, two holders each. That is the
 * number both ceilings are set from.
 *
 * Market cap is capped generously: twelve times $50K is $600K, large but on the
 * scale market caps are already on by the late turns.
 *
 * Budget is capped hard, and the first version of this did not and was wrong by
 * a factor of twelve. A turn's marketing budget is $40K. Twelve holders at $50K
 * a holder is $600K — fifteen turns of budget arriving in one, in a match ten
 * turns long. The card measured at minus $18.5K: a mythic costing $280K that was
 * worse than not playing it. Half a turn's budget per holder is the ceiling, so
 * the worst case is six turns' worth and a bad card can no longer be written
 * without the set refusing it.
 */
/** Does this effect aim at a position rather than at a player, or at nothing? */
function aimsAtAPosition(effect: Effect): boolean {
  if (!("target" in effect)) return false;
  const t = effect.target;
  return t !== undefined && t !== "self" && t !== "opponent" && t !== "both";
}

export function validatePerHolder(
  perHolder: PerHolder | undefined,
  where: string
): string[] {
  if (!perHolder) return [];
  if (perHolder.mc <= 0)
    return [`${where}: a rider of ${perHolder.mc} does nothing.`];
  const ceiling =
    perHolder.kind === "extraBudget" ? RULES.budgetPerTurn / 2 : 50_000;
  if (perHolder.mc > ceiling) {
    return [
      `${where}: ${perHolder.mc} a holder is too much — twelve holders can move at ` +
        `once, so the ceiling is ${ceiling}.`,
    ];
  }
  return [];
}

export function validateRestriction(
  restriction: Restriction,
  where: string
): string[] {
  switch (restriction.kind) {
    case "banType":
      // Everything except a project. Projects are the market cap engine and the
      // only way either player scores; a card that switches them off is not a
      // card, it is the end of the match with extra steps. Tactics, events,
      // tools and people are all fair game — taking somebody's answers
      // away is a card, taking their engine away is not.
      return restriction.cardType === "project"
        ? [
            `${where}: banType cannot ban projects. A player who cannot play a ` +
              `project cannot score, and a card that ends the match is not a card.`,
          ]
        : [];
    case "banTakeProfit":
    case "banRoom":
      return [];
    case "taxPlays":
      // Nought does nothing and negative would be a discount for the person on
      // the other side of the table, which no restriction is allowed to be.
      // Capped at a hundred because past that a common costs more than a mythic,
      // and a tax that reorders the whole price list is a different card from the
      // one printed.
      return Number.isFinite(restriction.percent) &&
        restriction.percent > 0 &&
        restriction.percent <= 100
        ? []
        : [`${where}: a tax of ${restriction.percent}% is not a tax.`];
    default:
      return assertNever(restriction, "validateRestriction");
  }
}

export function validateAura(
  aura: Aura,
  where: string,
  sectorsInSet: ReadonlySet<Sector>,
  projectsInSet: ReadonlySet<string>
): string[] {
  switch (aura.kind) {
    case "pumpSector": {
      const problems: string[] = [];
      if (!SECTORS.includes(aura.sector)) {
        problems.push(
          `${where}: aura points at unknown sector "${aura.sector}".`
        );
      } else if (!sectorsInSet.has(aura.sector)) {
        // No project in this sector: the aura can never apply to anything.
        problems.push(
          `${where}: aura pumps sector "${aura.sector}", but no project in the set has that sector. This card does nothing.`
        );
      }
      if (!Number.isFinite(aura.bonus) || aura.bonus === 0) {
        problems.push(`${where}: an aura bonus of zero does nothing.`);
      }
      return problems;
    }
    case "championProjects": {
      const problems: string[] = [];
      // The flat half is a sector aura and gets a sector aura's checks. Skipping
      // them because the interesting half is elsewhere is how half a card stops
      // working while the other half covers for it.
      if (!SECTORS.includes(aura.sector)) {
        problems.push(
          `${where}: aura points at unknown sector "${aura.sector}".`
        );
      } else if (!sectorsInSet.has(aura.sector)) {
        problems.push(
          `${where}: aura pumps sector "${aura.sector}", but no project in the set has that sector.`
        );
      }
      if (!Number.isFinite(aura.bonus) || aura.bonus <= 0) {
        problems.push(
          `${where}: a champion with a floor of ${aura.bonus} is dead in most decks.`
        );
      }
      if (aura.tickers.length === 0) {
        problems.push(
          `${where}: an aura that champions no project does nothing.`
        );
      }
      for (const ticker of aura.tickers) {
        // The reason this variant carries names instead of a sector, and the
        // reason it is checked here rather than trusted. A family that does not
        // exist multiplies nothing, silently, forever — 110 cards died of
        // exactly this in the last project.
        if (!projectsInSet.has(ticker)) {
          problems.push(
            `${where}: aura champions "${ticker}", which is not a project ticker in the set. This card does nothing for it.`
          );
        }
      }
      if (!Number.isFinite(aura.times) || aura.times <= 1) {
        // One is not a multiplier, it is a card that says it does something.
        // Below one it would be a penalty on the holder's own board, which no
        // aura is allowed to be — see the note on Restriction.
        problems.push(
          `${where}: an aura multiplier of ${aura.times} does nothing or works against its owner.`
        );
      }
      return problems;
    }
    case "budgetEachTurn":
      // Zero pays nothing and negative would tax its own owner, which no aura is
      // allowed to be — see the note on Restriction.
      return aura.budget > 0 && Number.isFinite(aura.budget)
        ? []
        : [
            `${where}: a budget aura of ${aura.budget} does nothing or works against its owner.`,
          ];
    case "drawEachTurn":
      // Whole cards. Half a card is not a thing that can be dealt, and a fraction
      // here would round somewhere without saying so.
      return Number.isSafeInteger(aura.cards) && aura.cards > 0
        ? []
        : [`${where}: a draw aura of ${aura.cards} is not a number of cards.`];
    case "bankPays": {
      const problems: string[] = [];
      if (!sectorsInSet.has(aura.sector)) {
        problems.push(
          `${where}: aura pumps sector "${aura.sector}", which no project has.`
        );
      }
      if (!Number.isFinite(aura.bonus) || aura.bonus <= 0) {
        problems.push(
          `${where}: a banker with a floor of ${aura.bonus} is dead in a deck that never banks.`
        );
      }
      if (!Number.isFinite(aura.mc) || aura.mc <= 0) {
        problems.push(
          `${where}: taking profit paying ${aura.mc} is not a payment.`
        );
      }
      return problems;
    }
    case "healEachTurn": {
      const problems: string[] = [];
      if (!Number.isSafeInteger(aura.holders) || aura.holders <= 0) {
        problems.push(
          `${where}: a healing aura of ${aura.holders} is not a number of holders.`
        );
      }
      if (!sectorsInSet.has(aura.sector)) {
        problems.push(
          `${where}: aura pumps sector "${aura.sector}", which no project has.`
        );
      }
      if (!Number.isFinite(aura.bonus) || aura.bonus <= 0) {
        problems.push(
          `${where}: a healer with a floor of ${aura.bonus} does nothing on an undamaged board.`
        );
      }
      return problems;
    }
    case "morePositions":
      return Number.isSafeInteger(aura.positions) && aura.positions > 0
        ? []
        : [`${where}: ${aura.positions} is not a number of positions.`];
    case "giftBudget": {
      const problems: string[] = [];
      if (!Number.isFinite(aura.budget) || aura.budget <= 0) {
        problems.push(`${where}: a gift of ${aura.budget} is not a gift.`);
      }
      // Without the multiplier this is a present, which is the whole reason the
      // two halves sit on one card.
      if (!Number.isFinite(aura.times) || aura.times <= 1) {
        problems.push(
          `${where}: a gift with a waste multiplier of ${aura.times} is just a gift.`
        );
      }
      return problems;
    }
    case "punishWaste":
      // One changes nothing and below one would be a favour to the opponent,
      // which is the wrong direction for a card that reads as an attack.
      return Number.isFinite(aura.times) && aura.times > 1
        ? []
        : [
            `${where}: a waste multiplier of ${aura.times} helps the opponent or does nothing.`,
          ];
    case "stripHolders":
      return Number.isSafeInteger(aura.holders) && aura.holders > 0
        ? []
        : [`${where}: ${aura.holders} is not a number of holders.`];
    case "burnHand":
      return Number.isSafeInteger(aura.cards) && aura.cards > 0
        ? []
        : [`${where}: ${aura.cards} is not a number of cards.`];
    default:
      return assertNever(aura, "validateAura");
  }
}

/**
 * Checks the spread across the rarity tiers. Separate from validateSet, because
 * this is a design agreement rather than a correctness requirement — you want it
 * guarded, but it shouldn't take down the dev server while you work on the set.
 */
export function validateDistribution(
  cards: readonly Card[],
  expected: Readonly<Record<string, number>>
): void {
  const tally = new Map<string, number>();
  for (const card of cards) {
    tally.set(card.rarity, (tally.get(card.rarity) ?? 0) + 1);
  }
  const problems: string[] = [];
  for (const [rarity, want] of Object.entries(expected)) {
    const got = tally.get(rarity) ?? 0;
    if (got !== want)
      problems.push(`${rarity}: expected ${want}, counted ${got}.`);
  }
  if (problems.length > 0) throw new SetError(problems);
}

function amount(value: number, complaint: string): string[] {
  if (!Number.isFinite(value)) return [`${complaint} (value is ${value})`];
  if (value === 0) return [complaint];
  return [];
}

function count(value: number, complaint: string): string[] {
  return Number.isInteger(value) && value >= 1
    ? []
    : [`${complaint} (is ${value})`];
}
