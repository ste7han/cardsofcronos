// The lobby's rules, apart from the routes that serve them.
//
// Everything here is a decision about what may happen; the routes are plumbing
// on top of it. Split that way so the rules can be tested without a request, and
// so a second front end later cannot invent different ones.
//
// Correspondence for now. Live matches need a connection that stays open —
// Durable Objects, not a database — and they are refused by name rather than
// silently ignored: an unknown mode arriving at a route that only understood
// one of them is exactly the failure this project keeps writing tests against.
//
// Staked matches are allowed as of September 2026, because there is somewhere
// to hold a stake: contracts/MatchEscrow.sol. What that changes for this file
// is smaller than it sounds — the amount is validated here, and whether the
// money is actually in escrow is a question for the chain, in lib/escrow.ts.
// Nothing here believes a client about a deposit.

import { validateDeck } from "@/engine/deck";
import type { MatchMode } from "@/engine/record";
import type { CardIndex } from "@/engine/types";

/**
 * What the lobby accepts.
 *
 * Live was refused here with a note saying it "needs a connection that stays
 * open". It does not, and never did: engine/record.ts brings the clock forward
 * whenever anybody looks — a window nobody answered becomes an endTurn, so a
 * missed turn costs the turn and not the match — and the board polls while it
 * is the opponent's move. What live actually needed was a clock somebody can
 * read at a live clock and a poll that does not sleep through it, and those are
 * in components/pvp/MatchBoard.tsx now.
 *
 * The rest of live has been here the whole time and untakeable: TURN_CLOCK,
 * the one-at-a-time limit in CONCURRENT, the deadline catch-up. It was built to
 * a brief and then never given a button, which is its own kind of silent
 * failure — the feature reads as present in every file that mentions it.
 */
export const MODES: readonly MatchMode[] = ["live", "correspondence"];

/**
 * The amounts on the buttons. Zero is a friendly match.
 *
 * Buttons and not only a free field, because a lobby where twenty people are
 * waiting on twenty different amounts is twenty people waiting. A free amount
 * is allowed on top — see whyNotAStake — for anybody who wants one, and it is
 * their own problem to find somebody at it.
 */
export const STAKES: readonly number[] = [0, 10, 50, 100, 500, 1000];

/** The most anybody may put on one match. Not a judgement, a blast radius. */
export const MOST_AT_STAKE = 100_000;

/**
 * Why an amount is not a stake, or null.
 *
 * Whole CRO. The escrow takes wei and could hold any fraction, but the lobby
 * stores the amount as a number and matches offers by it — and two offers that
 * differ in the eighteenth decimal are two offers nobody can pair.
 */
export function whyNotAStake(stake: unknown): string | null {
  // Not "falsy": zero is a real answer and `!stake` would also let through
  // undefined and an empty string.
  if (typeof stake !== "number" || !Number.isFinite(stake)) return "That is not a stake.";
  if (stake < 0) return "A stake cannot be negative.";
  if (!Number.isInteger(stake)) return "Stakes are whole CRO.";
  if (stake > MOST_AT_STAKE) {
    return `The most on one match is ${MOST_AT_STAKE.toLocaleString("en-US")} CRO.`;
  }
  return null;
}

/**
 * Why a request to sit down is refused, or null.
 *
 * One function for both creating an offer and joining one, because they are the
 * same question asked twice and answering it differently in two places is how a
 * deck that could not be offered becomes a deck that can be joined with.
 */
export function whyNotSeated(args: {
  mode: unknown;
  stake: unknown;
  deck: unknown;
  index: CardIndex;
}): string | null {
  if (typeof args.mode !== "string" || !MODES.includes(args.mode as MatchMode)) {
    return `A match is ${MODES.join(" or ")}, and that was neither.`;
  }

  const why = whyNotAStake(args.stake);
  if (why !== null) return why;

  if (!Array.isArray(args.deck) || !args.deck.every((id) => typeof id === "string")) {
    return "That is not a deck.";
  }

  try {
    // Throws, with the reason on it. The deck rules live in the engine and are
    // the same ones the builder shows — a second copy here would drift.
    validateDeck(args.deck as string[], args.index);
  } catch (error) {
    return error instanceof Error ? error.message : "That deck is not legal.";
  }

  // Whether the player owns these cards is checked by the caller and only for a
  // staked match — see whyNotYours. It cannot be checked here because it needs
  // the database, and this function is the rules rather than the plumbing.
  //
  // For a friendly match it is not checked at all, and that is deliberate: a
  // collection used to live only in the player's own browser, so the server had
  // never seen it. It has seen it since the mint — card_owners is kept current
  // from the chain — and the moment a match is worth something, that is the
  // half that has to be true.
  return null;
}

/**
 * Which of these cards this wallet does not hold.
 *
 * Only worth asking on a staked match. It reads the ownership table the
 * minute-job keeps rather than the chain, so a card minted in the last minute
 * may not be there yet — which is a reason to wait a minute before staking on
 * it, and the lobby says so.
 *
 * Duplicates in the deck are not a concern: a deck holds one of each, and the
 * deck rules have already said so by the time this is asked.
 */
export function notHeldBy(
  held: ReadonlySet<string>,
  deck: readonly string[],
): string[] {
  return [...new Set(deck)].filter((id) => !held.has(id));
}

/** A short, readable id. Not a secret: it names a match, it does not protect one. */
export function newId(): string {
  const bytes = new Uint8Array(9);
  crypto.getRandomValues(bytes);
  return [...bytes].map((b) => b.toString(36).padStart(2, "0")).join("").slice(0, 12);
}
