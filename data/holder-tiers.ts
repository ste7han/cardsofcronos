// What holding $CROCARD gets you: a smaller cut taken out of what you win.
//
// One rule sits above all of these: holding never changes what you may put in a
// deck. Everyone builds inside the same rules, so a match for money is decided
// by how you play and not by what you hold.
//
// That was measured before it was decided. A deck built on 110 points beats one
// built on 80 in 86% of matches, and even 90 against 80 wins 64%. Selling deck
// power in a game people bet on is not selling a stronger deck, it is selling the
// result of the bet. So holding buys economics instead, and only economics: how
// much of what you win you keep. Nothing else.
//
// What is taken does not all go up in smoke. A ranked match splits its cut the
// same way a mint does — half to holders, a quarter burned, a quarter into the
// weekly pot — which is why the number below is a cut and not a burn.
//
// There were perks on these rungs — all tables, tournament entry, new sets
// first — and they are gone. Every one of them was a promise about a thing that
// does not exist yet, printed next to a number that does, and a rung that
// promises four things is four things to keep true. TCG offers one, and one is
// the whole reason the sentence above stays honest: a smaller cut is not access,
// so it cannot quietly turn into an advantage at a table.
//
// THE LADDER IS TCG'S, and it carries over without a number changing, which is
// worth saying because it nearly always is not. $TCG has a supply of one billion
// and the ladder is built on fractions of it — one per cent, a tenth, a
// hundredth. $CROCARD's supply was read off the chain rather than assumed and it
// is one billion exactly, so 10,000,000 / 1,000,000 / 100,000 is the same ladder
// and not a coincidence dressed up as one. If that supply is ever wrong here,
// every threshold below is wrong with it.
//
// The three tiers this replaced were placeholders and said so: "no bag", "a
// bag", "a serious bag", with a burn of 10/7/4 that nobody had settled.

/**
 * One billion, read from the token on Cronos rather than taken on trust.
 *
 *   cast call 0xECf3361441512c1e9F6A6e8734D86614D8e795BC "totalSupply()" \
 *     --rpc-url https://evm.cronos.org
 *
 * 18 decimals, so the raw answer is this times 1e18.
 */
export const CROCARD_SUPPLY = 1_000_000_000;

export interface HolderTier {
  id: "none" | "small" | "medium" | "whale";
  name: string;
  /** The least you must hold, in whole $CROCARD. */
  atLeast: number;
  /**
   * Share of the pot taken when you win, 0 to 1. What is left is yours.
   *
   * CALLED `cut` AND NOT `burn`, and it was `burn` for an afternoon. That was
   * true while a ranked match was 100% burn and stopped being true the moment
   * the stream started splitting three ways — a quarter of this is burned and
   * the rest goes to holders and the prize pot. A field named for one of the
   * three things it pays is the "one name, two meanings" trap CLAUDE.md is
   * about, and it had already reached the page as "BURNED WHEN YOU WIN".
   *
   * Where it goes is lib/revenue.ts and lives there only. This says how much.
   *
   * The winner's tier is the one that counts. Holding is meant to mean you keep
   * more of what you win, and your stake is gone either way when you lose — so a
   * discount on a loss would only ever have been a discount for the person who
   * beat you.
   */
  cut: number;
}

/**
 * Highest tier first, because that is the order they are searched in.
 *
 * A ladder read the other way round would hand a whale the retail rate the
 * moment somebody inserted a tier above them. The mint page reverses it for
 * display, where low-to-high is the way anybody reads a ladder.
 */
export const HOLDER_TIERS: readonly HolderTier[] = [
  {
    id: "whale",
    name: "WHALE",
    // One per cent of a billion.
    atLeast: CROCARD_SUPPLY / 100,
    cut: 0.05,
  },
  {
    id: "medium",
    name: "HOLDER",
    atLeast: CROCARD_SUPPLY / 1_000,
    cut: 0.1,
  },
  {
    id: "small",
    name: "BAGHOLDER",
    atLeast: CROCARD_SUPPLY / 10_000,
    cut: 0.15,
  },
  {
    id: "none",
    name: "RETAIL",
    atLeast: 0,
    cut: 0.25,
  },
];

/**
 * Refuses at load a ladder that is out of order or does not reward holding.
 *
 * Both mistakes are one digit wide and neither is visible on the page: a
 * threshold typed below the rung under it silently makes that rung unreachable,
 * and a burn that does not fall as you climb is a ladder that charges you for
 * holding. Checked here rather than only in a test, because the test cannot stop
 * a deploy and this can.
 */
{
  for (let i = 1; i < HOLDER_TIERS.length; i++) {
    const above = HOLDER_TIERS[i - 1]!;
    const below = HOLDER_TIERS[i]!;
    if (below.atLeast >= above.atLeast) {
      throw new Error(
        `${below.name} asks for ${below.atLeast} and ${above.name} above it asks for ` +
          `${above.atLeast}. The rung above is unreachable.`,
      );
    }
    if (below.cut <= above.cut) {
      throw new Error(
        `${below.name} is cut ${below.cut} and ${above.name} above it ${above.cut}. ` +
          `Climbing the ladder has to cost you less, or it is not a ladder.`,
      );
    }
  }
  if (HOLDER_TIERS[HOLDER_TIERS.length - 1]!.atLeast !== 0) {
    throw new Error("The bottom rung asks for a balance. Somebody holding nothing has no tier.");
  }
}

/**
 * Which tier a balance falls in.
 *
 * `null` — a balance nobody could read — is retail. Never give a discount that
 * could not be verified: an RPC that will not answer must not be worth money to
 * the person it would not answer about.
 */
export function tierFor(balance: number | null): HolderTier {
  const retail = HOLDER_TIERS[HOLDER_TIERS.length - 1]!;
  if (balance === null) return retail;
  return HOLDER_TIERS.find((tier) => balance >= tier.atLeast) ?? retail;
}

/** What share of the pot is taken when this balance wins. */
export function cutFor(balance: number | null): number {
  return tierFor(balance).cut;
}

/** What the next rung up would need, or null at the top. */
export function nextTier(balance: number | null): HolderTier | null {
  const current = tierFor(balance);
  const index = HOLDER_TIERS.findIndex((tier) => tier.id === current.id);
  return index > 0 ? HOLDER_TIERS[index - 1]! : null;
}
