// The one place a position leaves the table.
//
// It was three. closePosition in match.ts handled taking profit and making room,
// the rug path spliced the array itself in effects.ts, and DEGODS' burn added a
// third when it was written. Nothing was wrong with any of them and that is the
// point: a fourth was going to be written the same way, and by then something
// would have needed to count how many positions a match has cost — which is
// exactly what happened.
//
// So this is scoreboard.ts's rule applied to the board instead of the score. A
// position comes off here or it does not come off, and a test greps the engine
// to keep it that way.

import { cardLabel, formatMC } from "./format";
import { log } from "./helpers";
import { changeMC } from "./scoreboard";
import type { BoardProject, Card, CardIndex, Player, State } from "./types";

/**
 * Take a position off the board and record that it happened.
 *
 * Returns the position, because every caller wants it: the take-profit path
 * banks what it earned, the rug path claws it back, the burn path fires it at
 * the other player. What they all share is that the table is one narrower
 * afterwards, and that is the part worth counting in one place.
 *
 * `to` is where the card itself lands. The discard for almost everything; the
 * hand for the one card that gives a project back rather than spending it.
 */
export function removePosition(
  state: State,
  player: Player,
  slot: number,
  to: "discard" | "hand" = "discard",
  index?: CardIndex,
): BoardProject {
  const position = state.players[player].projects.splice(slot, 1)[0];
  if (!position) {
    throw new Error(`No position in slot ${slot} for ${player} to remove.`);
  }
  state.players[player][to].push(position.cardId);

  // Anybody on this side holding a cut takes it, and takes it here because here
  // is where every departure passes. Read off the board after the position is
  // already gone, so a position never pays itself its own severance.
  if (index && position.earned > 0) {
    // Either board. The bot was holding the bag on the whole market, not only on
    // its owner's half of it — and on one side alone this paid 2.97 times a
    // match, which is a rule nobody would build around.
    const other: Player = player === "you" ? "opponent" : "you";
    for (const side of [player, other]) {
      for (const standing of state.players[side].projects) {
        const card = index.get(standing.cardId);
        if (!card || card.type !== "project" || !card.severance) continue;
        if (standing.holders < card.holders) continue;
        // A venue charges on somebody else's sale, not on its own. The bag
        // holder charges on every sale there is.
        if (card.severance.from === "theirs" && side === player) continue;

        const paid = Math.round((position.earned * card.severance.percentage) / 100);
        if (paid <= 0) continue;
        changeMC(state, side, paid, index);
        log(
          state,
          side,
          card.severance.from === "theirs"
            ? `${cardLabel(card as Card)}: their sale, your fee — ${formatMC(paid)} MC.`
            : `${cardLabel(card as Card)}: it was holding the bag — ${formatMC(paid)} MC back.`,
          "pump",
        );
      }
    }
  }
  // Both boards, all match. A family paid for what the match has cost should be
  // paid for the whole match rather than for its own half of it — the same
  // reasoning holdersLost is counted under.
  state.positionsGone += 1;
  return position;
}
