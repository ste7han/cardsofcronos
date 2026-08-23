// The market: your opponent in this first version.
//
// No neural network, but an honest estimator. Every card in hand gets a value in
// MC-equivalent, and the bot plays the highest one. Where a card needs a target,
// it picks the project that yields the most or hurts the most.
//
// The switch in `effectValue` is exhaustive and ends on assertNever(). That is
// deliberate: add an effect variant and the bot breaks at compile time instead of
// silently never playing those cards again.

import { assertNever, holds } from "./effects";
import { cardById, otherPlayer } from "./helpers";
import {
  applyMove,
  canDiscard,
  canTakeProfit,
  needsPortfolioSlot,
  playable,
  pumpOf,
  targetRequirementOf,
} from "./match";
import { next } from "./rng";
import { WASTE_PENALTY } from "./types";
import type { Card, CardIndex, Effect, Move, Player, State, TargetProject } from "./types";
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
  // Nothing affordable left is the only reason to stop early.
  if (state.budgetThisTurn - state.budgetSpentThisTurn < MARKETING_COST.common) {
    return { kind: "endTurn" };
  }

  const turnsLeft = Math.max(1, RULES.turns - state.turn + 1);
  const hand = state.players[player].hand;
  const options: Option[] = [];

  for (let handIndex = 0; handIndex < hand.length; handIndex++) {
    const card = cardById(index, hand[handIndex]!);
    if (!playable(state, card, player, index)) continue;

    const aimed = chooseTarget(state, card, player, index, turnsLeft);
    const value = cardValue(state, card, player, index, turnsLeft, aimed);

    options.push({
      move: { kind: "playCard", handIndex, ...(aimed === null ? {} : { targetIndex: aimed }) },
      score: perUnit(policy, value, MARKETING_COST[card.rarity]) + jitter(state, handIndex),
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
function wasteSaved(policy: BotPolicy, cost: number): number {
  return policy.wasteAware ? cost * WASTE_PENALTY : 0;
}

/** Every option is scored on the same scale, whichever scale the policy uses. */
function perUnit(policy: BotPolicy, value: number, cost: number): number {
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
): number {
  let score = 0;

  if (card.type === "project") {
    score += card.launchMC + card.pumpMC * turnsLeft;

    // With a full portfolio this card costs a position. Subtract what that
    // position would still have earned, otherwise the bot happily throws away a
    // mythic to open a common.
    if (needsPortfolioSlot(state, card, player, index) && targetIndex !== null) {
      score -= pumpOf(state, player, targetIndex, index) * turnsLeft;
    }
  }

  const aura = auraOf(card);
  if (aura && aura.kind === "pumpSector") {
    const hits = state.players[player].projects.filter((p) => {
      const c = cardById(index, p.cardId);
      return c.type === "project" && c.sector === aura.sector;
    }).length;
    // Worth something even with an empty board: more projects are coming.
    score += aura.bonus * (hits + 0.5) * turnsLeft;
  }

  if (card.effect) {
    score += effectValue(state, card.effect, player, index, turnsLeft, targetIndex);
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
  if (card.payoff && holds(card.payoff.when, boardAfter(state, card, player, index), player, index)) {
    score += effectValue(state, card.payoff.effect, player, index, turnsLeft, targetIndex);
  }

  return score;
}

/**
 * The table as it will be once this card is down, for reading a condition.
 *
 * Only the portfolio count moves, and only for a project that opens a position
 * rather than replacing one. Everything else a card does to the table happens in
 * its effect, which the engine applies before it looks at the payoff — so
 * guessing at those here would be a second implementation of applyEffect, which
 * is the thing this codebase is arranged to never have.
 */
function boardAfter(state: State, card: Card, player: Player, index: CardIndex): State {
  if (card.type !== "project" || needsPortfolioSlot(state, card, player, index)) return state;
  const after = structuredClone(state) as State;
  after.players[player].projects.push({
    cardId: card.id,
    holders: card.holders,
    extraPump: 0,
    earned: card.launchMC,
    playedOnTurn: state.turn,
  });
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
    case "directMC":
      // Damage to the opponent is worth as much as your own gain, so a flat
      // amount hitting both is a wash.
      if (effect.target === "both") return 0;
      return effect.target === "self" ? effect.mc : -effect.mc;

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
      for (const owner of ownersOf(effect.target, player)) {
        const count = slotsOn(state, effect.target, owner, player, targetIndex);
        value += (owner === player ? 1 : -1) * count * effect.mc * turnsLeft;
      }
      return value;
    }

    case "pumpBySector": {
      // Same shape as pumpProject, but only projects in a listed sector count.
      // Per board again: a table-wide pump lifts the opponent too, so the card
      // is worth the difference and nothing more.
      let value = 0;
      for (const owner of ownersOf(effect.target, player)) {
        for (const slot of slotList(state, effect.target, owner, player, targetIndex)) {
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
        for (const slot of slotList(state, effect.target, owner, player, targetIndex)) {
          const onBoard = state.players[owner].projects[slot]!;
          const lethal = effect.amount >= onBoard.holders;
          // Lethal damage is a rug: it takes back everything the position earned
          // on top of the pump it would still have paid.
          const loss = lethal
            ? pumpOf(state, owner, slot, index) * turnsLeft + onBoard.earned
            : (effect.amount / Math.max(1, onBoard.holders)) *
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
        for (const slot of slotList(state, effect.target, owner, player, targetIndex)) {
          const onBoard = state.players[owner].projects[slot]!;
          const card = cardById(index, onBoard.cardId);
          if (card.type !== "project") continue;
          const gained = Math.min(effect.amount, card.holders - onBoard.holders);
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
        for (const slot of slotList(state, effect.target, owner, player, targetIndex)) {
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
      const haul = (state.players[otherPlayer(player)].mc * effect.percentage) / 100;
      return haul * 2; // you gain it and they lose it
    }

    case "drawCards":
      return effect.amount * 15_000;

    case "cancel": {
      // Worth what the aura would still have paid out: its bonus, times the
      // projects of that sector held, times the turns left to play.
      let value = 0;
      for (const owner of playersOf(effect.target, player)) {
        const sign = owner === player ? -1 : 1;
        const auras = state.players[owner].support
          .map((entry) => auraOf(cardById(index, entry.cardId)))
          .filter((a): a is NonNullable<typeof a> => a !== null)
          .sort((a, b) => b.bonus - a.bonus)
          .slice(0, effect.count);
        for (const aura of auras) {
          const hits = state.players[owner].projects.filter((p) => {
            const c = cardById(index, p.cardId);
            return c.type === "project" && c.sector === aura.sector;
          }).length;
          value += sign * aura.bonus * hits * turnsLeft;
        }
      }
      return value;
    }

    case "extraBudget":
      // Worth what it lets you spend, and no more: budget you cannot use is
      // taken off your market cap anyway.
      return effect.mc;

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
  return onBoard.earned * risk - givenUp;
}

/** Which project the bot points at, when the card asks for one. */
function chooseTarget(
  state: State,
  card: Card,
  player: Player,
  index: CardIndex,
  turnsLeft: number,
): number | null {
  // A project going into a full portfolio has to close a position. Close the
  // weakest one — it gives up the least future pump.
  if (needsPortfolioSlot(state, card, player, index)) {
    return weakestPosition(state, player, index);
  }

  const requirement = targetRequirementOf(card);
  if (!requirement) return null;

  const owner = boardOf(requirement, player);
  const projects = state.players[owner].projects;
  if (projects.length === 0) return null;

  // The most valuable project: the best one to pump, and the best one to wreck.
  let best = 0;
  let bestValue = -Infinity;
  for (let i = 0; i < projects.length; i++) {
    const value = pumpOf(state, owner, i, index) * turnsLeft;
    if (value > bestValue) {
      bestValue = value;
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
    const value = pumpOf(state, player, i, index);
    if (value < lowest) {
      lowest = value;
      weakest = i;
    }
  }
  return weakest;
}

/** Which slots on one board an effect lands on. */
function slotList(
  state: State,
  target: TargetProject,
  owner: Player,
  player: Player,
  targetIndex: number | null,
): number[] {
  const projects = state.players[owner].projects;
  if (needsChoice(target)) {
    if (targetIndex === null) return [];
    return targetIndex < projects.length ? [targetIndex] : [];
  }
  return projects.map((_, i) => i);
}

function slotsOn(
  state: State,
  target: TargetProject,
  owner: Player,
  player: Player,
  targetIndex: number | null,
): number {
  return slotList(state, target, owner, player, targetIndex).length;
}

/** Small deterministic variation, so two seeds don't produce the same match. */
function jitter(state: State, handIndex: number): number {
  const { value } = next(state.rngState + state.turn * 31 + handIndex);
  return value * 5_000;
}
