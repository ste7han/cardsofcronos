// A match as a pure reducer: applyMove(state, move) returns a new state and
// leaves the old one untouched.
//
// That shape is deliberate. The moment a match has a stake attached, the server
// has to validate every move; then exactly this function runs there, unchanged.
// In Cards of Cronos the card check was purely a UI filter, so calling the
// function directly let you play any card. That can't happen here, because the UI
// has no rules of its own — it can only propose moves this function approves.

import { applyEffect, assertNever, holds } from "./effects";
import { cardLabel, formatMC, formatMCPair, plural } from "./format";
import { describeCondition, describeRestriction } from "./rules-text";
import { cardById, drawToFull, log, otherPlayer, projectById } from "./helpers";
import { buildDeck } from "./deck";
import type { ProjectCard } from "./types";
import { shuffle } from "./rng";
import type {
  Aura,
  AuraKind,
  Card,
  CardIndex,
  ChoiceTarget,
  Move,
  Player,
  PlayerState,
  Restriction,
  Sector,
  State,
} from "./types";
import {
  MARKETING_COST,
  IllegalMove,
  PLAYERS,
  RULES,
  TURN_ACTION_COST,
  WASTE_PENALTY,
  boardOf,
  needsChoice,
} from "./types";

/** Convenient index for looking cards up by id. */
export function buildIndex(cards: readonly Card[]): CardIndex {
  return new Map(cards.map((c) => [c.id, c]));
}

export function newMatch(
  cards: readonly Card[],
  seed: number,
  decks?: Partial<Record<Player, readonly string[]>>,
): State {
  // A deck is 40 cards inside a points budget. Leave one out and a legal deck is
  // generated from the seed, so a match can never quietly fall back on playing the
  // whole set and breaking its own rules.
  const yours = decks?.you ?? buildDeck(cards, seed | 0);
  const theirs = decks?.opponent ?? buildDeck(cards, (seed | 0) + 7919);

  const firstShuffle = shuffle(yours, seed | 0);
  const secondShuffle = shuffle(theirs, firstShuffle.state);

  const state: State = {
    seed,
    rngState: secondShuffle.state,
    turn: 1,
    toMove: "you",
    budgetThisTurn: budgetForTurn(1),
    budgetSpentThisTurn: 0,
    players: {
      you: emptySide(firstShuffle.list),
      opponent: emptySide(secondShuffle.list),
    },
    log: [],
    finished: false,
    winner: null,
  };

  log(state, null, `Match started. ${RULES.turns} turns, highest MC wins.`, "system");

  if (RULES.firstMoveSeedMC > 0) {
    state.players.you.mc = RULES.firstMoveSeedMC;
    log(
      state,
      null,
      `Seed round: the first player starts at ${formatMC(RULES.firstMoveSeedMC)} MC for moving first.`,
      "system",
    );
  }

  for (const player of PLAYERS) drawToFull(state, player);

  return state;
}

function emptySide(deck: string[]): PlayerState {
  return {
    mc: 0,
    hand: [],
    deck,
    discard: [],
    projects: [],
    support: [],
    pendingBudget: 0,
  };
}

// ---------------------------------------------------------------------------
// The reducer
// ---------------------------------------------------------------------------

/**
 * Apply a move on behalf of a named player, refusing it if it is not their turn.
 *
 * This is the one a server calls. applyMove takes the mover from state.toMove
 * and never asks who sent the request, which is right for the bot and for a
 * replay and wrong for anything holding a socket: without this, a client can
 * post a move during the opponent's turn and the reducer will happily apply it
 * as the opponent's.
 *
 * Separate rather than a parameter on applyMove, because every existing caller
 * genuinely is the authority — the bot, the tests, the measurement scripts and
 * the replay all move for whoever is to move. Making them all pass an argument
 * they cannot get wrong is noise; making the server call a different name is a
 * choice it has to make on purpose.
 */
export function applyMoveAs(
  state: State,
  player: Player,
  move: Move,
  index: CardIndex,
): State {
  if (state.toMove !== player) {
    throw new IllegalMove(`It is not ${player}'s turn to move.`);
  }
  return applyMove(state, move, index);
}

