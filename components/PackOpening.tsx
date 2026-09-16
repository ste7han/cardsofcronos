"use client";

// Opening a pack, or the one card you bought.
//
// Before this the cards simply appeared: you loaded the deck page and a deck was
// there. That is the one moment a trading card game has that nothing else does,
// and it was happening off screen.
//
// Two ways to see them, because people are not the same about this. Turn them
// over one at a time and take as long as you like, or hit SHOW ALL and let them
// land in a wave. The wave saves the best card for last; the grid does not,
// because it must not — if the cards were laid out by rarity, the last one would
// always be the good one and clicking would decide nothing. So position is draw
// order and only the *timing* of the wave knows what is in them.

import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";

import { CardBack } from "@/components/CardBack";
import { CardView } from "@/components/CardView";
import { isBackbone } from "@/engine/pack";
import { RARITIES, type Card } from "@/engine/types";
import { cx } from "@/lib/cx";
import { RARITY } from "@/lib/rarity";
import { INDEX } from "@/lib/set";

export type PackKind = "pack" | "single";

const COPY: Record<
  PackKind,
  { eyebrow: string; sealed: string; blurb: string; done: string; stack: number }
> = {
  pack: {
    eyebrow: "SET 01 — PACK",
    sealed: "A PACK",
    blurb:
      "Ten cards, drawn. One of them is rare or better and that is the only promise; the rest is the odds. Nothing you already own comes out of it twice.",
    done: "KEEP THEM",
    stack: 3,
  },
  single: {
    eyebrow: "SET 01 — ONE CARD",
    sealed: "ONE CARD",
    blurb:
      "One card, drawn at the printed odds. Nothing is promised and nothing needs to be — one card at 50/35/9/5/1 is exactly what the page says it is.",
    done: "KEEP IT",
    // One card is not a stack. Three sealed cards fanned behind a single is the
    // pack's picture borrowed for a product that is not a pack.
    stack: 1,
  },
};

