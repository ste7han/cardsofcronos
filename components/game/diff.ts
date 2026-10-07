// What should visibly happen after a move.
//
// This reads the difference between two states, not the log. Deliberately:
// CLAUDE.md says "measure effect on the outcome, not on log lines", and that holds
// here just as much. If the presentation leaned on log text, rewording a sentence
// would become a silent bug in the animation.

import { formatDelta, formatMC } from "@/engine/format";
import type { Snapshot } from "@/engine/snapshot";
import type { Player } from "@/engine/types";
import { PLAYERS } from "@/engine/types";

export interface Marker {
  text: string;
  tone: "pump" | "dump";
  /** Should the card shake? Only on damage. */
  hit: boolean;
}

export interface Flash {
  /** Key is `${player}:${cardId}`. */
  projects: Record<string, Marker>;
  /** MC change per player, where there was one. */
  mc: Partial<Record<Player, number>>;
  /**
   * A position was taken from somebody, and what it cost them.
   *
   * ── WHY THIS IS NOT "A POSITION DISAPPEARED" ────────────────────────────────
   *
   * It was, and it fired on taking profit. Banking closes a position too, and so
   * does playing a bigger card over one — so the screen flashed red for the two
   * things a player does on purpose, which is how a warning stops being read.
   *
   * A rug is the one that takes the market cap back with it. That is the test
   * now: a position left AND its owner's market cap fell on the same move.
   * Banking does not move the number — the earnings were already paid out as
   * they were made — and neither does an upgrade, so neither trips this.
   *
   * Null when nothing was taken.
   */
  rug: { player: Player; lost: number } | null;
  /** The last line from the log, as a caption for the beat. */
  beat: string | null;
  beatTone: "pump" | "dump" | "neutral" | "system";
}

export const EMPTY_FLASH: Flash = {
  projects: {},
  mc: {},
  rug: null,
  beat: null,
  beatTone: "neutral",
};

/**
 * How long a marker stays up.
 *
 * Here rather than on either table, because both of them show these and a beat
 * that is one length on one screen and another length on the other is exactly
 * the kind of difference nobody reports and everybody feels.
 */
export const FLASH_MS = 1050;

export function key(player: Player, cardId: string): string {
  return `${player}:${cardId}`;
}

/**
 * What visibly changed between two moments.
 *
 * Takes Snapshots rather than States, which is what lets the PvP table have
 * these at all — it holds a PlayerView and may never hold a State, so for a
 * long time nothing rose off a card there and a hit looked like nothing
 * happening.
 *
 * The move is gone from the arguments and that is not a tidy-up. It was needed
 * for one branch, the pump phase, and the PvP table does not know what move the
 * opponent made — it polls and a new view arrives. A turn ending is visible in
 * the pair itself: toMove changed, and the player who ended it is the one who
 * held it. Reading the fact off the two moments rather than off a label is the
 * same discipline as reading the outcome rather than the log.
 */
export function makeFlash(before: Snapshot, after: Snapshot): Flash {
  const flash: Flash = { projects: {}, mc: {}, rug: null, beat: null, beatTone: "neutral" };

  for (const player of PLAYERS) {
    const mcDelta = after.players[player].mc - before.players[player].mc;
    if (mcDelta !== 0) flash.mc[player] = mcDelta;

    const earlier = new Map(before.players[player].projects.map((p) => [p.cardId, p]));
    const now = new Map(after.players[player].projects.map((p) => [p.cardId, p]));

    // What left, and what it had made. `earned` is the launch plus every pump a
    // position ever paid out, which is exactly what a rug claws back — so this
    // is the figure to show rather than the move's net, which also carries the
    // turn's pump and whatever else landed.
    let taken = 0;
    for (const [cardId, position] of earlier) {
      if (!now.has(cardId)) taken += position.earned;
    }
    // Only when it cost them. See the note on Flash.rug: banking and upgrading
    // both remove a position and neither takes the market cap back.
    if (taken > 0 && mcDelta < 0) flash.rug = { player, lost: taken };

    for (const [cardId, project] of now) {
      const old = earlier.get(cardId);
      if (!old) continue; // Newly on the table: the landing animation covers that.

      const holdersDelta = project.holders - old.holders;
      const pumpDelta = project.extraPump - old.extraPump;

      if (holdersDelta < 0) {
        flash.projects[key(player, cardId)] = {
          text: `${holdersDelta} holder${holdersDelta === -1 ? "" : "s"}`,
          tone: "dump",
          hit: true,
        };
      } else if (holdersDelta > 0) {
        flash.projects[key(player, cardId)] = {
          text: `+${holdersDelta} holder${holdersDelta === 1 ? "" : "s"}`,
          tone: "pump",
          hit: false,
        };
      } else if (pumpDelta !== 0) {
        flash.projects[key(player, cardId)] = {
          text: `${formatDelta(pumpDelta)}/turn`,
          tone: pumpDelta > 0 ? "pump" : "dump",
          hit: false,
        };
      }
    }
  }

  // The pump phase: ending a turn adds each project's pump. That doesn't show up
  // as a difference on the project itself, so we fetch it here.
  if (before.toMove !== after.toMove) {
    const player = before.toMove;
    before.players[player].projects.forEach((project) => {
      const yield_ = project.pump;
      if (yield_ <= 0) return;
      flash.projects[key(player, project.cardId)] = {
        text: `+${formatMC(yield_)}`,
        tone: "pump",
        hit: false,
      };
    });
  }

  const newEntries = after.log.slice(before.log.length);
  const last = newEntries[newEntries.length - 1];
  if (last) {
    flash.beat = last.text;
    flash.beatTone = last.tone;
  }

  return flash;
}
