"use client";

// Read a card in your hand, on a screen that cannot hover.
//
// Both tables put the card you are pointing at up over the table at a size you
// can actually read, because a hand row big enough to read five cards at once
// does not fit beside two boards. On a mouse that is a hover and costs nothing.
// On a finger there is no such thing: a tap fires pointerenter, never fires
// pointerleave, and is also the gesture that plays the card — so the preview
// opened on every play, stayed open, and after the hand re-indexed it showed a
// card that was no longer the one you touched.
//
// The pointer handlers are mouse-only now, which fixes that and takes reading a
// card away from every phone. This gives it back as its own affordance rather
// than as a second meaning for the tap: one tap cannot mean both "show me this"
// and "play this", and of the two, play is the one the card is for.
//
// Same shape and the same reasoning as DiscardButton beside it, including
// living here rather than in either table: the two track hover differently and
// this is a property of the card it sits on.

import { cx } from "@/lib/cx";

export function PeekButton({
  open,
  onToggle,
}: {
  /** Is this card the one currently being shown? */
  open: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={(event) => {
        // The card underneath is a button too, and it plays.
        event.stopPropagation();
        onToggle();
      }}
      title="Read this card"
      aria-label="Read this card"
      className={cx(
        "absolute -top-2 -left-2 z-20 flex h-6 w-6 items-center justify-center",
        "border text-[11px] leading-none transition-colors",
        // Only where hovering does not exist. Everywhere else the hover already
        // does this, and a button that duplicates a hover is a button in the way
        // — the same rule DiscardButton uses for the opposite corner.
        "hidden [@media(hover:none)]:flex",
        open
          ? "border-gold bg-gold text-ground"
          : "border-line-strong bg-ground text-muted",
      )}
    >
      {/* A magnifier, drawn rather than typed: the glyph renders as an emoji on
          iOS and as a box on some Androids. */}
      <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none" aria-hidden>
        <circle cx="7" cy="7" r="4.5" stroke="currentColor" strokeWidth="1.5" />
        <path d="M10.5 10.5 14 14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    </button>
  );
}
