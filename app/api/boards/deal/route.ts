// The match a paid board owes you.
//
// The seed comes from here and nowhere else, which is the whole point. The
// browser used to pick it, and a browser that picks the shuffle can keep
// picking until one goes its way — so a fee bought a win rather than a go. Here
// it is dealt once, against a paid entry, and the entry is spent at the deal.
//
// Asking twice hands back the same seed. That is the reconnection: a match
// interrupted is still there to finish, and there is still only one of it.

import { db, signedInWallet, UNAUTHORISED } from "@/lib/api";
import { boardOf } from "@/data/boards";
import { dealEntry } from "@/lib/entries";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  // CLONED. signedInWallet reads the body too, and a body can only be read once.
  const body = (await request.clone().json().catch(() => null)) as { board?: unknown } | null;

  const board = boardOf(typeof body?.board === "string" ? body.board : "");
  if (board === undefined) {
    return Response.json({ error: "There is no such board." }, { status: 400 });
  }

  const wallet = await signedInWallet(request);
  if (wallet === null) return UNAUTHORISED;

  // A free board deals itself: the browser picks the seed and always has, and
  // there is nothing to spend. Answering with null rather than an error, so the
  // table can ask about any board without knowing which kind it is.
  if (board.entry?.contract == null) return Response.json({ seed: null, free: true });

  const seed = await dealEntry(db(), wallet, board.id, Date.now());
  if (seed === null) {
    return Response.json(
      {
        error: `This board costs ${board.entry.cro} CRO a go and this wallet has none left.`,
      },
      { status: 402 },
    );
  }

  return Response.json({ seed, free: false });
}