export function applyMove(state: State, move: Move, index: CardIndex): State {
  if (state.finished) {
    throw new IllegalMove("The match is over; no further moves are possible.");
  }

  const next: State = structuredClone(state);
  const player = next.toMove;

  switch (move.kind) {
    case "playCard":
      playCard(next, player, move.handIndex, move.targetIndex, index);
      return next;

    case "takeProfit":
      takeProfit(next, player, move.slot, index);
      return next;

    case "discard":
      discard(next, player, move.handIndex, index);
      return next;

    case "endTurn":
      endTurn(next, player, index);
      return next;

    default:
      return assertNever(move, "applyMove");
  }
}

function playCard(
  state: State,
  player: Player,
  handIndex: number,
  targetIndex: number | undefined,
  index: CardIndex,
): void {
  const hand = state.players[player].hand;

  if (!Number.isInteger(handIndex) || handIndex < 0 || handIndex >= hand.length) {
    throw new IllegalMove(`Hand slot ${handIndex} does not exist (hand holds ${hand.length} cards).`);
  }
  const card = cardById(index, hand[handIndex]!);
  const cost = MARKETING_COST[card.rarity];
  const left = state.budgetThisTurn - state.budgetSpentThisTurn;
  if (cost > left) {
    throw new IllegalMove(
      `${cardLabel(card)} costs ${formatMC(cost)} to market and only ${formatMC(left)} is left this turn.`,
    );
  }

  const blocker = whyNot(state, card, player, index);
  if (blocker) throw new IllegalMove(blocker);

  hand.splice(handIndex, 1);
  state.budgetSpentThisTurn += cost;

  switch (card.type) {
    case "project": {
      const upgrading = positionOfProject(state, player, card.project, index);
      if (upgrading !== null) {
        upgradePosition(state, player, upgrading, card, index);
        break;
      }

      closePositionIfFull(state, player, targetIndex, index);
      state.players[player].projects.push({
        cardId: card.id,
        holders: card.holders,
        extraPump: 0,
        earned: card.launchMC,
        playedOnTurn: state.turn,
      });
      state.players[player].mc += card.launchMC;
      log(
        state,
        player,
        `LAUNCH ${card.name} — ${formatMC(card.launchMC)} MC, pumps ${formatMC(card.pumpMC)} per turn.`,
        "pump",
      );
      announceRestriction(state, player, card);
      break;
    }

    case "influencer": {
      state.players[player].support.push({ cardId: card.id });
      log(state, player, `${card.name} joins — ${shortAura(card.aura)}.`, "pump");
      break;
    }

    case "tool": {
      // Stays on the table like an influencer: a tool is something you have, not
      // something you spend. Its one-off effect is applied below, with every
      // other card's, so a tool cannot quietly skip it.
      state.players[player].support.push({ cardId: card.id });
      log(
        state,
        player,
        card.aura
          ? `${card.name} is up — ${shortAura(card.aura)}.`
          : `${card.name} is up.`,
        "pump",
      );
      announceRestriction(state, player, card);
      break;
    }

    case "tactic":
    case "event": {
      state.players[player].discard.push(card.id);
      break;
    }

    default:
      return assertNever(card, "playCard");
  }

  if (card.effect) {
    applyEffect(state, card.effect, player, card, targetIndex, index);
  }

  // The bonus is checked after the base effect and after the card is on the
  // table, because both can change whether the condition holds — a project that
  // fills your fifth position is the fifth position, and an effect that swings
  // market cap can put you behind or take you out of it. Checking first would
  // read the table the card has just changed.
  if (card.payoff && holds(card.payoff.when, state, player, index)) {
    log(state, player, `${card.name}: ${describeCondition(card.payoff.when)}`, "pump");
    applyEffect(state, card.payoff.effect, player, card, targetIndex, index);
  }
}

