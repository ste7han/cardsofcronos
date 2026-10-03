// What one player is allowed to see.
//
// The server holds a State. A State holds both hands, both decks, the seed and
// the state of the PRNG — everything needed to replay the match, which is the
// point of it and also the reason it can never be sent to a client. The seed
// alone is enough to compute both shuffles, so a player handed one knows the
// opponent's whole deck order and every card they are about to draw themselves.
//
// So a client is sent a PlayerView instead, and the type is deliberately not a
// State and not shaped like one. A redacted State that still typechecks as a
// State is a thing somebody will eventually pass to applyMove, where an empty
// deck and a seed of zero are not an error — they are a quiet, wrong answer.
// Two different things get two different types.
//
// Nothing in here is a rule. It decides what is visible, never what is legal.

import type { BoardProject, BoardSupport, LogEntry, Player, State } from "./types";
import type { CardIndex } from "./types";
import { MARKETING_COST } from "./types";
import { otherPlayer } from "./helpers";
import {
  needsPortfolioSlot,
  priceFor,
  playable,
  pumpOf,
  targetRequirementOf,
  upgradesAPosition,
  whyNoDiscard,
  whyNoProfit,
  whyNot,
} from "./match";
import type { Refusal } from "./match";
import { cardById } from "./helpers";
import { budgetDeltaOf, mcDeltaOf } from "./preview";
import type { ChoiceTarget } from "./types";

/**
 * A position, with what it is about to pay.
 *
 * The pump is computed here rather than left to the client. It depends on every
 * aura on that side of the table, which is a rule, and a client that worked it
 * out for itself would be a second implementation of the rules — the exact thing
 * this engine is arranged to prevent. The number is public anyway: the solo
 * table prints it on every tile.
 */
export type ViewProject = BoardProject & { pump: number };

/**
 * What one card in your hand can do right now.
 *
 * Answered here for the same reason the pump is: the rules live in the engine,
 * the client has no State to run them against, and a client that worked any of
 * this out for itself would be a second implementation of the rules. In Cards of
 * Cronos the card check was a UI filter and a direct call could play anything —
 * the fix was not a better filter, it was that the screen stopped deciding.
 *
 * None of it is a secret. Every field is about your own hand and your own board,
 * both of which you can see.
 */
export interface HandCardView {
  id: string;
  canPlay: boolean;
  /** Why not, in the engine's own words, or the portfolio note when it is full. */
  reason: string | null;
  /**
   * What playing this would do to both market caps, or null when it is refused.
   *
   * The one thing on this table that genuinely cannot be worked out from a
   * view: mcDeltaOf answers by playing the move and looking at the difference,
   * so it needs the deck to draw from and the PRNG to draw with. Both are
   * secrets. It is answered here, where they exist, for the same reason
   * everything else on this type is.
   *
   * Which side is which is in engine terms, `you` and `opponent`, not the
   * holder's. PlayerView.me says which of the two the holder is.
   */
  mcDelta: { you: number; opponent: number } | null;
  /**
   * What this card costs to play, right now, for the player holding it.
   *
   * On the view rather than worked out from the card's rarity, for exactly the
   * reason freePlays is: a table that prices cards for itself is a second
   * implementation of the price. It was worked out from the rarity, and every
   * rule that moves a price — the discount a position grants, the tax the other
   * side charges, half off a card that came back out of the discard — was
   * invisible on the card face until the moment you played it.
   */
  price: number;
  /**
   * What playing this card does to the budget you have left this turn.
   *
   * `price` says what comes out; this says where you end up, and a card can do
   * both — Retardio costs $280K and leaves the budget $140K higher than it
   * found it. A table that subtracts `price` from the budget bar gets that card
   * exactly backwards, so the answer is worked out by playing the move.
   */
  budgetDelta: { spendable: number; price: number } | null;
  /** The printed price, so a table can show that a rule has moved it. */
  printedPrice: number;
  /** Which board this card asks you to point at, if any. */
  needsTarget: ChoiceTarget | null;
  /** A full portfolio does not block a project — it asks you to close one. */
  needsSlot: boolean;
  /** Takes over a position you already hold, and costs you nothing to place. */
  upgrades: boolean;
}

/**
 * Your own side, which is not the same as your whole PlayerState.
 *
 * The first version handed the player `state.players[player]` unchanged, which
 * put their own deck in the payload in draw order — every card they were about
 * to draw, in the order they were going to draw it. The rules do not give a
 * player that any more than they give them the opponent's hand, and it was
 * caught by a test written to look for exactly this on the other side of the
 * table. The obvious half of a redaction is the opponent; the half that ships
 * broken is your own.
 */
