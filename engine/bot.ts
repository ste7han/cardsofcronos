// The market: your opponent in this first version.
//
// No neural network, but an honest estimator. Every card in hand gets a value in
// MC-equivalent, and the bot plays the highest one. Where a card needs a target,
// it picks the project that yields the most or hurts the most.
//
// The switch in `effectValue` is exhaustive and ends on assertNever(). That is
// deliberate: add an effect variant and the bot breaks at compile time instead of
// silently never playing those cards again.

import { applyEffect, assertNever, holds } from "./effects";
import { cardById, otherPlayer } from "./helpers";
import {
  applyMove,
  canDiscard,
  canTakeProfit,
  needsPortfolioSlot,
  playable,
  auraFloor,
  chargeFor,
  auraUpkeep,
  upkeepFor,
  auraWorth,
  auraWouldPay,
  pumpOf,
  targetRequirementOf,
} from "./match";
import { next } from "./rng";
import { WASTE_PENALTY } from "./types";

/**
 * What one holder is worth per turn, for pricing a healing aura.
 *
 * A rough figure and deliberately so: this is a bot heuristic, not a payout. The
 * set averages about $25K of pump across roughly three holders, so a third of
 * that is the order of it.
 */
const HOLDER_WORTH = 8_000;

/**
 * What one more portfolio position is worth over a match.
 *
 * A position holds a project and a project is worth its launch plus its pump for
 * the turns left. The median project launches around $30K and pumps around $25K,
 * so a position opened with half the match to run is roughly this — an estimate
 * for a decision, like everything else here.
 */
/**
 * How much of a standing effect's run the bot expects to collect.
 *
 * A standing effect only pays while the position is undamaged, and a position
 * that is taking market cap off somebody every turn is the one they knock over.
 * Scoring it at the full run would have the bot overpay for every one of them.
 *
 * Measured rather than guessed: over 220 matches in which the one standing card
 * reached the board, it fired on 977 of the 1358 turns it could have. See
 * scripts/night-slerf.ts, section 2. It started life at 0.67 on nothing but a
 * feeling, which was close enough to be worse than being wrong.
 */
const STANDING_SURVIVES = 0.72;

/**
 * Projects of a sector this player holds right now.
 *
 * The engine subtracts the card being played, because by the time an effect
 * resolves that card is already on the board. Here nothing is subtracted, for
 * the same reason read the other way: scoring happens before the play, so the
 * card is not on the board yet and the count is already "every other one".
 */
function countSector(
  state: State,
  player: Player,
  sector: Sector | "any" | "table" | "sectors" | "theirs" | "turn" | "holders" | "plays" | "spent",
  index: CardIndex,
): number {
  // The same four cases othersOfSector answers, and it has to be the same four
  // or the bot prices a card differently from the way it resolves.
  if (sector === "turn") return state.turn;
  if (sector === "plays") return state.playsThisTurn;
  if (sector === "spent") return state.players[player].discard.length;
  if (sector === "holders") {
    let total = 0;
    for (const position of state.players[player].projects) total += position.holders;
    return total;
  }
  if (sector === "sectors") {
    const kinds = new Set<Sector>();
    for (const position of state.players[player].projects) {
      const at = cardById(index, position.cardId);
      if (at.type === "project") kinds.add(at.sector);
    }
    return kinds.size;
  }
  const other: Player = player === "you" ? "opponent" : "you";
  const sides: Player[] =
    sector === "table" ? ["you", "opponent"] : sector === "theirs" ? [other] : [player];
  const wide = sector === "any" || sector === "table" || sector === "theirs";
  let held = 0;
  for (const side of sides) {
    for (const position of state.players[side].projects) {
      const at = cardById(index, position.cardId);
      if (at.type === "project" && (wide || at.sector === sector)) held++;
    }
  }
  return held;
}

const POSITION_WORTH = 150_000;
import type { Card, CardIndex, Effect, Move, Player, Sector, State, TargetProject,
  Restriction,
} from "./types";
import {
  MARKETING_COST,
  RULES,
  TURN_ACTION_COST,
  auraOf,
  boardOf,
  needsChoice,
  ownersOf,
  playersOf,
} from "./types";

interface Option {
  move: Move;
  score: number;
}

/**
 * Tuning the bot can be argued about, so it can also be measured. Both sides of a
 * simulated match can run different policies, which is the only honest way to ask
 * whether a change is better play rather than merely a change.
 */
export interface BotPolicy {
  /**
   * Per-turn chance the bot assumes a position will be rugged, divided by its
   * holders. Higher means it banks profit sooner.
   */
  profitRisk: number;
  /**
   * Value below which a card in hand is worth throwing away, in MC-equivalent.
   * Zero switches discarding off entirely, which is how the measurement asks
   * whether the mechanic helps at all.
   */
  discardBelow: number;
  /**
   * Rank cards by value per unit of budget rather than by value.
   *
   * Measured with `npm run duel -- perBudget 1 0`.
   */
  perBudget: boolean;
  /**
   * Count the budget a card saves from being wasted as part of its value.
   *
   * Unspent budget comes off your market cap at the end of the turn, so playing
   * a card that costs 100K is worth its own effect plus the 100K it stops you
   * losing. Without this the bot walks into the penalty every turn: it ends the
   * turn as soon as nothing left in hand looks worth playing, which is exactly
   * when the budget is about to be taken off it.
   */
  wasteAware: boolean;
}

/**
 * Measured with `npm run duel`, not guessed. At 0.45 the bot banks about one and a
 * half positions a match and loses head to head, 48.2% against 51.8% — eager
 * banking throws away pump. At 0.25 it is level with never banking at all.
 *
 * Level, not useless. The bot maximises expected market cap, while banking is a
 * win-probability play: you give up upside to lock in a lead. It also cannot see
 * its own hand quality or whether the opponent has shown an attack card. A person
 * has all of that, so treat this number as "does not make the bot worse", not as
 * a verdict on the mechanic.
 *
 * discardBelow was measured the same way, and unlike profitRisk it is not close:
 * throwing weak cards away beats never doing it 57.5% to 42.5%. The threshold
 * wants to be low, though — the bot should bin the dross, not dig. Duelled
 * against 10K: 5K level at 50.1%, 15K down to 48.6%, 25K to 46.6%, 60K to 39.6%.
 * Past about 20K it is discarding cards it should have played.
 */