/**
 * Say out loud that a standing rule just landed.
 *
 * The card face carries it and whyNot() names it when you hover a card you
 * cannot play, but the log said nothing at all — so from the other side of the
 * table a whole card type switching off looked like the game refusing moves for
 * no reason. A rule that changes what the opponent may do is the loudest thing
 * a card can do and it was the quietest thing in the log.
 */
function announceRestriction(state: State, player: Player, card: Card): void {
  if (card.type !== "project" || !card.restriction) return;
  log(state, player, `${card.name}: ${describeRestriction(card.restriction)}`, "dump");
}

/** Which slot holds a card of this project, or null. */
function positionOfProject(
  state: State,
  player: Player,
  project: string,
  index: CardIndex,
): number | null {
  const projects = state.players[player].projects;
  for (let slot = 0; slot < projects.length; slot++) {
    const held = index.get(projects[slot]!.cardId);
    if (held?.type === "project" && held.project === project) return slot;
  }
  return null;
}

/**
 * Is this card a step up from the one already holding the position?
 *
 * Strictly bigger, by what it costs to play. Sideways is not an upgrade — two
 * commons of one project are alternatives, not a ladder — and downward would let
 * you play the mythic, "upgrade" to the common and keep the pump for nothing.
 */
function isUpgradeOver(card: ProjectCard, held: ProjectCard): boolean {
  return MARKETING_COST[card.rarity] > MARKETING_COST[held.rarity];
}

/**
 * A bigger card of the same project takes over the position.
 *
 * This is evolution, and it is what the extra cards of a project are for. BONK
 * did not restart at zero when it reached a billion: the holders came with it and
 * so did the momentum. So the new card inherits everything the old position was
 * pumping — its own rate plus whatever had been added to it — and what the old
 * one already earned stays where it is, in your market cap.
 *
 * It costs one action rather than two, which is the point. Closing a position and
 * playing the replacement is still possible and still costs two; that route banks
 * the position instead, and a banked position cannot be rugged.
 */
function upgradePosition(
  state: State,
  player: Player,
  slot: number,
  card: ProjectCard,
  index: CardIndex,
): void {
  const position = state.players[player].projects[slot]!;
  const old = projectById(index, position.cardId);
  const inherited = old.pumpMC + position.extraPump;

  state.players[player].discard.push(position.cardId);
  state.players[player].projects[slot] = {
    cardId: card.id,
    holders: card.holders,
    extraPump: inherited,
    earned: position.earned + card.launchMC,
    playedOnTurn: state.turn,
  };
  state.players[player].mc += card.launchMC;

  log(
    state,
    player,
    // cardLabel, not name: every card in a family shares its name, so "WIF
    // becomes WIF" is what this said. The moment is the only thing that tells
    // eight cards apart, and this line exists to say which one took over.
    `UPGRADE ${cardLabel(old)} becomes ${cardLabel(card)} — ${formatMC(card.launchMC)} MC, ` +
      `now pumps ${formatMC(card.pumpMC + inherited)} per turn.`,
    "pump",
  );
}

/**
 * A full portfolio doesn't block a project — it makes you choose. Close a
 * position and the MC it already made stays; you only give up its future pump.
 *
 * That is what stops a full portfolio from turning half your hand into dead
 * cards, and it is the decision the cap exists for in the first place.
 */
function closePositionIfFull(
  state: State,
  player: Player,
  targetIndex: number | undefined,
  index: CardIndex,
): void {
  const projects = state.players[player].projects;
  if (projects.length < RULES.portfolioSize) return;

  if (targetIndex === undefined) {
    throw new IllegalMove(
      `Your portfolio is full at ${RULES.portfolioSize} positions. Close one to open a new position.`,
    );
  }
  if (!Number.isInteger(targetIndex) || targetIndex < 0 || targetIndex >= projects.length) {
    throw new IllegalMove(
      `Position ${targetIndex} does not exist; the portfolio holds ${projects.length}.`,
    );
  }

  closePosition(state, player, targetIndex, index, "CLOSED");
}

