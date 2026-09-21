// What is on offer.
//
// Your own offers come back too, marked as yours. Hiding them would mean a
// player posts an offer and then cannot see it, which reads as the post having
// failed — and the first thing they do is post another one.
//
// Decks are not sent. A listing carries one so the match can start the moment it
// is claimed, but showing it would let anyone in the lobby read their opponent's
// forty cards before choosing whether to sit down.

import { db, env, signedInWallet, UNAUTHORISED } from "@/lib/api";
import { normalise } from "@/lib/address";
import { wagerFor } from "@/lib/escrow";
import { openListings } from "@/lib/store";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const wallet = await signedInWallet(request);
  if (wallet === null) return UNAUTHORISED;

  const listings = await openListings(db(), Date.now());

  // Whether the money is actually up, asked of the chain. A staked offer is
  // posted before the deposit is signed — they are two steps and the second one
  // happens in a wallet — so the lobby would otherwise advertise seats nobody
  // could take, and the person taking them would find out by having their join
  // refused after choosing a deck.
  //
  // One eth_call per staked offer, and only per staked offer: a friendly one is
  // funded by definition. An offer whose deposit cannot be read is reported as
  // unfunded rather than assumed good — the cost of being wrong that way is a
  // seat that looks unavailable for a minute.
  const rpc = env().CRONOS_RPC;
  const funded = await Promise.all(
    listings.map(async (listing) => {
      if (listing.stake <= 0) return true;
      const wager = await wagerFor(listing.id, rpc).catch(() => null);
      if (wager === null) return false;
      return (
        wager.state === "open" &&
        normalise(wager.opener) === normalise(listing.playerId) &&
        wager.stake === BigInt(Math.round(listing.stake)) * 10n ** 18n
      );
    }),
  );

  return Response.json({
    listings: listings.map((listing, i) => ({
      id: listing.id,
      mode: listing.mode,
      stake: listing.stake,
      rank: listing.rank,
      createdAt: listing.createdAt,
      expiresAt: listing.expiresAt,
      mine: listing.playerId === wallet,
      // False only ever means "not yet": the offer stands, the deposit has not
      // landed. Whoever posted it is shown how to finish; everybody else is
      // shown that it is not takeable.
      funded: funded[i] ?? false,
    })),
  });
}