export const DEFAULT_POLICY: BotPolicy = {
  profitRisk: 0.25,
  discardBelow: 10_000,
  perBudget: false,
  wasteAware: true,
};

/**
 * Picks the next move. Pure: reads the state, changes nothing. The randomness
 * comes from state.rngState, so the same state gives the same move and a match
 * stays replayable.
 */
export function chooseMove(
  state: State,
  index: CardIndex,
  policy: BotPolicy = DEFAULT_POLICY,
): Move {
  const player = state.toMove;
  if (state.finished) throw new Error("The bot was handed a finished match.");
  // Nothing affordable left is the only reason to stop early. The cheapest thing
  // in the game is a common, and a common can be taxed — so the floor is what a
  // common costs *this player, on this table*, not what it says on the card.
  const cheapest = Math.min(
    ...state.players[player].hand.map((id) => chargeFor(state, cardById(index, id), player, index)),
    Number.POSITIVE_INFINITY,
  );
  if (state.budgetThisTurn - state.budgetSpentThisTurn < Math.min(cheapest, MARKETING_COST.common)) {
    return { kind: "endTurn" };
  }

  const turnsLeft = Math.max(1, RULES.turns - state.turn + 1);
  const hand = state.players[player].hand;
  const options: Option[] = [];

  for (let handIndex = 0; handIndex < hand.length; handIndex++) {
    const card = cardById(index, hand[handIndex]!);
    if (!playable(state, card, player, index)) continue;

    // Two questions now, not one. A project going into a full portfolio has to
    // close something, and it may separately have an effect to aim; the bot used
    // to answer whichever came first and a card that needed both got half a
    // move.
    const closing = needsPortfolioSlot(state, card, player, index)
      ? weakestPosition(state, player, index)
      : null;
    const aimed = chooseTarget(state, card, player, index, turnsLeft);
    // Which of the revealed cards to take out. Its own answer because it is
    // counted against a different list — and without one the effect burned the
    // top card every time, which is the mechanic with its whole point removed:
    // measured that way it was worth 0.4 points, because a random card off a
    // forty-card deck is replaced by one just like it.
    const burn = card.effect?.kind === "peekAndBurn"
      ? worstToLeaveThem(state, player, card.effect.look, index)
      : null;
    const value = cardValue(state, card, player, index, turnsLeft, aimed, closing);

    options.push({
      move: {
        kind: "playCard",
        handIndex,
        ...(aimed === null ? {} : { targetIndex: aimed }),
        ...(closing === null ? {} : { closeIndex: closing }),
        ...(burn === null ? {} : { burnIndex: burn }),
      },
      // Value per unit of what it actually costs here. Reading the printed
      // price would make a taxed card look like a bargain, which is precisely
      // backwards.
      score: perUnit(policy, value, chargeFor(state, card, player, index)) + jitter(state, handIndex),
    });

    // Throwing it away instead. Worth an action only because the top-up refills
    // to the hand size: a card held is a card not drawn, so a weak card costs
    // you the draw it is standing in the way of.
    //
    // Only cards that could be played right now are candidates. A card blocked
    // by an empty board may be the best card in hand next turn, and the bot
    // cannot tell the difference — so it does not get to guess.
    // Affordability has to be checked now that a discard and a card cost
    // different amounts. It used to be free to assume: if any card could be
    // played, an action was left, and a discard cost the same one.
    if (policy.discardBelow > 0 && value < policy.discardBelow && canDiscard(state, player)) {
      options.push({
        move: { kind: "discard", handIndex },
        // Divided by its own price for the same reason the cards are: scoring one
        // option per dollar and another per action compares two different things,
        // and the cheaper unit always wins.
        score:
          perUnit(policy, policy.discardBelow - value, TURN_ACTION_COST) +
          // Offset the jitter seed so a discard never ties with its own play.
          jitter(state, 200 + handIndex),
      });
    }
  }

  // Banking a position: it adds no market cap, it protects market cap you already
  // have. Worth weighing every turn, not only when the portfolio is full.
  if (canTakeProfit(state, player, index)) {
    state.players[player].projects.forEach((_, slot) => {
      options.push({
        move: { kind: "takeProfit", slot },
        // Offset the jitter seed so banking does not share a value with a hand slot.
        score:
          perUnit(
            policy,
            takeProfitValue(state, player, slot, index, turnsLeft, policy),
            TURN_ACTION_COST,
          ) + jitter(state, 100 + slot),
      });
    });
  }

  const best = options.reduce<Option | null>(
    (top, option) => (top === null || option.score > top.score ? option : top),
    null,
  );

  // Nothing in hand that adds value: better to close the turn and pump.
  if (best === null || best.score <= 0) return { kind: "endTurn" };
  return best.move;
}

/**
 * Budget a move stops going to waste, which is market cap it stops you losing.
 *
 * Worth exactly what it costs: spend 100K and 100K does not come off you at the
 * end of the turn.
 */
/**
 * What a standing rule is worth to the player holding it, for one turn it holds.
 *
 * This was `RULES.budgetPerTurn` for every rule in the game — a flat $40K added
 * for HAVING a restriction, without reading what it said. Every other line
 * around the call site prices itself from its own numbers: a toll sums their
 * board and takes its percentage, onTheirPlay multiplies its own rate. This one
 * did not, and it was wrong by up to a hundred times in both directions.
 *
 * Measured the way everything else here is: a plain rare carrying nothing but
 * the rule, put on the board undamaged on turn four, 300 seeds against the same
 * 300 with no rule. Whole-match margin, then divided by the six turns it stands.
 *
 *   taxPlays 7%          $246K   ->  $41K a turn
 *   taxPlays 13%         $384K   ->  $64K
 *   taxPlays 25%         $695K   ->  $116K
 *   banType event        $156K   ->  $26K
 *   banType tool         $150K   ->  $25K
 *   banType tactic       $242K   ->  $40K
 *   banType influencer   $338K   ->  $56K
 *   banType project     $3615K   ->  $603K
 *   banTakeProfit        -$15K   ->  nothing
 *   banRoom             $1696K   ->  $283K
 *
 * Two of those are worth saying out loud. banRoom is the strongest rule in the
 * game by a distance, which fits: a side closes a position to free a slot on
 * 82.5% of the occasions a position leaves at all, so a player who cannot do it
 * has stopped being able to launch anything. And banTakeProfit, which reads like
 * the same card, is worth nothing — it shuts the other door, the deliberate one,
 * and almost nobody uses that door.
 *
 * The tax is the one shape that scales cleanly with its own number, so it gets a
 * rate rather than a row: $5K a percentage point fits all three readings.
 */