/**
 * Taking profit on purpose: close a position and keep what it made.
 *
 * Costs one of your plays for the turn. That cost is the mechanic — it forces a
 * choice between adding to the table and protecting what is on it. Free banking
 * would make the last turn a formality and a rug harmless.
 */
/**
 * The first restriction on the other side of the table that `pick` accepts.
 *
 * One place that knows where restrictions live — a project holding a position or
 * a tool sitting in support, always on the opponent's side of whoever is asking.
 * Everything else asks this and gets back the name of the card doing it, so the
 * message can say which card is in the way rather than "not allowed".
 */
function restrictionOn(
  state: State,
  player: Player,
  index: CardIndex,
  pick: (r: Restriction & { source: string }) => string | null,
): string | null {
  const them = otherPlayer(player);
  for (const position of state.players[them].projects) {
    const card = cardById(index, position.cardId);
    if (card.type !== "project" || !card.restriction) continue;
    // Undamaged only. A standing rule holds while the position is untouched and
    // lifts the moment anything takes a holder off it — which is what stops a
    // card that switches tactics off from being a lock nobody holds the key to.
    // Healing back to full brings it back, because healHolders never goes past
    // the printed count and "untouched" is the same test either way.
    if (position.holders < card.holders) continue;
    const hit = pick({ ...card.restriction, source: card.name });
    if (hit) return hit;
  }
  return null;
}

function takeProfit(state: State, player: Player, slot: number, index: CardIndex): void {
  const locked = restrictionOn(state, player, index, (r) =>
    r.kind === "banTakeProfit" ? r.source : null,
  );
  if (locked) {
    throw new IllegalMove(
      `${locked} is on the opponent's table. There is no way out of a position while it holds.`,
    );
  }

  const spare = state.budgetThisTurn - state.budgetSpentThisTurn;
  if (TURN_ACTION_COST > spare) {
    throw new IllegalMove(
      `Taking profit costs ${formatMC(TURN_ACTION_COST)} and only ${formatMC(spare)} is left this turn.`,
    );
  }
  const projects = state.players[player].projects;
  if (!Number.isInteger(slot) || slot < 0 || slot >= projects.length) {
    throw new IllegalMove(`Position ${slot} does not exist; the portfolio holds ${projects.length}.`);
  }

  state.budgetSpentThisTurn += TURN_ACTION_COST;
  closePosition(state, player, slot, index, "TAKE PROFIT");
}

/**
 * Throw a card out of your hand.
 *
 * The point is not the card you lose, it is the card you draw. The top-up only
 * fills back to the hand size, so every card you hold is a card you do not draw
 * — a dead card in hand costs you a live one every turn it sits there.
 *
 * Priced at TURN_ACTION_COST, the same as taking profit, so it competes with
 * playing something rather than being free.
 */
function discard(state: State, player: Player, handIndex: number, index: CardIndex): void {
  const hand = state.players[player].hand;
  const spare = state.budgetThisTurn - state.budgetSpentThisTurn;

  if (TURN_ACTION_COST > spare) {
    throw new IllegalMove(
      `Throwing a card away costs ${formatMC(TURN_ACTION_COST)} and only ${formatMC(spare)} is left this turn.`,
    );
  }
  if (!Number.isInteger(handIndex) || handIndex < 0 || handIndex >= hand.length) {
    throw new IllegalMove(
      `Hand slot ${handIndex} does not exist (hand holds ${hand.length} cards).`,
    );
  }

  const card = cardById(index, hand[handIndex]!);
  hand.splice(handIndex, 1);
  state.players[player].discard.push(card.id);
  state.budgetSpentThisTurn += TURN_ACTION_COST;
  log(state, player, `THREW AWAY ${cardLabel(card)}.`, "neutral");
}

/**
 * Removes a position and banks what it produced. Shared by taking profit and by
 * making room in a full portfolio, because both mean the same thing: you got out
 * in time, so the market cap is realised and a rug can no longer touch it.
 */
