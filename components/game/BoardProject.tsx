"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useRef } from "react";

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
  /**
   * Set while this position is the reason a control of yours is switched off.
   *
   * Its own prop and not a third value of `preview`, deliberately. A preview
   * says "this is what your card would do to that"; this says "that is why you
   * cannot". One name meaning two things is the trap CLAUDE.md opens with, and
   * it is worse here than usual because both would render as a coloured ring —
   * the mistake would look like a working feature.
   */
  blocking?: boolean;
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
  blocking = false,
  marker,
  onClick,
}: Props) {
  const damaged = onBoard.holders < card.holders;
  const style = RARITY[card.rarity];

  /**
   * Bring this into view when it becomes the reason.
   *
   * Found by looking at the highlight rather than at the code: the ring was
   * going on correctly and the board had scrolled, so hovering the dead button
   * lit a card nobody could see. A pointer explaining something off-screen is
   * the same as no explanation, and worse to debug — the feature reports
   * success.
   *
   * `nearest` in both axes so it moves the least it can: the board row scrolls
   * sideways and sits in a column that scrolls down, and a highlight that yanks
   * the whole table around loses the player the thing they were looking at.
   */
  const tile = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!blocking) return;
    tile.current?.scrollIntoView({ block: "nearest", inline: "nearest", behavior: "smooth" });
  }, [blocking]);

  // Three things want to draw a ring on this tile and only one may. Written as
  // one decision rather than three ternaries threaded through the style object,
  // where the last version already needed two levels and this would have made
  // four — and a ring that is wrong is indistinguishable from a ring that is
  // right until somebody clicks it.
  //
  //   aiming    you have committed to a card and this is a legal target
  //   blocking  this is why a control of yours is off
  //   preview   you are considering a card and it would touch this
  //
  // Aiming wins because it is the only one you can act on. Blocking beats
  // preview because it only appears while you are hovering the control it
  // explains, and an explanation that loses to a hover is not an explanation.
  const ring = targetable
    ? {
        // Banking your own position is not an attack, so it should not look like one.
        colour: targetable === "bank" ? "245,196,81" : "255,77,77",
        opacity: 1,
        dashed: false,
        spread: "26px -6px",
      }
    : blocking
      ? // Gold, the same gold as TAKE PROFIT, so hovering a dead button lights
        // the card holding it down in the button's own colour.
        { colour: "245,196,81", opacity: 0.9, dashed: false, spread: "30px -4px" }
      : preview
        ? {
            colour: preview.impact === "helps" ? "0,224,138" : "255,77,77",
            // A card you will definitely hit gets a solid ring; one you might
            // pick gets a fainter one, because the preview should not claim to
            // know more than it does.
            opacity: preview.certain ? 0.85 : 0.45,
            dashed: !preview.certain,
            spread: preview.certain ? "30px -4px" : "22px -8px",
          }
        : null;

  return (
    <motion.button
      ref={tile}
      type="button"
      layout
      initial={{ opacity: 0, y: 24, scale: 0.9 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.85, filter: "blur(4px)" }}
      transition={{ type: "spring", stiffness: 380, damping: 26 }}
      // aria-disabled, not disabled, and this is the third place in the app to
      // learn it. A disabled button receives no pointer events at all and they
      // do not reach its ancestors either — so the CardPeek wrapped around this
      // tile never saw a tap, and reading a position you already hold was
      // impossible on any screen without a mouse. DiscardButton and
      // TakeProfitButton both say the same thing in their own headers: refuse in
      // the handler, not in the attribute.
      aria-disabled={!targetable}
      onClick={() => {
        if (!targetable) return;
        onClick?.();
      }}
      title={
        targetable === "bank"
          ? `Close ${card.name} and bank ${formatMC(onBoard.earned)}`
          : targetable
            ? `Target ${card.name}`
            : card.name
      }
      className={cx(
        // One width, the larger one. See the note in Game.tsx: a
        // narrower card is a card with smaller writing on it, and the
        // phone was getting the narrow one.
        "relative w-[124px] shrink-0 overflow-visible border px-2 py-1.5 text-left transition-colors",
        marker?.hit && "hit",
        targetable ? "cursor-crosshair" : "cursor-default",
      )}
      style={{
        borderColor: ring ? `rgba(${ring.colour},${ring.opacity})` : `${style.colour}55`,
        borderStyle: ring?.dashed ? "dashed" : "solid",
        background: `linear-gradient(165deg, ${style.colour}1f, rgba(0,0,0,0) 55%), var(--color-panel)`,
        boxShadow: ring
          ? `0 0 ${ring.spread} rgba(${ring.colour},${ring.opacity * 0.85}), inset 0 1px 0 rgba(255,255,255,0.07)`
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
