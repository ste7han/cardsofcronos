import { moodOf } from "@/lib/art";
import { cx } from "@/lib/cx";
import { SET } from "@/lib/set";

/**
 * Every ticker in the set scrolling past, green or red depending on what the card
 * does. Two identical halves side by side, so the loop is seamless.
 */
export function Tickertape() {
  const rows = SET.map((card) => ({
    ticker: card.ticker,
    up: moodOf(card) === "pump",
  }));

  return (
    <div className="overflow-hidden border-y border-line bg-panel py-2" aria-hidden>
      <div className="tape flex w-max">
        {[0, 1].map((half) => (
          <div key={half} className="flex shrink-0">
            {rows.map((row, i) => (
              <span
                key={`${half}-${i}`}
                className="flex items-center gap-1.5 px-4 text-[10px] tracking-[0.1em] whitespace-nowrap"
              >
                <span className="text-muted">{row.ticker}</span>
                <span className={cx(row.up ? "text-pump" : "text-dump")}>{row.up ? "▲" : "▼"}</span>
              </span>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
