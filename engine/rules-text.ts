// The card's rules text is generated here from its effect. There is no written
// rules text in the card data that can drift away from it.
//
// This fixes a concrete problem from Cards of Cronos: a threshold was changed
// without updating the card text, so the card promised something other than what
// it did. What is printed here is by definition what happens. Flavour text is
// separate and promises nothing.

import { assertNever } from "./effects";
import { formatMC, plural, searchText, sectorName } from "./format";

export { sectorName };
import { RULES, SECTORS, auraOf, needsChoice } from "./types";
import type {
  Aura,
  AuraKind,
  Card,
  CardType,
  Condition,
  Effect,
  PerHolder,
  PerRate,
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
    lines.push({
      kind: "stat",
      text: `Launch: ${formatMC(card.launchMC)} MC when played.`,
    });
    lines.push({
      kind: "stat",
      text: `Pump: ${formatMC(card.pumpMC)} MC every turn.`,
    });
  }

  // Said before anything else, because on these cards there is nothing else.
  if (card.type === "project" && card.useless) {
    lines.push({ kind: "effect", text: "Useless." });
  }

  const aura = auraOf(card);
  if (aura) lines.push({ kind: "aura", text: describeAura(aura) });

  if (card.effect)
    lines.push({ kind: "effect", text: describeEffect(card.effect) });

  // The payoff reads as its own line, condition first. "When you are $500K behind:
  // gain $500K MC" is a sentence; folding it into the effect above would hide
  // the half that decides whether it happens.
  if (card.payoff) {
    // A payoff that aims at the same kind of position as the effect lands on the
    // position the effect was aimed at — one move, one target. Saying "one of
    // your projects" twice would promise a second choice the player never gets,
    // which is the card promising something other than what it does.
    const effectTarget =
      card.effect && "target" in card.effect ? card.effect.target : undefined;
    const payoffTarget =
      "target" in card.payoff.effect ? card.payoff.effect.target : undefined;
    const sameOne =
      payoffTarget !== undefined &&
      payoffTarget === effectTarget &&
      (payoffTarget === "ownProject" || payoffTarget === "enemyProject");

    // Fifty-six cards in the set have a payoff of the same kind as their own
    // effect. Without a word joining them the second line reads as a separate
    // instruction — "Takes 6%" twice looks like two takings rather than one that
    // got bigger.
    //
    // Only when they hit the same thing, too. Jeo Boden takes a holder off their
    // board and then, when ahead, off every board — the same kind of effect
    // aimed somewhere wider, and "another" would say it was more of the same.
    const again =
      card.effect?.kind === card.payoff.effect.kind &&
      effectTarget === payoffTarget;

    lines.push({
      kind: "effect",
      text: `${describeCondition(card.payoff.when)}: ${describeEffect(
        card.payoff.effect,
        sameOne,
        again
      )}`,
    });
  }

  // A standing rule has to be on the face. It is the one thing on a card that
  // changes what the other player may do, and a card that silently forbids a
  // move is the card-text-that-lies problem wearing a different hat.
  const restriction = restrictionOf(card);
  if (restriction) {
    const said = describeRestriction(restriction);
    // A shared lock is the same rule pointed at both sides, so it is the same
    // sentence with its subject changed rather than a second set of strings —
    // one place writes each rule and one place turns it around.
    const mutual = card.type === "project" && card.mutual;
    lines.push({
      kind: "aura",
      text: mutual
        ? said.replace("your opponent cannot", "neither player may")
        : said,
    });
  }

  const uptime = uptimeLine(card);
  if (uptime) lines.push({ kind: "aura", text: uptime });

  // Reads as an aura because that is what it is to the player: something the
  // card goes on doing rather than something it did. The "while undamaged" is
  // spelled out on the face, because it is the answer, and a card that can be
  // answered has to say how.
  if (card.type === "project" && card.loyalty) {
    lines.push({
      kind: "aura",
      text: `Pumps ${card.loyalty}% more for every turn it has been standing.`,
    });
  }

  if (card.type === "project" && card.freePlays) {
    lines.push({
      kind: "aura",
      text:
        card.freePlays === 1
          ? "While undamaged, your first card each turn is free."
          : `While undamaged, your first ${card.freePlays} cards each turn are free.`,
    });
  }

  if (card.type === "project" && card.severance) {
    lines.push({
      kind: "aura",
      text:
        card.severance.from === "theirs"
          ? `While undamaged, every position the opponent closes pays you ${card.severance.percentage}% of what it earned.`
          : `While undamaged, every position that closes pays you ${card.severance.percentage}% of what it earned.`,
    });
  }

  if (card.type === "project" && card.discount) {
    lines.push({
      kind: "aura",
      text: `While undamaged, every card costs you ${card.discount}% less.`,
    });
  }

  if (card.type === "project" && card.shield) {
    lines.push({
      kind: "aura",
      text: `While undamaged, you lose ${card.shield}% less market cap.`,
    });
  }

  if (card.type === "project" && card.leverage) {
    lines.push({
      kind: "aura",
      text: `While undamaged, everything that moves your MC moves ${card.leverage}% further, up and down.`,
    });
  }

  if (card.type === "project" && card.morePositions) {
    lines.push({
      kind: "aura",
      text: `While undamaged, your portfolio holds ${plural(
        card.morePositions,
        "more position",
        "more positions"
      )}.`,
    });
  }

  if (card.type === "project" && card.toll) {
    lines.push({
      kind: "aura",
      text: `While undamaged, you take ${card.toll.percentage}% of everything the opponent gains.`,
    });
  }

  if (card.type === "project" && card.oracle) {
    lines.push({
      kind: "aura",
      text: `While undamaged, you gain ${card.oracle}% of every move their market cap makes, up or down.`,
    });
  }

  if (card.type === "project" && card.tip) {
    lines.push({
      kind: "aura",
      text: `While undamaged, you take ${card.tip}% of every marketing budget the opponent spends.`,
    });
  }

  if (card.type === "project" && card.onYourPlay) {
    lines.push({
      kind: "aura",
      text: `While undamaged, you gain ${formatMC(
        card.onYourPlay.mc
      )} MC every time you play a card.`,
    });
  }

  if (card.type === "project" && card.onTheirPlay) {
    lines.push({
      kind: "aura",
      text:
        `While undamaged, you gain ${formatMC(
          card.onTheirPlay.mc
        )} MC every time the ` +
        `opponent plays a ${card.onTheirPlay.cardType}.`,
    });
  }

  if (card.type === "project" && card.standing) {
    lines.push({
      kind: "aura",
      text: `While undamaged, every turn: ${describeEffect(card.standing)}`,
    });
  }

  return lines;
}