export interface OwnView {
  mc: number;
  hand: string[];
  /**
   * Cards you may still play without paying for them.
   *
   * One at the start of the match if you move first, none if you do not, and
   * that is the whole of what the two seats differ by — see
   * RULES.firstMoveFreeCard. On the view rather than worked out by the table,
   * because a table that decides for itself when a card is free is a second
   * implementation of the price, and the price is the rule that fires most.
   */
  freePlays: number;
  /** The same cards, with what the engine says about each. Aligned by index. */
  playable: HandCardView[];
  /**
   * May you throw a card away, and may you bank a position?
   *
   * Both are rules and both cost an action, so both depend on the budget as well
   * as on the board. The PvP table first worked one of them out for itself —
   * "you have a position, so you may take profit" — which is most of the rule
   * and not all of it, and the button appeared on turns where the engine would
   * have refused it. That is the whole argument for these two fields.
   */
  canDiscard: boolean;
  /** Why not. Beside the boolean for the same reason noProfit is — see below. */
  noDiscard: Refusal | null;
  canTakeProfit: boolean;
  /**
   * Why not, and which position is the reason.
   *
   * Beside the boolean rather than instead of it, because the two answer
   * different questions: canTakeProfit decides whether the button works,
   * noProfit decides what it says when it does not. Both come out of the same
   * call in the engine, so they cannot disagree.
   */
  noProfit: Refusal | null;
  discard: string[];
  projects: ViewProject[];
  support: BoardSupport[];
  pendingBudget: number;
  /** How many are left to draw, never which. */
  deckCount: number;
  /** Cards finished with. Two families are paid off it, so it has to be on the table. */
  finishedCount: number;
}

/** The opponent, as much of them as you are allowed to know. */
export interface OpponentView {
  mc: number;
  projects: ViewProject[];
  support: BoardSupport[];
  /** Face up once played, so it is public. */
  discard: string[];
  /** Budget waiting for their next turn. Public: a card said so out loud. */
  pendingBudget: number;
  /** How many cards they hold, never which. */
  handCount: number;
  /** How many are left to draw, never which. */
  deckCount: number;
  /** Cards finished with. Two families are paid off it, so it has to be on the table. */
  finishedCount: number;
}

export interface PlayerView {
  /** Which side this view belongs to. A client should never have to guess. */
  me: Player;
  /**
   * Free plays the opponent has left. Public: which seat moves first is on the
   * screen, and so is what that seat is owed for it.
   */
  theirFreePlays: number;
  turn: number;
  toMove: Player;
  budgetThisTurn: number;
  budgetSpentThisTurn: number;
  finished: boolean;
  winner: Player | null;
  log: LogEntry[];
  you: OwnView;
  them: OpponentView;
}

/**
 * The match as `player` may see it.
 *
 * Structured-cloned rather than referenced. A view that shares objects with the
 * server's State is a view a caller can mutate the match through, and "the UI
 * cannot change the rules" is the property this whole engine is arranged around.
 */
