"use client";

// TAKE PROFIT, on both tables.
//
// It used to be written twice — once in Game.tsx against the engine directly,
// once in MatchBoard.tsx against a field on the view — and the two drifted the
// way two copies of anything drift. One had a tooltip and the other did not.
// One printed the cost in a dimmer colour beside the label, the other printed it
// in the label. Neither was wrong; they were just not the same button, and the
// player who plays a solo match and then a PvP match is one player.
//
// The bigger thing they disagreed about was what to do when the move is not
// legal, and both did the same wrong thing: `canTakeProfit && <button>`, so the
// control vanished. That reads as "this game does not have that" rather than
// "not right now, and here is why". The maker lost a turn to it — could not
// bank, could not tell what had stopped him, and the reason was a card sitting
// on the opponent's board that no part of the screen pointed at.
//
// So the button never leaves. It goes quiet, it says why, and while you are
// pointing at it the position holding the rule up lights in this button's own
// gold. The reason comes from the engine (whyNoProfit) because there are two
// tables and only one rule; the highlight is the caller's job, because only the
// table knows where it draws the opponent's board.

import { formatMC } from "@/engine/format";
import type { Refusal } from "@/engine/match";
import { TURN_ACTION_COST } from "@/engine/types";
import { cx } from "@/lib/cx";

interface Props {
  /** Why the move is refused, or null when it is allowed. Straight from the engine. */
  noProfit: Refusal | null;
  /** Held off while a move is in flight. PvP only; solo resolves at once. */
  busy?: boolean;
  onTakeProfit: () => void;
  /**
   * Point at the position holding the rule up, or at nothing.
   *
   * Called with the opponent's slot on hover and with null on leave. The table
   * decides what pointing looks like; this decides when.
   */
  onBlame?: (slot: number | null) => void;
}

export function TakeProfitButton({ noProfit, busy = false, onTakeProfit, onBlame }: Props) {
  const blocked = noProfit !== null;
  const blame = noProfit?.blocking?.slot ?? null;

  // Only ever "stop pointing" plus, when there is something to point at, where.
  // Written once rather than at three call sites: a leave handler that forgets
  // to clear leaves a card glowing at a player who is looking somewhere else,
  // and a stuck highlight is worse than none — it points at the wrong card with
  // exactly the same confidence.
  const point = (slot: number | null) => onBlame?.(slot);

  return (
    <button
      type="button"
      // Not `disabled`. A disabled button takes no pointer events in any
      // browser, so it cannot be hovered, so it cannot explain itself — which
      // would leave the highlight and the tooltip unreachable on the one press
      // that needs them. It refuses in the handler instead.
      aria-disabled={blocked || busy}
      onClick={() => {
        if (blocked || busy) return;
        onTakeProfit();
      }}
      onPointerEnter={() => blocked && point(blame)}
      onPointerLeave={() => point(null)}
      // Touch has no hover. The reason still has to be reachable, so a tap on a
      // refused button points at the blocking card instead of doing nothing —
      // and the tap that follows anywhere else clears it, via the same leave.
      onPointerCancel={() => point(null)}
      onFocus={() => blocked && point(blame)}
      onBlur={() => point(null)}
      title={noProfit?.reason ?? `Close a position and bank what it made. Costs ${formatMC(TURN_ACTION_COST)} of this turn's marketing budget.`}
      className={cx(
        "border px-3 py-2 text-[9px] tracking-[0.18em] transition-colors",
        blocked || busy
          ? "cursor-not-allowed border-line-strong bg-transparent text-faint"
          : "border-gold/60 bg-gold/10 text-gold hover:bg-gold hover:text-ground",
      )}
    >
      TAKE PROFIT <span className={blocked || busy ? "text-faint" : "text-gold/70"}>{formatMC(TURN_ACTION_COST)}</span>
    </button>
  );
}
