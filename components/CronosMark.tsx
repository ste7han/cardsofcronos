// The Cards of Cronos mark.
//
// A hexagon, a C cut out of a second hexagon, and a hexagonal stone in the
// middle. It is the mark the first version of this game wore, and it is the one
// thing from that site worth carrying forward: it says the name without
// spelling it, which three letters on a card back never quite did.
//
// It arrives here as a path rather than as the file it came from. The original
// is `legacy/public/logo.svg`, which is not a vector at all -- four base64 PNGs
// of 270x229 in an SVG wrapper. That is too little for a card back that has to
// be crisp at 39px in the opponent's hand and at three times a card's width on
// an NFT render, and enlarging it would put a soft mark on a sharp card.
//
// So it was traced, by `npm run trace-mark`, and the trace was checked against
// the original rather than eyeballed. Re-run that script if the source ever
// changes; do not edit the numbers below by hand.
//
// The shape is flat and single-colour on purpose. The original carries a purple
// gradient and little facets on the stone, and both disappear at the size this
// is used -- what survives shrinking is the silhouette.

/** Traced from the original at 1600px. Width 100, height 117.2. */
export const MARK_PATH =
  "M49.72 0.00L50.72 0.00L54.16 2.00L95.89 28.52L98.34 29.63L100.00 31.19L99.78 87.13L57.16 113.43L50.94 116.98L49.61 117.20L1.33 87.13L0.33 86.02L0.00 33.41L0.55 30.41L49.61 0.11ZM50.72 26.53L53.16 27.41L63.60 34.30L75.25 40.95L76.80 42.18L77.03 42.95L69.03 48.17L67.92 48.28L52.72 37.51L35.63 47.06L33.30 49.39L33.19 67.81L33.63 70.03L51.61 82.02L54.50 81.13L65.48 73.92L69.92 71.59L71.70 72.03L76.14 74.92L77.03 75.92L76.80 76.47L50.61 92.67L49.06 92.12L26.19 76.91L22.31 73.70L22.31 44.06L23.86 42.40L50.61 26.64ZM51.39 47.39L53.94 48.06L63.26 54.72L63.82 57.38L63.82 62.49L63.26 65.26L53.83 71.92L51.94 72.48L46.84 69.59L41.07 65.15L41.07 53.61L46.73 49.72L51.28 47.50ZM49.61 4.66L52.16 5.33L96.67 33.41L96.89 82.13L96.45 84.57L90.23 88.90L80.69 94.23L57.16 108.99L52.16 111.99L49.61 112.76L3.88 83.68L3.88 33.07L49.50 4.77Z";

export const MARK_WIDTH = 100;
export const MARK_HEIGHT = 117.2;

/**
 * The mark, centred on (`x`, `y`) and `height` tall.
 *
 * Sized by height rather than by width because everywhere it is used it sits in
 * something round -- a disc, a card, a circle of guilloche -- and height is what
 * decides whether it fits.
 */
export function CronosMark({
  x,
  y,
  height,
  fill,
  opacity,
}: {
  x: number;
  y: number;
  height: number;
  fill: string;
  opacity?: number;
}) {
  const scale = height / MARK_HEIGHT;
  const width = MARK_WIDTH * scale;
  return (
    <g transform={`translate(${x - width / 2} ${y - height / 2}) scale(${scale})`}>
      <path d={MARK_PATH} fill={fill} fillOpacity={opacity} fillRule="evenodd" />
    </g>
  );
}
