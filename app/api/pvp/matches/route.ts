// Your matches, enough of each to decide which to open.
//
// Whose turn it is comes from replaying the moves, not from a column. The match
// is the seed and the list of moves; anything else stored beside it is a second
// copy of the truth that can disagree with the first.

import { db, env, signedInWallet, UNAUTHORISED } from "@/lib/api";
import { catchUp, seatOf, stateOf } from "@/engine/record";
import { CARDS } from "@/data/cards";
import { matchesOf, saveMoves } from "@/lib/store";
import { settle } from "@/lib/finish";
import { INDEX } from "@/lib/set";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const wallet = await signedInWallet(request);
  if (wallet === null) return UNAUTHORISED;

  const now = Date.now();
  const records = await matchesOf(db(), wallet);

  const matches = [];
  for (const record of records) {
    // The clock is brought up to date on read, and written back when it moved.
    // A match nobody opens for three days has to have lost those turns by the
    // time somebody does, and there is no cron here to do it for them.
    const current = catchUp(record, now, CARDS, INDEX);
    if (current.moves.length !== record.moves.length) {
      await saveMoves(db(), current.id, current.moves, current.deadline, null);
    }

    const state = stateOf(current, CARDS, INDEX);
    await settle(db(), current, state, now, {
      publisherKey: env().PUBLISHER_KEY,
      rpc: env().CRONOS_RPC,
      pvpFriendly: env().DISCORD_PVP_FRIENDLY,
      pvpRanked: env().DISCORD_PVP_RANKED,
    });

    const seat = seatOf(current, wallet)!;
    const them = seat === "you" ? "opponent" : "you";

    matches.push({
      id: current.id,
      mode: current.mode,
      stake: current.stake,
      opponent: current.seats[them],
      turn: state.turn,
      yourTurn: state.toMove === seat && !state.finished,
      finished: state.finished,
      won: state.finished ? state.winner === seat : null,
      drawn: state.finished && state.winner === null,
      yourMC: state.players[seat].mc,
      theirMC: state.players[them].mc,
      deadline: current.deadline,
      createdAt: current.createdAt,
    });
  }

  return Response.json({ matches });
}
