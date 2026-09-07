// One card on screen — as an object, not an information panel.
//
// The build is that of a real trading card: a header band with the game name, an
// art window with its own frame, a name plate, and a footer with the stats and the
// effect. Rarity lives in the border colour, the corner brackets and the header
// band, not in a badge you have to go looking for.
//
// The shape is fixed at 5:7, which is what a card in your hand is (63 by 88mm is
// 1:1.40). It has to be stated rather than left to the content: with a
// content-driven height the card ran to 1:2.01 and every card was a slightly
// different length, which reads as a list of panels rather than a set of cards.
// Everything inside is therefore a proportion of the width, never a pixel height —
// a fixed art window is exactly what stretched it in the first place.
//
// The rules text comes from engine/rules-text.ts and is only displayed here. There
// is deliberately no written rules text in the card data: what you read here is by
// definition what the engine does.

import { CardArt } from "@/components/CardArt";
import { RarityMark } from "@/components/RarityMark";
import { Icon } from "@/components/Icon";
import { formatMC } from "@/engine/format";
import { effectLines, rulesText } from "@/engine/rules-text";
import type { Card } from "@/engine/types";
import { MARKETING_COST } from "@/engine/types";
import { cx } from "@/lib/cx";
import { RARITY, SECTOR_LABEL, TYPE_LABEL } from "@/lib/rarity";

interface Props {
  card: Card;
  /** Smaller size, for the hand. */
  compact?: boolean;
  className?: string;
}