function restrictionWorth(restriction: Restriction): number {
  switch (restriction.kind) {
    case "taxPlays":
      return restriction.percent * 5_000;
    case "banRoom":
      return 283_000;
    case "banTakeProfit":
      return 0;
    case "banType":
      switch (restriction.cardType) {
        case "project":
          return 603_000;
        case "influencer":
          return 56_000;
        case "tactic":
          return 40_000;
        case "event":
          return 26_000;
        case "tool":
          return 25_000;
        default:
          return assertNever(restriction.cardType, "restrictionWorth cardType");
      }
    default:
      return assertNever(restriction, "restrictionWorth");
  }
}

function wasteSaved(policy: BotPolicy, cost: number): number {
  return policy.wasteAware ? cost * WASTE_PENALTY : 0;
}

/** Every option is scored on the same scale, whichever scale the policy uses. */
/**
 * A card's score: what it is worth, against what it costs to get it.
 *
 * A cost of nothing is not a very good deal, it is a different question. While
 * the player holds a free play every card in hand costs nothing, so dividing by
 * cost would rank them all identically and the bot would spend the one free card
 * in the match on whatever happened to come first in the hand. When it is free,
 * the best card is simply the best card.
 *
 * Guarded rather than special-cased at the call site, so anything else that ever
 * makes a card free gets the same answer without knowing it had to ask.
 */
function perUnit(policy: BotPolicy, value: number, cost: number): number {
  if (cost <= 0) return value;
  return policy.perBudget ? value / cost : value;
}

/** Plays the bot's whole turn. Returns the new state. */
export function playBotTurn(
  state: State,
  index: CardIndex,
  policy: BotPolicy = DEFAULT_POLICY,
): State {
  let current = state;
  const start = current.toMove;
  let steps = 0;
  while (!current.finished && current.toMove === start) {
    current = applyMove(current, chooseMove(current, index, policy), index);
    if (++steps > 50) throw new Error("The bot can't get out of its turn — possible loop.");
  }
  return current;
}

// ---------------------------------------------------------------------------

