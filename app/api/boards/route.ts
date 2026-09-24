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
import { lockedOut, potOf, prizeFor } from "@/lib/gate";
import { sparEntries } from "@/lib/entries";
import { db } from "@/lib/api";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const wallet = await signedInWallet(request);

  const boards = await Promise.all(
    BOARDS.map(async (board) => ({
      id: board.id,
      name: board.name,
      blurb: board.blurb,
      face: board.face,
      needs: board.needs === null ? null : board.needs.whole,
      prize: await prizeFor(board.id),
      // What a go costs, and how many this wallet has already paid for. Null
      // where the board is free, and null where the contract is not deployed —
      // a fee with nowhere to pay it is a board that looks paid for and takes
      // nothing.
      entry:
        board.entry === null || board.entry.contract === null
          ? null
          : {
              cro: board.entry.cro,
              contract: board.entry.contract,
              spare: wallet === null ? 0 : await sparEntries(db(), wallet, board.id),
            },
      // The board's own pot, in its own token, and what is in it right now.
      alsoPays:
        board.alsoPays === null || board.alsoPays.contract === null
          ? null
          : {
              symbol: board.alsoPays.symbol,
              pot: await potOf(board.alsoPays.token, board.alsoPays.contract),
            },
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
