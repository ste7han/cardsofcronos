// Sit down at somebody's offer.
//
// The claim is the hard part and it is one statement: DELETE ... RETURNING, so
// two players pressing join at the same moment cannot both get the match. That
// is not a rare case in a lobby — it is the normal one the moment anything
// interesting is posted, and a read-then-write hands the same match to both with
// no rule downstream that would notice.
//
// Everything after the claim is safe: the listing is gone, so this request owns
// it. If the match then fails to write, the offer is lost and the players post
// again — which is the failure worth having, because the other one is two
// matches from one offer.

import { db, env, signedInWallet, UNAUTHORISED } from "@/lib/api";
import { wagerFor, whyNotFunded } from "@/lib/escrow";
import { claimListing, hasRoomFor, putListing, putMatch, seedFor } from "@/lib/store";
import { newId, whyNotSeated } from "@/lib/pvp";
import { newRecord } from "@/engine/record";
import { INDEX } from "@/lib/set";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const body = await request.clone().json().catch(() => null);
  const { id, deck } = (body ?? {}) as { id?: unknown; deck?: unknown };
  if (typeof id !== "string") return Response.json({ error: "Which offer?" }, { status: 400 });

  const wallet = await signedInWallet(request);
  if (wallet === null) return UNAUTHORISED;

  const now = Date.now();
  const listing = await claimListing(db(), id, now);
  if (!listing) {
    return Response.json(
      { error: "That offer is gone — somebody else took it, or it expired." },
      { status: 409 },
    );
  }

  // Checked after the claim, deliberately. Doing it before leaves a window where
  // the answer is stale by the time it matters, and the offer is put back below
  // rather than swallowed.
  const refusal =
    listing.playerId === wallet
      ? "That is your own offer. Cancel it instead."
      : whyNotSeated({ mode: listing.mode, stake: listing.stake, deck, index: INDEX });

  const noRoom =
    refusal === null && !(await hasRoomFor(db(), wallet, listing.mode, now))
      ? "You already have as many matches as that mode allows."
      : null;

  // The money, asked of the chain and of nobody else. A client saying it has
  // deposited is a client saying anything it likes, and a match that starts on
  // that word is a match one side can win without ever having staked.
  //
  // The wager is keyed on the OFFER's id, because that is what existed when the
  // deposits were made. See the wager column in db/schema.sql for why it must
  // not be this match's id.
  let notFunded: string | null = null;
  if (refusal === null && noRoom === null && listing.stake > 0) {
    notFunded = whyNotFunded(
      await wagerFor(listing.id, env().CRONOS_RPC).catch(() => null),
      { opener: listing.playerId, joiner: wallet, stakeCro: listing.stake },
    );
  }

  if (refusal || noRoom || notFunded) {
    // Put it back. The player who posted it did nothing wrong and should not
    // lose their place in the lobby because somebody else turned up with a deck
    // that does not pass.
    await putListing(db(), listing);
    return Response.json({ error: refusal ?? noRoom ?? notFunded }, { status: 400 });
  }

  const matchId = newId();
  await putMatch(
    db(),
    newRecord({
      id: matchId,
      mode: listing.mode,
      stake: listing.stake,
      // The player who posted the offer takes the first seat, and therefore
      // moves first. Somebody has to, and "whoever was here first" is the only
      // rule that does not need explaining.
      seats: { you: listing.playerId, opponent: wallet },
      // From the id, not from a random number: creating the same match twice
      // must not produce two different games, and a replay never has to guess.
      seed: seedFor(matchId),
      decks: { you: listing.deck, opponent: deck as string[] },
      // Friendly matches carry none, and settling one would find nothing.
      wager: listing.stake > 0 ? listing.id : null,
      now,
    }),
  );

  return Response.json({ id: matchId });
}