function cardValue(
  state: State,
  card: Card,
  player: Player,
  index: CardIndex,
  turnsLeft: number,
  targetIndex: number | null,
  /**
   * Which of your own positions this play would close, when the portfolio is
   * full. Separate from targetIndex, which is what the effect aims at.
   *
   * They used to be one number and that stopped being true when a move learned
   * to carry both. Left as one, this counted an aim at the *opponent's* slot
   * four as giving up your own slot four — and crashed outright the moment the
   * aim was a slot number your board does not have.
   */
  closeIndex: number | null = null,
): number {
  let score = 0;

  if (card.type === "project") {
    score += card.launchMC + card.pumpMC * turnsLeft;

    // With a full portfolio this card costs a position. Subtract what that
    // position would still have earned, otherwise the bot happily throws away a
    // mythic to open a common.
    const closing = closeIndex ?? (needsPortfolioSlot(state, card, player, index) ? weakestPosition(state, player, index) : null);
    if (closing !== null && state.players[player].projects[closing]) {
      score -= pumpOf(state, player, closing, index) * turnsLeft;
    }
  }

  const aura = auraOf(card);
  if (aura) {
    // Every aura kind, and this line is the reason the check is not
    // `aura.kind === "pumpSector"` any more. It was, and a champion aura scored
    // exactly nothing — so the bot drew Trump, Meow, Frank, Bonk Guy and Nom
    // sixty-odd times each across three thousand matches and played them not
    // once. Five cards that did nothing, invisible to every test, which is the
    // Cards of Cronos failure reproduced from scratch inside a codebase built
    // to refuse it. An `if` on a kind is a switch with a silent default.
    //
    // Worth something even with an empty board: more projects are coming. Half
    // the floor, which is what the old (hits + 0.5) meant.
    //
    // Three of the five aura kinds pay in something other than market cap, so
    // auraWouldPay returns nought for them. Left there they would score zero and
    // the bot would never play one — which is exactly how the champions arrived
    // dead, and the reason this line is now two lines.
    const upkeep = auraUpkeep(aura);
    const perTurn =
      // Budget is money and money buys cards, so it is worth its face. It is not
      // worth *more* than its face: what you cannot spend is charged back.
      upkeep.budget +
      // A card in hand is about half a turn's spending — you can only play what
      // the budget affords either way. Measured rather than argued: at a fifth of
      // a turn Threadguy went unplayed on two draws in three while every other
      // mythic went down on nine in ten, and a mythic nobody plays is not a
      // mythic.
      upkeep.draw * RULES.budgetPerTurn * 0.5 +
      // A holder kept is pump kept. Positions pay in proportion to the holders
      // they have left, and a typical one is around $8K of pump per holder.
      upkeep.heal * HOLDER_WORTH +
      // And the same holder taken off the other side is worth the same, plus the
      // chance it finishes a position off entirely.
      upkeep.strip * HOLDER_WORTH +
      // A card out of their hand is a card they do not play. Same figure as one
      // in yours, from the other end.
      upkeep.burn * RULES.budgetPerTurn * 0.5 +
      // Handing them budget on a table with nothing to punish it is a present.
      // The same model the one-off uses, so a card and an aura saying the same
      // thing are not priced two different ways.
      (upkeep.wasteTimes > 1
        ? upkeep.gift * (upkeep.wasteTimes - 1) * 0.6
        : -upkeep.gift * 0.4) +
      // A position is a position: what the sixth one earns, roughly, for the
      // rest of the match. Counted once here rather than per turn, so it is
      // divided back out below.
      (upkeep.positions * POSITION_WORTH) / Math.max(1, turnsLeft) +
      // Doubling what idle money costs them is worth what they idle. The same
      // 60% of a turn's budget, times the extra multiple.
      (upkeep.wasteTimes - 1) * RULES.budgetPerTurn * 0.6;

    const paying = auraWouldPay(state, player, aura, index);
    score += (paying + auraFloor(aura) * 0.5 + perTurn) * turnsLeft;
  }

  if (card.effect) {
    score += effectValue(state, card.effect, player, index, turnsLeft, targetIndex);
  }

  // Tenure is worth what it will have grown into, which is the average of what
  // it pays on the way in and what it pays at the end — half the total lift over
  // the turns it is likely to stand.
  if (card.type === "project" && card.loyalty) {
    score += ((card.pumpMC * card.loyalty) / 100) * ((turnsLeft * turnsLeft) / 2);
  }

  // A free play is worth what it saves, and what it saves is a card's price. The
  // cap keeps it to the cheap half of the set, so the common price is the honest
  // figure rather than the average one.
  if (card.type === "project" && card.freePlays) {
    score += MARKETING_COST.common * card.freePlays * turnsLeft * STANDING_SURVIVES;
  }

  // Severance is worth a share of what this position will have earned by the
  // time it goes, and it goes when the slot is wanted — which the portfolio
  // guarantees. Priced off its own pump for the turns it is likely to stand.
  if (card.type === "project" && card.severance) {
    // Two positions a turn leave this side of the table, each having earned
    // roughly what a position earns. Priced off this board's own output, which
    // is the closest thing to what will be closing.
    const from = card.severance.from === "theirs" ? otherPlayer(player) : player;
    let output = 0;
    for (let slot = 0; slot < state.players[from].projects.length; slot++) {
      output += pumpOf(state, from, slot, index);
    }
    score += ((output * card.severance.percentage) / 100) * turnsLeft * STANDING_SURVIVES;
  }

  // A discount is worth what this player is about to spend, and what they spend
  // is their budget — a saving on money never earned is not a saving. Half
  // weight, because the budget it frees still has to find a card and a slot, and
  // the portfolio runs out before the money does.
  if (card.type === "project" && card.discount) {
    // The per-turn allowance rather than what is left of this one: the card is
    // being valued for the rest of the match, not for the next thirty seconds.
    score += ((RULES.budgetPerTurn * card.discount) / 100) * turnsLeft * 0.5;
  }

  // A shield is worth what it stops, and what it stops is what the other player
  // is taking. Priced off their board, because a board that pays is a board that
  // can afford to take.
  if (card.type === "project" && card.shield) {
    const them = otherPlayer(player);
    let theirs = 0;
    for (let slot = 0; slot < state.players[them].projects.length; slot++) {
      theirs += pumpOf(state, them, slot, index);
    }
    score += ((theirs * card.shield) / 100) * turnsLeft * 0.5;
  }

  // Leverage is worth what it multiplies, and what it multiplies is roughly what
  // this board makes in a turn. Both directions, so it is discounted for the
  // half of it that lands on you — a player ahead wants it and a player being
  // taken apart does not.
  if (card.type === "project" && card.leverage) {
    let mine = 0;
    for (let slot = 0; slot < state.players[player].projects.length; slot++) {
      mine += pumpOf(state, player, slot, index);
    }
    score += ((mine * card.leverage) / 100) * turnsLeft * 0.6;
  }

  // Room for more positions, priced the way the aura that grants it is: what one
  // more position earns for the rest of the match.
  if (card.type === "project" && card.morePositions) {
    score += card.morePositions * POSITION_WORTH;
  }

  // A toll takes a cut of what they gain, and what they gain is roughly what a
  // board pays — priced off their own pump rather than off a guess.
  if (card.type === "project" && card.toll) {
    let theirs = 0;
    const them = otherPlayer(player);
    for (let slot = 0; slot < state.players[them].projects.length; slot++) {
      theirs += pumpOf(state, them, slot, index);
    }
    // Twice, because every dollar taken moves the margin on both sides.
    score += ((theirs * card.toll.percentage) / 100) * 2 * turnsLeft * STANDING_SURVIVES;
  }

  // Paid per card they play. Two a turn is an ordinary turn.
  // A share of every move their market cap makes. Priced off their board's
  // output, doubled for the falls it also reads.
  if (card.type === "project" && card.oracle) {
    const them = otherPlayer(player);
    let theirs = 0;
    for (let slot = 0; slot < state.players[them].projects.length; slot++) {
      theirs += pumpOf(state, them, slot, index);
    }
    score += ((theirs * 2 * card.oracle) / 100) * turnsLeft * STANDING_SURVIVES;
  }

  // A share of what the other player spends, and a match spends about $2M of
  // marketing budget spread over ten turns.
  if (card.type === "project" && card.tip) {
    score += ((200_000 * card.tip) / 100) * turnsLeft * STANDING_SURVIVES;
  }

  // Paid per card you play, and 2.29 cards a turn is what the set measures.
  if (card.type === "project" && card.onYourPlay) {
    score += card.onYourPlay.mc * 2.29 * turnsLeft * STANDING_SURVIVES;
  }

  if (card.type === "project" && card.onTheirPlay) {
    score += card.onTheirPlay.mc * 2 * turnsLeft * STANDING_SURVIVES;
  }

  // A standing effect is the one-off times the turns it has left, the same way
  // an aura is scored above — a card that takes 5% every round for six rounds is
  // not a 5% card, and a bot that reads it as one leaves it in hand.
  //
  // Discounted, because the assumption behind the multiplication is that the
  // position survives, and a position that is doing something to the other
  // player is the position they aim at. Two thirds is the rate at which a
  // position on a hostile card is still undamaged a turn later, measured over
  // the baseline; it is not a guess dressed as a constant.
  if (card.type === "project" && card.standing) {
    const once = effectValue(state, card.standing, player, index, turnsLeft, targetIndex);
    score += once * turnsLeft * STANDING_SURVIVES;
  }

  // The payoff, worth its full value when the table already agrees and nothing
  // when it does not.
  //
  // Without this the bot valued a card on its base effect alone, so it never
  // played Second Wind *because* it was behind — it played it and the payoff
  // happened. Fourteen cards were therefore priced below what they do, in every
  // simulation run since they were written.
  //
  // Read against the table the card will land on, not the one in front of it.
  // The engine checks the condition after the card is played, and for a project
  // that is one position further along; scoring the board as it stands would
  // make a card that needs a fifth project look dead while holding the fifth.
  // The aim goes through too, or a payoff that asks about the position the card
  // points at reads as never firing and the bot leaves those cards in hand. The
  // engine passes it; anything here that does not is the bot playing a different
  // game from the one it is scoring.
  if (
    card.payoff &&
    holds(
      card.payoff.when,
      boardAfter(state, card, player, index, targetIndex),
      player,
      index,
      targetIndex ?? undefined,
    )
  ) {
    score += effectValue(state, card.payoff.effect, player, index, turnsLeft, targetIndex);
  }

  return score;
}

