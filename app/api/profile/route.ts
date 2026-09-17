// Everything the profile page needs about one wallet, in one request.
//
// Three numbers off the chain — the $CROCARD balance, the running total
// contracts/HolderDrop.sol has paid that wallet across every round it claimed,
// and what is still sitting in open rounds waiting to be taken — plus the PvP
// record out of our own table.
//
// One route because it is one page. The record used to come from /api/ref/me,
// which was the referral route and answered with it as a passenger; referrals
// are gone from this game and the record is not, so it moved here rather than
// keeping a route alive for one field.
//
// SERVER-SIDE, like every other chain read in this project. A browser could ask
// an RPC directly, and then the endpoint is in the page — and the day this needs
// a paid one, its key is in the page with it. CLAUDE.md has one rule about keys
// and it has no exceptions.
//
// SIGNED IN, because it is a balance attached to a person. Anybody can look up
// any address on an explorer and that is fine; this route answering for any
// address handed to it would make the site the convenient way to do it in bulk.

import { PUBLIC_RPCS, tokenBalances } from "@/lib/cronos";
import { db, env, signedInWallet, UNAUTHORISED } from "@/lib/api";
import { owedTo, takenOnChain } from "@/lib/holders";
import { playerOf } from "@/lib/store";
import { CONTRACTS, CROCARD } from "@/lib/revenue";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const wallet = await signedInWallet(request);
  if (wallet === null) return UNAUTHORISED;

  const secret = env().CRONOS_RPC;
  const rpcs = secret ? [secret, ...PUBLIC_RPCS] : PUBLIC_RPCS;
  const drop = CONTRACTS.drop;

  const [[held], player, owed] = await Promise.all([
    tokenBalances(rpcs, CROCARD, [wallet]),
    playerOf(db(), wallet),
    // What the live tree says this wallet has earned, what the contract says it
    // has taken, and the difference. Null until the drop is deployed and a tree
    // has gone live, which is also the first moment either number can exist.
    drop === null ? Promise.resolve(null) : owedTo(db(), wallet, takenOnChain(rpcs)),
  ]);

  return Response.json({
    // Null is "the chain would not answer", which is not zero. A balance page
    // that reads empty because a request timed out is the one wrong answer here.
    held: held?.toString() ?? null,
    // Both in base units as strings. `taken` is what the contract has paid this
    // wallet across its whole life; `claimable` is what pressing the button
    // would pay now. Null is "not known", which is not zero.
    taken: owed?.taken ?? null,
    claimable: owed?.claimable ?? null,
    earned: owed?.earned ?? null,
    // So the numbers above can be checked rather than believed.
    drop,
    token: CROCARD,
    record: { wins: player.wins, losses: player.losses, draws: player.draws },
  });
}
