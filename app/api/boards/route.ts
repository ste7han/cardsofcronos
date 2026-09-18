// Which opponents there are, what each one pays, and whether a score would count.
//
// Asked before a match rather than after it. The lock is enforced when a score
// is submitted — see lib/gate.ts — but finding out there that it was never going
// to count means ten turns spent under a misunderstanding, and it was knowable
// before the first card.
//
// THE LOCK IS ON THE PRIZE AND NOT ON THE OPPONENT. Anybody can sit down against
// any of these; what holding $LION buys is a place on that board. So `shut` is
// not "you may not play this", it is "this will not count", and the page says it
// that way round.
//
// Signed out, every locked board reads as not counting. That is the honest
// answer: whether a score counts is about a wallet, and there is no wallet.

import { BOARDS } from "@/data/boards";
import { signedInWallet } from "@/lib/api";
import { lockedOut, prizeFor } from "@/lib/gate";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const wallet = await signedInWallet(request);

  const boards = await Promise.all(
    BOARDS.map(async (board) => ({
      id: board.id,
      name: board.name,
      blurb: board.blurb,
      needs: board.needs === null ? null : board.needs.whole,
      prize: await prizeFor(board.id),
      shut:
        board.needs === null
          ? null
          : wallet === null
            ? `Sign in with a wallet holding ${board.needs.whole.toLocaleString("en-US")} $LION for this to count.`
            : await lockedOut(board, wallet),
    })),
  );

  return Response.json({ boards });
}
