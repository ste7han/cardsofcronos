// Make a move.
//
// The engine decides, here, on the server. In Cards of Cronos the card check was
// a UI filter and a direct call could play anything; playInto goes through
// applyMoveAs, which refuses a move made out of turn as well as one that is
// illegal — and this is the only path a request reaches.
//
// An illegal move is a 400 with the engine's own sentence on it. Those sentences
// are written to be read by a player, and inventing a second vaguer one here
// would throw away the only explanation that knows what actually happened.

import { db, env, signedInWallet, UNAUTHORISED } from "@/lib/api";
import { playInto, seatOf, stateOf } from "@/engine/record";
import { CARDS } from "@/data/cards";
import { getMatch, saveMoves } from "@/lib/store";
import { settle } from "@/lib/finish";
import { viewFor } from "@/engine/view";
import { INDEX } from "@/lib/set";
import { IllegalMove, type Move } from "@/engine/types";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const body = await request.clone().json().catch(() => null);
  const { id, move } = (body ?? {}) as { id?: unknown; move?: unknown };
  if (typeof id !== "string" || !move || typeof move !== "object") {
    return Response.json({ error: "Which match, and what move?" }, { status: 400 });
  }

  const wallet = await signedInWallet(request);
  if (wallet === null) return UNAUTHORISED;

  const record = await getMatch(db(), id);
  if (!record) return Response.json({ error: "No such match." }, { status: 404 });

  const seat = seatOf(record, wallet);
  if (!seat) return Response.json({ error: "No such match." }, { status: 404 });

  let played;
  try {
    played = playInto(record, wallet, move as Move, Date.now(), CARDS, INDEX);
  } catch (error) {
    if (error instanceof IllegalMove) {
      return Response.json({ error: error.message }, { status: 400 });
    }
    throw error;
  }

  const state = stateOf(played, CARDS, INDEX);
  const now = Date.now();

  if (state.finished) {
    // settle writes the moves as well, under a WHERE that makes it happen once.
    // Two requests reach a finished match — the move that ends it and the
    // opponent's next poll — and a record incremented twice cannot be corrected.
    await settle(db(), played, state, now, {
      publisherKey: env().PUBLISHER_KEY,
      rpc: env().CRONOS_RPC,
      pvpFriendly: env().DISCORD_PVP_FRIENDLY,
      pvpRanked: env().DISCORD_PVP_RANKED,
    });
  } else {
    await saveMoves(db(), played.id, played.moves, played.deadline, null, played.armed);
  }

  return Response.json({ view: viewFor(state, seat, INDEX), deadline: played.deadline });
}
