// The card's rules text is generated here from its effect. There is no written
// rules text in the card data that can drift away from it.
//
// This fixes a concrete problem from Cards of Cronos: a threshold was changed
// without updating the card text, so the card promised something other than what
// it did. What is printed here is by definition what happens. Flavour text is
// separate and promises nothing.

import { assertNever } from "./effects";
import { formatMC, plural, sectorName } from "./format";

export { sectorName };
import { SECTORS, auraOf } from "./types";
import type {
  Aura,
  AuraKind,
  Card,
  CardType,
  Condition,
  Effect,
  Restriction,
  Sector,
  TargetPlayer,
  TargetProject,
} from "./types";

/**
 * One line of rules text, and which kind of thing it describes.
 *
 * Typed rather than a bare string because the card draws an icon beside each
 * line, and a card carrying both an aura and an effect — Backpack, BonkBot,
 * Helius — was drawing the aura icon beside both. The kind has to travel with
 * the line; deriving it from the card gives one answer for every line on it.
 */
export interface RulesLine {
  kind: "stat" | "aura" | "effect";
  text: string;
}

/** The full rules text of a card, line by line. */
export function rulesText(card: Card): RulesLine[] {
  const lines: RulesLine[] = [];

  if (card.type === "project") {
    lines.push({ kind: "stat", text: `Launch: ${formatMC(card.launchMC)} MC when played.` });
    lines.push({ kind: "stat", text: `Pump: ${formatMC(card.pumpMC)} MC every turn.` });
  }

  const aura = auraOf(card);
  if (aura) lines.push({ kind: "aura", text: describeAura(aura) });

  if (card.effect) lines.push({ kind: "effect", text: describeEffect(card.effect) });

  // The payoff reads as its own line, condition first. "When you are $500K behind:
  // gain $500K MC" is a sentence; folding it into the effect above would hide
  // the half that decides whether it happens.
  if (card.payoff) {
    lines.push({
      kind: "effect",
      text: `${describeCondition(card.payoff.when)}: ${describeEffect(card.payoff.effect)}`,
    });
  }

  // A standing rule has to be on the face. It is the one thing on a card that
  // changes what the other player may do, and a card that silently forbids a
  // move is the card-text-that-lies problem wearing a different hat.
  const restriction = restrictionOf(card);
  if (restriction) lines.push({ kind: "aura", text: describeRestriction(restriction) });

  return lines;
}

/** The standing rule on a card, or null. Only a project carries one. */
export function restrictionOf(card: Card): Restriction | null {
  return card.type === "project" ? (card.restriction ?? null) : null;
}

export function describeCondition(condition: Condition): string {
  switch (condition.kind) {
    case "behindBy":
      return `When you are ${formatMC(condition.mc)} or more behind`;
    case "ownProjectsInSector":
      return `When you hold ${condition.atLeast} or more ${sectorName(condition.sector)} projects`;
    case "ownProjectCount":
      return `When you hold ${condition.atLeast} or more projects`;
    case "turnAtLeast":
      return `From turn ${condition.turn}`;
    default:
      return assertNever(condition, "describeCondition");
  }
}

export function describeRestriction(restriction: Restriction): string {
  // Switching on the object rather than on a copied kind, unlike auraBonusFor.
  // Aura has one variant, so a copied kind narrows to never in the default and
  // nothing else needs narrowing. Restriction has two with different fields, so
  // the switch has to be on the object or the branches cannot see them.
  switch (restriction.kind) {
    // "undamaged" is on the face because it is the way out. A card that says
    // only "while this holds" reads as permanent, and a player who believes that
    // stops looking for the answer.
    case "banType":
      return `While undamaged, your opponent cannot play ${pluralType(restriction.cardType)}.`;
    case "banTakeProfit":
      return "While undamaged, your opponent cannot take profit.";
    default:
      return assertNever(restriction, "describeRestriction");
  }
}

/**
 * The plural a card type is called by on a card face.
 *
 * Not the `plural` imported from format, which counts things. This names a type.
 */
function pluralType(cardType: CardType): string {
  switch (cardType) {
    case "project":
      return "projects";
    case "tactic":
      return "tactics";
    case "event":
      return "events";
    case "tool":
      return "tools";
    case "influencer":
      return "influencers";
    default:
      return assertNever(cardType, "pluralType");
  }
}

/**
 * Only the lines that aren't already shown as a stat on the card: the effect and
 * the aura.
 *
 * For the small card in your hand. Launch and pump are already there as a number
 * with an icon above; repeating them as a sentence below is duplication that eats
 * the room the effect needs. The full text is on the large card.
 */
export function effectLines(card: Card): RulesLine[] {
  return rulesText(card).filter((line) => line.kind !== "stat");
}

