// What is attached to the wallet asking.
//
// A POST for a read, which looks wrong and is not: the request carries a wallet
// proof, and a proof in a query string ends up in browser history and in every
// log between here and the browser. The alternative — a GET taking a bare
// address — would let anyone list anyone's links by guessing addresses, and
// addresses are public.

import { db, signedInWallet, UNAUTHORISED } from "@/lib/api";
import { linksOf } from "@/lib/store";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const wallet = await signedInWallet(request);
  if (wallet === null) return UNAUTHORISED;

  const links = await linksOf(db(), wallet);
  return Response.json({
    links: links.map((link) => ({
      network: link.network,
      handle: link.handle,
      linkedAt: link.linkedAt,
    })),
  });
}
