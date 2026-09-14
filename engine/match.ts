// A match as a pure reducer: applyMove(state, move) returns a new state and
// leaves the old one untouched.
//
// That shape is deliberate. The moment a match has a stake attached, the server
// has to validate every move; then exactly this function runs there, unchanged.
// In Cards of Cronos the card check was purely a UI filter, so calling the
// function directly let you play any card. That can't happen here, because the UI
// has no rules of its own — it can only propose moves this function approves.

import { applyEffect, assertNever, holds } from "./effects";
import { auraOn, pumpOf } from "./pump";
import { removePosition } from "./positions";
import { changeMC, discountFor, onCardPlayed, spendBudget } from "./scoreboard";

export { pumpOf };
import { cardLabel, formatMC, formatMCPair, plural } from "./format";
import { describeCondition, describeRestriction } from "./rules-text";
import { draw, cardById, drawToFull, log, otherPlayer, projectById } from "./helpers";
import { buildDeck } from "./deck";
import { timesWord } from "./rules-text";
import type { ProjectCard } from "./types";
import { nextInt, shuffle } from "./rng";
import type {
  Boards,
  Aura,
  AuraKind,
  Card,
  CardIndex,
  ChoiceTarget,
  Effect,
  Move,
  Player,
  PlayerState,
  Restriction,
  Sector,
  State,
} from "./types";
import {
  basePrice,
  auraOf,
  MARKETING_COST,
  IllegalMove,
  PLAYERS,
  RARITIES,
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
    toMove: FIRST_MOVER,
    holdersLost: 0,
    positionsGone: 0,
    peakMC: { you: 0, opponent: 0 },
    pending: [],
    budgetThisTurn: budgetFor(1, FIRST_MOVER),
    budgetSpentThisTurn: 0,
    budgetSpent: { you: 0, opponent: 0 } as Record<Player, number>,
    playsThisTurn: 0,
    upgradedThisPlay: false,
    players: {
      you: emptySide(firstShuffle.list),
      opponent: emptySide(secondShuffle.list),
    },
    log: [],
    finished: false,
    winner: null,
    freePlays: {
      [FIRST_MOVER]: RULES.firstMoveFreeCard ? 1 : 0,
      [otherPlayer(FIRST_MOVER)]: 0,
    } as Record<Player, number>,
  };

  log(state, null, `Match started. ${RULES.turns} turns, highest MC wins.`, "system");

  // Dormant, and kept rather than deleted. The seed round was how moving first
  // was paid for until it became firstMoveBudget; the constant is zero now, so
  // this does nothing. It stays because validateEffect's aheadBy floor is driven
  // off the same constant, and a seed that comes back without its floor coming
  // back with it is the Birdeye bug again. See the note on firstMoveSeedMC.
  if (RULES.firstMoveSeedMC > 0) {
    // No index here and none needed: nobody has a position on the table before
    // the first move, so there is no toll to collect on it.
    changeMC(state, FIRST_MOVER, RULES.firstMoveSeedMC - state.players[FIRST_MOVER].mc);
    log(
      state,
      null,
      `Seed round: the first player starts at ${formatMC(RULES.firstMoveSeedMC)} MC for moving first.`,
      "system",
    );
  }

  if (RULES.firstMoveFreeCard) {
    log(
      state,
      null,
      `Moving first: the opening player's first card is free, whatever it costs.`,
      "system",
    );
  }

  // Said once, at the start, rather than on each of the turns it lands on. It is
  // a standing fact about the seat and not an event, and a line that repeats
  // every turn reads as something having just happened.
  if (RULES.firstMoveBudget > 0) {
    log(
      state,
      null,
      `Moving first: the opening player's marketing budget runs a turn ahead, ` +
        `up to the last turn — on turn ${RULES.turns} both players get ` +
        `${formatMC(budgetForTurn(RULES.turns))}.`,
      "system",
    );
  }

  for (const player of PLAYERS) drawToFull(state, player, RULES.handSize);

  return state;
}

