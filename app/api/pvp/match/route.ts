// One match, as the player asking is allowed to see it.
//
// viewFor and never the State. A State holds both hands, both decks and the seed
// — and the seed alone gives away every card either player is about to draw. The
// redaction is a type and not a filter for exactly that reason: a redacted State
// that still typechecks as a State is something somebody eventually passes to
// applyMove.

import { db, signedInWallet, UNAUTHORISED } from "@/lib/api";
import { catchUp, seatOf, stateOf } from "@/engine/record";
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

  const current = catchUp(record, Date.now(), CARDS, INDEX);
  if (current.moves.length !== record.moves.length) {
    await saveMoves(db(), current.id, current.moves, current.deadline, null);
  }

  const state = stateOf(current, CARDS, INDEX);
  // A match that ended on the clock rather than on a move has nobody to notice
  // it except the next person to look. Cheap and idempotent when it did not.
  await settle(db(), current, state, Date.now());

  return Response.json({
    id: current.id,
    mode: current.mode,
    stake: current.stake,
    opponent: current.seats[seat === "you" ? "opponent" : "you"],
    deadline: current.deadline,
    view: viewFor(state, seat, INDEX),
  });
}
