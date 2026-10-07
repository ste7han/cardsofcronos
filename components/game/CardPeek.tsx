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

import { usesTouch } from "@/lib/pointer";

import { CardView } from "@/components/CardView";
import type { Card } from "@/engine/types";

/** Wide enough to read the rules text, narrow enough for a phone in portrait. */
const WIDTH = 260;
/** Clear of the trigger, and of the finger that is on it. */
const GAP = 12;


export function CardPeek({
  card,
  children,
  className,
  disabled = false,
  on = "hover",
}: {
  card: Card;
  children: React.ReactNode;
  className?: string;
  /**
   * What opens it on a mouse.
   *
   * ── WHY THERE IS A SECOND MODE ───────────────────────────────────────────
   *
   * "hover" is right where the trigger is a thing you point AT: a position on
   * the board, a supporter chip. You are already looking at it.
   *
   * It is wrong in a list. The deck builder shipped with the whole row of each
   * of forty cards as the trigger, and moving the cursor down that column to
   * find a card opened a full-size card over every row it passed. The maker's
   * answer was that it hurt the page, which it did — a preview that arrives
   * without being asked for is the same complaint as a board that redraws
   * itself while you are reading it.
   *
   * "press" makes it a click on a mouse, which is what a button is. A finger
   * taps either way.
   */
  on?: "hover" | "press";
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
      // 7.8/5, which is the aspect a full-size card is drawn at — see the
      // `aspect-[5/7.8]` in CardView. It said 1.4 here, which is the COMPACT
      // ratio: the shape of a card in your hand, not the shape of the one this
      // opens. Thirty-four pixels of difference at this width, all of it off the
      // top of the screen, because the card was placed as if it ended where it
      // did not.
      const height = Math.round(WIDTH * (7.8 / 5)) + 8;
      // Above the tile by default, below it when there is no room above — a
      // position on the top row of the board has nothing over it.
      const above = box.top - GAP - height;
      // Clamped at both ends, and not only computed. The ratio above can drift
      // again — a card's shape is a design decision and this is a copy of it —
      // and whatever it drifts to, a popover that opens off the edge of the
      // screen is a popover nobody can read. Floor beats arithmetic.
      const wanted = above >= 8 ? above : box.bottom + GAP;
      const top = Math.max(8, Math.min(wanted, window.innerHeight - height - 8));
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
        if (on === "hover" && e.pointerType === "mouse") setOpen(true);
      }}
      onPointerLeave={(e) => {
        if (on === "hover" && e.pointerType === "mouse") setOpen(false);
      }}
      // Tap toggles, and does not swallow the tap. The board tiles are also
      // buttons — a position is how you aim a card at it — so this must not stop
      // the click underneath from happening.
      onClick={() => {
        if (disabled) return;
        // A press opens it on any pointer. A hover trigger still toggles on a
        // finger, because a touchscreen has no hover to open it with.
        if (on === "press" || usesTouch()) setOpen((v) => !v);
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
