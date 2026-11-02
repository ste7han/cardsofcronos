// What a project on Cronos gets when it has a set of its own in this game.
//
// One file, for the reason lib/revenue.ts is one file: these terms are printed
// on /partners, and they will one day be the arguments of a mint contract. A
// page that says "half to the project" next to a contract that pays a third is
// the copy-drifts-from-the-number lesson in CLAUDE.md, with money on it.
//
// ── WHAT IS DECIDED AND WHAT IS NOT ──────────────────────────────────────────
//
// Decided by the maker on 2026-11-02:
//
//   - A partner card costs twice what a Set 01 card costs.
//   - Half of what a partner mint brings in goes to that project.
//   - The holder discount applies, and it is earned by holding either $CROCARD
//     or the project's own token.
//   - Partner cards mix with Set 01 in one deck.
//
// NOT decided: how many different cards a set has, and how many of them are
// minted. Those are null rather than a guess. A number on a screen that nothing
// stands behind invites people to plan around it — the `players.rank` lesson —
// and a project reading "40 cards" will plan around 40. The page says "to be
// decided" for as long as these are null, and fills in by itself when they are
// not.

/** How many times the Set 01 list price a partner card costs. */
export const PRICE_MULTIPLE = 2;

/** Percent of every partner mint that goes to the project it is about. */
export const TO_PARTNER_PERCENT = 50;

/** How many different cards one partner set has. Null until decided. */
export const CARDS_PER_SET: number | null = null;

/** How many cards of one partner set are minted in total. Null until decided. */
export const MINTS_PER_SET: number | null = null;

// ── THE DISCOUNT ON A PARTNER TOKEN ──────────────────────────────────────────
//
// The $CROCARD rungs are a ten-thousandth, a thousandth and a hundredth of its
// supply (data/holder-tiers.ts). A partner token has its own supply, so its
// rungs are the same FRACTIONS of that supply rather than the same token counts
// — 100,000 of a token with a trillion in circulation is dust. The percentages
// off are the ladder's, unchanged, and whichever of the two tokens puts a buyer
// higher is the one that counts. /partners reads both off HOLDER_TIERS, so there
// is no second ladder here to drift.
