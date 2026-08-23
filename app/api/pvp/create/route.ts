// Post an offer to the lobby.
//
// An offer is not a match: one player, no seed, no board. It sits for an hour
// and is then ignored — settled in DESIGN.md, because a lobby that keeps dead
// listings looks busier than it is, which is worse than looking empty.

import { db, signedInWallet, UNAUTHORISED } from "@/lib/api";
import { LISTING_LIFE, hasRoomFor, playerOf, putListing } from "@/lib/store";
import { newId, whyNotSeated } from "@/lib/pvp";
import type { MatchMode } from "@/engine/record";
import { INDEX } from "@/lib/set";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const body = await request.clone().json().catch(() => null);
  const wallet = await signedInWallet(request);
  if (wallet === null) return UNAUTHORISED;

  const { mode, stake, deck } = (body ?? {}) as { mode?: unknown; stake?: unknown; deck?: unknown };

  const refusal = whyNotSeated({ mode, stake, deck, index: INDEX });
  if (refusal) return Response.json({ error: refusal }, { status: 400 });

  const now = Date.now();
  // Offers count against the limit as well as matches: an offer is a match you
  // have already committed to, so five of each would be ten.
  if (!(await hasRoomFor(db(), wallet, mode as MatchMode, now))) {
    return Response.json(
      { error: "You already have as many matches and offers as that mode allows." },
      { status: 409 },
    );
  }

  const id = newId();
  await putListing(db(), {
    id,
    playerId: wallet,
    mode: mode as MatchMode,
    stake: 0,
    deck: deck as string[],
    // Copied onto the listing rather than looked up when the lobby is read: it
    // is what the offer was made at, and matchmaking compares against it.
    rank: (await playerOf(db(), wallet)).rank,
    createdAt: now,
    expiresAt: now + LISTING_LIFE,
  });

  return Response.json({ id });
}
