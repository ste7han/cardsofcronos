// Which card a token turned out to be — for tokens that are already sold.
//
// The collection's baseURI points at the face-down folder until the set is
// revealed, so the contract will not say what token 14 is. That is deliberate:
// an order anybody can read ahead of the mint is an order somebody can wait in
// front of, and the whole point of publishing the hash instead was that nobody
// can see what is coming.
//
// ── SO WHY WILL THIS SAY ─────────────────────────────────────────────────────
//
// Because it only answers for tokens BELOW nextTokenId, and a token below
// nextTokenId has already been minted. Whoever holds it cannot un-buy it, so
// knowing what it is changes nothing they can do. What must stay hidden is the
// order of what has NOT been sold, and that is exactly what this refuses.
//
// It is the same line scripts/nft/reveal.ts draws when it turns tokens face up
// as far as the mint has got and no further, and it is drawn here against the
// chain rather than against anything this server believes: `nextTokenId` is
// read for every request.
//
// ── IT DOES NOT CHECK WHO IS ASKING ──────────────────────────────────────────
//
// On purpose. A sold token's card is not a secret from its owner, and it is not
// a secret from anybody else either — it is on its way to being on every
// marketplace the moment the set is revealed. Gating it would mean a holder who
// lost their session also lost the ability to look at their own cards, for a
// fact that is not private.

import shuffle from "@/data/shuffle.json";

import { env } from "@/lib/api";
import { PUBLIC_RPCS, rpc } from "@/lib/cronos";
import { selector } from "@/lib/evm-tx";
import { CONTRACTS } from "@/lib/revenue";

export const dynamic = "force-dynamic";

/** Most tokens one request may ask about. A transaction cannot mint more. */
const AT_MOST = 50;

export async function POST(request: Request) {
  const nft = CONTRACTS.nft;
  if (nft === null) return Response.json({ error: "No collection." }, { status: 503 });

  const body = (await request.json().catch(() => null)) as { ids?: unknown } | null;
  const asked = Array.isArray(body?.ids) ? body!.ids : null;
  if (asked === null) return Response.json({ error: "Which tokens?" }, { status: 400 });
  if (asked.length === 0 || asked.length > AT_MOST) {
    return Response.json({ error: `Ask about 1 to ${AT_MOST} tokens.` }, { status: 400 });
  }

  const ids: number[] = [];
  for (const one of asked) {
    const id = Number(one);
    if (!Number.isInteger(id) || id < 1 || id > shuffle.tokens) {
      return Response.json({ error: `${String(one)} is not a token in this set.` }, { status: 400 });
    }
    ids.push(id);
  }

  // The line, read off the chain every time. A cached answer here would be a
  // cached answer about what is safe to reveal.
  let next: number;
  try {
    const secret = env().CRONOS_RPC;
    const rpcs = secret ? [secret, ...PUBLIC_RPCS] : PUBLIC_RPCS;
    const answer = await rpc(rpcs, "eth_call", [
      { to: nft, data: selector("nextTokenId()") },
      "latest",
    ]);
    next = Number(BigInt(answer));
  } catch {
    // Refuses rather than guessing. Guessing here is the one mistake that
    // cannot be taken back: a card shown early is shown.
    return Response.json({ error: "The chain could not be asked." }, { status: 503 });
  }

  const tooEarly = ids.filter((id) => id >= next);
  if (tooEarly.length > 0) {
    return Response.json(
      {
        error:
          `Token ${tooEarly[0]} has not been minted. What an unsold token is stays shut ` +
          `until it is sold — see the provenance hash on /mint.`,
      },
      { status: 403 },
    );
  }

  return Response.json({
    // Token 1 is the first entry, so the index is one behind the number.
    cards: ids.map((id) => ({ token: id, cardId: shuffle.order[id - 1]! })),
  });
}
