// The public face of a match at one moment.
//
// There are two tables in this game and they were built from two different
// things. The solo table holds a State — both hands, both decks, the seed, the
// state of the PRNG — because it is the server as well as the client. The PvP
// table holds a PlayerView, which is a State with everything secret taken out,
// because a client handed a seed knows every card the opponent will ever draw.
//
// That difference is right and it is not going away. What was wrong is what
// grew on top of it: anything the presentation wanted had to be written against
// a State, so the PvP table simply did without. It had no hover preview and no
// rising numbers on a hit — not because PvP should not have them, but because
// the functions that make them asked for a type it is not allowed to hold.
//
// A Snapshot is what both of them can be reduced to, and it is exactly enough
// for a table to draw itself: market caps, positions with what each is paying,
// the support row, whose turn it is, and the log. Every field is something both
// players can already see on their own screen.
//
// The point is not the type. The point is that previewOf and makeFlash now take
// this, so there is one preview and one set of markers, and "does PvP do that
// too" stops being a question anybody has to ask.

import { pumpOf } from "./match";
import type {
  BoardProject,
  Boards,
  BoardSupport,
  CardIndex,
  LogEntry,
  Player,
  State,
} from "./types";
import type { PlayerView } from "./view";

/** A position, with what it is about to pay. See ViewProject, which is this. */
export interface SnapshotProject extends BoardProject {
  pump: number;
}

export interface SnapshotSide {
  mc: number;
  projects: readonly SnapshotProject[];
  support: readonly BoardSupport[];
}

/**
 * Boards, plus the two things a diff needs that a board does not carry: whose
 * turn it is, and what has been said. Extends Boards rather than repeating it,
 * so anything that takes Boards takes one of these — which is how previewOf
 * ends up serving both tables without knowing there are two.
 */
export interface Snapshot extends Boards {
  toMove: Player;
  log: readonly LogEntry[];
  players: Record<Player, SnapshotSide>;
}

/**
 * A snapshot of a State, as the solo table holds one.
 *
 * The pump is worked out here because a State does not carry it — it depends on
 * every aura on that side of the table, which is a rule. The solo table already
 * called pumpOf once per position to draw the tile; that call moves here rather
 * than being added, so this costs nothing it was not already paying.
 */
export function snapshotOfState(state: State, index: CardIndex): Snapshot {
  const sideOf = (player: Player): SnapshotSide => ({
    mc: state.players[player].mc,
    projects: state.players[player].projects.map((project, slot) => ({
      ...project,
      pump: pumpOf(state, player, slot, index),
    })),
    support: state.players[player].support,
  });

  return {
    toMove: state.toMove,
    log: state.log,
    players: { you: sideOf("you"), opponent: sideOf("opponent") },
  };
}

/**
 * A snapshot of a PlayerView, as the PvP table holds one.
 *
 * The view is written from one side — `you` and `them` — and a Snapshot is
 * written in the engine's terms, `you` and `opponent`, because everything that
 * reads one is engine code that thinks that way. `view.me` is the hinge: it
 * says which of the two the holder is, so nothing here has to guess.
 *
 * No pump is computed. The server already did it and put it on every
 * ViewProject, for the same reason the note in view.ts gives: a client working
 * it out for itself would be a second implementation of the rules.
 */
export function snapshotOfView(view: PlayerView): Snapshot {
  const mine: SnapshotSide = {
    mc: view.you.mc,
    projects: view.you.projects,
    support: view.you.support,
  };
  const theirs: SnapshotSide = {
    mc: view.them.mc,
    projects: view.them.projects,
    support: view.them.support,
  };

  // Both sides written out for each case rather than keyed by view.me. A record
  // built from a computed key needs a cast to typecheck, and a cast here would
  // be a promise that both sides got filled — which is the one thing worth
  // being sure of, since every reader indexes this without asking.
  return {
    toMove: view.toMove,
    log: view.log,
    players: view.me === "you" ? { you: mine, opponent: theirs } : { you: theirs, opponent: mine },
  };
}