export function viewFor(state: State, player: Player, index: CardIndex): PlayerView {
  const handOf = (side: Player): HandCardView[] =>
    state.players[side].hand.map((id, handIndex) => {
      const card = cardById(index, id);
      const needsSlot = needsPortfolioSlot(state, card, side, index);

      /**
       * Why not, and never nothing.
       *
       * whyNot answers about the card and says nothing about whose turn it is —
       * the solo table has always put that in front of it, and this did not, so
       * every card sat dimmed with no explanation for as long as the opponent
       * was thinking. A card at forty percent opacity that will not say why is
       * the whole of "I suddenly could not play".
       */
      const reason = state.finished
        ? "The match is over."
        : state.toMove !== side
          ? "Not your turn."
          : (whyNot(state, card, side, index) ??
            (needsSlot
              ? "Portfolio is full — playing this asks you to close a position first."
              : null));

      return {
        id,
        canPlay: playable(state, card, side, index),
        reason,
        // The loop index, not indexOf(id). A deck holds one of each card so a
        // hand cannot repeat one today, and indexOf would have been right for
        // exactly as long as that stayed true — then quietly reported the first
        // copy's number for the second.
        //
        // Only for the side being asked about: running the opponent's hand
        // through applyMove answers a question nobody may ask.
        mcDelta: side === player ? mcDeltaOf(state, handIndex, index) : null,
        // Same rule as mcDelta: only for the side being asked. `price` above is
        // what the card takes; this is where the budget lands once whatever the
        // card hands back has landed too, which is not the same number and
        // cannot be worked out from the card face.
        budgetDelta: side === player ? budgetDeltaOf(state, handIndex, index) : null,
        price: priceFor(state, card, side, index),
        printedPrice: MARKETING_COST[card.rarity],
        needsTarget: targetRequirementOf(card),
        needsSlot,
        upgrades: upgradesAPosition(state, card, side, index),
      };
    });

  const withPump = (side: Player): ViewProject[] =>
    state.players[side].projects.map((project, slot) => ({
      ...project,
      pump: pumpOf(state, side, slot, index),
    }));

  const them = otherPlayer(player);
  const theirs = state.players[them];
  const yours = state.players[player];
  const noProfit = whyNoProfit(state, player, index);
  const noDiscard = whyNoDiscard(state, player);

  return structuredClone({
    me: player,
    turn: state.turn,
    toMove: state.toMove,
    budgetThisTurn: state.budgetThisTurn,
    budgetSpentThisTurn: state.budgetSpentThisTurn,
    finished: state.finished,
    winner: state.winner,
    log: state.log,
    theirFreePlays: state.freePlays[them] ?? 0,
    you: {
      mc: yours.mc,
      hand: yours.hand,
      freePlays: state.freePlays[player] ?? 0,
      playable: handOf(player),
      canDiscard: noDiscard === null,
      noDiscard,
      // One call, two fields. canTakeProfit(state, ...) is whyNoProfit === null
      // in the engine, so asking twice would cost a second walk of the board and
      // buy nothing; asking once and deriving both is the only arrangement in
      // which the button's enabled state and its explanation cannot disagree.
      canTakeProfit: noProfit === null,
      noProfit,
      discard: yours.discard,
      projects: withPump(player),
      support: yours.support,
      pendingBudget: yours.pendingBudget,
      deckCount: yours.deck.length,
      finishedCount: yours.discard.length,
    },
    them: {
      mc: theirs.mc,
      projects: withPump(them),
      support: theirs.support,
      discard: theirs.discard,
      pendingBudget: theirs.pendingBudget,
      handCount: theirs.hand.length,
      deckCount: theirs.deck.length,
      finishedCount: theirs.discard.length,
    },
  });
}

/**
 * What somebody watching sees, which is neither player's view.
 *
 * ── WHY THIS IS ITS OWN TYPE AND NOT A PLAYERVIEW WITH BITS REMOVED ──────────
 *
 * A spectator must not see a hand. Not the one belonging to the side they are
 * rooting for, not either. On a ranked match somebody who can read a hand can
 * tell the other player what is coming, and that is not spying on a game, it is
 * taking money off the person holding those cards.
 *
 * So this does not build a PlayerView and delete things: it has no field a hand
 * could be put in. `OwnView` carries `hand`, `playable`, and the rest of what
 * only you may know; a watcher gets two `OpponentView`s, which carry counts.
 * Redaction that happens by shape cannot be forgotten in a later edit, and this
 * file has already had the other kind go wrong — see the note on OwnView, where
 * a player was handed their own deck in draw order.
 */
export interface WatchView {
  turn: number;
  toMove: Player;
  finished: boolean;
  winner: Player | null;
  /** Public from the moment it happens: both players already see all of it. */
  log: LogEntry[];
  /** The seat that opened the match, as the match itself names them. */
  you: OpponentView;
  opponent: OpponentView;
}

/**
 * Both sides, as the other side sees them.
 *
 * `budgetThisTurn` is left out on purpose. It belongs to whoever is moving, and
 * handing it over says how much they have left to spend before they have spent
 * it — which is the one public-looking number that tells you what somebody is
 * about to be able to do.
 */
export function watchView(state: State, index: CardIndex): WatchView {
  const side = (player: Player): OpponentView => {
    const them = state.players[player];
    return {
      mc: them.mc,
      projects: them.projects.map((project, slot) => ({
        ...project,
        pump: pumpOf(state, player, slot, index),
      })),
      support: them.support,
      discard: them.discard,
      pendingBudget: them.pendingBudget,
      handCount: them.hand.length,
      deckCount: them.deck.length,
      finishedCount: them.discard.length,
    };
  };

  return structuredClone({
    turn: state.turn,
    toMove: state.toMove,
    finished: state.finished,
    winner: state.winner,
    log: state.log,
    you: side("you"),
    opponent: side("opponent"),
  });
}
