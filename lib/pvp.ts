// The lobby's rules, apart from the routes that serve them.
//
// Everything here is a decision about what may happen; the routes are plumbing
// on top of it. Split that way so the rules can be tested without a request, and
// so a second front end later cannot invent different ones.
//
// Correspondence and friendly, for now. Live matches need a connection that
// stays open — Durable Objects, not a database — and staked matches need
// somewhere to hold the stake, which does not exist yet. Both are refused by
// name rather than silently ignored: an unknown mode arriving at a route that
// only understood one of them is exactly the failure this project keeps writing
// tests against.

import { validateDeck } from "@/engine/deck";
import type { MatchMode } from "@/engine/record";
import type { CardIndex } from "@/engine/types";

/** What the lobby accepts today. */
export const MODES: readonly MatchMode[] = ["correspondence"];

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
    return `Only ${MODES.join(" and ")} matches can be played yet. Live play needs a connection that stays open.`;
  }

  // Not "falsy": a stake of zero is the only allowed one, and `!stake` would
  // also let through undefined and an empty string.
  if (args.stake !== 0) {
    return "Only friendly matches for now. There is nowhere to hold a stake yet, and a stake nobody holds is not a stake.";
  }

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

  // Deliberately not checked: whether the player owns these cards. A collection
  // lives in their own browser, so the server has never seen it and cannot say.
  // For a friendly match with nothing at stake that is a fair trade; the moment
  // a match is worth something, collections have to move to the server, and this
  // comment is where that starts. See DESIGN.md.
  return null;
}

/** A short, readable id. Not a secret: it names a match, it does not protect one. */
export function newId(): string {
  const bytes = new Uint8Array(9);
  crypto.getRandomValues(bytes);
  return [...bytes].map((b) => b.toString(36).padStart(2, "0")).join("").slice(0, 12);
}