function emptySide(deck: string[]): PlayerState {
  return {
    mc: 0,
    hand: [],
    deck,
    discard: [],
      recovered: [],
    projects: [],
    support: [],
    pendingBudget: 0,
    banked: 0,
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
    case "playCard": {
      // The id is taken before the card leaves the hand and looked up after the
      // move has been allowed — the other order turned an out-of-range hand slot
      // into "no such card" instead of the illegal move it is.
      const id = next.players[player].hand[move.handIndex];
      playCard(
        next,
        player,
        move.handIndex,
        // peekAndBurn counts against the cards it revealed rather than against a
        // board, so it arrives in its own field and is handed to the effect in
        // the same place a board target would be.
        move.burnIndex ?? move.targetIndex,
        move.closeIndex,
        index,
      );
      // Watchers fire once the card has resolved: they are reacting to a card
      // that was played, not to one that was about to be.
      if (id) onCardPlayed(next, player, cardById(index, id).type, index);
      return next;
    }

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
  closeIndex: number | undefined,
  index: CardIndex,
): void {
  const hand = state.players[player].hand;

  if (!Number.isInteger(handIndex) || handIndex < 0 || handIndex >= hand.length) {
    throw new IllegalMove(`Hand slot ${handIndex} does not exist (hand holds ${hand.length} cards).`);
  }
  const card = cardById(index, hand[handIndex]!);
  const cost = chargeFor(state, card, player, index);
  const free = cost === 0 && (state.freePlays[player] ?? 0) > 0;
  const left = state.budgetThisTurn - state.budgetSpentThisTurn;
  if (cost > left) {
    throw new IllegalMove(
      `${cardLabel(card)} costs ${formatMC(cost)} to market and only ${formatMC(left)} is left this turn.`,
    );
  }

  const blocker = whyNot(state, card, player, index);
  if (blocker) throw new IllegalMove(blocker);

  hand.splice(handIndex, 1);
  {
    // The half-price mark travels with the card and dies when it leaves the hand.
    const mark = state.players[player].recovered.indexOf(card.id);
    if (mark !== -1) state.players[player].recovered.splice(mark, 1);
  }
  spendBudget(state, player, cost, index);
  // Counted before the effect resolves, so a card asking whether it is the
  // second this turn is counting itself. That is what the text says.
  state.playsThisTurn += 1;
  if (free) {
    state.freePlays[player] -= 1;
    log(
      state,
      player,
      `${cardLabel(card)} goes out for nothing — the free play for moving first.`,
      "pump",
    );
  }

  // Fresh on every play, because a payoff two cards later must not read the
  // answer to a question somebody else asked.
  state.upgradedThisPlay = false;

  switch (card.type) {
    case "project": {
      const upgrading = positionOfProject(state, player, card.project, index);
      if (upgrading !== null) {
        state.upgradedThisPlay = true;
        upgradePosition(state, player, upgrading, card, index);
        break;
      }

      closePositionIfFull(state, player, closeIndex, index);
      state.players[player].projects.push({
        cardId: card.id,
        holders: card.holders,
        extraPump: 0,
        earned: card.launchMC,
        playedOnTurn: state.turn,
      });
      changeMC(state, player, card.launchMC, index);
      log(
        state,
        player,
        `LAUNCH ${card.name} — ${formatMC(card.launchMC)} MC, pumps ${formatMC(card.pumpMC)} per turn.`,
        "pump",
      );
      announceRestriction(state, player, card);
      break;
    }

    case "person": {
      state.players[player].support.push({ cardId: card.id });
      log(state, player, `${card.name} joins — ${shortAura(card.aura)}.`, "pump");
      break;
    }

    case "tool": {
      // Stays on the table like a person: a tool is something you have, not
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
  // The same targetIndex the effect used, so a payoff can ask about the position
  // the card was pointed at.
  if (card.payoff && holds(card.payoff.when, state, player, index, targetIndex)) {
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
  state: Boards,
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
  changeMC(state, player, card.launchMC, index);

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
  if (projects.length < portfolioSizeFor(state, player, index)) return;

  if (targetIndex === undefined) {
    const room = portfolioSizeFor(state, player, index);
    // Over the limit rather than at it, which happens when a card that granted
    // room takes damage: the room goes and the positions stay. Saying "full at
    // six" to somebody looking at nine of their own positions is the game lying
    // about its own rule, the same way it would if a card raised the limit and
    // this still said six.
    throw new IllegalMove(
      projects.length > room
        ? `You hold ${projects.length} positions and have room for ${room} — a card that ` +
          `was making space has been damaged. Close one to open a new position.`
        : `Your portfolio is full at ${room} positions. Close one to open a new position.`,
    );
  }

  // Somebody across the table may be holding the door shut. Checked here rather
  // than in whyNot alone, because this is the one place a position is closed to
  // make room and a rule that only lived in the check would be a rule the engine
  // did not actually have.
  const held = restrictionOn(state, player, index, (r) => (r.kind === "banRoom" ? true : null));
  if (held) {
    throw new IllegalMove(
      `${whoseTable(held)}. Nobody is selling: you cannot ` +
        `close a position to make room. Take profit instead, or wait.`,
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
/**
 * What this card costs this player to play, right now.
 *
 * The printed price, plus whatever the other side of the table is charging on
 * top. Four places read a price — the play path, whyNot, and two in the bot —
 * and every one of them read MARKETING_COST directly, so a new pricing rule
 * would have had four chances to be forgotten in three files. There is one now.
 *
 * Rounded to whole market cap, and up: a tax that rounded down would be free on
 * anything cheap enough, which is the half of the set it matters most on.
 */
export function priceFor(
  state: State,
  card: Card,
  player: Player,
  index: CardIndex,
): number {
  // Half, for a card that came back out of the discard: you have paid for it
  // once already.
  //
  // A price cut and deliberately not a budget grant, which is what this was
  // first. Unspent budget is charged back at one for one, so handing a player
  // the money instead of the discount gives with one hand and takes with the
  // other unless they happen to spend it. Measured: as a grant it moved the
  // family's cards by nothing worth printing; as a price it moved them 15-20%.
  //
  // Rounded up, like the tax and the discount below, so nothing here is ever
  // allowed to make a card free.
  const base = state.players[player].recovered.includes(card.id)
    ? Math.ceil(basePrice(card) / 2)
    : basePrice(card);
  const tax = restrictionOn(state, player, index, (r) => (r.kind === "taxPlays" ? r.percent : null));
  const taxed = tax === null ? base : base + Math.ceil((base * tax.value) / 100);

  // The discount comes off last, so it cuts the other player's tax along with
  // the printed price — which is what a card saying "everything you play costs
  // less" promises. Rounded up, the way the tax rounds up: neither rule is ever
  // allowed to make something free.
  const off = discountFor(state, player, index);
  return off === 0 ? taxed : Math.ceil(taxed * (1 - off / 100));
}

/**
 * What this card costs this player *right now*, which is not what it is priced at.
 *
 * priceFor answers "what does this card cost", and that is the number the hand
 * shows and the number the bot divides value by. This answers "what comes out of
 * the budget if it is played", which is nothing while the player still holds a
 * free play.
 *
 * Two functions rather than one, and the reason is the bot. It ranks cards by
 * value per unit of cost, so a priceFor that returned zero would divide every
 * card by nothing and rank them all the same — the ranking would be gone and
 * nothing would fail. Keeping the price honest and the charge separate means the
 * only code that has to know about free plays is the code that spends one.
 */
export function chargeFor(
  state: State,
  card: Card,
  player: Player,
  index: CardIndex,
): number {
  if ((state.freePlays[player] ?? 0) > 0 && withinFreeCap(card)) return 0;
  return priceFor(state, card, player, index);
}

/**
 * Is this card cheap enough for the free play to cover?
 *
 * A cap on the rarity rather than on the price, because rarity is what the card
 * shows and a player reading "your first card is free, up to a legendary" can
 * check it without doing arithmetic.
 */
export function withinFreeCap(card: Card): boolean {
  const cap = RULES.firstMoveFreeCardUpTo;
  if (cap === null) return true;
  return RARITIES.indexOf(card.rarity) <= RARITIES.indexOf(cap);
}

/**
 * How many cards this player may put down for nothing this turn.
 *
 * Read off the board every time, undamaged only, and summed the way every other
 * standing number is. The opening free play is granted once at the start of a
 * match and is not part of this: that one is a rule of the game, this is a rule
 * on a card.
 */
function agentsFor(state: State, player: Player, index: CardIndex): number {
  let total = 0;
  for (const position of state.players[player].projects) {
    const card = index.get(position.cardId);
    if (!card || card.type !== "project" || !card.freePlays) continue;
    if (position.holders < card.holders) continue;
    total += card.freePlays;
  }
  return total;
}

/**
 * A rule the other side's board is holding up, and the position holding it.
 *
 * The slot is the part that took a while to matter. Knowing a rule is on is
 * enough to refuse a move; it is not enough to explain one. A player who can
 * suddenly not take profit is looking at their own board for the reason, and it
 * is on the other one — so the answer has to name a position, not just a card.
 */
export interface Standing<T> {
  /** Whatever `pick` pulled out of the restriction. */
  value: T;
  /** The card's name, for the sentence. */
  source: string;
  /** Which position is holding it up, on the board named by `mine`. */
  slot: number;
  /**
   * Whose board it is standing on.
   *
   * Every restriction pointed across the table until Serum, so four sentences in
   * this file said "is on the opponent's table" and were right by construction.
   * A lock that binds the player who played it is on THEIR OWN table, and a
   * refusal that sends them looking at the other board for a card that is on
   * theirs is worse than no explanation.
   */
  mine: boolean;
}

/**
 * The first restriction on the opponent's board that `pick` says yes to.
 *
 * Generic in what `pick` returns, which is not decoration: the tax rule needs a
 * number out of here and used to get it as a string, so priceFor did
 * `String(r.percent)` on the way in and `Number(tax)` on the way out. A number
 * that survives a round trip through text is a number waiting to come back as
 * NaN — and it would have come back as a price.
 *
 * `null` from `pick` means "not this one, keep looking", so a pick that can
 * legitimately return a falsy value must not use `0` or `""` to mean no.
 */
function restrictionOn<T>(
  state: State,
  player: Player,
  index: CardIndex,
  pick: (r: Restriction) => T | null,
): Standing<T> | null {
  // Your own mutual locks bind you first, and uptime does not lift them: they
  // are on your table, not theirs, and a key nobody can rotate is not a key you
  // can rotate either.
  const mine = state.players[player].projects;
  for (let slot = 0; slot < mine.length; slot++) {
    const position = mine[slot]!;
    const card = cardById(index, position.cardId);
    if (card.type !== "project" || !card.restriction || !card.mutual) continue;
    if (position.holders < card.holders) continue;
    const value = pick(card.restriction);
    if (value !== null) return { value, source: card.name, slot, mine: true };
  }

  // Nothing on their table binds a player who is holding uptime. Checked before
  // the search rather than inside it, so every restriction answers to it at once
  // and a new restriction kind cannot quietly be the one that still applies.
  for (const position of state.players[player].projects) {
    const card = cardById(index, position.cardId);
    if (card.type !== "project" || !card.uptime) continue;
    if (position.holders < card.holders) continue;
    return null;
  }

  const them = otherPlayer(player);
  const board = state.players[them].projects;
  for (let slot = 0; slot < board.length; slot++) {
    const position = board[slot]!;
    const card = cardById(index, position.cardId);
    if (card.type !== "project" || !card.restriction) continue;
    // Undamaged only. A standing rule holds while the position is untouched and
    // lifts the moment anything takes a holder off it — which is what stops a
    // card that switches tactics off from being a lock nobody holds the key to.
    // Healing back to full brings it back, because healHolders never goes past
    // the printed count and "untouched" is the same test either way.
    if (position.holders < card.holders) continue;
    const value = pick(card.restriction);
    if (value !== null) return { value, source: card.name, slot, mine: false };
  }
  return null;
}

/** "X is on your own table" or "on the opponent's table", whichever is true. */
function whoseTable(held: { source: string; mine: boolean }): string {
  return held.mine
    ? `${held.source} is on your own table`
    : `${held.source} is on the opponent's table`;
}

function takeProfit(state: State, player: Player, slot: number, index: CardIndex): void {
  // The same sentence the table puts under the button, because it is the same
  // refusal. These were two separate lists of conditions saying the same thing
  // in different words, which is how a screen and an engine start disagreeing
  // about a rule while both look right on their own.
  //
  // Whose turn it is and whether the match is over are checked by applyMove
  // before anything gets here, so those branches of whyNoProfit are unreachable
  // on this path — and harmless, since they refuse rather than allow.
  const no = whyNoProfit(state, player, index);
  if (no) throw new IllegalMove(no.reason);

  const projects = state.players[player].projects;
  if (!Number.isInteger(slot) || slot < 0 || slot >= projects.length) {
    throw new IllegalMove(`Position ${slot} does not exist; the portfolio holds ${projects.length}.`);
  }

  spendBudget(state, player, TURN_ACTION_COST, index);
  closePosition(state, player, slot, index, "TAKE PROFIT");
  // Only here. A position that rugs is not banked and neither is one replaced to
  // make room — the number means "you chose this", which is what every card
  // reading it is actually asking about.
  state.players[player].banked += 1;

  let paid = 0;
  for (const entry of state.players[player].support) {
    const aura = auraOf(cardById(index, entry.cardId));
    if (aura?.kind === "bankPays") paid += aura.mc;
  }
  if (paid > 0) {
    changeMC(state, player, paid, index);
    log(state, player, `Selling into it pays ${formatMC(paid)} on top.`, "pump");
  }
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

  // The same sentence the table puts under the ×, because it is the same
  // refusal. Whose turn it is and whether the match is over are checked by
  // applyMove before anything reaches here, so those branches are unreachable
  // on this path — and harmless, since they refuse rather than allow.
  const no = whyNoDiscard(state, player);
  if (no) throw new IllegalMove(no.reason);

  if (!Number.isInteger(handIndex) || handIndex < 0 || handIndex >= hand.length) {
    throw new IllegalMove(
      `Hand slot ${handIndex} does not exist (hand holds ${hand.length} cards).`,
    );
  }

  const card = cardById(index, hand[handIndex]!);
  hand.splice(handIndex, 1);
  {
    // The half-price mark travels with the card and dies when it leaves the hand.
    const mark = state.players[player].recovered.indexOf(card.id);
    if (mark !== -1) state.players[player].recovered.splice(mark, 1);
  }
  state.players[player].discard.push(card.id);
  spendBudget(state, player, TURN_ACTION_COST, index);
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
  const closed = removePosition(state, player, slot, "discard", index);
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
function chargeForWastedBudget(state: State, player: Player, index: CardIndex): void {
  const wasted = state.budgetThisTurn - state.budgetSpentThisTurn;
  if (wasted <= 0) return;

  const side = state.players[player];
  // The opponent's supporters can make idle money more expensive. One is the
  // identity, so a table with none of those cards on it charges exactly what it
  // always did.
  const times = upkeepFor(state, otherPlayer(player), index).wasteTimes;
  const charge = Math.round(wasted * WASTE_PENALTY * times);
  const taken = Math.min(side.mc, charge);
  if (taken <= 0) return;
  changeMC(state, player, -taken, index);
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

/**
 * The player who moves first. Always the same seat, decided by newMatch.
 *
 * Named rather than written as "you" at each site, because "you" is a seat and
 * moving first is a property of the seat. A reader who meets `player === "you"`
 * in a budget calculation has to go and find out why.
 */
export const FIRST_MOVER: Player = PLAYERS[0];

/**
 * Which seat opens the given turn.
 *
 * Derived from the turn number rather than kept in the state, so nothing has to
 * be serialised, replayed or migrated for it — a match is still its seed and its
 * moves. With RULES.alternateOpener off this is always the first mover, which is
 * how the game has always worked.
 */
export function openerOf(turn: number): Player {
  return RULES.alternateOpener && turn % 2 === 0 ? otherPlayer(FIRST_MOVER) : FIRST_MOVER;
}

/**
 * A turn's marketing budget for one player, before anything a card hands them.
 *
 * The first player gets RULES.firstMoveBudget more, every turn, which is what
 * pays for moving first — see the note on that constant for why it is paid a
 * turn at a time rather than as a lump at the start.
 *
 * One function rather than the addition written at both call sites. There are
 * two: the opening turn in newMatch and every turn after it in endTurn, and a
 * compensation that arrives on nine turns out of ten is the kind of thing that
 * measures almost right and reads entirely wrong.
 */
export function budgetFor(turn: number, player: Player): number {
  const ahead = player === FIRST_MOVER ? RULES.firstMoveBudget : 0;
  // Capped at the top of the ladder, which is what stops the last turn being
  // lopsided. Without it the first player's final turn grants $440K against
  // $400K, and $440K reaches combinations $400K cannot — a mythic and two epics
  // is exactly $440K, two legendaries and a rare is exactly $440K, and neither
  // fits in $400K. On the turn that decides the match, one seat could build
  // something the other could not afford at all, and it did: measured at 27.3%
  // of matches before the cap and 6.5% after, the remainder being budget handed
  // over by cards, which both seats can do.
  //
  // It costs nothing to take away. The first player wins 51.1% with the bonus on
  // every turn and 51.6% with it off the last one, which is the same number at
  // this sample size. So the run of the match is paid for and the final turn is
  // the same for both, which is the only turn a player counts.
  //
  // The cap applies to the second player too and never binds on them, which is
  // deliberate: read as written it says nobody's turn budget goes past the top
  // of the ladder, rather than making the first seat a special case twice.
  return Math.min(budgetForTurn(turn) + ahead, budgetForTurn(RULES.turns));
}

/**
 * Why this player cannot throw a card away right now, or null when they can.
 *
 * The same treatment take profit got, and for the same complaint: the × on a
 * card was hidden whenever the move was refused, so the mechanic simply was not
 * there and nothing said why. Discarding is the cheaper case — every reason it
 * can give is already visible somewhere on the screen, in the budget bar or in
 * the hand — but "the player could have worked it out" has never been a good
 * enough answer here, and it is the reason nobody notices the number they are
 * short by.
 *
 * Ordered the way whyNoProfit is: the reason you can do something about first.
 * An empty hand is a fact about the hand you are looking at, so the budget goes
 * above it — that is the one carrying a figure worth reading.
 */
export function whyNoDiscard(state: State, player: Player): Refusal | null {
  if (state.finished) return { reason: "The match is over.", blocking: null };
  if (state.toMove !== player) return { reason: "Not your turn.", blocking: null };

  const spare = state.budgetThisTurn - state.budgetSpentThisTurn;
  if (spare < TURN_ACTION_COST) {
    return {
      reason:
        `Throwing a card away costs ${formatMC(TURN_ACTION_COST)} of marketing ` +
        `budget and ${formatMC(spare)} is left this turn.`,
      blocking: null,
    };
  }

  if (state.players[player].hand.length === 0) {
    return { reason: "Your hand is empty, so there is nothing to throw away.", blocking: null };
  }

  return null;
}

/**
 * Is there room in the turn to throw a card away, and a card to throw?
 *
 * Derived, never re-stated — see canTakeProfit for the argument. This one had a
 * second copy of its conditions inside discard() as well, worded differently,
 * which is how a screen and an engine start disagreeing about a rule while both
 * look right on their own.
 */
export function canDiscard(state: State, player: Player): boolean {
  return whyNoDiscard(state, player) === null;
}

/**
 * Why a move is refused, in words a table can put under the control.
 *
 * A boolean was the whole answer for both of the moves below, and a table can
 * do only one thing with a boolean: take the control away. Nothing was wrong
 * with either rule — you genuinely could not bank, you genuinely could not
 * throw a card away — but a control that vanishes is not a refusal, it is a
 * disappearance. It reads as "this game does not have that", and it left the
 * maker looking at his own board for a reason sitting on the other one.
 *
 * The sentence is written here rather than on either table. There are two
 * tables, they have disagreed about one of these rules before — see the note on
 * OwnView.canTakeProfit — and a reason phrased twice is a reason that will
 * eventually be phrased differently.
 *
 * `blocking` is the part a sentence cannot carry: which of the opponent's
 * positions is holding the rule up, so the screen can point at it. It is null
 * when the refusal is nobody's doing, and for now that is every refusal
 * discarding can produce — the field stays because a restriction that switched
 * discarding off would need it and would otherwise have nowhere to say so.
 */
export interface Refusal {
  reason: string;
  /** The opponent's position holding a rule up, when a card is the reason. */
  blocking: { source: string; slot: number } | null;
}

/** Why this player cannot take profit right now, or null when they can. */
export function whyNoProfit(state: State, player: Player, index: CardIndex): Refusal | null {
  if (state.finished) return { reason: "The match is over.", blocking: null };
  if (state.toMove !== player) return { reason: "Not your turn.", blocking: null };

  if (state.players[player].projects.length === 0) {
    return {
      reason: "You hold no positions, so there is nothing to close.",
      blocking: null,
    };
  }

  // The index is required rather than optional. A restriction that only applies
  // when the caller happens to pass an argument is a rule that fails silently
  // for anyone who forgets, and the bot forgetting it would mean proposing a
  // move that throws in the middle of a simulation.
  const locked = restrictionOn(state, player, index, (r) =>
    r.kind === "banTakeProfit" ? true : null,
  );
  if (locked) {
    return {
      reason:
        `${whoseTable(locked)}. There is no way out of a ` +
        `position while it holds — take a holder off it and the lock lifts.`,
      blocking: { source: locked.source, slot: locked.slot },
    };
  }

  // Budget last, deliberately. It is the reason that clears by itself next turn,
  // and a player told "you cannot afford it" would stop reading — while the
  // rule above is the one they need to do something about.
  const spare = state.budgetThisTurn - state.budgetSpentThisTurn;
  if (spare < TURN_ACTION_COST) {
    return {
      reason:
        `Taking profit costs ${formatMC(TURN_ACTION_COST)} of marketing budget ` +
        `and ${formatMC(spare)} is left this turn.`,
      blocking: null,
    };
  }

  return null;
}

/**
 * May this player bank a position right now?
 *
 * Derived, never re-stated. Two lists of conditions that have to agree is one
 * list that will stop agreeing, and the version of this that spelled the rule
 * out a second time is exactly how the PvP table ended up with a button the
 * engine refused.
 */
export function canTakeProfit(state: State, player: Player, index: CardIndex): boolean {
  return whyNoProfit(state, player, index) === null;
}

function endTurn(state: State, player: Player, index: CardIndex): void {
  tickPhase(state, player, index);
  pumpPhase(state, player, index);
  standingPhase(state, player, index);
  duePhase(state, player, index);
  chargeForWastedBudget(state, player, index);

  // Both players have gone once play comes back round to whoever opened the
  // turn. That used to be written as `next === "you"`, which is the same test
  // while one seat opens every turn and quietly the wrong one as soon as they
  // take it in turns.
  const next = otherPlayer(player);
  state.toMove = next;

  if (next === openerOf(state.turn)) {
    state.turn += 1;
    if (state.turn > RULES.turns) {
      finish(state);
      return;
    }
    state.toMove = openerOf(state.turn);
  }
  const mover = state.toMove;

  state.budgetSpentThisTurn = 0;
  state.playsThisTurn = 0;
  // Agents with keys. Granted here rather than banked, so a position knocked off
  // its holders stops trading the same turn, and set rather than added so an
  // unused one never carries into tomorrow.
  state.freePlays[mover] = agentsFor(state, mover, index);
  // Anything the opponent handed them lands here, at the one moment the budget
  // is set. Cleared as it is taken, so a grant is spent once and a replay from
  // the same seed and moves lands on the same number.
  const granted = state.players[mover].pendingBudget;
  state.players[mover].pendingBudget = 0;
  // Standing auras pay here, at the one moment the budget is set. Read fresh
  // rather than banked, so cancelling somebody's supporter stops the income the
  // same turn.
  const upkeep = upkeepFor(state, mover, index);
  // What the other side's supporters are doing to this player, read fresh off
  // the table so cancelling a card stops it the same turn.
  const against = upkeepFor(state, player, index);
  // Floored at nothing. A grant can be negative — a card that takes budget off
  // the other side rather than handing it over — and a turn with a budget below
  // zero would refuse every play and then charge nothing for the waste, which is
  // two wrong answers rather than one.
  state.budgetThisTurn = Math.max(
    0,
    budgetFor(state.turn, mover) + granted + upkeep.budget + against.gift,
  );
  if (against.gift > 0) {
    log(
      state,
      mover,
      `${formatMC(against.gift)} of somebody else's marketing budget, and it still has to go somewhere.`,
      "dump",
    );
  }
  if (upkeep.budget > 0) {
    log(state, mover, `${formatMC(upkeep.budget)} of standing marketing budget.`, "pump");
  }
  if (granted > 0) {
    log(
      state,
      mover,
      `${formatMC(granted)} of somebody else's marketing budget arrives, and it has to go somewhere.`,
      "dump",
    );
  }
  healUpkeep(state, mover, index, upkeep.heal);
  stripUpkeep(state, mover, index, against.strip);
  burnUpkeep(state, mover, against.burn);
  drawToFull(state, mover, RULES.handSize);
  // On top of the refill, not into it. A cap only pays when the hand is against
  // it, which it is on 38% of moves; a draw pays every time.
  if (upkeep.draw > 0) draw(state, mover, upkeep.draw);
}

/**
 * Holders back on every damaged position, capped at what the card started with.
 *
 * Silent when there is nothing to repair, which is most turns — a log line every
 * turn saying nothing happened is how a log stops being read.
 */
/**
 * Holders off one of this player's positions, picked with the state's own PRNG.
 *
 * Through nextInt and state.rngState, so the pick is part of the state and a
 * match replays from its seed and its moves exactly as it was played. There is
 * no hidden randomness in this engine and this is not the first of it.
 *
 * A separate roll per holder, so two holders can land on two positions. Chipping
 * one board is a different thing from chipping the board.
 */
function stripUpkeep(state: State, player: Player, index: CardIndex, holders: number): void {
  if (holders <= 0) return;
  for (let i = 0; i < holders; i++) {
    const positions = state.players[player].projects;
    if (positions.length === 0) return;
    const roll = nextInt(positions.length, state.rngState);
    state.rngState = roll.state;
    const hit = positions[roll.value]!;
    const card = projectById(index, hit.cardId);
    hit.holders -= 1;
    // Counted here as well as in damageHolders. Two places take holders off and
    // both have to say so, or a card that pays for the wreckage would quietly
    // miss half of it.
    state.holdersLost += 1;
    if (hit.holders <= 0) {
      removePosition(state, player, roll.value, "discard", index);
      log(state, player, `${card.name} loses its last holder and rugs.`, "dump");
    } else {
      log(state, player, `${card.name} loses a holder.`, "dump");
    }
  }
}

/** Cards out of this player's hand, picked the same way and for the same reason. */
function burnUpkeep(state: State, player: Player, cards: number): void {
  for (let i = 0; i < cards; i++) {
    const hand = state.players[player].hand;
    if (hand.length === 0) return;
    const roll = nextInt(hand.length, state.rngState);
    state.rngState = roll.state;
    const [gone] = hand.splice(roll.value, 1);
    if (gone) {
      state.players[player].discard.push(gone);
      log(state, player, `A card goes out of your hand.`, "dump");
    }
  }
}

function healUpkeep(state: State, player: Player, index: CardIndex, holders: number): void {
  if (holders <= 0) return;
  let mended = 0;
  for (const held of state.players[player].projects) {
    const card = projectById(index, held.cardId);
    const before = held.holders;
    held.holders = Math.min(card.holders, held.holders + holders);
    mended += held.holders - before;
  }
  if (mended > 0) {
    log(state, player, `${mended} ${mended === 1 ? "holder comes" : "holders come"} back.`, "pump");
  }
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
  changeMC(state, player, total, index);
  log(
    state,
    player,
    `PUMP ${formatMC(total)} across ${plural(projects.length, "project", "projects")} — ${formatMC(state.players[player].mc)} MC total.`,
    "pump",
  );
}

/**
 * Every standing project effect on this player's board, fired once.
 *
 * After the pump rather than before it, so a card that both pumps and takes is
 * read in the order the board is: your projects earn, then what stands on them
 * does its work. The order is only visible on a card that scales with market
 * cap, and this is the one that matches the log.
 *
 * The undamaged test is `restrictionOn`'s, written out again rather than shared
 * because that one walks the opponent's board looking for a rule and this one
 * walks your own looking for an effect. Same sentence, opposite directions.
 */
function standingPhase(state: State, player: Player, index: CardIndex): void {
  const board = state.players[player].projects;
  for (let slot = 0; slot < board.length; slot++) {
    const position = board[slot]!;
    const card = cardById(index, position.cardId);
    if (card.type !== "project" || !card.standing) continue;
    // Damage closes the tap, healing back to full opens it again — the same test
    // and the same reason as a standing rule: a card that goes on working after
    // it has been answered is a card there is no answer to.
    if (position.holders < card.holders) continue;
    applyEffect(state, card.standing, player, card, undefined, index);
  }
}

/**
 * Everything hung on this player's positions, fired once.
 *
 * Before the pump rather than after it, so a position somebody has left to rot
 * pays the number it has rotted to. A tick that fires after the payout would
 * have the first turn of a decay cost nothing, which is a turn of grace nothing
 * on the card mentions.
 *
 * Back to front, because a tick can take the last of a position and removing one
 * shifts every slot after it.
 */
function tickPhase(state: State, player: Player, index: CardIndex): void {
  const board = state.players[player].projects;
  for (let slot = board.length - 1; slot >= 0; slot--) {
    const position = board[slot];
    if (!position?.ticks?.length) continue;
    for (const tick of position.ticks) {
      // Still there? An earlier tick on the same position can have taken it.
      if (state.players[player].projects[slot] !== position) break;
      applyEffect(
        state,
        onThisPosition(tick.effect),
        // The board owner, not whoever hung it. A position can change hands —
        // takeOver moves one across the table and its marks go with it — and a
        // tick resolved from the attacher's point of view then counts a slot on
        // a board that position is no longer standing on. It crashed exactly
        // there: "points at project 5, but you has 5".
        player,
        cardById(index, tick.cardId),
        slot,
        index,
      );
    }
  }
}

/**
 * A tick's effect, aimed at the position it is standing on.
 *
 * Resolved as the board owner, so from here the position is always one of
 * theirs whoever hung the mark. A decay somebody attached to your board still
 * decays your position — which is the point of it — and it goes on doing that if
 * the position ever changes hands.
 */
function onThisPosition(effect: Effect): Effect {
  if ("target" in effect && (effect.target === "ownProject" || effect.target === "enemyProject")) {
    return { ...effect, target: "ownProject" } as Effect;
  }
  return effect;
}

/**
 * Everything this player set going that has come due.
 *
 * At the end of their own turn, so a card played on turn three with two turns on
 * it resolves at the end of turn five — the other player has had two turns in
 * between to do something about it, which is the whole point of a card that
 * waits.
 *
 * A mark is looked up by project rather than kept as a slot, so it finds the
 * position wherever it has moved to and finds nothing when the position is gone.
 * `ifGone` is what happens then; without one, a mark on something that is no
 * longer there simply says so and passes.
 */
function duePhase(state: State, player: Player, index: CardIndex): void {
  const due = state.pending.filter((p) => p.owner === player && p.onTurn <= state.turn);
  if (due.length === 0) return;
  state.pending = state.pending.filter((p) => !due.includes(p));

  for (const item of due) {
    const source = cardById(index, item.cardId);
    let slot: number | undefined;
    if (item.mark) {
      slot = state.players[item.mark.player].projects.findIndex((position) => {
        const card = cardById(index, position.cardId);
        return card.type === "project" && card.project === item.mark!.project;
      });
      if (slot === -1) {
        if (item.ifGone) {
          log(state, player, `${cardLabel(source)}: it was gone in time.`, "pump");
          applyEffect(state, item.ifGone, player, source, undefined, index);
        } else {
          log(
            state,
            player,
            `${cardLabel(source)}: what it was marking is no longer on the table.`,
            "neutral",
          );
        }
        continue;
      }
    }
    log(state, player, `${cardLabel(source)}: it comes due.`, "dump");
    applyEffect(state, item.effect, player, source, slot, index);
  }
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



/**
 * What an aura does at the top of a turn, beyond any pump.
 *
 * Split by whose side it lands on, because half of these reach across the table
 * and a field named `budget` that sometimes means the opponent's is the kind of
 * ambiguity that ends up paying the wrong player. Yours are read on your turn;
 * theirs are read off your supporters and applied to them on their turn.
 */
export interface AuraUpkeep {
  /** Yours: extra marketing budget. */
  budget: number;
  /** Yours: extra cards drawn on top of the refill. */
  draw: number;
  /** Yours: holders returned to each damaged position. */
  heal: number;
  /** Yours: extra portfolio positions you may hold. */
  positions: number;
  /** Theirs: marketing budget handed over — a gift that is an attack. */
  gift: number;
  /** Theirs: holders stripped from a position picked at random. */
  strip: number;
  /** Theirs: cards destroyed out of hand, picked at random. */
  burn: number;
  /** Theirs: multiplier on what unspent budget costs them. One leaves it alone. */
  wasteTimes: number;
}

/**
 * The second half of what an aura is, beside auraOn.
 *
 * Two functions rather than one because they are asked at different moments and
 * with different arguments — auraOn is per position, this is once per turn — but
 * both are exhaustive over the same union on purpose. A new kind cannot be added
 * without saying, in both places, what it does to a position and what it hands
 * over at the top of a turn. Either answer may be nothing; neither may be
 * silence.
 */
export function auraUpkeep(aura: Aura): AuraUpkeep {
  const none = { budget: 0, draw: 0, heal: 0, positions: 0, gift: 0, strip: 0, burn: 0, wasteTimes: 1 };
  switch (aura.kind) {
    case "pumpSector":
    case "championProjects":
      return none;
    case "budgetEachTurn":
      return { ...none, budget: aura.budget };
    case "morePositions":
      return { ...none, positions: aura.positions };
    case "giftBudget":
      return { ...none, gift: aura.budget, wasteTimes: aura.times };
    case "punishWaste":
      return { ...none, wasteTimes: aura.times };
    case "stripHolders":
      return { ...none, strip: aura.holders };
    case "burnHand":
      return { ...none, burn: aura.cards };
    case "drawEachTurn":
      return { ...none, draw: aura.cards };
    case "healEachTurn":
      return { ...none, heal: aura.holders };
    case "bankPays":
      // Nothing at the top of a turn. This one fires on a move, not on a clock.
      return none;
    default:
      return assertNever(aura, "auraUpkeep");
  }
}

/** Everything this player's support row hands them at the top of a turn. */
export function upkeepFor(state: Boards, player: Player, index: CardIndex): AuraUpkeep {
  const total: AuraUpkeep = {
    budget: 0, draw: 0, heal: 0, positions: 0, gift: 0, strip: 0, burn: 0, wasteTimes: 1,
  };
  for (const entry of state.players[player].support) {
    const aura = auraOf(cardById(index, entry.cardId));
    if (!aura) continue;
    const one = auraUpkeep(aura);
    total.budget += one.budget;
    total.draw += one.draw;
    total.heal += one.heal;
    total.positions += one.positions;
    total.gift += one.gift;
    total.strip += one.strip;
    total.burn += one.burn;
    // Multipliers compound; one is the identity, so two of them is four times.
    total.wasteTimes *= one.wasteTimes;
  }
  return total;
}

/**
 * How many positions this player may hold.
 *
 * Read from the board rather than from RULES, because an aura can raise it. The
 * three places that ask are the two that enforce the cap and the line that tells
 * the player why they cannot play — and that last one matters: a card that
 * raised the limit while the message still said six would be the game lying
 * about its own rule.
 */
export function portfolioSizeFor(state: Boards, player: Player, index: CardIndex): number {
  return (
    RULES.portfolioSize + upkeepFor(state, player, index).positions + roomFrom(state, player, index)
  );
}

/**
 * Extra positions granted by projects on this player's own board.
 *
 * Undamaged only, like every other standing thing. A damaged one puts the player
 * over their own limit, which is not an error — the next card they play simply
 * has to close something first, and that is the answer to the card.
 */
function roomFrom(state: Boards, player: Player, index: CardIndex): number {
  let extra = 0;
  for (const position of state.players[player].projects) {
    const card = cardById(index, position.cardId);
    if (card.type !== "project" || !card.morePositions) continue;
    if (position.holders < card.holders) continue;
    extra += card.morePositions;
  }
  return extra;
}

/** How many cards this player draws at the top of a turn, beyond the refill. */
export function extraDrawFor(state: Boards, player: Player, index: CardIndex): number {
  return upkeepFor(state, player, index).draw;
}

/**
 * What this aura would add per turn if it were played onto this board now.
 *
 * For the bot, which has to price a supporter before it is on the table and
 * cannot use auraWorth. Both halves of every kind, through auraOn, so a kind it
 * has never heard of is still valued rather than scored at nothing.
 *
 * Ignores the holders proportion, deliberately: this is an estimate for a
 * decision, not a payout, and a damaged position is worth less to keep either
 * way.
 */
export function auraWouldPay(
  state: State,
  player: Player,
  aura: Aura,
  index: CardIndex,
): number {
  let total = 0;
  for (const held of state.players[player].projects) {
    const card = projectById(index, held.cardId);
    const on = auraOn(aura, card);
    total += on.add + (card.pumpMC + held.extraPump) * (on.times - 1);
  }
  return total;
}

/**
 * What this aura is worth on an empty board — its promise rather than its pay.
 *
 * Exhaustive on purpose. The bot adds half of this for the projects still to
 * come, and a new aura kind that returned nothing here would be a card the bot
 * declines on turn one and then never gets a reason to reconsider.
 */
export function auraFloor(aura: Aura): number {
  switch (aura.kind) {
    case "pumpSector":
      return aura.bonus;
    case "championProjects":
      // The flat half only. A multiplier needs a specific family on the table
      // and guessing that one is coming is how a bot talks itself into a card.
      return aura.bonus;
    case "healEachTurn":
    case "bankPays":
      return aura.bonus;
    case "budgetEachTurn":
    case "drawEachTurn":
    case "morePositions":
    case "giftBudget":
    case "punishWaste":
    case "stripHolders":
    case "burnHand":
      // Nothing, and not because they are worthless — because they are worth the
      // same whatever the board looks like, so there is no promise about
      // projects still to come. The bot prices them in auraWouldPay instead,
      // which asks what they are actually worth this turn.
      return 0;
    default:
      return assertNever(aura, "auraFloor");
  }
}

/**
 * What one aura is paying its owner per turn, on the board as it stands.
 *
 * The bot needs this to price `cancel`, and it used to work it out inline as
 * "bonus times the projects of that sector". That arithmetic is only true for an
 * aura that adds a flat amount to a sector — it reads `bonus` and `sector`
 * straight off the object, so a champion aura would not have compiled, and had
 * the fields merely been optional it would have valued every champion at zero
 * and cancelled them last. Asking pumpOf instead makes the answer true for any
 * aura, including ones not yet written.
 *
 * Measured by difference: what the board pays now, against what it would pay
 * with this supporter gone. That is the definition of what cancelling it is
 * worth, rather than a model of it.
 */
export function auraWorth(
  state: State,
  player: Player,
  supportSlot: number,
  index: CardIndex,
): number {
  const before = totalPump(state, player, index);
  const without: State = {
    ...state,
    players: {
      ...state.players,
      [player]: {
        ...state.players[player],
        support: state.players[player].support.filter((_, i) => i !== supportSlot),
      },
    },
  };
  return before - totalPump(without, player, index);
}

function totalPump(state: State, player: Player, index: CardIndex): number {
  let total = 0;
  for (let slot = 0; slot < state.players[player].projects.length; slot++) {
    total += pumpOf(state, player, slot, index);
  }
  return total;
}

/**
 * Would playing this card take over a position you already hold?
 *
 * Separate from needsPortfolioSlot: an upgrade never needs a slot, because it
 * replaces rather than adds. The screen wants to say "upgrades your BONK" rather
 * than "close a position first", and those are different sentences.
 */
export function upgradesAPosition(
  state: Boards,
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
  state: Boards,
  card: Card,
  player: Player,
  index: CardIndex,
): boolean {
  if (card.type !== "project") return false;
  if (state.players[player].projects.length < portfolioSizeFor(state, player, index)) return false;
  return !upgradesAPosition(state, card, player, index);
}

/** Does this card point at one project the player has to choose? If so, which kind of target. */
/**
 * How many cards this card wants in your discard, or null if it does not care.
 *
 * Two families are paid off that pile and nothing on either table showed the
 * number, so a player had a condition they could not check. The count is on the
 * board now and this is what tells it whether to read as met — one function, so
 * the solo table and the PvP table cannot disagree about a card's own rule.
 */
export function discardRequirementOf(card: Card): number | null {
  const when = card.payoff?.when;
  return when?.kind === "discardAtLeast" ? when.count : null;
}

export function targetRequirementOf(card: Card): ChoiceTarget | null {
  const effect = card.effect;
  if (!effect) return null;
  // Hanging something on a position is a choice about a position — unless it
  // hangs on a whole board, which chooses nothing.
  if (effect.kind === "attach") {
    return needsChoice(effect.target) ? effect.target : null;
  }
  // A timer asks for a position to mark, which is not the same thing as what its
  // effect will aim at when it comes due — and it is the mark the player is
  // choosing now. Without this the card would ask for nothing and then throw for
  // having been given nothing.
  if (effect.kind === "after") return effect.marks ?? null;
  if (!("target" in effect)) return null;
  // A player target is never a project choice, and neither is a missing one —
  // drawCards carries an optional target and leaving it out means "you".
  const target = effect.target;
  if (target === undefined || target === "self" || target === "opponent" || target === "both") {
    return null;
  }
  return needsChoice(target) ? target : null;
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
  const price = chargeFor(state, card, player, index);
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
    r.kind === "banType" && r.cardType === card.type ? true : null,
  );
  if (banned) {
    return `${whoseTable(banned)}, and nothing of type ${card.type} can be played while it holds.`;
  }

  // The same rule the play path enforces, so a card that cannot be placed is
  // dimmed rather than refused after the fact.
  if (card.type === "project" && state.players[player].projects.length >= portfolioSizeFor(state, player, index)) {
    const shut = restrictionOn(state, player, index, (r) => (r.kind === "banRoom" ? true : null));
    if (shut) {
      return (
        `${whoseTable(shut)} and your portfolio is full. ` +
        `Nobody is selling — take profit to open a slot.`
      );
    }
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
  // Switched on the object rather than on a copied kind. With one variant a copy
  // was the only way to make the default branch `never`; with two, narrowing is
  // what the switch is for, and a copy narrows nothing — every field access in
  // every branch stops compiling. The union having grown is what makes the
  // ordinary pattern work again.
  switch (aura.kind) {
    case "pumpSector":
      return `${aura.sector} pumps ${formatMC(aura.bonus)} more per turn`;
    case "budgetEachTurn":
      return `${formatMC(aura.budget)} more budget a turn`;
    case "drawEachTurn":
      return `${aura.cards} more ${aura.cards === 1 ? "card" : "cards"} a turn`;
    case "healEachTurn":
      return (
        `${aura.sector} pumps ${formatMC(aura.bonus)} more per turn, ` +
        `${aura.holders} ${aura.holders === 1 ? "holder" : "holders"} back a turn`
      );
    case "bankPays":
      return (
        `${aura.sector} pumps ${formatMC(aura.bonus)} more per turn, ` +
        `taking profit pays ${formatMC(aura.mc)}`
      );
    case "morePositions":
      return `${aura.positions} more ${aura.positions === 1 ? "position" : "positions"}`;
    case "giftBudget":
      return `their budget goes up ${formatMC(aura.budget)} a turn and waste costs them ${aura.times}x`;
    case "punishWaste":
      return `their wasted budget costs them ${aura.times} times as much`;
    case "stripHolders":
      return `${aura.holders} of their holders a turn`;
    case "burnHand":
      return `${aura.cards} out of their hand a turn`;
    case "championProjects":
      return (
        `${aura.sector} pumps ${formatMC(aura.bonus)} more per turn, ` +
        `${aura.tickers.join(", ")} ${timesWord(aura.times)}`
      );
    default:
      return assertNever(aura, "shortAura");
  }
}