function closePosition(
  state: State,
  player: Player,
  slot: number,
  index: CardIndex,
  label: string,
): void {
  const closed = state.players[player].projects.splice(slot, 1)[0]!;
  state.players[player].discard.push(closed.cardId);
  log(
    state,
    player,
    `${label} ${projectById(index, closed.cardId).name} — ${formatMC(closed.earned)} MC realised and banked.`,
    "neutral",
  );
}

/** Is taking profit available right now? */
/**
 * Budget you were given and did not spend comes off your market cap.
 *
 * Marketing you did not do is not a saving. Without this the budget is only ever
 * a ceiling — you take what you can use and the rest costs nothing, which is why
 * 147K a turn was sitting idle and a deck of nothing but expensive cards did
 * fine. With it, every turn you have to find something worth doing with the
 * money, and a hand that cannot absorb it hurts.
 */
function chargeForWastedBudget(state: State, player: Player): void {
  const wasted = state.budgetThisTurn - state.budgetSpentThisTurn;
  if (wasted <= 0) return;

  const side = state.players[player];
  const charge = Math.round(wasted * WASTE_PENALTY);
  const taken = Math.min(side.mc, charge);
  if (taken <= 0) return;
  side.mc -= taken;
  log(
    state,
    player,
    `${formatMC(wasted)} of marketing budget went unspent — ${formatMC(taken)} off the market cap.`,
    "dump",
  );
}

/**
 * The marketing budget for a turn. Turn one gets one share, turn ten gets ten —
 * $40K rising to $400K.
 *
 * An allowance, not income: it does not accumulate. Whatever is left when the
 * turn ends is gone, and the end of the turn charges for it.
 */
export function budgetForTurn(turn: number): number {
  return turn * RULES.budgetPerTurn;
}

/** Is there room in the turn to throw a card away, and a card to throw? */
export function canDiscard(state: State, player: Player): boolean {
  return (
    !state.finished &&
    state.toMove === player &&
    state.budgetThisTurn - state.budgetSpentThisTurn >= TURN_ACTION_COST &&
    state.players[player].hand.length > 0
  );
}

export function canTakeProfit(state: State, player: Player, index: CardIndex): boolean {
  return (
    !state.finished &&
    state.toMove === player &&
    state.budgetThisTurn - state.budgetSpentThisTurn >= TURN_ACTION_COST &&
    state.players[player].projects.length > 0 &&
    // The index is required rather than optional. A restriction that only
    // applies when the caller happens to pass an argument is a rule that fails
    // silently for anyone who forgets, and the bot forgetting it would mean
    // proposing a move that throws in the middle of a simulation.
    restrictionOn(state, player, index, (r) => (r.kind === "banTakeProfit" ? r.source : null)) === null
  );
}

function endTurn(state: State, player: Player, index: CardIndex): void {
  pumpPhase(state, player, index);
  chargeForWastedBudget(state, player);

  const next = otherPlayer(player);
  state.toMove = next;

  // Both players have gone: the turn counter moves on.
  if (next === "you") {
    state.turn += 1;
    if (state.turn > RULES.turns) {
      finish(state);
      return;
    }
  }

  state.budgetSpentThisTurn = 0;
  // Anything the opponent handed them lands here, at the one moment the budget
  // is set. Cleared as it is taken, so a grant is spent once and a replay from
  // the same seed and moves lands on the same number.
  const granted = state.players[next].pendingBudget;
  state.players[next].pendingBudget = 0;
  state.budgetThisTurn = budgetForTurn(state.turn) + granted;
  if (granted > 0) {
    log(
      state,
      next,
      `${formatMC(granted)} of somebody else's marketing budget arrives, and it has to go somewhere.`,
      "dump",
    );
  }
  drawToFull(state, next);
}

function pumpPhase(state: State, player: Player, index: CardIndex): void {
  const projects = state.players[player].projects;
  if (projects.length === 0) {
    log(state, player, "No projects on the board — no pump this turn.", "neutral");
    return;
  }
  let total = 0;
  for (let i = 0; i < projects.length; i++) {
    const yielded = pumpOf(state, player, i, index);
    // Booked against the position as well as the score: this is what a rug takes
    // back off you.
    projects[i]!.earned += yielded;
    total += yielded;
  }
  state.players[player].mc += total;
  log(
    state,
    player,
    `PUMP ${formatMC(total)} across ${plural(projects.length, "project", "projects")} — ${formatMC(state.players[player].mc)} MC total.`,
    "pump",
  );
}

