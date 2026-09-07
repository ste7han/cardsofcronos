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
