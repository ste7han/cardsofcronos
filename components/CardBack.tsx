// The back of every card.
//
// Drawn rather than generated, for the same reason the fronts are: it has to be
// crisp at 39px in the opponent's hand and at three times a card's width on a
// retina render of an NFT, it has to carry text that is spelled right every
// time, and it has to sit in the same physical world as the faces. An image is a
// compromise at both ends and a text-rendering lottery in the middle.
//
// It reads at three sizes, and everything is on it at every one:
//
//   large   the sealed stack before a mint is opened, ~180x260
//   small   a face-down card in the reveal grid, ~300x420
//   tiny    the opponent's hand at the table, ~39x54
//
// Tiny used to drop the mark and the address on the grounds that three letters
// in a fourteen-pixel disc are mush — true, and beside the point. What was left
// was a glowing dot, and the cards in the opponent's hand stopped looking like
// cards. Small and unreadable still reads as a card back. Absent does not.

import { cx } from "@/lib/cx";

/**
 * Which face the card wears, and what it is struck in.
 *
 * Four designs and two metals, both behind one constant each. This is taste
 * rather than correctness, and taste gets revisited — so switching it is a word,
 * not a rewrite. The variants share the edge, the address and the vignette;
 * what differs is what fills the middle.
 */
type Design = "coin" | "wordmark" | "guilloche" | "foil";

/**
 * What a card wears when nothing says otherwise.
 *
 * The sealed stack overrides it to `foil`, and that is the whole idea rather
 * than an exception: foil reads as a stack and a coin reads as a card. Unopened,
 * the thing in front of you is a gold bar; torn open, it is a pile of cards with
 * a struck mark on each. Both were worth keeping, so both are used where each
 * one is the stronger of the two.
 *
 * What the design must never do is vary with what is *on* the card. The back is
 * what you look at before you know, and a rarer card wearing a better back would
 * hand you the answer through the wrapper.
 */
const GROUND = "#080a0d";

const DESIGN: Design = "guilloche";
const FACE: keyof typeof PALETTES = "cronos";

const PALETTES = {
  /**
   * Deep purple struck with gold — the two colours this game has always been.
   * `--color-primary` and `--color-gold` are where they come from; the shades
   * around them are the same hues taken lighter and darker, because what makes
   * a face read as struck metal is that the light is uneven across it.
   *
   * `mark` is the odd one out and it is the reason this field exists. On a gold
   * face the letters are punched through to the dark and read as stamped. On a
   * dark face that is invisible, so they are laid on in gold instead. The
   * design does not change; which side of it is lit does.
   */
  cronos: {
    /** The lit corner, the body, the turned-away edge. */
    from: "#8b3fd4",
    mid: "#3b1668",
    to: "#150827",
    ink: "#ffd700",
    mark: "#ffd700",
    halo: ["#9d4edd", "#ffd700"],
  },
  /**
   * Trenches' gold, kept because the two games share this component and a
   * palette is one word to switch. Nothing in Cards of Cronos selects it.
   */
  gold: {
    from: "#fff3cf",
    mid: "#f5c451",
    to: "#a8761f",
    ink: "#f5c451",
    mark: GROUND,
    halo: ["#f5c451", "#c9922a"],
  },
} as const;

const P = PALETTES[FACE];

export type BackSize = "large" | "small" | "tiny";