function finish(state: State): void {
  state.finished = true;
  const mine = state.players.you.mc;
  const theirs = state.players.opponent.mc;
  state.winner = mine === theirs ? null : mine > theirs ? "you" : "opponent";
  const [yoursText, theirsText] = formatMCPair(mine, theirs);
  log(
    state,
    null,
    state.winner === null
      ? `Draw at ${yoursText} MC.`
      : `Over: ${yoursText} against ${theirsText} — ` +
        `${state.winner === "you" ? "you win" : "the market wins"} by ${formatMC(Math.abs(mine - theirs))}.`,
    "system",
  );
}

// ---------------------------------------------------------------------------
// Derived values — one source for engine, bot and UI
// ---------------------------------------------------------------------------

/** What this project yields this turn, including built-up pump and influencer auras. */
export function pumpOf(state: State, player: Player, slot: number, index: CardIndex): number {
  const onBoard = state.players[player].projects[slot];
  if (!onBoard) throw new Error(`No project in slot ${slot} for ${player}.`);
  const card = projectById(index, onBoard.cardId);

  let bonus = 0;
  for (const entry of state.players[player].support) {
    const supporter = cardById(index, entry.cardId);
    if (supporter.type !== "influencer" && supporter.type !== "tool") {
      throw new Error(
        `Card "${entry.cardId}" sits in support but is a ${supporter.type}, which cannot be there.`,
      );
    }
    // A tool need not carry an aura; an influencer always does.
    if (supporter.aura) bonus += auraBonusFor(supporter.aura, card.sector);
  }
  // Floored at zero. pumpProject takes a negative amount, which is how a card
  // makes a position worth less every turn instead of removing it — but past
  // zero it would start draining market cap, which is a rug paid in
  // instalments and is not what any card printed on it says.
  const full = Math.max(0, card.pumpMC + onBoard.extraPump + bonus);

  // A damaged position pays in proportion to the holders it has left.
  //
  // Measured before this existed: attacking cost 26% more margin per dollar than
  // building and took seven cards to remove one position. The damage landed —
  // 5.84 net holders a match — it just never finished anything, because eleven
  // of the eighteen cards that strip holders hit the whole enemy board for one
  // and six positions chipped by one each is six positions still paying in full.
  // 63.6% of every position that died was killed outright by a table-wide event
  // rather than by damage adding up.
  //
  // So damage counts on its way to a kill instead of only at the end of one. No
  // number on any card changes and no new field exists: holders already mean
  // "how much this survives", and now they also mean "how much of it is left".
  // Healing puts the pump back with the holders, which is the same rule read
  // backwards rather than a second one.
  return Math.round((full * onBoard.holders) / card.holders);
}

function auraBonusFor(aura: Aura, sector: Sector): number {
  // Switching on the kind rather than the object: Aura has one variant today, so
  // this is the only way TypeScript can narrow the default branch to never. Add a
  // second aura and this function breaks at compile time — which is the point.
  const kind: AuraKind = aura.kind;
  switch (kind) {
    case "pumpSector":
      return aura.sector === sector ? aura.bonus : 0;
    default:
      return assertNever(kind, "auraBonusFor");
  }
}

/**
 * Would playing this card take over a position you already hold?
 *
 * Separate from needsPortfolioSlot: an upgrade never needs a slot, because it
 * replaces rather than adds. The screen wants to say "upgrades your BONK" rather
 * than "close a position first", and those are different sentences.
 */
export function upgradesAPosition(
  state: State,
  card: Card,
  player: Player,
  index: CardIndex,
): boolean {
  if (card.type !== "project") return false;
  const slot = positionOfProject(state, player, card.project, index);
  if (slot === null) return false;
  return isUpgradeOver(card, projectById(index, state.players[player].projects[slot]!.cardId));
}

