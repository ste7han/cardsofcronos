// What a card is trying to do, in the five words the design note uses.
//
// One file, because two scripts read it and they used to carry a copy each. TCG
// has the same function twice — night-family-identity.ts and
// night-family-proposal.ts — with a comment in the second saying the two must
// agree, "purely on which intent won a draw", because they had already
// disagreed by five families once. Two copies of one rule is one copy too many.
//
// THE SWITCH IS EXHAUSTIVE, and that is the difference from the version this was
// ported out of. TCG's ends in `default: return "none"`, which was fine when the
// engine had thirteen effect kinds and is not now that it has twenty-nine:
// sixteen of them fall through it and a card carrying one reads as a card
// carrying nothing. Measured on TCG's own set, 71 of its 577 project cards with
// an effect are invisible to its own family report, and ten families of eight
// have three or more cards unread — io.net reads as six of eight blank while
// every one of those six does something.
//
// That is the failure this repository is built around, arriving in a measuring
// tool rather than in the engine: not a wrong answer, a confident one. So this
// ends in assertNever, and a new effect kind breaks the build here until
// somebody says which of the five it is.

import { assertNever } from "@/engine/effects";
import { restrictionOf } from "@/engine/rules-text";
import type { Card, Effect } from "@/engine/types";

import { CARDS } from "@/data/cards";

/** The intents DESIGN.md already talks in. Same five as TCG, same names. */
export type Intent = "community" | "money" | "momentum" | "takes" | "locks" | "none";

export const INTENTS: Intent[] = ["takes", "momentum", "money", "community", "locks"];

/**
 * What one effect is for.
 *
 * Anything aimed across the table takes, whatever shape it has. Anything that
 * pays you is money, anything that changes what a position yields is momentum,
 * anything that hands you cards or holders back is community.
 */
export function intentOfEffect(e: Effect): Intent {
  switch (e.kind) {
    // --- takes: it happens to them -----------------------------------------
    case "stealMC":
    case "rug":
    case "cancel":
    case "takeOver":
    case "discardCards":
    case "burnForDamage":
    case "peekAndBurn":
      return "takes";
    case "damageHolders":
      // allProjects hits both boards. It is still an attack: the card is played
      // by somebody who chose to break the table rather than build on it.
      return "takes";

    // --- either, on which way it points ------------------------------------
    case "directMC":
    case "scaleMC":
    case "extraBudget":
      return e.target === "opponent" ? "takes" : "money";

    // Pays you, and reads as momentum anyway. It is worth exactly nothing on an
    // empty board: it does not pay you, it pays what you built. A momentum family
    // carrying it is still a momentum family, which is the point of adding it.
    case "pumpToMC":
      return "momentum";

    // --- money: it pays you ------------------------------------------------
    case "budgetToMC":
    case "refundMC":
    case "unbankedMC":
    case "peakMC":
    case "comebackMC":
    case "mcPerHolderLost":
    case "mcPerPositionGone":
      return "money";

    // --- momentum: it changes what a position yields ------------------------
    case "pumpProject":
    case "pumpBySector":
      return "momentum";
    case "scalePump":
      // A cut to their pump is an attack wearing a percentage.
      return e.percentage < 0 ? "takes" : "momentum";
    case "benchmark":
      // Lifts one of your positions to what their best yields. It reads off
      // their board and it pays on yours.
      return "momentum";
    case "fork":
      // Copies their strongest position onto your board and takes nothing from
      // them. What you end up with is a position that pumps.
      return "momentum";
    case "merge":
      // Closes your other positions onto one. Nothing is gained and nothing is
      // lost; the pump moves.
      return "momentum";

    // --- community: it hands you something back -----------------------------
    case "drawCards":
    case "healHolders":
    case "recoverCard":
      return "community";

    // --- wrappers: ask what is inside ---------------------------------------
    case "after":
      // The intent is what it will eventually do, not the waiting. Same rule
      // lib/art.ts uses to decide whether the chart goes up or falls apart.
      return intentOfEffect(e.effect);
    case "attach":
      // Hangs something on a position every turn from now on. Aimed only at
      // them it is a decay and it takes; anywhere else — your own board, or the
      // whole table, which includes your own — the answer is whatever was hung.
      return e.target === "enemyProject" ||
        e.target === "enemyBest" ||
        e.target === "allEnemyProjects"
        ? "takes"
        : intentOfEffect(e.every);

    default:
      return assertNever(e, "intentOfEffect");
  }
}

