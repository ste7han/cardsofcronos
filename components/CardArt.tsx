// The card image, generated from the card id: a candlestick chart in the rarity's
// colour, with the ticker as a watermark. Every card gets the same image on every
// render, because the randomness comes from a hash of the id.
//
// Real art is already wired: set `art` on a card and CardArt renders an <img>
// instead, cropped to fill the same window. Drop files in public/art/ and point
// at them with "/art/name.png". Nothing else in the UI notices.

import { ART_FILES } from "@/lib/art-manifest";
import { next } from "@/engine/rng";
import type { Card } from "@/engine/types";
import { hashOf, moodOf } from "@/lib/art";
import { cx } from "@/lib/cx";
import { RARITY } from "@/lib/rarity";

const CANDLES = 14;
const WIDTH = 200;
const HEIGHT = 116;

/**
 * Which file this card uses, or null for the procedural chart.
 *
 * Three steps, and the middle one is what makes 535 cards finishable:
 *
 *   /art/<card id>       this exact moment — "bonk-airdrop.png"
 *   /art/<project>       the whole family — "bonk.png" covers all eight
 *   procedural           until there is anything else
 *
 * A project's eight cards are eight moments of one subject, so one good image
 * per project covers 419 project cards and a per-moment file replaces it
 * whenever one turns up. Resolution is by filename, so adding art is dropping a
 * file in and running `npm run art` — no card data to edit, nothing to forget.
 */
export function artFor(card: Card): string | null {
  if (card.art) return card.art;
  const own = ART_FILES[card.id];
  if (own) return own;
  if (card.type === "project") return ART_FILES[card.project] ?? null;
  return null;
}

export function CardArt({ card, className }: { card: Card; className?: string }) {
  const art = artFor(card);
  // Real art wins when there is any. The rest of the UI never notices.
  if (art) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={art} alt={card.name} className={cx("object-cover", className)} />;
  }
  return <ProceduralArt card={card} className={className} />;
}

function ProceduralArt({ card, className }: { card: Card; className?: string }) {
  const style = RARITY[card.rarity];
  const mood = moodOf(card);
  const points = walk(card.id, mood, style.violence);
  const key = card.id.replace(/[^a-z0-9]/g, "");

  const slotWidth = WIDTH / CANDLES;
  const body = slotWidth * 0.62;

  return (
    <svg
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      className={className}
      role="img"
      aria-label={`Chart for ${card.name}`}
      preserveAspectRatio="none"
    >
      <defs>
        <radialGradient id={`glow-${key}`} cx="50%" cy="100%" r="90%">
          <stop offset="0%" stopColor={style.glow} />
          <stop offset="100%" stopColor="rgba(0,0,0,0)" />
        </radialGradient>
      </defs>

      <rect width={WIDTH} height={HEIGHT} fill="#0a0c0f" />
      <rect width={WIDTH} height={HEIGHT} fill={`url(#glow-${key})`} />

      {/* Grid lines, just visible enough to suggest a chart. */}
      {[0.25, 0.5, 0.75].map((f) => (
        <line
          key={f}
          x1={0}
          x2={WIDTH}
          y1={HEIGHT * f}
          y2={HEIGHT * f}
          stroke="rgba(255,255,255,0.05)"
          strokeWidth={1}
        />
      ))}

      {/* textLength forces the width, so a long ticker like MOODENG doesn't fall
          off the card and a short one like WIF still fills the space. */}
      <text
        x={WIDTH / 2}
        y={HEIGHT / 2 + 2}
        textAnchor="middle"
        dominantBaseline="middle"
        textLength={WIDTH * 0.88}
        lengthAdjust="spacingAndGlyphs"
        fontFamily="ui-monospace, Menlo, monospace"
        fontSize={40}
        fontWeight={700}
        fill={style.colour}
        opacity={0.14}
      >
        {card.ticker}
      </text>

      {points.slice(0, -1).map((open, i) => {
        const close = points[i + 1]!;
        const up = close >= open;
        const colour = up ? "#00e08a" : "#ff4d4d";
        const x = i * slotWidth + (slotWidth - body) / 2;
        const top = y(Math.max(open, close));
        const bottom = y(Math.min(open, close));
        const middle = x + body / 2;
        const wick = wicks(card.id, i, open, close);

        return (
          <g key={i}>
            <line
              x1={middle}
              x2={middle}
              y1={y(wick.high)}
              y2={y(wick.low)}
              stroke={colour}
              strokeWidth={1}
              opacity={0.75}
            />
            <rect
              x={x}
              y={top}
              width={body}
              height={Math.max(3, bottom - top)}
              fill={colour}
              opacity={up ? 0.95 : 0.88}
            />
          </g>
        );
      })}
    </svg>
  );
}

/** Turns a 0..1 value into a y coordinate, with margin top and bottom. */
function y(value: number): number {
  const margin = 8;
  return HEIGHT - margin - value * (HEIGHT - margin * 2);
}

/**
 * The price path. Pump climbs with a tail upwards; dump climbs first and then
 * falls away — the shape everyone in the trenches recognises.
 */
function walk(id: string, mood: "pump" | "dump", violence: number): number[] {
  let state = hashOf(id);
  let price = mood === "pump" ? 0.14 : 0.3;
  const points: number[] = [price];

  for (let i = 0; i < CANDLES; i++) {
    const draw = next(state);
    state = draw.state;
    const r = draw.value;
    const progress = i / CANDLES;

    if (mood === "pump") {
      // Jagged upwards, with a tail that steepens towards the end.
      price += (r - 0.34) * 0.19 * violence + progress * progress * 0.07;
    } else if (progress < 0.58) {
      price += (r - 0.3) * 0.16 * violence;
    } else {
      // The cliff.
      price -= (0.07 + r * 0.1) * violence;
    }

    price = Math.min(0.95, Math.max(0.05, price));
    points.push(price);
  }

  // Stretch to the full height. Without this a common chart hangs at the bottom of
  // the frame, because low violence barely moves. Now violence controls how jagged
  // the line is, not how much room it takes.
  return normalise(points);
}

function normalise(points: number[]): number[] {
  const low = Math.min(...points);
  const high = Math.max(...points);
  const range = high - low;
  if (range < 0.001) return points.map(() => 0.5);
  return points.map((p) => 0.08 + ((p - low) / range) * 0.84);
}

/** Wick above and below the candle. */
function wicks(id: string, i: number, open: number, close: number) {
  const { value: a, state } = next(hashOf(id) + i * 977);
  const { value: b } = next(state);
  return {
    high: Math.min(1, Math.max(open, close) + a * 0.07),
    low: Math.max(0, Math.min(open, close) - b * 0.07),
  };
}
