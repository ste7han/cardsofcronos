// What holding $CROCARD gets you.
//
// One rule sits above all of these: holding never changes what you may put in a
// deck. Everyone builds inside the same budget, so a match for money is decided
// by how you play and not by what you hold.
//
// That was measured before it was decided. A deck built on 110 points beats one
// built on 80 in 86% of matches, and even 90 against 80 wins 64%. Selling deck
// power in a game people bet on is not selling a stronger deck, it is selling the
// result of the bet. So holding buys economics and access instead: how much of
// your winnings you keep, and where you are allowed to play.
//
// The thresholds and percentages below are placeholders. They cannot be settled
// until the token exists and there is a real burn to divide, and DESIGN.md says
// so rather than pretending otherwise.

export interface HolderTier {
  name: string;
  /** Written out rather than a number, because the supply is not set yet. */
  holding: string;
  /** Share of the pot burned on a match played at stake. */
  burn: string;
  perks: string[];
}

export const HOLDER_TIERS: readonly HolderTier[] = [
  {
    name: "RETAIL",
    holding: "no bag",
    burn: "10%",
    perks: ["Every card in the set is yours to build with", "Tables up to a small stake"],
  },
  {
    name: "HOLDER",
    holding: "a bag",
    burn: "7%",
    perks: ["All tables", "Match history and replays kept"],
  },
  {
    name: "WHALE",
    holding: "a serious bag",
    burn: "4%",
    perks: ["All tables", "Tournament entry", "New sets before anyone else"],
  },
];
