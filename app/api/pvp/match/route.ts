// One match, as the player asking is allowed to see it.
//
// viewFor and never the State. A State holds both hands, both decks and the seed
// — and the seed alone gives away every card either player is about to draw. The
// redaction is a type and not a filter for exactly that reason: a redacted State
// that still typechecks as a State is something somebody eventually passes to
// applyMove.

import { db, env, signedInWallet, UNAUTHORISED } from "@/lib/api";
import { arrive, catchUp, seatOf, stateOf } from "@/engine/record";
import { CARDS } from "@/data/cards";
import { getMatch, saveMoves } from "@/lib/store";
import { settle } from "@/lib/finish";
import { viewFor } from "@/engine/view";
import { INDEX } from "@/lib/set";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const body = await request.clone().json().catch(() => null);
  const id = (body as { id?: unknown } | null)?.id;
  if (typeof id !== "string") return Response.json({ error: "Which match?" }, { status: 400 });

  const wallet = await signedInWallet(request);
  if (wallet === null) return UNAUTHORISED;

  const record = await getMatch(db(), id);
  if (!record) return Response.json({ error: "No such match." }, { status: 404 });

  const seat = seatOf(record, wallet);
  // The same answer as a match that does not exist. Telling a stranger that a
  // match is real but not theirs is telling them what to go looking for.
  if (!seat) return Response.json({ error: "No such match." }, { status: 404 });

  const now = Date.now();
  const caught = catchUp(record, now, CARDS, INDEX);
  const state = stateOf(caught, CARDS, INDEX);

  // Turning up starts your own clock, and this is the only place that can know
  // you did: a match begins when the second player sits down, and the first one
  // may have walked away during the wait. Until they load the board the deadline
  // is the opening grace, which is a cap on the waiting and not a turn.
  //
  // `arrive` makes no move, so the state above is still this record's state.
  const current = (!state.finished && arrive(caught, seat, state.toMove, now)) || caught;

  if (current.moves.length !== record.moves.length || current.armed !== record.armed) {
    await saveMoves(db(), current.id, current.moves, current.deadline, null, current.armed);
  }
  // A match that ended on the clock rather than on a move has nobody to notice
  // it except the next person to look. Cheap and idempotent when it did not.
  await settle(db(), current, state, now, {
    publisherKey: env().PUBLISHER_KEY,
    rpc: env().CRONOS_RPC,
    pvpFriendly: env().DISCORD_PVP_FRIENDLY,
    pvpRanked: env().DISCORD_PVP_RANKED,
  });

  return Response.json({
    id: current.id,
    mode: current.mode,
    stake: current.stake,
    opponent: current.seats[seat === "you" ? "opponent" : "you"],
    deadline: current.deadline,
    // Whether that deadline is a turn or merely how long the match will wait.
    // The board counts down differently for the two, because a countdown on a
    // clock that has not started is a lie told once a second.
    armed: current.armed !== null,
    view: viewFor(state, seat, INDEX),
  });
}