/**
 * The table as it will be once this card is down, for reading a condition.
 *
 * Two things move: the position it opens, and whatever its effect does — because
 * the engine applies the effect before it reads the payoff, and a payoff that
 * asks about the board is asking about the board the effect leaves behind.
 *
 * The effect is applied by calling applyEffect, not by predicting it. That
 * distinction is the whole reason this is safe: an earlier version added the
 * position and stopped there, on the argument that reproducing effects here
 * would be a second implementation of applyEffect. Right about the danger and
 * wrong about the remedy — the remedy is to use the first implementation.
 *
 * On a clone, so the log, the market caps and the PRNG this stirs are all thrown
 * away with it. And inside a try, because an effect that cannot resolve on this
 * board is a payoff the bot should read as not firing rather than a crash in the
 * middle of choosing a move.
 */
function boardAfter(
  state: State,
  card: Card,
  player: Player,
  index: CardIndex,
  targetIndex: number | null,
): State {
  const opensAPosition = card.type === "project" && !needsPortfolioSlot(state, card, player, index);
  if (!opensAPosition && !card.effect) return state;

  const after = structuredClone(state) as State;
  if (opensAPosition && card.type === "project") {
    after.players[player].projects.push({
      cardId: card.id,
      holders: card.holders,
      extraPump: 0,
      earned: card.launchMC,
      playedOnTurn: state.turn,
    });
  }
  if (card.effect) {
    try {
      applyEffect(after, card.effect, player, card, targetIndex ?? undefined, index);
    } catch {
      return after;
    }
  }
  return after;
}

