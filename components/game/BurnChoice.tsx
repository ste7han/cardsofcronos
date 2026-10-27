"use client";

// "Look at the top N of their deck and take one out" — the choice itself.
//
// Both tables ask it, so it lives here rather than in either. It was two copies
// of the same overlay, and the complaint that came back about it applied to
// both: the cards were drawn compact, at 150 pixels, and at that size the rules
// text is not readable. A choice about which card to take away from somebody is
// a choice about what those cards DO, so it was being made by guessing.
//
// ── TAPPING A CARD READS IT; TAKING IT OUT IS ITS OWN BUTTON ─────────────────
//
// It used to be one tap on the card, and that tap was final — the card left
// their deck for good. That is fine with a mouse and wrong on a phone, where the
// natural thing to do with a card you cannot read is to tap it, and tapping it
// was the irreversible move. The same rule PeekButton states for the hand: one
// tap cannot mean both "show me this" and "do this", and here the doing cannot
// be undone. So a tap opens the card at full size, and the button underneath —
// on the row, or on the open card — is the only thing that takes one out.
//
// ── DECLARED AT MODULE LEVEL, AND THAT IS NOT STYLE ──────────────────────────
//
// MatchBoard re-renders once a second for its clock. Declared inside it, this
// would be a new component every second and the open card would close before it
// could be read — which is exactly what happened to `Side`. See CLAUDE.md.
//
// ── PORTALLED TO THE BODY ────────────────────────────────────────────────────
//
// For the reason CardPeek gives: globals.css lifts every direct child of <body>
// onto its own layer, so a fixed overlay rendered inside <main> paints UNDER the
// site footer. The compact row fitted above the fold and nobody saw it; a card
// opened at full size on a phone reaches the footer, and the footer's links
// drew straight through the buttons.

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

import { CardView } from "@/components/CardView";
import type { Card } from "@/engine/types";
import { cx } from "@/lib/cx";

/** "NEXT" for the top, then how far down. The order is the order they draw in. */
const placeOf = (at: number) => (at === 0 ? "NEXT" : `${at + 1} DOWN`);

export function BurnChoice({
  cards,
  onPick,
  busy = false,
}: {
  /** The top of their deck, top first. */
  cards: readonly Card[];
  /** Takes the card at this position out. Final. */
  onPick: (index: number) => void;
  /** A move is on its way to the server; nothing can be picked twice. */
  busy?: boolean;
}) {
  const [reading, setReading] = useState<number | null>(null);

  // Arrows to step through them, Escape to go back to all of them. Comparing is
  // the whole point of opening one, so the next is a key away rather than a
  // close and a reopen.
  useEffect(() => {
    if (reading === null) return;
    const key = (event: KeyboardEvent) => {
      if (event.key === "Escape") setReading(null);
      if (event.key === "ArrowRight") setReading((at) => (at === null ? at : (at + 1) % cards.length));
      if (event.key === "ArrowLeft")
        setReading((at) => (at === null ? at : (at - 1 + cards.length) % cards.length));
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [reading, cards.length]);

  // The body only exists in the browser.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const open = reading === null ? null : cards[reading];

  if (!mounted) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-ground/92 p-4 backdrop-blur-md">
      <div className="w-full max-w-3xl py-4">
        <p className="text-center text-[10px] tracking-[0.28em] text-faint">THE TOP OF THEIR DECK</p>
        <h2 className="display mt-2 text-center text-2xl sm:text-3xl">TAKE ONE OUT</h2>

        {open === null || open === undefined || reading === null ? (
          <>
            <p className="mx-auto mt-3 max-w-md text-center text-[11px] leading-relaxed text-muted">
              They have not seen these yet, and they will never draw the one you pick. The rest stay
              where they are, in this order. Tap a card to read it.
            </p>

            <div className="mt-6 flex flex-wrap items-start justify-center gap-3">
              {cards.map((card, at) => (
                <div key={`${card.id}-${at}`} className="w-[150px]">
                  {/* Numbered, because "the top of their deck" is an order and
                      the one on the left is the one they draw next. */}
                  <p className="mb-1 text-center text-[9px] tracking-[0.2em] text-faint">{placeOf(at)}</p>
                  <button
                    type="button"
                    onClick={() => setReading(at)}
                    title="Read this card"
                    aria-label={`Read ${card.name}`}
                    className="group relative block w-full text-left transition-transform hover:-translate-y-1"
                  >
                    <CardView card={card} compact className="group-hover:ring-2 group-hover:ring-gold" />
                    {/* A magnifier, drawn rather than typed, the same as PeekButton's. */}
                    <span className="absolute -top-2 -left-2 z-10 flex h-7 w-7 items-center justify-center border border-line-strong bg-ground text-muted group-hover:border-gold group-hover:text-gold">
                      <svg viewBox="0 0 16 16" className="h-4 w-4" fill="none" aria-hidden>
                        <circle cx="7" cy="7" r="4.5" stroke="currentColor" strokeWidth="1.5" />
                        <path d="M10.5 10.5 14 14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                      </svg>
                    </span>
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => onPick(at)}
                    className="mt-2 w-full border border-dump/60 py-1.5 text-[10px] tracking-[0.2em] text-dump transition-colors hover:bg-dump hover:text-ground disabled:opacity-50"
                  >
                    TAKE OUT
                  </button>
                </div>
              ))}
            </div>
          </>
        ) : (
          <div className="mt-5 flex flex-col items-center">
            <p className="text-[10px] tracking-[0.24em] text-faint">
              {placeOf(reading)} · {reading + 1} OF {cards.length}
            </p>

            <div className="mt-3 flex items-center gap-2 sm:gap-4">
              <Step label="Previous card" onClick={() => setReading((reading - 1 + cards.length) % cards.length)}>
                ‹
              </Step>
              {/* Full size: the same CardView the hover peek opens, wide enough
                  for the rules to be set at the size they were designed at. */}
              <div className="w-[min(320px,68vw)] drop-shadow-[0_18px_38px_rgba(0,0,0,0.75)]">
                <CardView card={open} />
              </div>
              <Step label="Next card" onClick={() => setReading((reading + 1) % cards.length)}>
                ›
              </Step>
            </div>

            <div className="mt-5 flex w-full max-w-sm flex-col gap-2 sm:flex-row">
              <button
                type="button"
                disabled={busy}
                onClick={() => onPick(reading)}
                className="flex-1 border border-dump bg-dump py-2.5 text-[11px] tracking-[0.2em] text-ground transition-opacity hover:opacity-90 disabled:opacity-50"
              >
                TAKE THIS ONE OUT
              </button>
              <button
                type="button"
                onClick={() => setReading(null)}
                className="flex-1 border border-line-strong py-2.5 text-[11px] tracking-[0.2em] text-muted transition-colors hover:text-fg"
              >
                BACK TO ALL {cards.length}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}

function Step({ label, onClick, children }: { label: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className={cx(
        "flex h-11 w-9 shrink-0 items-center justify-center border border-line-strong bg-ground",
        "text-2xl leading-none text-muted transition-colors hover:border-gold hover:text-gold",
      )}
    >
      {children}
    </button>
  );
}
