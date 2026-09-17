// What a wallet can claim right now, and the proof to claim it with.
//
// contracts/HolderDrop.sol pays against a merkle proof, and the tree is
// cumulative: a leaf says what somebody has earned in total, ever, and the
// contract remembers what they have already taken. So this returns one number
// and one proof, and that proof keeps working until the next tree goes live.
//
// The tree is not stored anywhere. lib/holders.ts rebuilds it from the leaves
// the live tree was built from, which is cheap for a few thousand of them and
// means a proof cannot disagree with the leaf it came from.
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
import { owedTo, takenOnChain } from "@/lib/holders";
import { CONTRACTS } from "@/lib/revenue";

export const dynamic = "force-dynamic";

/**
 * What the claim button looks like with something in it, before it is real.
 *
 * DEVELOPMENT ONLY. The guard is `process.env.NODE_ENV`, and it lives HERE
 * rather than in the component because a route is never sent to a browser. The
 * first version of this put the sample numbers in components/Claim.tsx behind
 * the same guard, reasoning that the build would strip them — it did not. The
 * figures were in the production bundle, findable with grep, on a site whose
 * whole argument is that a number you cannot check is a number you should not
 * believe.
 *
 *   npm run dev, then /profile?preview=claim  or  ?preview=claimed
 */
function pretend(wallet: string, state: string) {
  const earned = (48_219n * 10n ** 18n).toString();
  const taken = state === "claimed" ? earned : (31_640n * 10n ** 18n).toString();
  return {
    wallet,
    drop: "0x" + "d".repeat(40),
    owed: {
      earned,
      taken,
      claimable: (BigInt(earned) - BigInt(taken)).toString(),
      proof: ["0x" + "1".repeat(64), "0x" + "2".repeat(64)],
      root: "0x" + "3".repeat(64),
    },
  };
}

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

  const preview = new URL(request.url).searchParams.get("preview");
  if (process.env.NODE_ENV === "development" && (preview === "claim" || preview === "claimed")) {
    return Response.json(pretend(wallet, preview));
  }

  const secret = env().CRONOS_RPC;
  const rpcs = secret ? [secret, ...PUBLIC_RPCS] : PUBLIC_RPCS;

  const owed = await owedTo(db(), wallet, takenOnChain(rpcs));
  return Response.json({ wallet, owed, drop: CONTRACTS.drop });
}
