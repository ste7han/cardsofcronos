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

import { PUBLIC_RPCS, rpc, tokenBalances } from "@/lib/cronos";
import { db, env, signedInWallet, UNAUTHORISED } from "@/lib/api";
import { claimedOnChain, owedTo } from "@/lib/holders";
import { playerOf } from "@/lib/store";
import { selector, word } from "@/lib/evm-tx";
import { CONTRACTS, CROCARD } from "@/lib/revenue";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const wallet = await signedInWallet(request);
  if (wallet === null) return UNAUTHORISED;

  const secret = env().CRONOS_RPC;
  const rpcs = secret ? [secret, ...PUBLIC_RPCS] : PUBLIC_RPCS;
  const drop = CONTRACTS.drop;

  const [[held], taken, player, owed] = await Promise.all([
    tokenBalances(rpcs, CROCARD, [wallet]),
    // `taken(address)` is a tally the contract keeps so this does not have to
    // read back every Claimed log ever emitted — Cronos answers eth_getLogs over
    // two thousand blocks at a time and a block is 0.42 seconds.
    drop === null
      ? Promise.resolve(null)
      : rpc<string>(rpcs, "eth_call", [
          { to: drop, data: selector("taken(address)") + word(wallet) },
          "latest",
        ]).catch(() => null),
    playerOf(db(), wallet),
    // Everything in an open round that this wallet has not claimed. Empty until
    // the drop is deployed, which is also when the first round can exist.
    drop === null ? Promise.resolve([]) : owedTo(db(), wallet, claimedOnChain(rpcs)),
  ]);

  return Response.json({
    // Null is "the chain would not answer", which is not zero. A balance page
    // that reads empty because a request timed out is the one wrong answer here.
    held: held?.toString() ?? null,
    taken: taken === null ? null : BigInt(taken).toString(),
    // Base units, as a string, and "0" rather than null when the drop exists and
    // owes this wallet nothing — those are different facts.
    claimable: drop === null ? null : owed.reduce((sum, one) => sum + BigInt(one.amount), 0n).toString(),
    rounds: owed.length,
    // So the numbers above can be checked rather than believed.
    drop,
    token: CROCARD,
    record: { wins: player.wins, losses: player.losses, draws: player.draws },
  });
}