/** The standing rule on a card, or null. Only a project carries one. */
/** The uptime line, for a card that carries it. */
/**
 * Everything a card can be found by, including what it does.
 *
 * searchText in format.ts covers the name, the ticker and the moment, which
 * answers "where is that card" and nothing else. This adds the rules text, so
 * typing "holder" finds every card that damages, heals or counts them — which
 * is how somebody actually looks for an effect, and there was no way to do it.
 *
 * Built from rulesText rather than from the effect, on purpose: rulesText is
 * what the card face says, so the search can never find a card on a word the
 * player cannot see, and can never miss one on a word they can.
 *
 * Cached by card id. The gallery filters 775 cards on every keystroke and
 * rulesText builds a dozen strings a card; without this that is ten thousand
 * strings per letter typed. The set is static once loaded, so the entry is
 * built once and never invalidated.
 */
const searchCache = new Map<string, string>();

export function cardSearchText(card: Card): string {
  const hit = searchCache.get(card.id);
  if (hit !== undefined) return hit;
  const text = `${searchText(card)} ${rulesText(card)
    .map((line) => line.text)
    .join(" ")}`.toLowerCase();
  searchCache.set(card.id, text);
  return text;
}

export function uptimeLine(card: Card): string | null {
  return card.type === "project" && card.uptime
    ? "While undamaged, your opponent's standing rules do not apply to you."
    : null;
}

export function restrictionOf(card: Card): Restriction | null {
  return card.type === "project" ? card.restriction ?? null : null;
}

/**
 * The rider on a holder effect, as the second half of the sentence.
 *
 * Written here rather than on the card so it cannot drift from what the rider
 * actually does — the whole reason rules text is generated in this project. It
 * says "for every holder" without saying how many, because how many is the
 * board's answer and not the card's.
 */
function perHolderNote(perHolder: PerHolder | undefined): string {
  if (!perHolder) return "";
  // Terse on purpose: this is the second sentence on a card that already has a
  // first, and 120 characters is what reads. "Your opponent" costs eight of them
  // over "They" and says nothing extra once the first sentence has named them.
  const mine = perHolder.target === "self";
  if (perHolder.kind === "directMC") {
    return ` ${mine ? "You" : "They"} gain ${formatMC(
      perHolder.mc
    )} MC per holder moved.`;
  }
  return ` ${mine ? "You" : "They"} get ${formatMC(
    perHolder.mc
  )} of budget next turn per holder moved.`;
}