function effectValue(
  state: State,
  effect: Effect,
  player: Player,
  index: CardIndex,
  turnsLeft: number,
  targetIndex: number | null,
): number {
  switch (effect.kind) {
    case "directMC": {
      // Damage to the opponent is worth as much as your own gain, so a flat
      // amount hitting both is a wash.
      if (effect.target === "both") return 0;
      // A rate times the board, when the card names a sector — otherwise the bot
      // reads a card worth five times its printed number as worth its printed
      // number and leaves it in hand.
      const paid = effect.per ? effect.mc * countSector(state, player, effect.per, index) : effect.mc;
      return effect.target === "self" ? paid : -paid;
    }

    case "scaleMC": {
      // A percentage is not a wash when it hits both: it multiplies the gap.
      // Ahead, you want the market up; behind, you want it down.
      const mine = state.players[player].mc;
      const theirs = state.players[otherPlayer(player)].mc;
      const mineDelta = effect.target === "opponent" ? 0 : (mine * effect.percentage) / 100;
      const theirsDelta = effect.target === "self" ? 0 : (theirs * effect.percentage) / 100;
      return mineDelta - theirsDelta;
    }

    case "pumpProject": {
      // Counted per board, because a table-wide pump lifts both sides and only
      // the difference matters.
      let value = 0;
      // A rate times the board is worth the board times the board, and without
      // this the bot prices the whole family at a fifth of what it does — it
      // would hold the cards that want a full table and play them on an empty
      // one, which is the exact opposite of the decision they are there to make.
      const held = state.players[player].projects.length;
      const rate = effect.per ? effect.mc * Math.max(0, held - 1) : effect.mc;
      for (const owner of ownersOf(effect.target, player)) {
        const count = slotsOn(state, effect.target, owner, player, targetIndex, index);
        value += (owner === player ? 1 : -1) * count * rate * turnsLeft;
      }
      return value;
    }

    case "pumpBySector": {
      // Same shape as pumpProject, but only projects in a listed sector count.
      // Per board again: a table-wide pump lifts the opponent too, so the card
      // is worth the difference and nothing more.
      let value = 0;
      for (const owner of ownersOf(effect.target, player)) {
        for (const slot of slotList(state, effect.target, owner, player, targetIndex, index)) {
          const onBoard = state.players[owner].projects[slot]!;
          const card = cardById(index, onBoard.cardId);
          if (card.type !== "project") continue;
          const bonus = effect.bonuses[card.sector];
          if (bonus === undefined) continue;
          value += (owner === player ? 1 : -1) * bonus * turnsLeft;
        }
      }
      return value;
    }

    case "damageHolders": {
      let value = 0;
      for (const owner of ownersOf(effect.target, player)) {
        for (const slot of slotList(state, effect.target, owner, player, targetIndex, index)) {
          const onBoard = state.players[owner].projects[slot]!;
          const take = effect.amount === "all" ? onBoard.holders : effect.amount;
          const lethal = take >= onBoard.holders;
          // Lethal damage is a rug: it takes back everything the position earned
          // on top of the pump it would still have paid.
          const loss = lethal
            ? pumpOf(state, owner, slot, index) * turnsLeft + onBoard.earned
            : (take / Math.max(1, onBoard.holders)) *
              pumpOf(state, owner, slot, index) *
              turnsLeft;
          value += owner === player ? -loss : loss;
        }
      }
      return value;
    }

    case "healHolders": {
      // Only worth something when there is damage to undo. Without this check the
      // bot played "Diamond Hands" on projects that were already at full holders.
      let healed = 0;
      for (const owner of ownersOf(effect.target, player)) {
        for (const slot of slotList(state, effect.target, owner, player, targetIndex, index)) {
          const onBoard = state.players[owner].projects[slot]!;
          const card = cardById(index, onBoard.cardId);
          if (card.type !== "project") continue;
          const room = card.holders - onBoard.holders;
          const gained = effect.amount === "full" ? room : Math.min(effect.amount, room);
          healed += owner === player ? gained : -gained;
        }
      }
      // A holder is roughly a turn of pump; valued low because the bot should
      // rather pump than repair.
      return healed * 6_000;
    }

    case "rug": {
      let value = 0;
      for (const owner of ownersOf(effect.target, player)) {
        for (const slot of slotList(state, effect.target, owner, player, targetIndex, index)) {
          const onBoard = state.players[owner].projects[slot]!;
          // Future pump plus everything the position has already produced, which
          // now comes straight off the owner's market cap.
          const loss = pumpOf(state, owner, slot, index) * turnsLeft + onBoard.earned;
          value += owner === player ? -loss : loss;
        }
      }
      return value;
    }

    case "stealMC": {
      // The rate times the board when the card names a sector, so the bot values
      // it for the board it actually has. Without this it reads a 10%-per-meme
      // card as a flat 10% and holds it back on the turn it is worth four times
      // that — the kind of card the bot has to understand or nobody will believe
      // the win rates it produces.
      let rate = effect.percentage;
      if (effect.per) {
        const sector = effect.per;
        const held = state.players[player].projects.filter((position) => {
          const card = cardById(index, position.cardId);
          return card.type === "project" && card.sector === sector;
        }).length;
        rate = effect.percentage * held;
      }
      const haul = (state.players[otherPlayer(player)].mc * rate) / 100;
      return haul * 2; // you gain it and they lose it
    }

    case "comebackMC": {
      // Worth the share of the gap it hands back, and nothing at all when there
      // is no gap. Not doubled the way stealMC is: this takes nothing off the
      // other player, so it moves the margin once rather than twice.
      const behind = state.players[otherPlayer(player)].mc - state.players[player].mc;
      if (behind <= 0) return 0;
      return (behind * effect.percentage) / 100;
    }

    case "recoverCard":
      // Measured, not guessed, and the guess was wrong by five times. A bare
      // recoverCard 1 printed on a common measured $75.6K over 1600 matches —
      // priced first at $15K on the reasoning that a card in hand is a card in
      // hand, which missed that this one is a card you get to PLAY, and a played
      // card brings its own launch, its own pump for the rest of the match and
      // its own effect with it.
      //
      // It is worth less late for the same reason: a card recovered on turn nine
      // has one turn to be anything. The bot cannot see that from here, so this
      // is the early figure and the cards carry the timing themselves.
      return effect.amount * 75_000;

    case "drawCards": {
      // A card in hand was measured at $16.7K, by taking one out of your own
      // hand and playing the match out (scripts/night-denial-price.ts). So a
      // card handed to the other player is worth about that much to them, and
      // the same figure is used in both directions rather than a guess for the
      // new one.
      const each = 15_000;
      switch (effect.target ?? "self") {
        case "self":
          return effect.amount * each;
        case "opponent":
          return -effect.amount * each;
        case "both":
          // You draw and so do they. Not nothing: the cards arrive in your hand
          // on your turn and in theirs before they have spent a budget on them.
          return 0;
      }
    }

    case "discardCards": {
      // Worth the same as a draw, from the other end, and doubled against the
      // opponent because a card they cannot play is a card and a turn.
      let value = 0;
      for (const target of playersOf(effect.target, player)) {
        const held = state.players[target].hand.length;
        const taken = Math.min(held, effect.amount);
        value += (target === player ? -1 : 1) * taken * 15_000;
      }
      return value;
    }

    case "takeOver": {
      // Their best position, valued the way cancel values an aura: what it would
      // still have paid, and here it pays *you* instead — so it is worth twice
      // the swing. Nothing when your portfolio is full, which is when the effect
      // refuses to fire at all.
      const other = otherPlayer(player);
      if (state.players[player].projects.length >= RULES.portfolioSize) return 0;
      let best = 0;
      for (let slot = 0; slot < state.players[other].projects.length; slot++) {
        best = Math.max(best, pumpOf(state, other, slot, index));
      }
      return best * turnsLeft * 2;
    }

    case "cancel": {
      // Worth what those auras would still have paid out over the turns left.
      //
      // This used to be "bonus times the projects of that sector held", which
      // was the right arithmetic for the only aura that existed and silently the
      // wrong one for any other. auraWorth asks the board what it is actually
      // paying, so a champion aura is priced correctly without this branch
      // knowing what a champion is.
      //
      // Ranked by the same measure the effect uses: biggest name first, where
      // "biggest" is what it earns rather than what number is printed on it.
      let value = 0;
      for (const owner of playersOf(effect.target, player)) {
        const sign = owner === player ? -1 : 1;
        const worths = state.players[owner].support
          .map((_, slot) => auraWorth(state, owner, slot, index))
          .sort((a, b) => b - a)
          .slice(0, effect.count);
        for (const worth of worths) value += sign * worth * turnsLeft;
      }
      return value;
    }

    case "extraBudget": {
      // Worth what it lets you spend, and no more: budget you cannot use is
      // taken off your market cap anyway.
      //
      // Whose budget it is was not being read at all. `return effect.mc` scored
      // "hand the opponent thirty-five thousand" as thirty-five thousand *for
      // you*, which was survivable while two cards in the set did it and is not
      // now — and it would have refused every card that takes budget off them,
      // because a negative read as a loss to itself.
      let value = 0;
      for (const side of playersOf(effect.target, player)) {
        if (side === player) {
          value += effect.mc;
          continue;
        }
        if (effect.mc < 0) {
          // Taking it off them is worth its face and there is no argument.
          value += -effect.mc;
          continue;
        }
        // Handing it over is the trap card, and whether it is a trap depends on
        // what else is on your side of the table. With something that multiplies
        // what they waste, the gift is the setup; without it, most of the money
        // simply gets spent against you.
        const times = upkeepFor(state, player, index).wasteTimes;
        value += times > 1 ? effect.mc * (times - 1) * 0.6 : -effect.mc * 0.4;
      }
      return value;
    }

    case "refundMC":
      return (state.budgetSpent[player] * effect.percentage) / 100;
    case "mcPerPositionGone":
      return effect.mc * state.positionsGone;
    case "mcPerHolderLost":
      // Worth exactly what the match has cost so far, which the bot can read
      // straight off the state. A card that is worth nothing on turn one and a
      // great deal on turn nine, priced correctly on both.
      return effect.mc * state.holdersLost;

    case "attach": {
      if (targetIndex === null) return 0;
      const mine = effect.target === "ownProject";
      // What it does once, times the turns it has left to do it in, discounted
      // for the position not surviving them all. A tick on their board is the
      // position they will close to be rid of it, so it is discounted harder.
      const once = effectValue(state, effect.every, player, index, turnsLeft, targetIndex);
      return once * turnsLeft * (mine ? 0.75 : 0.6);
    }

    case "scalePump": {
      let value = 0;
      for (const owner of ownersOf(effect.target, player)) {
        for (const slot of slotList(state, effect.target, owner, player, targetIndex, index)) {
          const now = pumpOf(state, owner, slot, index);
          const change = (now * effect.percentage) / 100;
          value += (owner === player ? change : -change) * turnsLeft;
        }
      }
      return value;
    }

    case "unbankedMC": {
      let unbanked = 0;
      for (const position of state.players[player].projects) unbanked += position.earned;
      return (unbanked * effect.percentage) / 100;
    }
    case "peakMC":
      // What you got to, not what you are holding — and the two are only the
      // same while nothing has knocked you back.
      return (state.peakMC[player] * effect.percentage) / 100;

    case "benchmark": {
      if (targetIndex === null) return 0;
      const them = otherPlayer(player);
      let theirBest = 0;
      for (let slot = 0; slot < state.players[them].projects.length; slot++) {
        theirBest = Math.max(theirBest, pumpOf(state, them, slot, index));
      }
      const now = state.players[player].projects[targetIndex]
        ? pumpOf(state, player, targetIndex, index)
        : 0;
      // Worth the gap it closes plus whatever it adds, for the turns that are
      // left. Against an empty board it is worth the plus and nothing else,
      // which is the card.
      return (Math.max(0, theirBest - now) + (effect.plus ?? 0)) * turnsLeft;
    }

    case "merge": {
      // Everything else you hold, moved onto one card. The pump survives; what
      // is lost is five positions' worth of soaking damage, which is priced as
      // the pump it would have kept paying had it not all been in one place.
      let pump = 0;
      const board = state.players[player].projects;
      for (let slot = 0; slot < board.length; slot++) pump += pumpOf(state, player, slot, index);
      return pump * turnsLeft * 0.55;
    }

    case "fork": {
      const them = otherPlayer(player);
      const theirs = state.players[them].projects;
      if (theirs.length === 0) return 0;
      let best = 0;
      for (let slot = 1; slot < theirs.length; slot++) {
        if (pumpOf(state, them, slot, index) > pumpOf(state, them, best, index)) best = slot;
      }
      const card = cardById(index, theirs[best]!.cardId);
      if (card.type !== "project") return 0;
      return card.launchMC + card.pumpMC * turnsLeft;
    }

    case "peekAndBurn":
      // A card taken out of a deck is a card they never draw. Priced at what one
      // in hand was measured at, which is the closest thing to a real number
      // this has — see scripts/night-denial-price.ts.
      return 16_700;

    case "budgetToMC": {
      const left = state.budgetThisTurn - state.budgetSpentThisTurn;
      // What it converts, plus the penalty it saves. Both halves are real and
      // only counting the first would have the bot undervalue every one of them.
      return Math.max(0, (left * effect.percentage) / 100) + left * 0.2;
    }

    case "burnForDamage": {
      // The whole board at once: worth the sum of everything on it, less
      // everything it would still have paid. There is no target to weigh because
      // there is nothing left standing to choose between.
      if (effect.target === "allOwnProjects") {
        const board = state.players[player].projects;
        let sum = 0;
        for (let slot = 0; slot < board.length; slot++) {
          const held = board[slot]!;
          const back = effect.keep ? (held.earned * effect.keep) / 100 : 0;
          sum += held.earned + back - pumpOf(state, player, slot, index) * turnsLeft;
        }
        return sum;
      }
      if (targetIndex === null) return 0;
      const position = state.players[player].projects[targetIndex];
      if (!position) return 0;
      // Their loss, plus whatever comes back to you, less the pump this position
      // would still have paid you. Without the keep the bot values every burn as
      // if it were the pure sacrifice, and it would sit on the cards that pay
      // more than they cost.
      const back = effect.keep ? (position.earned * effect.keep) / 100 : 0;
      // A project handed back is one more card in hand, and the set already has
      // a measured price for that rather than a guessed one — the same $16.7K
      // peekAndBurn is valued at, from scripts/night-denial-price.ts.
      const kept = effect.returns ? 16_700 : 0;
      return position.earned + back + kept - pumpOf(state, player, targetIndex, index) * turnsLeft;
    }

    case "after": {
      // Worth what it will do, discounted for having to survive until then.
      //
      // Two things can take it away: the match ending first, and — when it marks
      // a position — the other player answering it in the turns they now have.
      // 0.7 is the rate at which a marked position is still standing two turns
      // later, measured over the baseline. Without a discount the bot would pay
      // full price for a promise.
      // What it does now is worth its full price whatever happens afterwards.
      const now = effect.now
        ? effectValue(state, effect.now, player, index, turnsLeft, targetIndex)
        : 0;
      // And the bill never arrives if the match ends first, which is the whole
      // reason to hold a card like this until the last turns.
      if (turnsLeft <= effect.turns) return now;
      const later = effectValue(state, effect.effect, player, index, turnsLeft - effect.turns, targetIndex);
      const marked = "target" in effect.effect && needsChoice(effect.effect.target as never);
      return now + later * (marked ? 0.7 : 0.85);
    }

    default:
      return assertNever(effect, "effectValue");
  }
}