/** What a whole card is for. A restriction outranks an effect: a lock is a lock. */
export function intentOf(card: Card): Intent {
  if (restrictionOf(card)) return "locks";
  const e = (card as { effect?: Effect }).effect;
  if (!e) return "none";
  return intentOfEffect(e);
}

/**
 * How each family plays. Read off the flavour already on its cards; see
 * scripts/family-proposal.ts for the reasoning line by line.
 *
 * One map, because two scripts wanted it and they had a copy each within the
 * hour — and the copies already disagreed about Tectonic. That is the drift this
 * file was made to stop, arriving in the file that stops it.
 *
 * TECTONIC PLAYS AS LOCKS AND ITS EFFECTS READ AS MONEY, and both are true. TCG's
 * three locks families — Kamino, Serum, Firedancer — carry money effects on
 * nearly every card and put the lock in the second layer: a shield, an uptime, a
 * ban on one card type. A family that locked on all eight would be unplayable to
 * sit across from. So `familyIntent` is what the family IS, and a locks family
 * is checked against money when its effect layer is being read.
 */
export const FAMILY_INTENT: Record<string, Intent> = {
  clove: "community",
  ffs: "community",
  monsters: "takes",
  caw777: "momentum",
  dak: "takes",
  crooks: "community",
  obsidian: "money",
  tectonic: "locks",
  ferro: "money",
  wolfswap: "takes",
  vvs: "momentum",
  mmf: "money",
  robots: "momentum",
  howlers: "community",
  lions: "money",
  chimps: "community",
  nova: "momentum",
  cr00ts: "takes",
  minted: "money",

  // The fifteen that went in without effects, classified on 2026-09-11.
  // Deliberately no new takes beyond CRO Army and no new community: the table
  // above says takes already beats everything and community loses to everything.
  // Five went to locks, which had one family and is the only row that holds up
  // against takes at all — 46% where momentum and money manage 26% and 32%.
  cro: "locks",
  cronus: "locks",
  fulcrom: "locks",
  ebisusbay: "locks",
  loaf: "locks",
  caw: "momentum",
  corgi: "momentum",
  ryoshi: "momentum",
  bobs: "momentum",
  mery: "money",
  puush: "money",
  boomer: "money",
  capybara: "money",
  ballz: "money",
  croarmy: "takes",
};

/**
 * What a family's EFFECT layer should read as. Locks families run on money.
 *
 * COMMUNITY WAS TRIED THE SAME WAY AND MEASURED WORSE, which is worth writing
 * down because the argument for it was good and the outcome was not.
 *
 * intentOfEffect calls drawCards, healHolders and recoverCard "community", and
 * five families here are built almost entirely out of those three. Two of the
 * three do nothing unless somebody has already hurt you. TCG does not build them
 * that way at all: across its nineteen community families, 152 cards run on
 * directMC 30, scaleMC 24, pumpProject 14 and extraBudget 13, with only 23 that
 * draw, heal or recover — the community lives in the second layer, where those
 * cards carry 57 payoffs, 20 standings, 8 tolls and 6 freePlays.
 *
 * So twenty-four of the forty were rebuilt on shapes that pay, and it cost nine
 * points: FFS -22.6, Chimp Club -19.0, Crooks -3.6, measured against fourteen
 * other families over six seeds each. Raising the new effects to TCG's own bands
 * did not recover it either — 36.9% against 36.4%, so it is not that this set's
 * money numbers are small.
 *
 * MEASURED AGAIN ON 2026-09-11, and the table this replaced was wrong.
 *
 * That table said takes beat everything and community lost to everything
 * including itself. It could not be reproduced — nothing in the repository
 * produced it — and its diagonal gave it away: a style against itself has the
 * same cards on both sides and has to land near 50%, and it had takes at 35% and
 * momentum at 65%. It was measuring a seat, not a style.
 *
 * scripts/intent-duel.ts now produces this, sides swapped every match, forty
 * deck seeds per style, and the diagonal printed as the check on the rest.
 * 1200 matches per pairing, row wins against column:
 *
 *              takes  moment   money  commun   locks
 *   takes       50.9%   71.1%   36.3%   39.5%   39.3%
 *   momentum    29.5%   51.2%   39.5%   29.2%   23.8%
 *   money       65.1%   63.3%   49.7%   48.7%   46.2%
 *   community   61.2%   72.6%   54.3%   52.0%   48.8%
 *   locks       62.0%   75.3%   53.8%   54.0%   50.7%
 *
 * Every style is within two points of even against itself, which is what makes
 * the rest of it readable.
 *
 * Against the whole field: locks 59.1%, community 57.8%, money 54.6%,
 * takes 47.4%, momentum 34.6%.
 *
 * So community is not the problem and takes is not dominant. Momentum was, and
 * has since been answered — see pumpToMC in engine/types.ts. After it, 1200
 * matches per pairing:
 *
 *              takes  moment   money  commun   locks
 *   takes       51.5%   60.2%   37.0%   37.5%   37.8%
 *   momentum    41.3%   49.3%   52.8%   39.8%   37.1%
 *   money       64.4%   49.7%   49.7%   46.4%   43.2%
 *   community   63.7%   62.8%   57.0%   51.8%   48.3%
 *   locks       63.6%   63.2%   56.4%   54.9%   51.7%
 *
 * Against the field: locks 58.0%, community 56.7%, money 50.7%, takes 44.7%,
 * momentum 44.0%. Momentum went from 34.6% to 44.0% on one card per family, and
 * the spread across all five closed from 24.5 points to 14.0.
 *
 * WHAT IS LEFT is a different shape from what was here before. Nothing is far
 * behind any more; locks and community are ahead. That is a smaller problem than
 * one style at 34.6%, and nothing has been done about it.
 *
 * Two things changed between the tables and both matter. The old one was taken
 * when 136 of the 272 project cards did nothing and locks was a single card
 * carrying the one restriction the engine measures at minus fifteen thousand;
 * that game no longer exists. And it was measured in a way that cannot be
 * checked, which is the part worth remembering.
 */
