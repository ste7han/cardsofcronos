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
import { BURN_ADDRESS, CROCARD } from "@/lib/revenue";
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

export async function GET() {
  const [total, recent, dead] = await Promise.all([
    burnTotal(db()),
    burns(db(), 25),
    atTheDeadAddress(env().CRONOS_RPC),
  ]);
  return Response.json({ total, burns: recent, dead, deadAddress: BURN_ADDRESS });
}
