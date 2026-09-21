// The cards a wallet is holding.
//
// The collection is not ERC721Enumerable — see the note in the Solidity for why
// paying for an index nobody queries is a tax on every holder — so there is no
// `tokenOfOwnerByIndex` to ask and walking `ownerOf(1..5603)` is five thousand
// calls for one page view. The minute-job keeps `card_owners` current from the
// Transfer log instead, and this reads that.
//
// ── IT ONLY NAMES CARDS FOR TOKENS THAT EXIST ────────────────────────────────
//
// Which card a token is stays shut until that token is sold — /api/tokens has
// the argument. Nothing special is needed here to honour it: a row in
// card_owners exists because a Transfer happened, and a token that has been
// transferred has been minted. Somebody's own cards are the sold ones by
// definition.
//
// PUBLIC, like the rest. A wallet's holdings are on the chain; a login in front
// of them would only stop the owner reading their own.

import shuffle from "@/data/shuffle.json";

import { normalise } from "@/lib/address";
import { db } from "@/lib/api";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const asked = new URL(request.url).searchParams.get("wallet");
  if (asked === null) return Response.json({ error: "Which wallet?" }, { status: 400 });

  let wallet: string;
  try {
    wallet = normalise(asked);
  } catch {
    return Response.json({ error: "That is not an address." }, { status: 400 });
  }

  const { results } = await db()
    .prepare(`SELECT token FROM card_owners WHERE owner = ? ORDER BY token`)
    .bind(wallet)
    .all<{ token: number }>();

  const held = (results ?? [])
    .map((row) => row.token)
    // Guarded rather than trusted. A row for a token outside the set would be a
    // bug in the scan, and `order[id - 1]` on it would be undefined — which
    // renders as a card that does not exist rather than as an error.
    .filter((token) => token >= 1 && token <= shuffle.tokens);

  return Response.json({
    wallet,
    tokens: held.map((token) => ({ token, cardId: shuffle.order[token - 1]! })),
  });
}