/**
 * Families that have not been given an intent yet, listed by name on purpose.
 *
 * Same shape as AWAITING_FLAVOUR in engine/validation.ts, and for the same
 * reason: the alternative is a map that quietly returns undefined for anything
 * it has not heard of, which is how this file came to hand CAW777's intent to a
 * different family for three days without anything noticing.
 *
 * It is empty, which is the state it was built to reach: all thirty-four families
 * were classified on 2026-09-11. It stays rather than being deleted, because the
 * next family added will need somewhere to sit before anybody knows how it plays,
 * and because an empty set still makes the load-time check refuse an unclassified
 * one.
 */
export const INTENT_UNDECIDED: ReadonlySet<string> = new Set<string>([]);

/**
 * Every project family is either given an intent or listed as undecided.
 *
 * Checked when this module loads rather than by a test, so that no script which
 * reads intents can run against a family nobody has classified. A renamed family
 * key breaks here loudly instead of arriving as an undefined three calls later.
 */
export function unclassifiedFamilies(cards: readonly Card[]): string[] {
  const families = new Set(
    cards.flatMap((c) => (c.type === "project" ? [c.project] : [])),
  );
  const problems: string[] = [];
  for (const f of families) {
    if (!(f in FAMILY_INTENT) && !INTENT_UNDECIDED.has(f)) problems.push(f);
  }
  for (const f of Object.keys(FAMILY_INTENT)) {
    if (!families.has(f)) problems.push(`${f} has an intent and is not in the set`);
  }
  for (const f of INTENT_UNDECIDED) {
    if (!families.has(f)) problems.push(`${f} is listed undecided and is not in the set`);
  }
  return problems;
}

{
  const problems = unclassifiedFamilies(CARDS);
  if (problems.length > 0) {
    throw new Error(
      `scripts/intent.ts and the set disagree about ${problems.length} ` +
        `${problems.length === 1 ? "family" : "families"}:\n  ` +
        problems.join("\n  "),
    );
  }
}

/**
 * The intent a family's effects should read as, or undefined while undecided.
 *
 * Throws for a family it has never heard of. Returning undefined for both "not
 * decided yet" and "no such family" is what made the CAW777 rename invisible:
 * one of those is a state and the other is a bug.
 */
export function effectIntentFor(family: string): Intent | undefined {
  if (INTENT_UNDECIDED.has(family)) return undefined;
  const i = FAMILY_INTENT[family];
  if (i === undefined) throw new Error(`No intent is recorded for the family "${family}".`);
  return i === "locks" ? "money" : i;
}
