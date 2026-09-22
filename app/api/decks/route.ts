// Somebody's decks, kept where their wallet is.
//
// These lived in localStorage. That made a deck the property of a browser
// instead of the property of a player: four decks built on a laptop did not
// exist on the same person's phone, so /play on a phone offered the deck builder
// to somebody who already had four. A deck is a thing you own, like the cards in
// it, and it now hangs off the wallet like everything else here does.
//
// ── THIS IS WHERE A DECK IS ACTUALLY CHECKED ─────────────────────────────────
//
// The browser validates too, and that check is a convenience. This one is the
// rule. A deck arriving over HTTP is a deck somebody typed, and engine/deck.ts
// says it in as many words: in the first version of this game the card check was
// a UI filter, so a direct call could deck anything in the set.
//
// Ownership is read from `card_owners` — the table the minute-job keeps from the
// collection's Transfer log — and not from what the request says is held. The
// same table /api/cards answers from, so the builder and this agree by
// construction rather than by both being careful.
//
// What it does NOT do is re-check old decks. Cards can be sold, and a deck going
// unplayable is something to see in the list rather than something to lose
// silently; the table refuses new ones, and the screens say why an old one
// cannot be dealt.

import shuffle from "@/data/shuffle.json";

import { db, signedInWallet, UNAUTHORISED } from "@/lib/api";
import { deckProblems } from "@/engine/deck";
import { INDEX } from "@/lib/set";
import {
  MOST_DECKS,
  decksOf,
  dropDeck,
  playDeck,
  putDeck,
  tokensOf,
  type StoredDeck,
} from "@/lib/store";

export const dynamic = "force-dynamic";

/** The longest a deck name may be, the same number the builder stops typing at. */
const NAME_LIMIT = 28;

/** What this wallet may deck, as card ids. */
async function owned(wallet: string): Promise<Set<string>> {
  const tokens = await tokensOf(db(), wallet);
  return new Set(
    tokens
      // Guarded rather than trusted, the same as /api/cards: a token outside the
      // set would be a bug in the scan, and `order[id - 1]` on it is undefined.
      .filter((token) => token >= 1 && token <= shuffle.tokens)
      .map((token) => shuffle.order[token - 1]!),
  );
}

function asAnswer(decks: StoredDeck[]) {
  return {
    decks: decks.map((deck) => ({
      id: deck.id,
      name: deck.name,
      cardIds: deck.cardIds,
      at: deck.at,
    })),
    playing: decks.find((deck) => deck.playing)?.id ?? null,
  };
}

export async function POST(request: Request) {
  // CLONED. signedInWallet reads the body as well, and a body can only be read
  // once — this cost an afternoon in /api/solo, where the second read got a
  // consumed stream and every result silently failed to post.
  const body = (await request.clone().json().catch(() => null)) as {
    action?: unknown;
    id?: unknown;
    name?: unknown;
    cardIds?: unknown;
  } | null;

  const wallet = await signedInWallet(request);
  if (wallet === null) return UNAUTHORISED;

  const action = body?.action;
  const database = db();

  if (action === "list") {
    return Response.json(asAnswer(await decksOf(database, wallet)));
  }

  if (action === "save") {
    const { id, name, cardIds } = body!;
    if (!Array.isArray(cardIds) || !cardIds.every((one) => typeof one === "string")) {
      return Response.json({ error: "That is not a list of cards." }, { status: 400 });
    }

    const problems = deckProblems(cardIds as string[], INDEX, await owned(wallet));
    // 200 and not 400. A deck that breaks the rules is an answer to give the
    // builder, which draws every problem next to the deck; an HTTP error would
    // be a thing the fetch throws on and a screen that says "could not save".
    if (problems.length > 0) return Response.json({ problems });

    const existing = await decksOf(database, wallet);
    const replacing = typeof id === "string" ? existing.find((deck) => deck.id === id) : undefined;
    if (replacing === undefined && existing.length >= MOST_DECKS) {
      return Response.json({
        problems: [`You have ${MOST_DECKS} decks, which is the most. Delete one to save another.`],
      });
    }

    const at = Date.now();
    const called =
      typeof name === "string" && name.trim() !== ""
        ? name.trim().slice(0, NAME_LIMIT)
        : `Deck ${existing.length + 1}`;

    await putDeck(database, wallet, {
      // Reusing the id is what makes saving after an edit a replacement rather
      // than a copy, and it has to be one of this wallet's own — an id from the
      // request that belongs to nobody would otherwise create a deck under a
      // name somebody else picked.
      id: replacing?.id ?? `d${at.toString(36)}${Math.random().toString(36).slice(2, 6)}`,
      name: called,
      cardIds: cardIds as string[],
      at,
    });

    return Response.json({ problems: [], ...asAnswer(await decksOf(database, wallet)) });
  }

  if (action === "delete") {
    if (typeof body?.id !== "string") {
      return Response.json({ error: "Which deck?" }, { status: 400 });
    }
    await dropDeck(database, wallet, body.id);
    return Response.json(asAnswer(await decksOf(database, wallet)));
  }

  if (action === "play") {
    if (typeof body?.id !== "string") {
      return Response.json({ error: "Which deck?" }, { status: 400 });
    }
    // An id that is not this wallet's fails rather than quietly leaving the seat
    // where it was, which would read as success and deal the old deck.
    if (!(await playDeck(database, wallet, body.id))) {
      return Response.json({ error: "No such deck." }, { status: 404 });
    }
    return Response.json(asAnswer(await decksOf(database, wallet)));
  }

  return Response.json({ error: `Unknown action: ${String(action)}` }, { status: 400 });
}
