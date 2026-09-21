// The burn, for anybody. No wallet needed.
//
// Public on purpose: a burn total is a claim about the token, and a claim only
// anybody logged in can read is not much of one.
//
// ── TWO NUMBERS, AND THEY ARE NOT THE SAME NUMBER ────────────────────────────
//
// `total` is what THIS GAME has burned: the sum of the burns in the database,
// every one of them a transaction anybody can open. It is zero until the
// splitter has released something.
//
// `dead` is what is sitting at the burn address RIGHT NOW, read off the chain.
// It includes everything the 2025 version burned, which is most of it.
//
// The page said only the first one and called it "$CROCARD BURNED", which read
// as "none has ever been burned" while 89 million sat at an address anybody
// could look at. Both are true and only one of them was on the page.

import { env } from "@/lib/api";
import { db } from "@/lib/api";
import { PUBLIC_RPCS, rpc } from "@/lib/cronos";
import { selector, word } from "@/lib/evm-tx";
import { BURN_ADDRESS, CONTRACTS, CROCARD } from "@/lib/revenue";
import { burnTotal, burns } from "@/lib/store";

export const dynamic = "force-dynamic";

/**
 * What the burn address holds, in base units, or null when it cannot be read.
 *
 * Null rather than zero, and the page draws the two differently. "Nothing has
 * been burned" and "we could not ask" are different sentences, and only one of
 * them is about the token.
 */
async function atTheDeadAddress(secretRpc?: string): Promise<string | null> {
  const rpcs = secretRpc ? [secretRpc, ...PUBLIC_RPCS] : PUBLIC_RPCS;
  try {
    const answer = await rpc(rpcs, "eth_call", [
      { to: CROCARD, data: selector("balanceOf(address)") + word(BURN_ADDRESS) },
      "latest",
    ]);
    return BigInt(answer).toString();
  } catch {
    return null;
  }
}

/**
 * CRO that has arrived and has not been through the split yet.
 *
 * Two places, because it moves in two steps. A mint pays the COLLECTION and
 * sits there; `release()` on the collection forwards it to the SPLITTER; and
 * `release()` on the splitter buys $CROCARD and divides it. Both of those calls
 * take no arguments and have no owner check, which is what lets the page offer
 * them to anybody.
 *
 * The daily job does this on its own every six hours. That is a deliberate
 * batch — a swap is a trade and four a day is better than forty — and it also
 * means somebody who just minted can watch 420 CRO sit there for four hours
 * wondering whether anything works. Hence the button.
 */
async function waitingToGoThrough(secretRpc?: string): Promise<{
  collection: string | null;
  splitter: string | null;
}> {
  const rpcs = secretRpc ? [secretRpc, ...PUBLIC_RPCS] : PUBLIC_RPCS;
  const balance = async (at: string | null): Promise<string | null> => {
    if (at === null) return null;
    try {
      return BigInt(await rpc(rpcs, "eth_getBalance", [at, "latest"])).toString();
    } catch {
      // Null is "could not ask", which the page draws differently from zero.
      return null;
    }
  };

  const [collection, splitter] = await Promise.all([
    balance(CONTRACTS.nft),
    balance(CONTRACTS.splitter),
  ]);
  return { collection, splitter };
}

export async function GET() {
  const [total, recent, dead, waiting] = await Promise.all([
    burnTotal(db()),
    burns(db(), 25),
    atTheDeadAddress(env().CRONOS_RPC),
    waitingToGoThrough(env().CRONOS_RPC),
  ]);
  return Response.json({
    total,
    burns: recent,
    dead,
    deadAddress: BURN_ADDRESS,
    waiting,
    // So the page can build the two calls without repeating an address.
    at: { collection: CONTRACTS.nft, splitter: CONTRACTS.splitter },
  });
}
