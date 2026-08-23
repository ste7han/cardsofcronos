"use client";

import { AnimatePresence, motion } from "framer-motion";

import { Icon } from "@/components/Icon";
import type { Marker } from "@/components/game/diff";
import { formatMC } from "@/engine/format";
import type { BoardProject as OnBoard, ProjectCard } from "@/engine/types";
import { cx } from "@/lib/cx";
import { RARITY, SECTOR_LABEL } from "@/lib/rarity";

interface Props {
  card: ProjectCard;
  onBoard: OnBoard;
  /** What this project yields this turn, including auras. Comes from pumpOf(). */
  pump: number;
  /** Is this project currently a valid target, and for what kind of action? */
  targetable?: false | "attack" | "bank";
  /** Set while a hand card is hovered and would touch this position. */
  preview?: { impact: "helps" | "hurts"; certain: boolean };
  /** What just happened to it: a number that rises, and whether it shakes. */
  marker?: Marker;
  onClick?: () => void;
}

export function BoardProject({
  card,
  onBoard,
  pump,
  targetable = false,
  preview,
  marker,
  onClick,
}: Props) {
  const damaged = onBoard.holders < card.holders;
  const style = RARITY[card.rarity];

  // Aiming beats previewing: once you have committed to a card, the board should
  // show what you can click, not what you were considering.
  const glow = targetable ? null : preview;
  const glowColour = glow?.impact === "helps" ? "0,224,138" : "255,77,77";
  // Banking your own position is not an attack, so it should not look like one.
  const aimColour = targetable === "bank" ? "245,196,81" : "255,77,77";

  return (
    <motion.button
      type="button"
      layout
      initial={{ opacity: 0, y: 24, scale: 0.9 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.85, filter: "blur(4px)" }}
      transition={{ type: "spring", stiffness: 380, damping: 26 }}
      disabled={!targetable}
      onClick={onClick}
      title={
        targetable === "bank"
          ? `Close ${card.name} and bank ${formatMC(onBoard.earned)}`
          : targetable
            ? `Target ${card.name}`
            : card.name
      }
      className={cx(
        "relative w-[104px] shrink-0 overflow-visible border px-2 py-1.5 text-left transition-colors sm:w-[124px]",
        marker?.hit && "hit",
        targetable ? "cursor-crosshair" : "cursor-default",
      )}
      style={{
        borderColor: targetable
          ? `rgb(${aimColour})`
          : glow
            ? `rgba(${glowColour},${glow.certain ? 0.85 : 0.45})`
            : `${style.colour}55`,
        // A card you will definitely hit gets a solid ring; one you might pick gets
        // a fainter one, because the preview should not claim to know more than it does.
        borderStyle: glow && !glow.certain ? "dashed" : "solid",
        background: `linear-gradient(165deg, ${style.colour}1f, rgba(0,0,0,0) 55%), var(--color-panel)`,
        boxShadow: targetable
          ? `0 0 26px -6px rgba(${aimColour},0.7), inset 0 1px 0 rgba(255,255,255,0.07)`
          : glow
            ? `0 0 ${glow.certain ? "30px -4px" : "22px -8px"} rgba(${glowColour},${glow.certain ? 0.75 : 0.45}), inset 0 1px 0 rgba(255,255,255,0.07)`
            : "inset 0 1px 0 rgba(255,255,255,0.06), 0 16px 30px -22px rgba(0,0,0,0.95)",
      }}
    >
      <div className="absolute inset-x-0 top-0 h-[2px]" style={{ background: style.colour }} />

      {/* The number that rises. This is what makes a move felt rather than merely
          visible in the log. */}
      <AnimatePresence>
        {marker && (
          <motion.span
            key={marker.text}
            initial={{ opacity: 0, y: 6, scale: 0.85 }}
            animate={{ opacity: 1, y: -18, scale: 1 }}
            exit={{ opacity: 0, y: -26 }}
            transition={{ duration: 0.55, ease: "easeOut" }}
            // Stays inside the board row's padding-top: that row scrolls
            // horizontally, which forces the browser to set overflow-y to auto —
            // so a number reaching too far above the card gets clipped.
            className={cx(
              "pointer-events-none absolute top-1 left-1/2 z-30 -translate-x-1/2 text-[12px] font-bold whitespace-nowrap",
              marker.tone === "pump" ? "text-pump" : "text-dump",
            )}
            style={{
              textShadow:
                marker.tone === "pump"
                  ? "0 0 14px rgba(0,224,138,0.8)"
                  : "0 0 14px rgba(255,77,77,0.8)",
            }}
          >
            {marker.text}
          </motion.span>
        )}
      </AnimatePresence>

      <p className="flex items-baseline justify-between gap-1">
        <span className="truncate text-[10px] font-bold tracking-tight">{card.ticker}</span>
        <span className="shrink-0 text-[7px] tracking-[0.14em] text-faint">
          {SECTOR_LABEL[card.sector]}
        </span>
      </p>

      <p
        className="mt-1 flex items-center gap-1 text-[10px] text-pump tabular-nums"
        title={`${formatMC(pump)} MC per turn`}
      >
        <Icon name="pump" className="h-3 w-3" />+{formatMC(pump)}
      </p>

      {/* What this position has produced, and therefore what a rug takes back.
          Close it yourself and you keep it; that is the whole decision. */}
      <p
        className="mt-0.5 flex items-center gap-1 text-[9px] text-gold tabular-nums"
        title={`${formatMC(onBoard.earned)} MC produced — banked if you close it, lost if it rugs`}
      >
        <Icon name="mc" className="h-3 w-3" />
        {formatMC(onBoard.earned)}
      </p>

      <div
        className="mt-1 flex items-center gap-1"
        title={`${onBoard.holders} of ${card.holders} holders`}
      >
        {Array.from({ length: card.holders }, (_, i) => (
          <span
            key={i}
            className={cx(
              "h-1.5 w-1.5 transition-colors",
              i < onBoard.holders ? "bg-fg" : "bg-line-strong",
            )}
          />
        ))}
        {damaged && <span className="ml-0.5 text-[7px] text-dump">DAMAGED</span>}
      </div>
    </motion.button>
  );
}