/**
 * What banking a position is worth: the market cap it protects, minus the pump it
 * gives up.
 *
 * The risk of losing it is estimated from how exposed it is — a position on one
 * holder dies to any of the ten cards in the set that deal damage — compounded
 * over the turns still to play. The numbers are a rough model, not a claim about
 * the true odds; what matters is that a fat, battered position late in a match
 * comes out ahead of a healthy one early.
 */
function takeProfitValue(
  state: State,
  player: Player,
  slot: number,
  index: CardIndex,
  turnsLeft: number,
  policy: BotPolicy,
): number {
  const onBoard = state.players[player].projects[slot]!;
  const perTurnRisk = policy.profitRisk / Math.max(1, onBoard.holders);
  const risk = 1 - Math.pow(1 - perTurnRisk, turnsLeft);
  const givenUp = pumpOf(state, player, slot, index) * turnsLeft;

  // What the support row pays for doing it. Without this the bot weighs banking
  // exactly as it did before the cards existed, and every one of them is a dead
  // card — the same failure the champions and the healer arrived with, which is
  // three for three on "the effect works and nobody plays it".
  let paid = 0;
  for (const entry of state.players[player].support) {
    const aura = auraOf(cardById(index, entry.cardId));
    if (aura?.kind === "bankPays") paid += aura.mc;
  }

  return onBoard.earned * risk - givenUp + paid;
}

