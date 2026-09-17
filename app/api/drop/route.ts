// What a wallet can still take from the open rounds, and the proof to take it.
//
// contracts/HolderDrop.sol pays against a merkle proof: a round is one number on
// the chain and a share is proved when it is claimed. The tree is not stored
// anywhere — lib/holders.ts rebuilds it from the rows the round was built from,
// which is cheap for a few thousand leaves and means a proof cannot disagree
// with the entry it came from.
//
// PUBLIC AND NOT SIGNED IN, unlike /api/profile. A proof is not a secret and it
// is not a capability: `claim` pays the holder named in the proof, never the
// caller, so the worst anybody can do with somebody else's proof is pay that
// somebody's gas. That is the whole reason the contract is shaped this way, and
// a proof behind a login would mean a holder who lost their session also lost
// their share.

import { db, env } from "@/lib/api";
import { normalise } from "@/lib/address";
import { PUBLIC_RPCS } from "@/lib/cronos";
import { claimedOnChain, owedTo } from "@/lib/holders";
import { CONTRACTS } from "@/lib/revenue";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const asked = new URL(request.url).searchParams.get("wallet");
  if (asked === null) return Response.json({ error: "Which wallet?" }, { status: 400 });

  let wallet: string;
  try {
    wallet = normalise(asked);
  } catch {
    // Said differently from "nothing is owed to you", because they are different
    // sentences and only one of them is about the caller's typing.
    return Response.json({ error: "That is not an address." }, { status: 400 });
  }

  const secret = env().CRONOS_RPC;
  const rpcs = secret ? [secret, ...PUBLIC_RPCS] : PUBLIC_RPCS;

  const rounds = await owedTo(db(), wallet, claimedOnChain(rpcs));
  const total = rounds.reduce((sum, one) => sum + BigInt(one.amount), 0n);

  return Response.json({ wallet, total: total.toString(), rounds, drop: CONTRACTS.drop });
}