export function CardBack({
  size = "small",
  design = DESIGN,
  className,
}: {
  size?: BackSize;
  design?: Design;
  className?: string;
}) {
  const tiny = size === "tiny";
  const large = size === "large";
  const foil = design === "foil";

  return (
    <svg
      viewBox="0 0 100 140"
      preserveAspectRatio="xMidYMid slice"
      className={cx("block h-full w-full", className)}
      aria-hidden="true"
    >
      <defs>
        {/* userSpaceOnUse throughout: the default bounding-box units give a
            vertical line a box of zero width, and a gradient on a zero-width box
            paints nothing at all. */}
        <linearGradient
          id="coc-back-face"
          gradientUnits="userSpaceOnUse"
          x1="20"
          y1="20"
          x2="80"
          y2="120"
        >
          <stop offset="0%" stopColor={P.from} />
          <stop offset="30%" stopColor={P.mid} />
          <stop offset="100%" stopColor={P.to} />
        </linearGradient>

        {/* The edge runs its own gradient rather than a flat colour. What makes
            metal look like metal is not brightness, it is that the light is
            uneven along it — a flat gold line at any opacity reads as a drawn
            border, and a gradient one reads as an edge catching the light. */}
        <linearGradient
          id="coc-back-edge"
          gradientUnits="userSpaceOnUse"
          x1="0"
          y1="0"
          x2="100"
          y2="140"
        >
          <stop offset="0%" stopColor={P.from} />
          <stop offset="35%" stopColor={P.mid} />
          <stop offset="70%" stopColor={P.to} />
          <stop offset="100%" stopColor={P.mid} />
        </linearGradient>

        <radialGradient id="coc-back-bloom-a" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor={P.halo[0]} stopOpacity="0.26" />
          <stop offset="100%" stopColor={P.halo[0]} stopOpacity="0" />
        </radialGradient>
        <radialGradient id="coc-back-bloom-b" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor={P.halo[1]} stopOpacity="0.26" />
          <stop offset="100%" stopColor={P.halo[1]} stopOpacity="0" />
        </radialGradient>

        <radialGradient id="coc-back-vignette" cx="50%" cy="50%" r="62%">
          <stop offset="35%" stopColor="#060709" stopOpacity="0" />
          <stop offset="100%" stopColor="#060709" stopOpacity="0.8" />
        </radialGradient>

        {/* Knocked out rather than drawn on top: the letters are whatever sits
            behind showing through, which is how a stamped back works. */}
        <mask id="coc-back-mark">
          <rect x="0" y="0" width="100" height="140" fill="white" />
          <text
            x="50"
            y={design === "wordmark" ? 66 : 70}
            textAnchor="middle"
            dominantBaseline="central"
            fontFamily="var(--font-display), system-ui, sans-serif"
            fontSize={design === "wordmark" ? 34 : 15}
            fontWeight="800"
            letterSpacing={design === "wordmark" ? -1.6 : -0.3}
            fill="black"
          >
            COC
          </text>
        </mask>

        <pattern id="coc-back-weave" width="9" height="9" patternUnits="userSpaceOnUse">
          <path
            d="M0 9 L9 0 M-2 2 L2 -2 M7 11 L11 7"
            stroke={P.mid}
            strokeWidth="0.45"
            fill="none"
          />
        </pattern>

        {/* The same hatch at three times the tile, for the card in the
            opponent's hand. Nine units there is three and a half pixels and the
            lines turn to mud; twenty-six is ten, which reads as lines. */}
        <pattern id="coc-back-weave-wide" width="26" height="26" patternUnits="userSpaceOnUse">
          <path
            d="M0 26 L26 0 M-6 6 L6 -6 M20 32 L32 20"
            stroke={P.mid}
            strokeWidth="1.4"
            fill="none"
          />
        </pattern>
      </defs>

      <rect x="0" y="0" width="100" height="140" fill={foil ? "url(#coc-back-face)" : GROUND} />

      {design === "guilloche" && (
        <>
          {/* A coarser tile at thumbnail size rather than none. Dropping the
              hatch and keeping the rings was the wrong half to keep: two circles
              around a mark is a coin, which is the design this one is not. The
              lines are what makes it a guilloche, so the lines are what survive
              and the rings are what go. */}
          <rect
            x="0"
            y="0"
            width="100"
            height="140"
            fill={tiny ? "url(#coc-back-weave-wide)" : "url(#coc-back-weave)"}
            opacity={tiny ? 0.42 : 0.5}
          />
          {!tiny &&
            [46, 38, 30, 22].map((r) => (
              <circle
                key={r}
                cx="50"
                cy="70"
                r={r}
                fill="none"
                stroke={P.mid}
                strokeOpacity="0.4"
                strokeWidth="0.4"
              />
            ))}
        </>
      )}

      {!foil && (
        <>
          <circle cx="44" cy="62" r="40" fill="url(#coc-back-bloom-a)" />
          <circle cx="57" cy="79" r="40" fill="url(#coc-back-bloom-b)" />
        </>
      )}

      <rect x="0" y="0" width="100" height="140" fill="url(#coc-back-vignette)" opacity={foil ? 0.35 : 1} />

      {design === "coin" && (
        <>
          <circle
            cx="50"
            cy="70"
            r="30"
            fill="none"
            stroke={P.ink}
            strokeOpacity="0.45"
            strokeWidth={tiny ? 1.4 : 0.7}
          />
          <circle cx="50" cy="70" r="25" fill="#07080b" />
          <g mask="url(#coc-back-mark)">
            <circle cx="50" cy="70" r="25" fill="url(#coc-back-face)" />
            {/* Metal turns away from the light before it ends. Flat colour to
                the very edge reads as a sticker. */}
            <circle
              cx="50"
              cy="70"
              r="24"
              fill="none"
              stroke={P.to}
              strokeOpacity="0.55"
              strokeWidth="2"
            />
          </g>
        </>
      )}

      {design === "wordmark" && (
        <text
          x="50"
          y="66"
          textAnchor="middle"
          dominantBaseline="central"
          fontFamily="var(--font-display), system-ui, sans-serif"
          fontSize="34"
          fontWeight="800"
          letterSpacing="-1.6"
          fill="url(#coc-back-face)"
        >
          COC
        </text>
      )}

      {design === "guilloche" && (
        <>
          <circle cx="50" cy="70" r={tiny ? 26 : 21} fill={GROUND} fillOpacity="0.92" />
          <text
            x="50"
            y="70"
            textAnchor="middle"
            dominantBaseline="central"
            fontFamily="var(--font-display), system-ui, sans-serif"
            fontSize="15"
            fontWeight="800"
            letterSpacing="-0.3"
            fill="url(#coc-back-face)"
          >
            COC
          </text>
        </>
      )}

      {/* Foil is the whole card inverted: gold everywhere, the mark and the
          address punched out of it in the dark. */}
      {foil && (
        <g mask="url(#coc-back-mark)">
          <rect x="0" y="0" width="100" height="140" fill={GROUND} fillOpacity="0" />
          <rect x="0" y="0" width="100" height="140" fill="url(#coc-back-face)" />
        </g>
      )}
      {foil && (
        <text
          x="50"
          y="70"
          textAnchor="middle"
          dominantBaseline="central"
          fontFamily="var(--font-display), system-ui, sans-serif"
          fontSize="15"
          fontWeight="800"
          letterSpacing="-0.3"
          fill={P.mark}
        >
          COC
        </text>
      )}

      <text
        x="50"
        y="132"
        textAnchor="middle"
        fontFamily="var(--font-mono), ui-monospace, monospace"
        fontSize={large ? 4.4 : tiny ? 6 : 4.8}
        letterSpacing={large ? 1.9 : tiny ? 0.7 : 1.6}
        fill={foil ? P.mark : P.ink}
        fillOpacity={foil ? 0.85 : 0.7}
      >
        CARDS OF CRONOS
      </text>

      {/* The only edge on the card. The element around it draws nothing — it
          used to draw a grey border and the light insets of card-frame, and the
          eye read a grey rim with something dull inside it. */}
      <rect
        x="2.5"
        y="2.5"
        width="95"
        height="135"
        rx="7"
        fill="none"
        stroke={foil ? P.mark : "url(#coc-back-edge)"}
        strokeOpacity={foil ? 0.5 : 0.95}
        strokeWidth={tiny ? 1.6 : 0.9}
      />
    </svg>
  );
}