/** 1st, 2nd, 3rd — only ever needed up to the size of a portfolio. */
function ordinal(n: number): string {
  const suffix = n === 1 ? "st" : n === 2 ? "nd" : n === 3 ? "rd" : "th";
  return `${n}${suffix}`;
}

export function describeCondition(condition: Condition): string {
  switch (condition.kind) {
    case "behindBy":
      return `When you are ${formatMC(condition.mc)} or more behind`;
    case "aheadBy":
      return `When you are ${formatMC(condition.mc)} or more ahead`;
    case "theirHandAtMost":
      return condition.cards === 0
        ? "When your opponent is holding nothing"
        : `When your opponent is holding ${condition.cards} ${
            condition.cards === 1 ? "card" : "cards"
          } or fewer`;
    case "bankedAtMost":
      return condition.count === 0
        ? "When you have never taken profit"
        : `When you have taken profit ${plural(
            condition.count,
            "time",
            "times"
          )} or fewer`;
    case "holdersLostAtLeast":
      return `When ${condition.holders} holders have been lost this match`;
    case "bankedAtLeast":
      return condition.count === 1
        ? "Once you have taken profit"
        : `Once you have taken profit ${condition.count} times`;
    case "ownProjectsInSector":
      return `When you hold ${condition.atLeast} or more ${sectorName(
        condition.sector
      )} projects`;
    case "ownProjectCount":
      return `When you hold ${condition.atLeast} or more projects`;
    case "targetPumpsAtLeast":
      return `When that project pumps ${formatMC(
        condition.mc
      )} or more per turn`;
    case "turnAtLeast":
      return `From turn ${condition.turn}`;
    case "turnAtMost":
      // "Up to turn 5" reads two ways — through five, or before it — and the
      // maker read it the second way. The engine means turn <= 5, and this is the
      // wording that cannot mean anything else while still printing the number
      // the card is built on.
      return condition.turn === 1
        ? "On the first turn"
        : `On turn ${condition.turn} or earlier`;
    case "targetHeldFor":
      return `When that project has stood for ${plural(
        condition.turns,
        "turn",
        "turns"
      )}`;
    case "yourHandAtLeast":
      return `When you are holding ${condition.cards} cards or more`;
    case "upgraded":
      return "When this takes over one of your positions";
    case "playedThisTurnAtLeast":
      return condition.cards === 2
        ? "When this is your second card this turn"
        : `When this is your ${
            condition.cards === 3
              ? "third"
              : condition.cards === 4
              ? "fourth"
              : `${condition.cards}th`
          } card this turn`;
    case "playedThisTurnAtMost":
      return condition.cards === 1
        ? "When this is the only card you play this turn"
        : `When you have played ${condition.cards} cards this turn or fewer`;
    case "discardAtLeast":
      return `When your discard holds ${condition.count} cards or more`;
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
      return `While undamaged, your opponent cannot play ${pluralType(
        restriction.cardType
      )}.`;
    case "taxPlays":
      return `While undamaged, every card costs your opponent ${restriction.percent}% more.`;
    case "banTakeProfit":
      return "While undamaged, your opponent cannot take profit.";
    case "banRoom":
      return "While undamaged, your opponent cannot close a position to make room.";
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
    case "person":
      return "people";
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

export function describeEffect(
  effect: Effect,
  sameOne = false,
  /**
   * Is this the second helping of something the card already did?
   *
   * A payoff that repeats its own effect reads as a separate instruction unless
   * it says so: "Takes 6% of the opponent's MC" twice on one card looks like two
   * different takings rather than one that got bigger. "Another" is the word
   * that makes the second line finish the first.
   */
  again = false
): string {
  switch (effect.kind) {
    case "directMC": {
      const who = playerLabel(effect.target);
      const more = again ? "another " : "";
      // "table" is both boards, so the card cannot say "you hold" about it.
      const each = perPhrase(effect.per, effect.target === "opponent");
      return effect.mc >= 0
        ? `${who} ${verbFor(effect.target, "gain")} ${more}${formatMC(
            effect.mc
          )} MC${each}.`
        : `${who} ${verbFor(effect.target, "lose")} ${more}${formatMC(
            Math.abs(effect.mc)
          )} MC${each}.`;
    }
    case "scaleMC": {
      const who = playerLabel(effect.target);
      const more = again ? "another " : "";
      return effect.percentage >= 0
        ? `${who} ${verbFor(effect.target, "gain")} ${more}${
            effect.percentage
          }% market cap.`
        : `${who} ${verbFor(effect.target, "lose")} ${more}${Math.abs(
            effect.percentage
          )}% market cap.`;
    }
    case "pumpProject":
      // Down is a different sentence, not the same one with a minus sign in the
      // middle of it. "pumps -$20K MC more per turn" was printed on five cards.
      // "permanently" is the word that was missing, and its absence was doing
      // real damage: the maker read the legendary standing beside the mythic
      // pumpProject and reasonably concluded the standing was the recurring one.
      // A standing says "While undamaged, every turn" out loud; this raises the
      // pump of a position for the rest of the match and said only "more per
      // turn", which reads like a rate somebody might switch off. It cannot be
      // switched off, it does not need the source position to survive, and it
      // keeps paying after that position is long gone. So the card says so.
      //
      // "for every other project you hold" is the tail the `per` field earns,
      // and it has to be there too: without it the number reads five times
      // smaller than what the card actually does.
      if (effect.per) {
        return `${targetLabel(
          effect.target,
          sameOne
        )} permanently pumps ${formatMC(effect.mc)} MC more per turn${perPhrase(
          effect.per
        )}.`;
      }
      return effect.mc >= 0
        ? `${targetLabel(effect.target, sameOne)} permanently pumps ${formatMC(
            effect.mc
          )} MC more per turn.`
        : `${targetLabel(effect.target, sameOne)} permanently pumps ${formatMC(
            Math.abs(effect.mc)
          )} MC less per turn.`;
    case "pumpBySector": {
      // Sorted by amount so the biggest number reads first, and generated from
      // the same object the engine uses — the card cannot promise a sector the
      // effect does not touch.
      const entries = (
        Object.entries(effect.bonuses) as [Sector, number][]
      ).sort((a, b) => b[1] - a[1]);

      // Every sector for the same amount is not a list, it is a rule. Wormhole's
      // mythic pumps all eight, and spelled out sector by sector that runs past
      // what fits on a card — a line nobody can read saying something simple.
      const uniform =
        entries.length === SECTORS.length &&
        entries.every(([, mc]) => mc === entries[0]![1]);
      if (uniform) {
        return `${targetLabel(
          effect.target,
          sameOne
        )} permanently pumps ${formatMC(
          entries[0]![1]
        )} more per turn, whatever the sector.`;
      }

      const parts = entries.map(
        ([sector, mc]) => `${sectorName(sector)} ${formatMC(mc)}`
      );
      return `${targetLabel(
        effect.target,
        sameOne
      )} permanently pumps more per turn: ${parts.join(", ")}.`;
    }
    case "damageHolders":
      return (
        (effect.amount === "all"
          ? `${targetLabel(effect.target, sameOne)} loses every holder it has.`
          : `${targetLabel(effect.target, sameOne)} loses ${plural(
              effect.amount,
              "holder",
              "holders"
            )}.`) + perHolderNote(effect.perHolder)
      );
    case "healHolders":
      return (
        (effect.amount === "full"
          ? `${targetLabel(effect.target, sameOne)} gets every holder back.`
          : `${targetLabel(effect.target, sameOne)} gets ${
              again ? "another " : ""
            }${plural(effect.amount, "holder", "holders")} back.`) +
        perHolderNote(effect.perHolder)
      );
    case "after": {
      const wait = effect.marks
        ? `Mark one of ${
            effect.marks === "ownProject" ? "your" : "the opponent's"
          } projects. ` + `After ${plural(effect.turns, "turn", "turns")}`
        : `After ${plural(effect.turns, "turn", "turns")}`;
      // Whatever the effect aims at is the marked position, so it reads as "that
      // project" rather than "one of theirs" — the card must not promise a
      // second choice the player never gets.
      const onTheMark = Boolean(effect.marks);
      const then = describeEffect(effect.effect, onTheMark || sameOne);
      // What happens now goes first, because it happens first.
      const straightAway = effect.now
        ? `${describeEffect(effect.now, sameOne)} `
        : "";
      if (!effect.ifGone) return `${straightAway}${wait}: ${then}`;
      // Two outcomes on one card, and the reader has to be able to tell which is
      // which without knowing the engine — so the condition is written out
      // rather than left to be inferred from the order.
      return (
        // "if it stands" rather than "if it is still standing": the long form put
        // this shape at 128 characters against a 120 limit, and the eleven words
        // it costs buy nothing a reader did not already have from "If it is gone"
        // sitting right after it.
        `${straightAway}${wait}, if it stands: ${then} ` +
        `If it is gone: ${describeEffect(effect.ifGone, onTheMark || sameOne)}`
      );
    }
    case "mcPerHolderLost":
      return `You gain ${formatMC(
        effect.mc
      )} MC for every holder lost anywhere this match.`;
    case "refundMC":
      return `You gain ${effect.percentage}% of all the marketing budget you have spent this match.`;
    case "mcPerPositionGone":
      return `You gain ${formatMC(
        effect.mc
      )} MC for every position that has left the table this match.`;
    case "attach": {
      const mine =
        effect.target === "ownProject" || effect.target === "allOwnProjects";
      const whose = mine ? "your" : "the opponent's";
      const pick = needsChoice(effect.target)
        ? `Pick one of ${whose} projects.`
        : null;
      // A compounding change is already a per-turn sentence, so wrapping it in
      // "every turn from now" prints "per turn" twice. Written as one sentence
      // instead of two half-sentences glued together.
      if (effect.every.kind === "scalePump") {
        const up = effect.every.percentage > 0;
        const subject = pick
          ? `${pick} It pumps`
          : `Each of ${whose} projects pumps`;
        return (
          `${subject} ${Math.abs(effect.every.percentage)}% ${
            up ? "more" : "less"
          } ` + `every turn, compounding.`
        );
      }
      // "That project" for the inner half, because it is the one just chosen —
      // the card must not read as a second choice nobody gets.
      return pick
        ? `${pick} Every turn from now: ${describeEffect(effect.every, true)}`
        : `Each of ${whose} projects, every turn from now: ${describeEffect(
            effect.every,
            true
          )}`;
    }
    case "scalePump": {
      // "Compounding" comes off the card. It is the right word in types.ts, where
      // it distinguishes this from pumpProject: this multiplies what a position
      // pumps and that adds a flat amount to it. On a card face beside "per
      // turn" it says something else entirely — that the rate keeps growing —
      // and a reader took it that way the first time they met it.
      //
      // It resolves once. A $24K pump becomes $32K and stays $32K. So the word
      // that belongs here is the one the flat version already uses: permanently.
      const up = effect.percentage > 0;
      return `${targetLabel(
        effect.target,
        sameOne
      )} permanently pumps ${Math.abs(effect.percentage)}% ${
        up ? "more" : "less"
      } per turn.`;
    }
    case "peekAndBurn":
      return `Look at the top ${effect.look} cards of the opponent's deck and take one out.`;
    case "unbankedMC":
      // "your board has earned" pointed at nothing the player can see. The number
      // is per position and it is already on the table — the gold figure on every
      // tile, whose tooltip calls it "MC produced". One number was being given two
      // names on two surfaces, which is the set's oldest trap wearing its friendly
      // face: nothing breaks, the reader just cannot tell they are the same thing.
      //
      // So the card uses the tile's word and points at positions rather than at a
      // board. types.ts describes this effect in the same words, which is where
      // the wording should have come from in the first place.
      return `You gain ${effect.percentage}% of what your positions have produced and you have not banked.`;
    case "peakMC":
      return `You gain ${effect.percentage}% of the highest market cap you have reached this match.`;
    case "benchmark": {
      // Two sentences, because it is two things and one sentence could not hold
      // them. It read "pumps as much as the opponent's strongest, if that is
      // more, plus $60K", where "that" could be either side's number, the
      // condition sat wedged in the middle of the clause it applied to, and the
      // words "per turn" — on a card that changes a per-turn rate — were nowhere
      // on it. A reader asked what it meant and could not be answered from the
      // face.
      //
      // The engine's own log says it plainly: "Switchboard up to $117K a turn —
      // their best is $57K." The match half is a floor, never a ceiling, and the
      // plus lands whether or not the floor did.
      //
      // One sentence after all, and not for style: validation holds a rules line
      // to 120 characters because that is what reads on a card, and the two-
      // sentence version came to 129. "MC" is the word that went — every other
      // pump line carries it, and of the three wordings that fit, this is the one
      // that kept "permanently". A dollar sign has no second reading; a rate that
      // might switch off does, and that word going missing is what made five
      // scalePump cards unreadable earlier the same day.
      const which = effect.target === "ownProject" ? "your" : "the opponent's";
      const match = `One of ${which} projects matches the opponent's best pump, if theirs is higher`;
      return effect.plus
        ? `${match}, then permanently pumps ${formatMC(
            effect.plus
          )} more per turn.`
        : `${match}.`;
    }
    case "merge":
      return "Closes every other project you hold and folds what they pay into this one.";
    case "fork":
      return "Copies the opponent's strongest project onto your board. They keep theirs.";
    case "pumpToMC":
      return `Cashes ${effect.times}x what your projects pump this turn, as MC.`;
    case "budgetToMC":
      return `Turns ${effect.percentage}% of your unspent marketing budget into MC.`;
    case "burnForDamage": {
      // Kept short on purpose: four shapes share this sentence and the longest
      // combination has to survive the 120 characters a card face holds.
      const what =
        effect.target === "allOwnProjects"
          ? "Close every project you have. The opponent loses all they earned"
          : "Close one of your own projects. The opponent loses what it earned";
      const back = effect.keep ? `, and you gain ${effect.keep}% of it.` : ".";
      const kept = effect.returns ? " It goes back to your hand." : "";
      return what + back + kept;
    }
    case "rug":
      return `${targetLabel(effect.target, sameOne)} rugs on the spot.`;
    case "stealMC": {
      // Says where it lands. "Takes 3% of the opponent's MC" never named who was
      // taking or what became of it — and the destination is the whole
      // difference between this and a card that only makes them lose: taken, it
      // moves the gap twice.
      const take = `You take ${again ? "another " : ""}${
        effect.percentage
      }% of the opponent's MC`;
      if (effect.per) {
        return `${take} for every other ${sectorName(
          effect.per
        )} project you hold.`;
      }
      return `${take}.`;
    }
    case "comebackMC":
      return `You gain ${effect.percentage}% of the market cap you are behind by.`;

    case "recoverCard":
      // The half price is on the card because it is half the card. A rule the
      // player only meets when they try to pay is the mismatch CLAUDE.md is
      // about — the text has to say what the mechanic does.
      return effect.amount === 1
        ? "The top card of your discard comes back to your hand, at half price."
        : `The top ${effect.amount} cards of your discard come back to your hand, at half price.`;

    case "drawCards": {
      const what = effect.amount === 1 ? "a card" : `${effect.amount} cards`;
      switch (effect.target ?? "self") {
        case "self":
          if (again) {
            return effect.amount === 1
              ? "Draw another card."
              : `Draw another ${effect.amount} cards.`;
          }
          return effect.amount === 1
            ? "Draw a card."
            : `Draw ${effect.amount} cards.`;
        case "opponent":
          return `Your opponent draws ${what}.`;
        case "both":
          return `Both players draw ${what}.`;
      }
    }
    case "discardCards": {
      const who =
        effect.target === "self"
          ? "You lose"
          : effect.target === "both"
          ? "Both players lose"
          : "Your opponent loses";
      const what = effect.amount === 1 ? "a card" : `${effect.amount} cards`;
      return `${who} ${what} out of hand, at random.`;
    }
    case "takeOver":
      return "Take your opponent's strongest position onto your own board, as it stands.";
    case "cancel": {
      const who =
        effect.target === "self"
          ? "your own"
          : effect.target === "opponent"
          ? "the opponent's"
          : "each player's";
      return effect.count === 1
        ? `Cancels ${who} biggest person or tool.`
        : `Cancels ${who} ${effect.count} biggest people or tools.`;
    }
    case "extraBudget": {
      // Says where it lands, because the two are opposites. Yours is money to
      // spend; theirs is money they are charged for not spending.
      //
      // And a negative amount is a different sentence, not the same one with a
      // minus sign in the middle of it. "Your opponent gets -$25K of marketing
      // budget" is not English, and it was printed on every card in the set that
      // takes budget away.
      const taking = effect.mc < 0;
      const amount = formatMC(Math.abs(effect.mc));
      // "table" is both boards, so the card cannot say "you hold" about it.
      const each = perPhrase(effect.per, effect.target === "opponent");
      if (effect.target === "self") {
        return taking
          ? `You have ${amount} less marketing budget this turn${each}.`
          : `${amount} more marketing budget this turn${each}.`;
      }
      if (effect.target === "opponent") {
        return taking
          ? `Your opponent has ${amount} less marketing budget next turn.`
          : `Your opponent gets ${amount} of marketing budget next turn, spent or not.`;
      }
      // Not the same turn for both, and the difference is the card: yours is set
      // for the turn you are in, so a grant to yourself is spendable now, and
      // theirs waits until their turn begins. "On their next turn" was true of
      // half of it.
      return taking
        ? `Both players have ${amount} less marketing budget: you now, them on their turn.`
        : `Both players get ${amount} of marketing budget: you now, them on their turn.`;
    }
    default:
      return assertNever(effect, "describeEffect");
  }
}

/**
 * "twice as hard", "three times as hard", "2.5x as hard".
 *
 * Written out to three, because "2x as hard" on a card reads like a spreadsheet
 * and "twice" reads like English. Anything past three or not a whole number
 * falls back to the figure, which is honest rather than tortured: nobody says
 * "seven times as hard" about a trading card and nobody should have to read
 * "two and a half times as hard" either.
 */
export function timesWord(times: number): string {
  if (times === 2) return "twice as hard";
  if (times === 3) return "three times as hard";
  return `${times}x as hard`;
}

export function describeAura(aura: Aura): string {
  // Switched on the object rather than on a copied kind. With one variant a copy
  // was the only way to make the default branch `never`; with two, narrowing is
  // what the switch is for, and a copy narrows nothing — every field access in
  // every branch stops compiling. The union having grown is what makes the
  // ordinary pattern work again.
  switch (aura.kind) {
    case "pumpSector":
      return `All your ${sectorName(aura.sector)} cards pump ${formatMC(
        aura.bonus
      )} MC more per turn.`;
    case "budgetEachTurn":
      return `You get ${formatMC(
        aura.budget
      )} more marketing budget every turn.`;
    case "drawEachTurn":
      return `You draw ${aura.cards} extra ${
        aura.cards === 1 ? "card" : "cards"
      } every turn.`;
    case "healEachTurn":
      return (
        `All your ${sectorName(aura.sector)} cards pump ${formatMC(
          aura.bonus
        )} MC more per turn. ` +
        `Each of your projects gets ${aura.holders} ${
          aura.holders === 1 ? "holder" : "holders"
        } back every turn.`
      );
    case "morePositions":
      return `You may hold ${
        RULES.portfolioSize + aura.positions
      } positions instead of ${RULES.portfolioSize}.`;
    case "giftBudget":
      // Said as what it is rather than as what it looks like. A card that reads
      // "your opponent gets money" and does not say why that hurts is a card
      // nobody plays and nobody fears.
      return (
        `Your opponent gets ${formatMC(
          aura.budget
        )} more marketing budget every turn, ` +
        `and unspent budget costs them ${aura.times} times as much.`
      );
    case "punishWaste":
      return `Unspent marketing budget costs your opponent ${aura.times} times as much.`;
    case "stripHolders":
      return `One of your opponent's projects loses ${aura.holders} ${
        aura.holders === 1 ? "holder" : "holders"
      } every turn, at random.`;
    case "burnHand":
      return `Your opponent loses ${aura.cards} ${
        aura.cards === 1 ? "card" : "cards"
      } out of hand every turn, at random.`;
    case "bankPays":
      return (
        `All your ${sectorName(aura.sector)} cards pump ${formatMC(
          aura.bonus
        )} MC more per turn. ` +
        `Every time you take profit you gain ${formatMC(aura.mc)} MC.`
      );
    case "championProjects": {
      // Two sentences, because it does two things and a card that mentions only
      // the interesting one is a card that undersells itself — the same lie as
      // overselling, in the other direction.
      //
      // Straight through. The aura names families by the ticker printed on their
      // cards, so this needs no translation and cannot invent a name — which is
      // what uppercasing the project id did, offering the player a PUMP-FUN card
      // to go and find.
      const names = aura.tickers;
      const list =
        names.length === 1
          ? names[0]
          : `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
      return (
        `All your ${sectorName(aura.sector)} cards pump ${formatMC(
          aura.bonus
        )} MC more per turn. ` +
        `Your ${list} cards pump ${timesWord(aura.times)}.`
      );
    }
    default:
      return assertNever(aura, "describeAura");
  }
}

/**
 * Where the projects are, as a phrase that follows a noun: "meme projects on the
 * table". Separate from targetLabel because a sector-filtered effect must not
 * say "every project" — only some of them get anything, and card text that
 * overstates what it does is the same lie as card text that understates it.
 */
/**
 * The tail a `per` earns: " for every other meme project you hold", and the
 * eight readings that are not a sector at all.
 *
 * One function because `per` is one field. directMC, extraBudget and pumpProject
 * all carry it with the same union and the same meaning; it was written out in
 * full twice and half-written a third time — pumpProject knew `"any"` and a
 * sector and nothing else, so Sekoia's face read "for every other sectors
 * project you hold". The value existed, the branch did not, and nothing failed.
 * That is the exact shape of the bug CLAUDE.md is written about, in the one
 * corner of this engine where being wrong is silent by construction.
 *
 * A switch with an exhaustive default, so a value added to the union arrives
 * here as a compiler error rather than as a sentence nobody reads twice.
 */
function perPhrase(per: PerRate | undefined, subjectIsThem = false): string {
  if (!per) return "";
  // "The opponent loses $14K MC for every project the opponent holds" names them
  // twice in one sentence, which is how Paper Hands read. When the sentence has
  // already made them the subject, the tail refers back instead of repeating.
  if (per === "theirs" && subjectIsThem) return " for every project they hold";
  switch (per) {
    case "table":
      // "on the table" was the first wording and a reader asked whether it meant
      // both boards or only theirs — which is the one thing this rate exists to
      // say. Every other `per` on this list names whose board it counts: "you
      // hold", "the opponent holds". This one named a surface instead, and a
      // surface has no owner.
      return " for every other project on either board";
    case "sectors":
      return " for every different sector you hold";
    case "theirs":
      return " for every project the opponent holds";
    case "turn":
      return " for every turn this match has run";
    case "holders":
      return " for every holder across your projects";
    case "plays":
      return " for every card you have played this turn";
    case "spent":
      return " for every card in your discard";
    case "any":
      return " for every other project you hold";
    default:
      return ` for every other ${sectorName(per)} project you hold`;
  }
}

function targetWhere(target: TargetProject): string {
  switch (target) {
    case "ownProject":
    case "allOwnProjects":
      return "on your board";
    case "enemyProject":
    case "allEnemyProjects":
    case "enemyBest":
      return "on the opponent's board";
    case "allProjects":
      return "on the table";
    default:
      return assertNever(target, "targetWhere");
  }
}

function targetLabel(target: TargetProject, sameOne = false): string {
  switch (target) {
    case "ownProject":
      return sameOne ? "That project" : "One of your projects";
    case "enemyProject":
      return sameOne ? "That project" : "One of the opponent's projects";
    case "allOwnProjects":
      return "Each of your projects";
    case "allEnemyProjects":
      return "Each of the opponent's projects";
    case "enemyBest":
      // No "that project" form: nobody chose it, the card did.
      return "The opponent's strongest project";
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

/**
 * What the budget figure on the turn bar means, in one sentence.
 *
 * Two tables show this number and until now only one of them explained it: the
 * solo table carried a title attribute about unspent budget and the PvP one
 * carried nothing at all. That is the same split that has already been fixed
 * twice — see the notes on TakeProfitButton and DiscardButton — and the fix is
 * the same. The sentence lives here, once.
 *
 * It has to say two things, and the second one is new. Unspent budget comes off
 * your market cap, which is the rule most players meet the hard way. And the
 * player who moved first has a bigger number than the player who did not, which
 * is a thing you can see on the screen and could not, before this line existed,
 * find out from anywhere.
 */
export function budgetNote(left: number, isFirstMover: boolean): string {
  const waste =
    left > 0
      ? `${formatMC(
          left
        )} of marketing budget left. Unspent budget comes off your market cap when the turn ends.`
      : "The whole budget is spent — nothing comes off your market cap.";

  if (!isFirstMover || RULES.firstMoveBudget <= 0) return waste;

  return (
    `${waste} You moved first, so your budget runs a turn ahead — ` +
    `${formatMC(
      RULES.firstMoveBudget
    )} more a turn, which is what pays for having to commit to the ` +
    `table first. It levels off for the last turn: on turn ${RULES.turns} both players get the same.`
  );
}

/**
 * What the free-play marker on the turn bar means.
 *
 * Written once and shown on both tables, which is the third control to need
 * saying twice — see the note on budgetNote, and TakeProfitButton before it.
 *
 * Two sentences and both are needed. The first says what you have, because a
 * marker with a number on it and no explanation is another thing to work out.
 * The second says why you have it, because the other player does not and will
 * otherwise read it as the game being uneven — which is exactly the objection
 * this rule was chosen to answer.
 */
export function freePlayNote(
  mine: number,
  theirs: number,
  isFirstMover: boolean
): string {
  if (mine > 0) {
    const cap = RULES.firstMoveFreeCardUpTo;
    const reach = cap === null ? "whatever it is priced at" : `up to a ${cap}`;
    return (
      `Your next card is free — it costs no marketing budget, ${reach}, so it can be ` +
      `something this turn could not otherwise reach. You get one, because you move ` +
      `first and have to commit to the table before there is a table to read.`
    );
  }
  if (theirs > 0) {
    return (
      `They have one card to play for free, whatever it costs. That is what moving first ` +
      `is paid for with; you get to answer a board instead.`
    );
  }
  return isFirstMover
    ? "Your free card is spent. Everything costs marketing budget from here."
    : "Their free card is spent. Everything costs marketing budget from here.";
}