export function CardView({ card, compact = false, className }: Props) {
  const style = RARITY[card.rarity];
  const lines = compact ? effectLines(card) : rulesText(card);
  const precious = card.rarity === "legendary" || card.rarity === "mythic";

  /**
   * The tier's colour at a given strength, as a hex alpha suffix.
   *
   * Everything tinted on the card goes through this, so raising a tier's
   * saturation raises it everywhere at once rather than in the one place
   * somebody remembered to change.
   */
  // Surfaces take the tier, edges do not. Every line on the card used to scale
  // with saturation too, so a mythic lit up four concentric rings — the border,
  // the keyline, the window and the grooves — and read as busy rather than rare.
  // A common looked right only because at 0.18 none of them showed. Colour lives
  // in the washes and the plates now; the lines stay neutral on every tier.
  const tint = (base: number) =>
    Math.round(Math.min(255, base * style.saturation))
      .toString(16)
      .padStart(2, "0");

  return (
    <article
      className={cx(
        "@container card-frame card-grain relative flex aspect-[5/7] flex-col overflow-hidden",
        precious && "card-foil",
        className,
      )}
      style={{
        // The band is the border. Two colour stops rather than one flat line, so
        // the edge has a direction to it — that is most of what separates a
        // printed frame from a rectangle with a stroke.
        border: `${precious ? 2 : 1.5}px solid transparent`,
        backgroundImage: [
          // Two washes, so the colour reaches the bottom of the card instead of
          // stopping under the art. A common barely registers; a mythic is red
          // all the way down.
          `radial-gradient(120% 80% at 50% -10%, ${style.colour}${tint(0x62)}, rgba(0,0,0,0) 62%),` +
            `radial-gradient(140% 70% at 50% 112%, ${style.colour}${tint(0x40)}, rgba(0,0,0,0) 64%),` +
            `linear-gradient(var(--color-panel), var(--color-panel))`,
          `linear-gradient(150deg, ${style.colour}, ${style.colour}55 38%, ${style.colour}dd 62%, ${style.colour}88)`,
        ].join(", "),
        backgroundOrigin: "border-box",
        backgroundClip: "padding-box, border-box",
        boxShadow: precious
          ? `inset 0 0 0 1px rgba(255,255,255,0.09), inset 0 1px 0 rgba(255,255,255,0.15), inset 0 -1px 0 rgba(0,0,0,0.6), 0 0 26px -10px ${style.colour}, 0 18px 38px -26px rgba(0,0,0,0.95)`
          : `inset 0 0 0 1px rgba(255,255,255,0.06), inset 0 1px 0 rgba(255,255,255,0.11), inset 0 -1px 0 rgba(0,0,0,0.55), 0 18px 38px -26px rgba(0,0,0,0.95)`,
      }}
    >
      {/* An inner keyline rather than four corner ticks. The ticks were square
          marks pinned to the sharp corners of a card that now has rounded ones,
          so they cut straight across the edge. A printed card has a line inside
          its border; this is that, and it follows the radius. */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-[3px] z-10 rounded-[7px]"
        style={{ boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.055)" }}
      />

      {/* Header band */}
      <header
        className={cx(
          "relative flex shrink-0 items-center justify-between gap-2 border-b",
          compact ? "px-2 py-1" : "px-2.5 py-1.5",
        )}
        style={{
          // Dark, whatever the tier. The wash that runs the rest of the card
          // reached this band too and it fought the wordmark — the one strip
          // that should read the same on all 535 cards. The tier is still here,
          // in the two pieces of text and the edge underneath them.
          borderColor: "rgba(0,0,0,0.6)",
          background:
            "linear-gradient(to bottom, rgba(28,33,42,0.97), rgba(16,20,27,0.98))",
          boxShadow: "inset 0 1px 0 rgba(255,255,255,0.11), inset 0 -1px 0 rgba(0,0,0,0.55)",
        }}
      >
        <span
          className={cx("display tracking-tight", compact ? "text-[9px]" : "text-[10px]")}
          style={{ color: style.colour }}
        >
          {compact ? "COC" : "CARDS OF CRONOS"}
        </span>
        <span
          className={cx("flex items-center gap-1 tracking-[0.16em]", compact ? "text-[6.5px]" : "text-[7.5px]")}
          style={{ color: style.colour }}
        >
          {style.label}
          <RarityMark
            rarity={card.rarity}
            colour={style.colour}
            className={compact ? "h-2 w-2" : "h-2.5 w-2.5"}
          />
        </span>
      </header>

      {/* Art window, with its own frame and a little air around it */}
      <div className={cx("relative shrink-0", compact ? "px-1.5 pt-1.5" : "px-2 pt-2")}>
        {/* What it costs to play. Top-left of the art, where a mana cost sits on
            every card game anyone has played. */}
        <span
          className={cx(
            "absolute z-10 flex items-center justify-center border border-gold bg-ground/90",
            "display tabular-nums text-gold",
            compact ? "top-0.5 left-0.5 px-1 text-[8px]" : "top-1 left-1 px-1.5 py-0.5 text-[10px]",
          )}
          title={`Costs ${formatMC(MARKETING_COST[card.rarity])} of marketing budget to play`}
        >
          {formatMC(MARKETING_COST[card.rarity])}
        </span>
        <div
          className="card-window relative overflow-hidden border"
          style={{ borderColor: "rgba(0,0,0,0.75)", background: "#05070a" }}
        >
          {/* 16:9 at full size, which is what the art is generated at and about
              the share a printed card gives its window. In the hand the card is
              168px and a three-line effect ran off the bottom, so the window
              flattens to 2:1 there — the art is decoration at that size and the
              rules are the thing you are reading. */}
          <CardArt
            card={card}
            className={cx("block w-full", compact ? "aspect-[2/1]" : "aspect-video")}
          />
          {/* Sheen across the window, so it reads as glass rather than a picture. */}
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-white/8 via-transparent to-transparent" />
        </div>
      </div>

      {/* Name plate */}
      <div
        className={cx(
          "card-plate shrink-0 text-center",
          compact ? "mx-1.5 my-1 px-1 py-1" : "mx-2 my-2 px-2 py-1.5",
        )}
        style={{
          background: `linear-gradient(to bottom, ${style.colour}${tint(0x55)}, ${style.colour}${tint(0x18)} 55%, rgba(0,0,0,0.34))`,
        }}
      >
        <h3 className={cx("display leading-none", compact ? "text-[10px]" : "text-[13px]")}>
          {card.name}
        </h3>
        {/* The moment, under the project it belongs to. Eight cards called
            Obsidian Finance with a numeral beneath is what makes them read as
            one family at a glance and still be nameable one at a time. */}
        {card.type === "project" && card.moment && (
          <p
            className={cx(
              "mt-0.5 leading-none text-fg/70",
              // One line in hand. A long subtitle wrapped to two at 128px wide
              // and pushed the effect off the bottom, which is a name costing a
              // rule its place on the card. A numeral cannot do that.
              compact ? "truncate text-[7.5px]" : "text-[9px]",
            )}
          >
            {card.moment}
          </p>
        )}
        <p
          className={cx(
            "mt-1 tracking-[0.18em] text-faint",
            compact ? "text-[6px]" : "text-[7px]",
          )}
        >
          {TYPE_LABEL[card.type]}
          {card.type === "project" ? ` · ${SECTOR_LABEL[card.sector]}` : ""}
        </p>
      </div>

      {/* Footer: stats and effect */}
      <div
        className={cx(
          "flex min-h-0 flex-1 flex-col gap-1",
          compact ? "px-2 pb-2" : "px-2.5 pb-2.5",
        )}
      >
        {card.type === "project" && (
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <Stat icon="mc" value={formatMC(card.launchMC)} compact={compact} />
            {/* At compact size "/t" no longer fits without clipping; the arrow icon
                already says it happens every turn. */}
            <Stat
              icon="pump"
              value={compact ? formatMC(card.pumpMC) : `${formatMC(card.pumpMC)}/t`}
              compact={compact}
              tone="pump"
            />
            <Stat icon="holders" value={String(card.holders)} compact={compact} />
          </div>
        )}

        {card.type === "project" && (
          <hr
            className="card-groove"
            aria-hidden
          />
        )}

        <ul
          className={cx(
            "space-y-0.5 leading-snug",
            // In hand the list gives rather than pushes. Chasing this one card
            // width at a time got it down to two in a hundred and no further,
            // because the height depends on the text and the text is different
            // on every card. min-h-0 with overflow hidden makes "never overflows"
            // a property of the layout instead of a coincidence of the wording.
            compact ? "min-h-0 flex-1 overflow-hidden text-[8px]" : "text-[9.5px]",
            card.type === "project" && "pt-1.5",
          )}
        >
          {lines.map((line) => (
            <li key={line.text} className="flex gap-1.5">
              <Icon
                name={line.kind === "aura" ? "aura" : "effect"}
                className={cx("mt-px shrink-0", compact ? "h-2.5 w-2.5" : "h-3 w-3")}
              />
              {/* In hand the card is a thumbnail: 128px wide, and a long effect
                  runs past the bottom. Clamped with an ellipsis rather than
                  silently cut, and the full text is one hover away in the card
                  beside the table — which you have to hover anyway to play it.
                  At full size nothing is clamped, because nothing needs to be. */}
              <span className={cx("text-fg/85", compact && "line-clamp-2")}>{line.text}</span>
            </li>
          ))}

        </ul>

        {!compact && (
          <hr
            className="card-groove mt-auto"
            aria-hidden
          />
        )}
        {/* The flavour, on every card at every size.
            It used to appear on a compact card only when there were no rules
            lines at all — a fallback so a card with no effect did not show a
            blank panel. That read as a deliberate choice for as long as most
            cards had no effect. The moment ninety single-project cards got one,
            the same rule quietly took the flavour off all of them, and the
            panel it was filling turned out to have room for both.
            Clamped rather than cut when compact, and the full line is always on
            the large card. */}
        <p
          className={cx(
            "mt-auto text-faint italic leading-snug",
            // Below about 170px the card cannot carry both, and the rules text is
            // the half you are reading. A container query rather than another
            // prop: the card knows how wide it has been made, and every caller
            // gets the right answer without having to be told what size it asked
            // for. Passing a size in would mean the gallery, the hand, the deck
            // builder and the pack opening each having to agree, and one of them
            // eventually not.
            compact ? "hidden pt-1 text-[7.5px] @[170px]:line-clamp-2 @[170px]:block" : "pt-2 text-[9px]",
          )}
        >
          {card.flavour}
        </p>
      </div>
    </article>
  );
}

function Stat({
  icon,
  value,
  compact,
  tone,
}: {
  icon: "mc" | "pump" | "holders";
  value: string;
  compact: boolean;
  tone?: "pump";
}) {
  return (
    <span
      className={cx(
        "inline-flex items-center gap-1 tabular-nums",
        compact ? "text-[8px]" : "text-[10px]",
        tone === "pump" ? "text-pump" : "text-fg",
      )}
    >
      <Icon name={icon} className={cx("shrink-0 text-muted", compact ? "h-3 w-3" : "h-3.5 w-3.5")} />
      {value}
    </span>
  );
}

