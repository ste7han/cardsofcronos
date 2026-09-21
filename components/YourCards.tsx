"use client";

// The cards this wallet is holding.
//
// The page had a rank, a balance and a claim and nowhere to look at what you had
// actually bought, which is the one thing somebody who just minted wants to do.
//
// ── DUPLICATES ARE COUNTED, NOT DRAWN TWICE ──────────────────────────────────
//
// Two tokens can be the same card, and a second copy is a real thing to hold —
// it is what you trade. But a grid that drew it twice would be a grid you scroll
// past the same picture in, and the filters above it would count it twice too.
// So the gallery gets one of each and the line above says how many tokens that
// is, which is the same way /mint says it.
//
// ── IT DOES NOT ASK THE CHAIN ────────────────────────────────────────────────
//
// The collection is not enumerable on purpose, so there is nothing to ask. The
// minute-job keeps the ownership table current from the Transfer log and this
// reads that — which means a mint from ten seconds ago may not be here yet, and
// the note below says so rather than letting somebody think it went missing.

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";

import { Gallery } from "@/components/Gallery";
import type { Card } from "@/engine/types";
import { INDEX } from "@/lib/set";

interface Held {
  token: number;
  cardId: string;
}

/**
 * What this wallet holds, asked once and shared by both views.
 *
 * `failed` is not the same as an empty list and the two are never collapsed:
 * "you hold nothing" and "we could not ask" are different sentences, and only
 * one of them is about the wallet.
 */
function useHeld(wallet: string | null) {
  const [held, setHeld] = useState<Held[] | null>(null);
  const [failed, setFailed] = useState(false);

  const look = useCallback(async () => {
    if (wallet === null) return;
    try {
      const response = await fetch(`/api/cards?wallet=${wallet}`);
      if (!response.ok) throw new Error("no");
      setHeld(((await response.json()) as { tokens: Held[] }).tokens);
      setFailed(false);
    } catch {
      setFailed(true);
    }
  }, [wallet]);

  useEffect(() => {
    void look();
  }, [look]);

  return { held, failed };
}

/** One of each, in the order the tokens were minted. See the note up top. */
function distinct(held: readonly Held[]): Card[] {
  const seen = new Set<string>();
  const cards: Card[] = [];
  for (const one of held) {
    if (seen.has(one.cardId)) continue;
    const card = INDEX.get(one.cardId);
    if (card === undefined) continue;
    seen.add(one.cardId);
    cards.push(card);
  }
  return cards;
}

/**
 * The line on /profile, and the way through to the grid.
 *
 * The gallery was here at first and it was too much page: filters, a size
 * picker and a few hundred cards, halfway down a page that is otherwise four
 * short facts. So the count stays and the cards moved to /profile/cards.
 */
export function CardsSummary({ wallet }: { wallet: string | null }) {
  const { held, failed } = useHeld(wallet);
  if (wallet === null) return null;

  return (
    <section>
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h2 className="display text-xl">YOUR CARDS</h2>
        {held !== null && held.length > 0 && (
          <Link
            href="/profile/cards"
            className="text-[10px] tracking-[0.18em] text-pump hover:underline"
          >
            SEE THEM ALL →
          </Link>
        )}
      </div>

      {failed ? (
        <p className="mt-2 text-[11px] leading-relaxed text-dump">
          Your cards could not be read. That is this page failing, not an empty wallet.
        </p>
      ) : held === null ? (
        <p className="mt-2 text-[11px] leading-relaxed text-muted">Looking…</p>
      ) : held.length === 0 ? (
        <p className="mt-2 max-w-2xl text-[11px] leading-relaxed text-muted">
          Nothing yet.{" "}
          <Link href="/mint" className="text-pump hover:underline">
            The mint is open
          </Link>{" "}
          — and if you have just minted, give it a minute: this reads a table kept up to date from
          the chain rather than asking the chain per visitor.
        </p>
      ) : (
        <p className="mt-2 max-w-2xl text-[11px] leading-relaxed text-muted">
          <span className="text-fg tabular-nums">{held.length}</span>{" "}
          {held.length === 1 ? "token" : "tokens"}, covering{" "}
          <span className="text-fg tabular-nums">{distinct(held).length}</span>{" "}
          {distinct(held).length === 1 ? "card" : "different cards"}.
        </p>
      )}
    </section>
  );
}

export function YourCards({ wallet }: { wallet: string | null }) {
  const { held, failed } = useHeld(wallet);

  if (wallet === null) {
    return (
      <p className="text-[11px] leading-relaxed text-muted">
        Sign in with your wallet to see what you are holding.
      </p>
    );
  }

  if (failed) {
    return (
      <p className="text-[11px] leading-relaxed text-dump">
        Your cards could not be read. That is this page failing, not an empty wallet.
      </p>
    );
  }

  if (held === null) {
    return <p className="text-[11px] leading-relaxed text-muted">Looking…</p>;
  }

  if (held.length === 0) {
    return (
      <p className="max-w-2xl text-[11px] leading-relaxed text-muted">
        Nothing yet.{" "}
        <Link href="/mint" className="text-pump hover:underline">
          The mint is open
        </Link>{" "}
        — and if you have just minted, give it a minute: this reads a table that is kept up to date
        from the chain rather than asking the chain per visitor.
      </p>
    );
  }

  const cards = distinct(held);

  return (
    <>
      <p className="max-w-2xl text-[11px] leading-relaxed text-muted">
        <span className="text-fg tabular-nums">{held.length}</span>{" "}
        {held.length === 1 ? "token" : "tokens"}, covering{" "}
        <span className="text-fg tabular-nums">{cards.length}</span>{" "}
        {cards.length === 1 ? "card" : "different cards"}. A second copy of a card is a real thing
        to hold — it is what you trade — but it is drawn once here.
      </p>
      <div className="mt-6">
        <Gallery cards={cards} />
      </div>
    </>
  );
}
