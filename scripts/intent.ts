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

  // The seven that people bought a card of, classified on 2026-09-12 alongside
  // their effects. Weighted away from what the measurement says is already ahead:
  // three momentum and one takes, the two weakest at 44.0% and 44.7%, against one
  // community which leads the field at 56.7% — and that one only because Gang Gang
  // renounced ownership and burned its liquidity, which is not a money deck and not
  // a takes deck, and filing it elsewhere for the sake of a number would be a lie.
  pyro: "momentum",
  bored: "momentum",
  scrap: "momentum",
  imperium: "takes",
  elmo: "money",
  crodraw: "money",
  ganggang: "community",
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
 * MEASURED AGAIN ON 2026-09-12, after eighty cards were added and after the
 * second and third cash-out went onto every momentum family.
 *
 * The table this replaced could not be reproduced at all — nothing in the
 * repository produced it — and its diagonal gave it away: a style against itself
 * has the same cards on both sides and has to land near 50%, and it had takes at
 * 35% and momentum at 65%. It was measuring a seat, not a style.
 *
 * scripts/intent-duel.ts produces this, sides swapped every match, forty deck
 * seeds per style, diagonal printed as the check on the rest. 1200 matches per
 * pairing, row wins against column:
 *
 *              takes  moment   money  commun   locks
 *   takes       50.5%   58.9%   33.1%   32.9%   35.7%
 *   momentum    38.3%   50.7%   46.3%   43.1%   37.6%
 *   money       66.2%   54.5%   49.8%   48.2%   48.1%
 *   community   64.0%   56.7%   49.8%   49.9%   48.0%
 *   locks       58.8%   61.4%   52.2%   51.0%   51.2%
 *
 * Against the field: locks 54.9%, community 53.7%, money 53.3%, momentum 43.2%,
 * takes 42.1%. Every style within 1.2 points of even against itself.
 *
 * WHY MOMENTUM WAS LOSING, which took three wrong answers to find. Its cards are
 * the biggest in the game — $50.7K of final margin per $10K spent, higher than
 * any other style — and its decks were the worst. The reason is in the deck and
 * not in the card: a momentum deck of forty cards held THIRTY-THREE PUMPS. Every
 * other style holds between nought and five of anything. A pump is worth its rate
 * times the turns a position survives, positions survive 3.05 turns, and the
 * thirty-third pump in a deck is competing with thirty-two others for the same
 * finite thing. Money's deck is 100% one effect and does not care, because
 * directMC pays the same however many you have played.
 *
 * So adding three momentum families in September made it WORSE, from 44.0% to
 * 36.4%: more families meant a purer deck meant more pumps. The answer was not
 * bigger pumps. It was pumpToMC on three cards of every momentum family instead
 * of one — cash out early and small, mid, or late and large. That took the deck
 * from 33 pumps and 4 cash-outs to 25 and 8, and momentum from 36.4% to 43.2%.
 *
 * WHAT IS LEFT: takes, at 42.1%, is now the bottom of the table. It was 44.7%
 * before any of this. Nothing has been done about it.
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