/** Which project the bot points at, when the card asks for one. */
function chooseTarget(
  state: State,
  card: Card,
  player: Player,
  index: CardIndex,
  turnsLeft: number,
): number | null {
  // The close is answered by the caller now, into its own field. This function
  // answers only "what is the effect aiming at", which is what its name says and
  // what it did not used to do.
  const requirement = targetRequirementOf(card);
  if (!requirement) return null;

  const owner = boardOf(requirement, player);
  const projects = state.players[owner].projects;
  if (projects.length === 0) return null;

  // Every position scored as the whole card, rather than the biggest one picked
  // by pump.
  //
  // Picking by pump was right for a card that only pumps and wrong the moment a
  // payoff asks something about the position — "when that project has stood for
  // four turns" was answered by aiming at the newest big one, so two PONKE cards
  // fired one time in seven while an older position sat beside them. The bot was
  // choosing a target for half the card.
  //
  // Six positions at most, so scoring each one is six calls where there was one.
  let best = 0;
  let bestValue = -Infinity;
  for (let i = 0; i < projects.length; i++) {
    const value = cardValue(state, card, player, index, turnsLeft, i);
    if (value > bestValue) {
      bestValue = value;
      best = i;
    }
  }
  return best;
}

/**
 * Which of the cards revealed off the top of their deck to take out.
 *
 * The dearest of them, by what it costs to play — a rough stand-in for how much
 * they would rather have drawn it, and the only signal available about a card
 * that is not on any board. Counted from the top down, which is how the effect
 * counts.
 */
function worstToLeaveThem(
  state: State,
  player: Player,
  look: number,
  index: CardIndex,
): number | null {
  const deck = state.players[otherPlayer(player)].deck;
  const seen = Math.min(look, deck.length);
  if (seen === 0) return null;
  let best = 0;
  let dearest = -Infinity;
  for (let i = 0; i < seen; i++) {
    const card = cardById(index, deck[deck.length - 1 - i]!);
    const worth = MARKETING_COST[card.rarity];
    if (worth > dearest) {
      dearest = worth;
      best = i;
    }
  }
  return best;
}

/** The position that yields the least. The one to give up when a slot is needed. */
function weakestPosition(state: State, player: Player, index: CardIndex): number {
  const projects = state.players[player].projects;
  let weakest = 0;
  let lowest = Infinity;
  for (let i = 0; i < projects.length; i++) {
    const value = worthOfPosition(state, player, i, index);
    if (value < lowest) {
      lowest = value;
      weakest = i;
    }
  }
  return weakest;
}

/**
 * What a position is worth to keep, per turn.
 *
 * Its pump, plus whatever it goes on doing while it stands. Pump alone was the
 * whole answer until positions could carry a clock or a toll, and then it was
 * quietly wrong in the worst way: a card paying $120K every turn off a small
 * pump read as the weakest thing on the board, so the bot closed it to make room
 * for something ordinary. It was throwing away its best card and the log said
 * only "CLOSED".
 *
 * Only what it does every turn. What it did once when it landed is spent.
 */
function worthOfPosition(state: State, player: Player, slot: number, index: CardIndex): number {
  let value = pumpOf(state, player, slot, index);
  const position = state.players[player].projects[slot];
  if (!position) return value;
  const card = cardById(index, position.cardId);
  if (card.type !== "project") return value;

  // A standing thing only pays while the position is undamaged, so a damaged one
  // is worth what it pumps and nothing more — which is also why it is the right
  // one to give up.
  if (position.holders < card.holders) return value;

  if (card.standing) value += effectValue(state, card.standing, player, index, 1, null);
  if (card.toll) {
    const them = otherPlayer(player);
    let theirs = 0;
    for (let i = 0; i < state.players[them].projects.length; i++) {
      theirs += pumpOf(state, them, i, index);
    }
    value += ((theirs * card.toll.percentage) / 100) * 2;
  }
  if (card.onTheirPlay) value += card.onTheirPlay.mc * 2;
  if (card.onYourPlay) value += card.onYourPlay.mc * 2.29;
  // A rule that binds both sides is worth a fraction of one that binds only
  // them, and the sign depends on whose board needs the door — which this cannot
  // see. Priced at a third rather than at nothing, so the bot will play one and
  // will not reach for it first. Not measured; the other numbers here are.
  if (card.restriction) value += restrictionWorth(card.restriction) * (card.mutual ? 0.33 : 1);
  // And uptime is worth that back, scaled by how often it is actually holding
  // anything off: a player is under somebody's rule on 31% of turns.
  if (card.uptime) value += RULES.budgetPerTurn * 0.31;
  return value;
}

/** Which slots on one board an effect lands on. */
function slotList(
  state: State,
  target: TargetProject,
  owner: Player,
  player: Player,
  targetIndex: number | null,
  index: CardIndex,
): number[] {
  const projects = state.players[owner].projects;
  if (needsChoice(target)) {
    if (targetIndex === null) return [];
    return targetIndex < projects.length ? [targetIndex] : [];
  }
  // Aimed by the card, at one position. Scoring it against the whole board would
  // have the bot price a single hit as if it landed on all six.
  if (target === "enemyBest") {
    if (projects.length === 0) return [];
    let best = 0;
    for (let i = 1; i < projects.length; i++) {
      if (pumpOf(state, owner, i, index) > pumpOf(state, owner, best, index)) best = i;
    }
    return [best];
  }
  return projects.map((_, i) => i);
}

function slotsOn(
  state: State,
  target: TargetProject,
  owner: Player,
  player: Player,
  targetIndex: number | null,
  index: CardIndex,
): number {
  return slotList(state, target, owner, player, targetIndex, index).length;
}

/** Small deterministic variation, so two seeds don't produce the same match. */
function jitter(state: State, handIndex: number): number {
  const { value } = next(state.rngState + state.turn * 31 + handIndex);
  return value * 5_000;
}
