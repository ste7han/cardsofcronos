// Which opponents this wallet may play for a prize.
//
// Asked before a match rather than after it. The lock is enforced when a score
// is submitted — see lib/gate.ts — but finding out there that you were never
// eligible means ten turns spent for nothing, and the answer was knowable before
// the first card.
//
// Signed out, every locked board reads as locked. That is the honest answer: a
// lock is about a wallet, and there is no wallet.

import { BOARDS } from "@/data/boards";
import { signedInWallet } from "@/lib/api";
import { lockedOut } from "@/lib/gate";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const wallet = await signedInWallet(request);

  const boards = await Promise.all(
    BOARDS.map(async (board) => ({
      id: board.id,
      name: board.name,
      blurb: board.blurb,
      needs: board.needs === null ? null : board.needs.whole,
      shut:
        board.needs === null
          ? null
          : wallet === null
            ? "Sign in with the wallet that holds it."
            : await lockedOut(board, wallet),
    })),
  );

  return Response.json({ boards });
}
