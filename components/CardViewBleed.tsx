// The same card, with the art doing the work.
//
// An alternative to CardView, not a replacement — both exist so they can be put
// next to each other and one can be chosen. Nothing in the game uses this yet.
//
// The difference is where the art goes. CardView gives it a window at about 38%
// of the card, which is what a printed card does and what suits the procedural
// chart, since a chart is a texture rather than a subject. Real art is a subject,
// and a subject in a stamp-sized window reads as an illustration attached to a
// card. Here the art is the card: full bleed, with everything else over a scrim
// at the bottom.
//
// What it costs is room for words. The flavour goes, the effect gets two lines,
// and anything longer is the reason to keep the other frame.

import { CardArt } from "@/components/CardArt";
import { Icon } from "@/components/Icon";
import { formatMC } from "@/engine/format";
import { effectLines } from "@/engine/rules-text";
import type { Card } from "@/engine/types";
import { MARKETING_COST } from "@/engine/types";
import { cx } from "@/lib/cx";
import { RARITY, SECTOR_LABEL, TYPE_LABEL } from "@/lib/rarity";

export function CardViewBleed({ card, className }: { card: Card; className?: string }) {
  const style = RARITY[card.rarity];
  const lines = effectLines(card);
  const precious = card.rarity === "legendary" || card.rarity === "mythic";

  return (
    <article
      className={cx("relative flex aspect-[5/7] flex-col overflow-hidden", className)}
      style={{
        border: `1px solid ${style.colour}`,
        boxShadow: precious
          ? `inset 0 0 0 1px rgba(255,255,255,0.10), 0 0 30px -8px ${style.colour}`
          : "inset 0 0 0 1px rgba(255,255,255,0.05)",
        background: "var(--color-panel)",
      }}
    >
      {/* The art, filling everything. */}
      <CardArt card={card} className="absolute inset-0 h-full w-full" />

      {/* A scrim rather than a panel: the art keeps going underneath the words
          instead of stopping at a line above them. */}
      <div
        aria-hidden
        className="absolute inset-x-0 bottom-0 h-[62%]"
        style={{
          background:
            "linear-gradient(to top, rgba(4,6,8,0.97) 0%, rgba(4,6,8,0.93) 34%, rgba(4,6,8,0.55) 62%, rgba(4,6,8,0) 100%)",
        }}
      />
      {/* A wash of the rarity colour over the top edge, so the tier reads before
          you have read anything. */}
      <div
        aria-hidden
        className="absolute inset-x-0 top-0 h-[26%]"
        style={{ background: `linear-gradient(to bottom, ${style.colour}38, transparent)` }}
      />

      <header className="relative flex items-start justify-between px-2.5 pt-2">
        <span
          className="display border border-gold bg-ground/85 px-1.5 py-0.5 text-[10px] tabular-nums text-gold"
          title={`Costs ${formatMC(MARKETING_COST[card.rarity])} of marketing budget to play`}
        >
          {formatMC(MARKETING_COST[card.rarity])}
        </span>
        <span
          className="border bg-ground/70 px-1.5 py-0.5 text-[7px] tracking-[0.18em]"
          style={{ borderColor: `${style.colour}88`, color: style.colour }}
        >
          {style.label}
        </span>
      </header>

      <div className="relative mt-auto px-3 pb-3">
        <h3 className="display text-[17px] leading-none">{card.name}</h3>
        {card.type === "project" && card.edition && (
          <p className="mt-1 text-[10px] leading-none text-fg/75">{card.edition}</p>
        )}
        <p className="mt-1.5 text-[7px] tracking-[0.2em] text-faint">
          {TYPE_LABEL[card.type]}
          {card.type === "project" ? ` · ${SECTOR_LABEL[card.sector]}` : ""}
        </p>

        {card.type === "project" && (
          <div className="mt-2 flex items-center gap-3 border-t border-white/12 pt-1.5 text-[10px] tabular-nums">
            <span className="inline-flex items-center gap-1">
              <Icon name="mc" className="h-3 w-3 text-muted" />
              {formatMC(card.launchMC)}
            </span>
            <span className="inline-flex items-center gap-1 text-pump">
              <Icon name="pump" className="h-3 w-3 text-muted" />
              {formatMC(card.pumpMC)}/t
            </span>
            <span className="inline-flex items-center gap-1">
              <Icon name="holders" className="h-3 w-3 text-muted" />
              {card.holders}
            </span>
          </div>
        )}

        {lines.length > 0 && (
          <ul
            className={cx(
              "space-y-0.5 text-[9.5px] leading-snug",
              card.type === "project" ? "mt-1.5" : "mt-2 border-t border-white/12 pt-1.5",
            )}
          >
            {lines.map((line) => (
              <li key={line.text} className="flex gap-1.5">
                <Icon
                  name={line.kind === "aura" ? "aura" : "effect"}
                  className="mt-px h-3 w-3 shrink-0"
                />
                <span className="text-fg/90">{line.text}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </article>
  );
}
