"use client";

import { AnimatePresence, animate, motion, useMotionValue } from "framer-motion";
import { useEffect, useState } from "react";

import { formatDelta, formatMC } from "@/engine/format";
import { cx } from "@/lib/cx";

/** The market cap, counting towards its new value instead of jumping to it. */
export function MCCounter({
  value,
  label,
  large = false,
  delta,
  preview,
  projected,
}: {
  value: number;
  label: string;
  large?: boolean;
  /** The change that just happened; rises next to the number. */
  delta?: number;
  /** Set while a hovered hand card would move this market cap. */
  preview?: "helps" | "hurts";
  /**
   * What the hovered card would do to this number, exactly, or null.
   *
   * The glow already said something was coming, which is not the same as saying
   * what. "It helps" and "+$26K" are different amounts of information and only
   * one of them lets you choose between two cards.
   */
  projected?: number | null;
}) {
  const motion_ = useMotionValue(value);
  const [shown, setShown] = useState(value);

  useEffect(() => {
    const controls = animate(motion_, value, {
      duration: 0.75,
      ease: [0.16, 1, 0.3, 1],
      onUpdate: (v) => setShown(v),
    });
    return () => controls.stop();
  }, [value, motion_]);

  const counting = Math.round(shown) !== value;

  return (
    <div className="relative flex items-baseline gap-2">
      <span className="text-[9px] tracking-[0.2em] text-faint">{label}</span>
      <span
        className={cx(
          "display tabular-nums transition-colors",
          large ? "text-2xl" : "text-lg",
          counting
            ? "text-pump"
            : preview === "hurts"
              ? "text-dump"
              : preview === "helps"
                ? "text-pump"
                : "text-fg",
        )}
        style={
          counting
            ? { textShadow: "0 0 22px rgba(0,224,138,0.45)" }
            : preview
              ? {
                  textShadow: `0 0 20px rgba(${preview === "helps" ? "0,224,138" : "255,77,77"},0.75)`,
                }
              : undefined
        }
      >
        {formatMC(Math.round(shown))}
      </span>

      {projected !== null && projected !== undefined && projected !== 0 && !counting && (
        <span
          className={cx(
            "display shrink-0 tabular-nums",
            large ? "text-sm" : "text-[11px]",
            projected > 0 ? "text-pump" : "text-dump",
          )}
          title="What the card you are hovering would do to this market cap."
        >
          {formatDelta(projected)}
        </span>
      )}

      <AnimatePresence>
        {delta !== undefined && delta !== 0 && (
          <motion.span
            key={`${delta}-${value}`}
            initial={{ opacity: 0, y: 2 }}
            animate={{ opacity: 1, y: -18 }}
            exit={{ opacity: 0, y: -30 }}
            transition={{ duration: 0.6, ease: "easeOut" }}
            className={cx(
              "pointer-events-none absolute top-0 left-full ml-2 text-[13px] font-bold whitespace-nowrap",
              delta > 0 ? "text-pump" : "text-dump",
            )}
            style={{
              textShadow:
                delta > 0 ? "0 0 14px rgba(0,224,138,0.8)" : "0 0 14px rgba(255,77,77,0.8)",
            }}
          >
            {formatDelta(delta)}
          </motion.span>
        )}
      </AnimatePresence>
    </div>
  );
}
