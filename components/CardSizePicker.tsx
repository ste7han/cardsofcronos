"use client";

import { CARD_SIZES, type CardSize } from "@/lib/card-size";
import { cx } from "@/lib/cx";

/** Three steps, smallest first, so the row reads the way the cards will look. */
export function CardSizePicker({
  size,
  onPick,
}: {
  size: CardSize;
  onPick: (next: CardSize) => void;
}) {
  return (
    <div className="flex items-center gap-1" title="How big the cards are laid out">
      {CARD_SIZES.map((option) => (
        <button
          key={option.id}
          type="button"
          onClick={() => onPick(option.id)}
          aria-pressed={size === option.id}
          className={cx(
            "border px-2 py-1.5 text-[10px] tracking-[0.14em] transition-colors",
            size === option.id
              ? "border-pump text-pump"
              : "border-line text-muted hover:border-line-strong hover:text-fg",
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
