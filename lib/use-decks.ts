"use client";

// Fetching this wallet's decks, and saying when they changed.
//
// The screens read a deck synchronously — the lobby during render, the table
// when it deals — because a deck that arrives as a promise would mean every one
// of them learning to draw a deck that is not there yet. lib/deck-storage.ts
// keeps a cache for exactly that, and this is what fills it.
//
// So the shape is: sync on mount and on every wallet change, then hand back a
// number that goes up whenever the cache changes. A component reading
// `loadDeck()` during render re-renders because the number moved; one reading in
// an effect puts the number in its deps. Nothing has to know where a deck came
// from.
//
// `ready` is not the same question as "has decks", the same way it is not in
// useSession. Before the fetch lands they look identical and mean opposite
// things — "this wallet has no decks" versus "we have not asked yet" — and a
// screen that cannot tell them apart offers the deck builder to somebody who
// has four. That is the bug this whole change is about, so it would be a poor
// place to reintroduce it.

import { useEffect, useState } from "react";

import { DECKS_EVENT, syncDecks } from "@/lib/deck-storage";
import { useSession } from "@/lib/use-session";

export interface Decks {
  /** Goes up whenever the cached decks change. Meaningless on its own. */
  stamp: number;
  /** Whether the answer on screen is one the server gave. */
  ready: boolean;
}

export function useDecks(): Decks {
  const { wallet, ready: session } = useSession();
  const [stamp, setStamp] = useState(0);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const bump = () => setStamp((n) => n + 1);
    window.addEventListener(DECKS_EVENT, bump);
    // Saving a deck in another tab is the same wallet's deck changing.
    window.addEventListener("storage", bump);
    return () => {
      window.removeEventListener(DECKS_EVENT, bump);
      window.removeEventListener("storage", bump);
    };
  }, []);

  useEffect(() => {
    if (!session) return;
    // Signed out is answered without asking. It is not "no decks" either, but
    // the screens ask about the wallet first and never get this far.
    if (wallet === null) {
      setReady(true);
      return;
    }

    let current = true;
    setReady(false);
    void syncDecks().then(() => {
      // A wallet switched mid-request must not mark the new one ready on the
      // strength of the old one's answer.
      if (current) setReady(true);
    });
    return () => {
      current = false;
    };
  }, [session, wallet]);

  return { stamp, ready };
}
