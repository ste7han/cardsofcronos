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
import { otherPlayer } from "./helpers";
import {
  canDiscard,
  canTakeProfit,
  needsPortfolioSlot,
  playable,
  pumpOf,
  targetRequirementOf,
  upgradesAPosition,
  whyNot,
} from "./match";
import { cardById } from "./helpers";
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
  canTakeProfit: boolean;
  discard: string[];
  projects: ViewProject[];
  support: BoardSupport[];
  pendingBudget: number;
  /** How many are left to draw, never which. */
  deckCount: number;
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
}

export interface PlayerView {
  /** Which side this view belongs to. A client should never have to guess. */
  me: Player;
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
    state.players[side].hand.map((id) => {
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

  return structuredClone({
    me: player,
    turn: state.turn,
    toMove: state.toMove,
    budgetThisTurn: state.budgetThisTurn,
    budgetSpentThisTurn: state.budgetSpentThisTurn,
    finished: state.finished,
    winner: state.winner,
    log: state.log,
    you: {
      mc: yours.mc,
      hand: yours.hand,
      playable: handOf(player),
      canDiscard: canDiscard(state, player),
      canTakeProfit: canTakeProfit(state, player, index),
      discard: yours.discard,
      projects: withPump(player),
      support: yours.support,
      pendingBudget: yours.pendingBudget,
      deckCount: yours.deck.length,
    },
    them: {
      mc: theirs.mc,
      projects: withPump(them),
      support: theirs.support,
      discard: theirs.discard,
      pendingBudget: theirs.pendingBudget,
      handCount: theirs.hand.length,
      deckCount: theirs.deck.length,
    },
  });
}
