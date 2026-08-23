// What is on offer.
//
// Your own offers come back too, marked as yours. Hiding them would mean a
// player posts an offer and then cannot see it, which reads as the post having
// failed — and the first thing they do is post another one.
//
// Decks are not sent. A listing carries one so the match can start the moment it
// is claimed, but showing it would let anyone in the lobby read their opponent's
// forty cards before choosing whether to sit down.

import { db, signedInWallet, UNAUTHORISED } from "@/lib/api";
import { openListings } from "@/lib/store";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const wallet = await signedInWallet(request);
  if (wallet === null) return UNAUTHORISED;

  const listings = await openListings(db(), Date.now());
  return Response.json({
    listings: listings.map((listing) => ({
      id: listing.id,
      mode: listing.mode,
      stake: listing.stake,
      rank: listing.rank,
      createdAt: listing.createdAt,
      expiresAt: listing.expiresAt,
      mine: listing.playerId === wallet,
    })),
  });
}
