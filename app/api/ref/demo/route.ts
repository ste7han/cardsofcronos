// A finished demo match, handed over to be checked.
//
// The seed and the moves and nothing else — the same thing a PvP match is stored
// as. The server rebuilds both decks from the seed and replays every move, so
// what it verifies is that a whole legal match happened, not that somebody said
// one did. A "I finished the demo" flag with nothing behind it would be a bar
// that only stops people who were not trying to get past it.
//
// Being honest about how strong this is: a determined farmer can script a
// simulation of a ten-turn match, because the engine is public and so is the
// deck. What it costs them is a working simulation, not a POST. The account
// linking is what actually makes a referral expensive; this makes sure the
// person referred at least met the game.

import { db, signedInWallet, UNAUTHORISED } from "@/lib/api";
import { applyMove, newMatch } from "@/engine/match";
import { RULES, type Move } from "@/engine/types";
import { CARDS } from "@/data/cards";
import { demoDecks } from "@/lib/demo";
import { INDEX } from "@/lib/set";
import { completeTask, markDemoDone } from "@/lib/store";

export const dynamic = "force-dynamic";

/** More than a match can contain, so a bad list cannot spin the worker. */
const MOST_MOVES = 400;

export async function POST(request: Request) {
  const body = await request.clone().json().catch(() => null);
  const { seed, moves } = (body ?? {}) as { seed?: unknown; moves?: unknown };

  if (!Number.isInteger(seed) || !Array.isArray(moves)) {
    return Response.json({ error: "A demo is a seed and a list of moves." }, { status: 400 });
  }
  if (moves.length > MOST_MOVES) {
    return Response.json({ error: "That is longer than a match." }, { status: 400 });
  }

  const wallet = await signedInWallet(request);
  if (wallet === null) return UNAUTHORISED;

  let state;
  try {
    state = newMatch(CARDS, seed as number, demoDecks(seed as number));
    for (const move of moves as Move[]) state = applyMove(state, move, INDEX);
  } catch (error) {
    // The engine's own sentence. If a list does not replay, this is the only
    // thing that knows why.
    return Response.json(
      { error: error instanceof Error ? error.message : "That does not replay." },
      { status: 400 },
    );
  }

  if (!state.finished || state.turn <= RULES.turns) {
    return Response.json({ error: "That match is not finished." }, { status: 400 });
  }

  const now = Date.now();
  await markDemoDone(db(), wallet, now);
  await completeTask(db(), wallet, "demo", "verified", now);

  return Response.json({ ok: true });
}