export function PackOpening({
  cardIds,
  onDone,
  kind = "pack",
}: {
  cardIds: readonly string[];
  onDone: () => void;
  kind?: PackKind;
}) {
  const copy = COPY[kind];
  const [opened, setOpened] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [turned, setTurned] = useState<ReadonlySet<number>>(new Set());
  const [waving, setWaving] = useState(false);

  // Draw order, deliberately. See the note at the top of this file.
  const cards = useMemo(
    () => cardIds.map((id) => INDEX.get(id)).filter((c): c is Card => Boolean(c)),
    [cardIds],
  );

  // How long each card waits when the whole lot is turned at once: cheapest
  // first, so the card worth waiting for arrives last wherever it is sitting.
  const waveDelay = useMemo(() => {
    const order = cards
      .map((card, i) => ({ i, rank: RARITIES.indexOf(card.rarity) }))
      .sort((a, b) => a.rank - b.rank);
    const delay = new Array<number>(cards.length).fill(0);
    order.forEach((entry, place) => {
      delay[entry.i] = place * (cards.length > 20 ? 0.03 : 0.07);
    });
    return delay;
  }, [cards]);

  const best = useMemo(
    () =>
      [...cards].sort((a, b) => RARITIES.indexOf(a.rarity) - RARITIES.indexOf(b.rarity)).at(-1),
    [cards],
  );
  const big = cards.filter(isBackbone).length;
  const allTurned = turned.size === cards.length;

  useEffect(() => setMounted(true), []);

  // The page behind is still a page: without this it scrolls under the overlay,
  // and the wheel over a reveal ends up moving the mint page nobody can see.
  useEffect(() => {
    const before = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = before;
    };
  }, []);

  function turn(i: number) {
    setTurned((was) => {
      if (was.has(i)) return was;
      const next = new Set(was);
      next.add(i);
      return next;
    });
  }

  function showAll() {
    setWaving(true);
    setTurned(new Set(cards.map((_, i) => i)));
  }

  if (!mounted) return null;

  // Rendered onto the body rather than into the page. It covers everything, and
  // a z-index is only worth what its stacking context is worth — the footer was
  // painting straight through it. A portal makes the question moot.
  return createPortal(
    <div className="fixed inset-0 z-50 overflow-y-auto bg-ground">
      <div className="mx-auto max-w-6xl px-4 py-10">
        <AnimatePresence mode="wait">
          {!opened ? (
            <motion.div
              key="sealed"
              exit={{ opacity: 0, scale: 0.96 }}
              className="flex flex-col items-center py-16 text-center"
            >
              <p className="text-[10px] tracking-[0.28em] text-faint">{copy.eyebrow}</p>
              <h1 className="display mt-3 text-4xl sm:text-5xl">{copy.sealed}</h1>
              <p className="mt-4 max-w-md text-[11px] leading-relaxed text-muted">{copy.blurb}</p>

              {/* A pack is a stack and one card is a card. */}
              <div className="relative mt-10 h-[260px] w-[180px]">
                {Array.from({ length: copy.stack }, (_, i) => copy.stack - 1 - i).map((i) => (
                  <motion.div
                    key={i}
                    className="card-grain absolute inset-0 overflow-hidden rounded-[10px] shadow-[0_18px_38px_-26px_rgba(0,0,0,0.95)]"
                    initial={{ rotate: (i - (copy.stack - 1) / 2) * 3, y: i * 5 }}
                    animate={{ rotate: (i - (copy.stack - 1) / 2) * 3, y: i * 5 }}
                    whileHover={i === 0 ? { y: -6, rotate: 0 } : undefined}
                  >
                    <CardBack size="large" />
                  </motion.div>
                ))}
              </div>

              <button
                type="button"
                onClick={() => setOpened(true)}
                className="glow-pump mt-12 border border-pump bg-pump/10 px-8 py-4 text-[11px] tracking-[0.22em] text-pump transition-colors hover:bg-pump hover:text-ground"
              >
                TEAR IT OPEN
              </button>
            </motion.div>
          ) : (
            <motion.div key="opened" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <div className="flex flex-wrap items-baseline justify-between gap-3">
                <div>
                  <p className="text-[10px] tracking-[0.28em] text-faint">{copy.eyebrow}</p>
                  <h1 className="display mt-2 text-3xl sm:text-4xl">
                    {allTurned ? "WHAT YOU PULLED" : "TURN THEM OVER"}
                  </h1>
                </div>

                <div className="flex items-center gap-2">
                  {!allTurned && (
                    <button
                      type="button"
                      onClick={showAll}
                      className="border border-line-strong px-5 py-3 text-[10px] tracking-[0.18em] text-muted transition-colors hover:border-fg hover:text-fg"
                    >
                      SHOW ALL
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={onDone}
                    className={cx(
                      "border px-5 py-3 text-[10px] tracking-[0.18em] transition-colors",
                      allTurned
                        ? "glow-pump border-pump bg-pump/10 text-pump hover:bg-pump hover:text-ground"
                        : "border-line-strong text-muted hover:border-fg hover:text-fg",
                    )}
                  >
                    {copy.done}
                  </button>
                </div>
              </div>

              <p className="mt-3 text-[11px] leading-relaxed text-muted">
                {allTurned ? (
                  <>
                    {big} of epic or better
                    {best ? (
                      <>
                        {" "}
                        — best pull:{" "}
                        <span style={{ color: RARITY[best.rarity].colour }}>{best.name}</span>
                      </>
                    ) : null}
                    . These are yours.
                  </>
                ) : (
                  <>
                    <span className="text-fg tabular-nums">
                      {turned.size} of {cards.length}
                    </span>{" "}
                    turned over. Click them one at a time, or turn the lot.
                  </>
                )}
              </p>

              {/* Sized rather than counted, and the full card rather than the
                  compact one. This is the moment somebody actually looks at what
                  they pulled, and the compact card drops the flavour line the
                  second a card has an effect — so the bottom of every project
                  card was simply missing at the one time it is worth reading. */}
              <div className="mt-8 grid grid-cols-[repeat(auto-fill,minmax(min(100%,300px),1fr))] gap-4">
                {cards.map((card, i) => (
                  <Slot
                    key={`${card.id}-${i}`}
                    card={card}
                    turned={turned.has(i)}
                    delay={waving ? waveDelay[i]! : 0}
                    onTurn={() => turn(i)}
                  />
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>,
    document.body,
  );
}

/**
 * One card, face down until it isn't.
 *
 * The flip is a scaleX squeeze rather than a rotateY, and that is a deliberate
 * retreat. Two goes at the 3D version both shipped the same bug in different
 * clothes: with two faces and `backface-visibility`, the glow on a good pull is
 * a `filter`, and a filter flattens `transform-style: preserve-3d` for
 * everything inside it — so the hidden face stopped being hidden and cards came
 * out mirrored. With one face and a rotateY the container kept ending on 180°
 * and mirrored them anyway. Squeezing to nothing and back has no perspective, no
 * backface and no stacking context to get wrong, and at this size it reads the
 * same. The face is swapped at the pinch, where the card is a line.
 */
function Slot({
  card,
  turned,
  delay,
  onTurn,
}: {
  card: Card;
  turned: boolean;
  delay: number;
  onTurn: () => void;
}) {
  const [face, setFace] = useState<"back" | "front">(turned ? "front" : "back");
  const glow = isBackbone(card);

  useEffect(() => {
    if (!turned || face === "front") return;
    const pinch = window.setTimeout(() => setFace("front"), (delay + 0.18) * 1000);
    return () => window.clearTimeout(pinch);
  }, [turned, delay, face]);

  return (
    <button
      type="button"
      onClick={onTurn}
      disabled={turned}
      aria-label={turned ? card.name : "Turn this card over"}
      className={cx(
        "relative block w-full transition-transform",
        !turned &&
          "cursor-pointer hover:scale-[1.03] focus-visible:outline focus-visible:outline-pump",
      )}
    >
      <motion.div
        className="relative aspect-[5/7] w-full"
        initial={false}
        animate={turned ? { scaleX: [1, 0, 1], y: [0, -6, 0] } : { scaleX: 1, y: 0 }}
        transition={{ duration: 0.36, delay, times: [0, 0.5, 1], ease: "easeInOut" }}
        style={
          face === "front" && glow
            ? { filter: `drop-shadow(0 0 18px ${RARITY[card.rarity].colour}55)` }
            : undefined
        }
      >
        {face === "front" ? (
          <CardView card={card} className="h-full w-full" />
        ) : (
          <div className="card-grain absolute inset-0 overflow-hidden rounded-[10px] shadow-[0_18px_38px_-26px_rgba(0,0,0,0.95)]">
            <CardBack size="small" />
          </div>
        )}
      </motion.div>
    </button>
  );
}