export function describeEffect(effect: Effect): string {
  switch (effect.kind) {
    case "directMC": {
      const who = playerLabel(effect.target);
      return effect.mc >= 0
        ? `${who} ${verbFor(effect.target, "gain")} ${formatMC(effect.mc)} MC.`
        : `${who} ${verbFor(effect.target, "lose")} ${formatMC(Math.abs(effect.mc))} MC.`;
    }
    case "scaleMC": {
      const who = playerLabel(effect.target);
      return effect.percentage >= 0
        ? `${who} ${verbFor(effect.target, "gain")} ${effect.percentage}% market cap.`
        : `${who} ${verbFor(effect.target, "lose")} ${Math.abs(effect.percentage)}% market cap.`;
    }
    case "pumpProject":
      return `${targetLabel(effect.target)} pumps ${formatMC(effect.mc)} MC more per turn.`;
    case "pumpBySector": {
      // Sorted by amount so the biggest number reads first, and generated from
      // the same object the engine uses — the card cannot promise a sector the
      // effect does not touch.
      const entries = (Object.entries(effect.bonuses) as [Sector, number][]).sort(
        (a, b) => b[1] - a[1],
      );

      // Every sector for the same amount is not a list, it is a rule. Wormhole's
      // mythic pumps all eight, and spelled out sector by sector that runs past
      // what fits on a card — a line nobody can read saying something simple.
      const uniform =
        entries.length === SECTORS.length && entries.every(([, mc]) => mc === entries[0]![1]);
      if (uniform) {
        return `${targetLabel(effect.target)} pumps ${formatMC(entries[0]![1])} more per turn, whatever the sector.`;
      }

      const parts = entries.map(([sector, mc]) => `${sectorName(sector)} ${formatMC(mc)}`);
      return `${targetLabel(effect.target)} pumps more per turn: ${parts.join(", ")}.`;
    }
    case "damageHolders":
      return `${targetLabel(effect.target)} loses ${plural(effect.amount, "holder", "holders")}.`;
    case "healHolders":
      return `${targetLabel(effect.target)} gets ${plural(effect.amount, "holder", "holders")} back.`;
    case "rug":
      return `${targetLabel(effect.target)} rugs on the spot.`;
    case "stealMC":
      return `Takes ${effect.percentage}% of the opponent's MC.`;
    case "drawCards":
      return effect.amount === 1 ? "Draw a card." : `Draw ${effect.amount} cards.`;
    case "cancel": {
      const who =
        effect.target === "self"
          ? "your own"
          : effect.target === "opponent"
            ? "the opponent's"
            : "each player's";
      return effect.count === 1
        ? `Cancels ${who} biggest influencer or tool.`
        : `Cancels ${who} ${effect.count} biggest influencers or tools.`;
    }
    case "extraBudget":
      // Says where it lands, because the two are opposites. Yours is money to
      // spend; theirs is money they are charged for not spending.
      return effect.target === "self"
        ? `${formatMC(effect.mc)} more marketing budget this turn.`
        : effect.target === "opponent"
          ? `Your opponent gets ${formatMC(effect.mc)} of marketing budget next turn, spent or not.`
          : `Both players get ${formatMC(effect.mc)} of marketing budget on their next turn.`;
    default:
      return assertNever(effect, "describeEffect");
  }
}

export function describeAura(aura: Aura): string {
  const kind: AuraKind = aura.kind;
  switch (kind) {
    case "pumpSector":
      return `All your ${sectorName(aura.sector)} cards pump ${formatMC(aura.bonus)} MC more per turn.`;
    default:
      return assertNever(kind, "describeAura");
  }
}

/**
 * Where the projects are, as a phrase that follows a noun: "meme projects on the
 * table". Separate from targetLabel because a sector-filtered effect must not
 * say "every project" — only some of them get anything, and card text that
 * overstates what it does is the same lie as card text that understates it.
 */
function targetWhere(target: TargetProject): string {
  switch (target) {
    case "ownProject":
    case "allOwnProjects":
      return "on your board";
    case "enemyProject":
    case "allEnemyProjects":
      return "on the opponent's board";
    case "allProjects":
      return "on the table";
    default:
      return assertNever(target, "targetWhere");
  }
}

function targetLabel(target: TargetProject): string {
  switch (target) {
    case "ownProject":
      return "One of your projects";
    case "enemyProject":
      return "One of the opponent's projects";
    case "allOwnProjects":
      return "Each of your projects";
    case "allEnemyProjects":
      return "Each of the opponent's projects";
    case "allProjects":
      return "Every project on the table";
    default:
      return assertNever(target, "targetLabel");
  }
}

/**
 * The verb that agrees with the subject playerLabel produced.
 *
 * "You" takes the plural form and "The opponent" the singular, which an "is it
 * both?" check gets wrong half the time — every card that gave you market cap
 * read "You gains $25K MC".
 */
function verbFor(target: TargetPlayer, verb: "gain" | "lose"): string {
  return target === "opponent" ? `${verb}s` : verb;
}

function playerLabel(target: TargetPlayer): string {
  switch (target) {
    case "self":
      return "You";
    case "opponent":
      return "The opponent";
    case "both":
      return "Both players";
    default:
      return assertNever(target, "playerLabel");
  }
}

