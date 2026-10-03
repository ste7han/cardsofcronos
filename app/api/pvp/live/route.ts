// The matches anybody may look in on.
//
// Everybody's, not one player's, and open without a wallet — a spectator page
// nobody can find is a URL you have to be sent, which is not a feature.
//
// What goes out is the shape of each match and not its state: who is playing,
// how far along, what is at stake. Reading one is /api/pvp/watch, where the
// redaction lives. This list could not leak a hand because it never asks for one.

import { db } from "@/lib/api";
import { CARDS } from "@/data/cards";
import { stateOf } from "@/engine/record";
import { watchableMatches } from "@/lib/store";
import { INDEX } from "@/lib/set";

export const dynamic = "force-dynamic";

export async function GET() {
  const records = await watchableMatches(db());

  return Response.json({
    matches: records.map((record) => {
      // Replayed to get the score, which is the one thing that makes a row worth
      // clicking. Sixty-six moves through the engine is nothing, and it is the
      // same work /api/pvp/watch does for one.
      const state = stateOf(record, CARDS, INDEX);
      return {
        id: record.id,
        mode: record.mode,
        stake: record.stake,
        seats: record.seats,
        turn: state.turn,
        finished: state.finished,
        // Named by seat rather than by address: the page shows both, and which
        // of the two is "you" means nothing to somebody who is neither.
        winner: state.winner,
        mc: { you: state.players.you.mc, opponent: state.players.opponent.mc },
        startedAt: record.createdAt,
      };
    }),
  });
}
