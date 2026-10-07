// How big the cards are laid out, on the pages that show a lot of them.
//
// Three steps rather than a slider, and each one carries the card variant that
// is honest at that width. The full card is drawn for about 400px and starts
// losing the bottom of its own rules text below roughly 320 — so "smaller" does
// not squeeze it, it switches to the compact card, which is drawn for about 160.
// A slider would let you pick the widths in between, where the card is neither.
//
// The choice is remembered, because it is a preference about your eyes and your
// screen rather than about the page you happen to be on.

"use client";

import { useEffect, useState } from "react";

export type CardSize = "small" | "medium" | "large";

export const CARD_SIZES: {
  id: CardSize;
  label: string;
  /** Narrowest a card may be laid out at. The grid fits as many as it can. */
  min: number;
  /** Below the full card's floor, the compact face is the honest one. */
  compact: boolean;
}[] = [
  { id: "small", label: "S", min: 140, compact: true },
  { id: "medium", label: "M", min: 210, compact: true },
  { id: "large", label: "L", min: 320, compact: false },
];

export const sizeOf = (id: CardSize) => CARD_SIZES.find((s) => s.id === id) ?? CARD_SIZES[2]!;

const KEY = "tcg.cardsize.v1";

/**
 * Reads after mount, never during render.
 *
 * localStorage does not exist on the server, so a first render that guessed at
 * it would be a hydration mismatch — the same reason the collection is loaded in
 * an effect. Everyone starts on the fallback for one frame.
 *
 * `fallback` is only what somebody sees before they have ever chosen. The deck
 * builder passes "medium": it is a page you work on, where seeing five cards
 * across matters more than reading one, while /cards is a page you browse and
 * large is right there. Once anybody picks a size it is theirs on both, which is
 * the point of storing it — this is a preference about eyes and screens, not
 * about which page you happen to be on.
 */
export function useCardSize(
  fallback: CardSize = "large",
): [CardSize, (next: CardSize) => void] {
  const [size, setSize] = useState<CardSize>(fallback);

  useEffect(() => {
    const stored = window.localStorage.getItem(KEY);
    if (stored && CARD_SIZES.some((s) => s.id === stored)) setSize(stored as CardSize);
  }, []);

  return [
    size,
    (next: CardSize) => {
      setSize(next);
      window.localStorage.setItem(KEY, next);
    },
  ];
}
