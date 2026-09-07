"use client";

// Look at a card that is already on the table.
//
// The board draws a position as a tile and a supporter as a ticker chip, because
// six positions and a support row have to fit on a phone. That is the right
// summary and it is not the card: you cannot read what an aura does, what a
// project's payoff needs, or what the flavour says. Until now the only answer was
// a native `title` tooltip — plain text, half a second late, and on a phone it
// does not exist at all.
//
// Hover on a mouse, tap on a touchscreen. Both, rather than one behaviour bent to
// cover the other: a hover that has to be tapped is a tap you have to guess at,
// and a tap on a desktop is a click you did not want to spend.
//
// Portalled to the body, and that is not decoration. globals.css lifts every
// direct child of <body> onto its own layer so the page sits above the grid
// lines, which gives <header> and <main> the same z-index and makes <main> paint
// over everything — the same rule that made the wallet dropdown unclickable. A
// popover rendered inside the board lands underneath the board.

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { CardView } from "@/components/CardView";
import type { Card } from "@/engine/types";

/** Wide enough to read the rules text, narrow enough for a phone in portrait. */
const WIDTH = 260;
/** Clear of the trigger, and of the finger that is on it. */
const GAP = 12;

/**
 * A touch device, asked of the pointer rather than of the screen width.
 *
 * A narrow window on a laptop is still a mouse, and a tablet in landscape is
 * still a finger. Width has never answered this question and every layout that
 * used it got one of the two wrong.
 */
function usesTouch(): boolean {
  return typeof window !== "undefined" && window.matchMedia("(pointer: coarse)").matches;
}

export function CardPeek({
  card,
  children,
  className,
  disabled = false,
}: {
  card: Card;
  children: React.ReactNode;
  className?: string;
  /**
   * Off while the thing underneath is waiting to be pressed.
   *
   * A position is also a button — it is how you point a card at it — and on a
   * touchscreen one tap cannot mean both "show me this" and "attack this". While
   * something is being aimed, the tap belongs to the aiming. On a mouse the two
   * never collide, because looking is a hover and aiming is a click.
   */
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [at, setAt] = useState<{ top: number; left: number } | null>(null);
  const trigger = useRef<HTMLDivElement>(null);

  // Placed from the trigger and kept there. `true` on the scroll listener is the
  // capture phase: the board scrolls sideways inside its own container and a
  // listener on window alone never hears it.
  useEffect(() => {
    if (disabled) setOpen(false);
  }, [disabled]);

  useEffect(() => {
    if (!open) return;

    const place = () => {
      const box = trigger.current?.getBoundingClientRect();
      if (!box) return;
      const height = Math.round(WIDTH * 1.4) + 8;
      // Above the tile by default, below it when there is no room above — a
      // position on the top row of the board has nothing over it.
      const above = box.top - GAP - height;
      const top = above >= 8 ? above : Math.min(box.bottom + GAP, window.innerHeight - height - 8);
      const left = Math.min(
        Math.max(8, box.left + box.width / 2 - WIDTH / 2),
        window.innerWidth - WIDTH - 8,
      );
      setAt({ top, left });
    };
    place();

    const away = (event: PointerEvent) => {
      if (!trigger.current?.contains(event.target as Node)) setOpen(false);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };

    window.addEventListener("scroll", place, true);
    window.addEventListener("resize", place);
    document.addEventListener("pointerdown", away);
    document.addEventListener("keydown", escape);
    return () => {
      window.removeEventListener("scroll", place, true);
      window.removeEventListener("resize", place);
      document.removeEventListener("pointerdown", away);
      document.removeEventListener("keydown", escape);
    };
  }, [open]);

  return (
    <div
      ref={trigger}
      className={className}
      // Hover only where there is a pointer to hover with. On a touchscreen the
      // browser fires these anyway on the first tap, which would open the card
      // and then immediately have to decide what the tap itself meant.
      onPointerEnter={(e) => {
        if (e.pointerType === "mouse") setOpen(true);
      }}
      onPointerLeave={(e) => {
        if (e.pointerType === "mouse") setOpen(false);
      }}
      // Tap toggles, and does not swallow the tap. The board tiles are also
      // buttons — a position is how you aim a card at it — so this must not stop
      // the click underneath from happening.
      onClick={() => {
        if (!disabled && usesTouch()) setOpen((v) => !v);
      }}
    >
      {children}
      {open &&
        at !== null &&
        createPortal(
          <div
            style={{ position: "fixed", top: at.top, left: at.left, width: WIDTH, zIndex: 120 }}
            // Nothing here takes a pointer. It is a thing to read, and a popover
            // that can be hovered is a popover you can get stuck behind on the
            // way to the tile it is covering.
            className="pointer-events-none drop-shadow-[0_18px_38px_rgba(0,0,0,0.75)]"
          >
            <CardView card={card} />
          </div>,
          document.body,
        )}
    </div>
  );
}