/**
 * Does playing this card require closing a position first?
 *
 * A project, a full portfolio — and not an upgrade. That last clause was missing,
 * and the sentence explaining why it has to be there was already written on
 * upgradesAPosition directly above: an upgrade never needs a slot, because it
 * replaces rather than adds. applyMove has always known it, taking the upgrade
 * branch and returning before it ever asks for a position to close.
 *
 * So the engine played a mythic WIF over a rare WIF on a full board without
 * complaint, while the screen stopped the player and demanded they sacrifice one
 * of their six first. The rule was right and only the question was wrong, which
 * is the kind of wrong nobody files as a bug — they just close a position they
 * did not have to lose.
 */
export function needsPortfolioSlot(
  state: State,
  card: Card,
  player: Player,
  index: CardIndex,
): boolean {
  if (card.type !== "project") return false;
  if (state.players[player].projects.length < RULES.portfolioSize) return false;
  return !upgradesAPosition(state, card, player, index);
}

/** Does this card point at one project the player has to choose? If so, which kind of target. */
export function targetRequirementOf(card: Card): ChoiceTarget | null {
  const effect = card.effect;
  if (!effect) return null;
  if (!("target" in effect)) return null;
  // A player target is never a project choice.
  if (effect.target === "self" || effect.target === "opponent" || effect.target === "both") {
    return null;
  }
  return needsChoice(effect.target) ? effect.target : null;
}

/**
 * Why this card can't be played right now, or null if it can.
 *
 * The UI uses this to dim cards, but it is not a UI filter: applyMove calls it
 * itself and throws. The UI therefore cannot route around the rule.
 */
export function whyNot(
  state: State,
  card: Card,
  player: Player,
  index: CardIndex,
): string | null {
  // Price first: this is the reason that fires most, and it used to live only in
  // playable(). A caller that asked whyNot() got null for a card it could not
  // afford, and had to know to check the price itself — a hole that swallowed a
  // whole measurement run. Every reason a card is unplayable is now stated here.
  const left = state.budgetThisTurn - state.budgetSpentThisTurn;
  const price = MARKETING_COST[card.rarity];
  if (price > left) {
    return (
      `${card.name} costs ${formatMC(price)} to market and you have ` +
      `${formatMC(left)} of budget left this turn.`
    );
  }

  if (card.type === "project") {
    const slot = positionOfProject(state, player, card.project, index);
    if (slot !== null) {
      const held = projectById(index, state.players[player].projects[slot]!.cardId);
      if (!isUpgradeOver(card, held)) {
        return (
          `${held.name} already holds your ${card.ticker} position, and ` +
          `${card.name} is not a step up from it. Only a bigger card takes over.`
        );
      }
    }
  }

  const banned = restrictionOn(state, player, index, (r) =>
    r.kind === "banType" && r.cardType === card.type ? r.source : null,
  );
  if (banned) {
    return `${banned} is on the opponent's table, and nothing of type ${card.type} can be played while it holds.`;
  }

  const requirement = targetRequirementOf(card);
  if (requirement) {
    const board = state.players[boardOf(requirement, player)].projects;
    if (board.length === 0) {
      return requirement === "enemyProject"
        ? `${card.name} needs a project on the opponent's board, and that board is empty.`
        : `${card.name} needs a project of your own, and your board is empty.`;
    }
  }
  return null;
}

/** Can this card hit the table right now? Used to dim the hand. */
export function playable(
  state: State,
  card: Card,
  player: Player,
  index: CardIndex,
): boolean {
  if (state.finished) return false;
  if (state.toMove !== player) return false;
  return whyNot(state, card, player, index) === null;
}

function shortAura(aura: Aura): string {
  const kind: AuraKind = aura.kind;
  switch (kind) {
    case "pumpSector":
      return `${aura.sector} pumps ${formatMC(aura.bonus)} more per turn`;
    default:
      return assertNever(kind, "shortAura");
  }
}
