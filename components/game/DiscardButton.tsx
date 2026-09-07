"use client";

// The × on a card, on both tables.
//
// Same shape as TakeProfitButton and the same complaint behind it: this was
// `canDiscard && <button>` on both tables, so whenever the move was refused the
// × was not there and the mechanic looked like something the game does not
// have. Every reason it can give is technically already on screen — the budget
// bar, the hand — but that is an argument for why the player *could* work it
// out, and the number you are short by is exactly what nobody notices.
//
// Its own button rather than a mode on the card, and that was already true
// before this: the card you cannot play is exactly the one you most want to
// throw away, so the two must not share a disabled state.
//
// Hidden until the card is hovered, and never hidden where hovering is not a
// thing. That behaviour was on the solo table only; the PvP one showed every ×
// all the time, which is five of them permanently in front of the cards you are
// choosing between. It lives here now so there is one answer.
//
// Done with group-hover rather than by threading a hovered index down from each
// table, because the two tables track hover differently and this is a property
// of the card it sits on, not of either of them. The parent needs `group`.

import { formatMC } from "@/engine/format";
import type { Refusal } from "@/engine/match";
import { TURN_ACTION_COST } from "@/engine/types";
import { cx } from "@/lib/cx";

interface Props {
  /** What is being thrown away, for the tooltip when the move is allowed. */
  cardName: string;
  /** Why the move is refused, or null when it is allowed. Straight from the engine. */
  noDiscard: Refusal | null;
  /** Held off while a move is in flight. PvP only; solo resolves at once. */
  busy?: boolean;
  onDiscard: () => void;
}

export function DiscardButton({ cardName, noDiscard, busy = false, onDiscard }: Props) {
  const blocked = noDiscard !== null;

  return (
    <button
      type="button"
      // Not `disabled`, for the reason TakeProfitButton gives: a disabled button
      // takes no pointer events, so it cannot be hovered, so it cannot explain
      // itself — and explaining itself is the whole of this change. It refuses
      // in the handler instead.
      aria-disabled={blocked || busy}
      onClick={() => {
        if (blocked || busy) return;
        onDiscard();
      }}
      title={
        noDiscard?.reason ??
        `Throw away ${cardName} — costs ${formatMC(TURN_ACTION_COST)} of this turn's budget, and you draw back up next turn.`
      }
      className={cx(
        "absolute -top-2 -right-2 z-20 flex h-6 w-6 items-center justify-center",
        "border text-[11px] leading-none transition-colors",
        // A pointer that cannot hover would never reveal this, which took the
        // whole throw-away mechanic off every phone once. Hidden until hover
        // only where hovering exists.
        "opacity-0 group-hover:opacity-100 focus-visible:opacity-100 [@media(hover:none)]:opacity-100",
        blocked || busy
          ? "cursor-not-allowed border-line bg-ground/70 text-faint"
          : "border-line-strong bg-ground text-muted hover:border-dump hover:bg-dump hover:text-ground",
      )}
    >
      ×
    </button>
  );
}
