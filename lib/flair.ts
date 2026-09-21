// How a line in a Discord channel is dressed.
//
// The feeds all said true things in a flat voice: an amount, a link, a full
// stop. True is the floor and it is not the ceiling — these are channels people
// leave open, and a number with nothing beside it tells you nothing about
// whether it is a big number.
//
// So everything here adds CONTEXT rather than adjectives. A bar showing how far
// the mint has got, a share of the supply that has been burned, a size the buy
// sits in, the margin a match was won by. Nobody is told that something is
// exciting; they are given the thing that would make them decide it was.
//
// ── NOTHING HERE MAY OVERSTATE ───────────────────────────────────────────────
//
// The rest of this project spends its effort on not being wrong about numbers —
// the burn page shows what it can prove, the mint page publishes a hash before
// it sells anything. A channel that shouted would undo that, and shouting is
// also what every other token's channel does. The loudest thing in here is a
// row of blocks.

/** The little icon beside the name on every embed. */
export const ICON = "https://cardsofcronos.com/icon.png";

/** The line above the title, so a message is placed without being read. */
export function from(what: string, href?: string): {
  name: string;
  url?: string;
  icon_url: string;
} {
  return { name: what, ...(href ? { url: href } : {}), icon_url: ICON };
}

/**
 * A progress bar, sixteen blocks wide.
 *
 * Sixteen because it is wide enough to read at a glance and narrow enough not
 * to wrap on a phone, which is where most of these are read.
 */
export function bar(done: number, total: number, width = 16): string {
  if (!Number.isFinite(done) || !Number.isFinite(total) || total <= 0) return "░".repeat(width);
  const filled = Math.max(0, Math.min(width, Math.round((done / total) * width)));
  return "█".repeat(filled) + "░".repeat(width - filled);
}

/**
 * Two figures against each other, as one bar split where they split.
 *
 * For a match: how far apart it was, without anybody having to divide two
 * seven-figure numbers in their head. A whitewash looks like a whitewash.
 */
export function versus(mine: number, theirs: number, width = 16): string {
  const total = mine + theirs;
  if (total <= 0) return "▬".repeat(width);
  const left = Math.max(0, Math.min(width, Math.round((mine / total) * width)));
  return "█".repeat(left) + "▒".repeat(width - left);
}

/**
 * How big a thing is, as one character.
 *
 * The thresholds are in CRO and they are chosen from what this game actually
 * charges: a card is 15, so a hundred is a handful of cards and a thousand is a
 * deck's worth of them. A scale invented out of nothing would put a whale on
 * every line in a quiet week.
 */
export function sizeOf(cro: number): string {
  if (cro >= 1_000) return "🐳";
  if (cro >= 250) return "🦈";
  if (cro >= 50) return "🐬";
  return "🐟";
}

/** Whole tokens, grouped, without pretending to a precision nobody wants. */
export function grouped(n: number, places = 0): string {
  return n.toLocaleString("en-US", { maximumFractionDigits: places });
}

/** A percentage with one decimal, or two when one would round it to nothing. */
export function share(part: number, whole: number): string {
  if (whole <= 0) return "0%";
  const pct = (part / whole) * 100;
  return `${pct.toFixed(pct < 1 ? 2 : 1)}%`;
}
