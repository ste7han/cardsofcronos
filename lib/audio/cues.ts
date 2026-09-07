// What the table should SOUND like after a move.
//
// The same discipline as components/game/diff.ts, and for the same reason. That
// file reads the difference between two states rather than the log, because
// CLAUDE.md says to measure effect on the outcome and not on log lines, and
// because a reworded sentence must never become a silent bug in the animation.
// A reworded sentence must not become a silent bug in the sound either.
//
// So this reads snapshots. What it adds on top is the MOVE, which the flash
// deliberately does without: the PvP table polls and never learns what the
// opponent did, so a diff that needed a move could not serve it. Sound is
// different in exactly one way. Playing a card and throwing one away both take a
// card out of a hand, and telling them apart from two board states alone means
// guessing. The intent is the thing being heard, so the intent is passed in.
//
// Where a cue can be read off the boards, it is read off the boards. The move
// says what you meant; the snapshots say what happened.

import type { Snapshot } from "@/engine/snapshot";
import type { Move, Player } from "@/engine/types";

/**
 * Every sound the table can make. A CLOSED union, and that is the point.
 *
 * lib/audio/sfx.ts switches on this with a `never` check at the bottom, so a cue
 * added here without a sound is a type error rather than silence. That is the
 * first lesson in CLAUDE.md: in the last project an unknown name fell through to
 * "do nothing" while the log said it had fired, and 110 of 235 cards did
 * nothing. A sound that does nothing is a smaller failure than a card that does
 * nothing, and it is the same failure, so it gets the same treatment.
 */
export type Cue =
  // Things you do.
  | "card-played"
  | "card-discarded"
  | "profit-taken"
  | "turn-ended"
  | "draw"
  // Things that happen to a board.
  | "pump"
  | "damage"
  | "heal"
  | "rug"
  | "mc-up"
  | "mc-down"
  // The table itself.
  | "select"
  | "deny"
  | "match-won"
  | "match-lost"
  | "match-drawn";

/**
 * What to play for one move, in the order it should be heard.
 *
 * A move can be several sounds: playing a card that damages two positions and
 * lifts your market cap is a card landing, a hit, and a number going up. They
 * are stacked with small delays by the player rather than fired at once, so it
 * reads as a consequence instead of a chord.
 *
 * `seat` is whose ears these are. A hit on your own board and a hit on theirs
 * are the same event and not the same feeling, and the sound leans the way the
 * screen already does.
 */
export function cuesFor(
  before: Snapshot,
  after: Snapshot,
  move: Move | null,
  seat: Player = "you",
): Cue[] {
  const cues: Cue[] = [];
  const them: Player = seat === "you" ? "opponent" : "you";

  // The intent first, because it is what the hand did and it should land before
  // whatever it caused.
  if (move) {
    switch (move.kind) {
      case "playCard":
        cues.push("card-played");
        break;
      case "discard":
        cues.push("card-discarded");
        break;
      case "takeProfit":
        cues.push("profit-taken");
        break;
      case "endTurn":
        cues.push("turn-ended");
        break;
      default: {
        // A move kind with no sound is a compile error, not a quiet table.
        const never: never = move;
        throw new Error(`No cue for move ${JSON.stringify(never)}.`);
      }
    }
  }

  // A position leaving the board. Read on both sides: a rug is loud whoever it
  // happened to, because it is the thing this game is named after.
  const gone = (player: Player) =>
    before.players[player].projects.some(
      (p) => !after.players[player].projects.some((q) => q.cardId === p.cardId),
    );
  if (gone(seat) || gone(them)) cues.push("rug");

  // Holders, across every position that survived. Counted rather than flagged so
  // a move that heals one board and hits the other makes both sounds.
  let hurt = false;
  let healed = false;
  for (const player of [seat, them]) {
    const earlier = new Map(before.players[player].projects.map((p) => [p.cardId, p]));
    for (const now of after.players[player].projects) {
      const old = earlier.get(now.cardId);
      if (!old) continue; // Newly landed: that is card-played, already said.
      if (now.holders < old.holders) hurt = true;
      if (now.holders > old.holders) healed = true;
    }
  }
  if (hurt) cues.push("damage");
  if (healed) cues.push("heal");

  // The market cap. The pump phase is its own sound because it is the heartbeat
  // of a turn rather than the result of a card, and it is told apart the way the
  // flash tells it apart: the turn changed hands.
  const delta = after.players[seat].mc - before.players[seat].mc;
  const passed = before.toMove !== after.toMove;
  if (delta > 0) cues.push(passed ? "pump" : "mc-up");
  else if (delta < 0) cues.push("mc-down");

  return cues;
}

/**
 * The end of a match is NOT decided here, and that is not an oversight.
 *
 * A Snapshot has no `finished` flag. It is the public face of one moment —
 * boards, whose turn it is, what has been said — and both tables build one,
 * including the PvP table, which learns the match is over from its own view. A
 * function that tried to infer the end from two of these would be guessing, and
 * guessing at the one sound a player will remember.
 *
 * So the table calls it, from the state it actually holds. This is the cue to
 * use.
 */
export function endCue(winner: Player | null, seat: Player = "you"): Cue {
  if (winner === null) return "match-drawn";
  return winner === seat ? "match-won" : "match-lost";
}
