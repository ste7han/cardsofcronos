// Looking in on a match you are not playing.
//
// ── NO SIGN-IN, DELIBERATELY ─────────────────────────────────────────────────
//
// A link somebody can only open after connecting a wallet is a link nobody
// opens. What this hands back is what both players can already see — the two
// boards, the market caps, whose turn it is and the log — so there is nobody it
// could be withheld from on the grounds of secrecy.
//
// The safety is in engine/view.ts rather than here: `watchView` has no field a
// hand could go in, so this route cannot leak one by forgetting to redact.
// Authentication would not have added anything to that and would have cost the
// thing the feature is for.
//
// ── IT DOES NOT MOVE THE MATCH ALONG ─────────────────────────────────────────
//
// /api/pvp/match catches a record up on the clock and settles a finished one,
// because the player asking is the person the deadline is about. This only
// reads. A spectator refreshing a page must not be able to time somebody out,
// and a stake must not be settled by whoever happens to be watching — those
// belong to the two people playing and to the nightly job.
//
// So a match whose clock has run out reads here as still running until one of
// its players next looks. That is a few seconds of being slightly behind, and
// the alternative is a bystander with a hand on the clock.

import { db } from "@/lib/api";
import { CARDS } from "@/data/cards";
import { getMatch } from "@/lib/store";
import { stateOf } from "@/engine/record";
import { watchView } from "@/engine/view";
import { INDEX } from "@/lib/set";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const id = new URL(request.url).searchParams.get("id");
  if (!id) return Response.json({ error: "Which match?" }, { status: 400 });

  const record = await getMatch(db(), id);
  // The same answer for a match that never existed and one somebody mistyped.
  if (!record) return Response.json({ error: "No such match." }, { status: 404 });

  const state = stateOf(record, CARDS, INDEX);

  return Response.json({
    id: record.id,
    mode: record.mode,
    stake: record.stake,
    // Both seats, because a watcher has no side and the page needs to name them.
    seats: record.seats,
    deadline: record.deadline,
    startedAt: record.createdAt,
    view: watchView(state, INDEX),
  });
}
