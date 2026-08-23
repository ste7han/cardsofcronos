// Where your deck lives between sessions.
//
// Nothing here trusts what it reads back. A stored deck can be from an older set,
// hand-edited, or half-written by a crashed tab, and a deck that quietly breaks
// the rules is exactly the kind of silent failure this project keeps trying to
// avoid. If it does not validate, it is reported and no deck is returned.
//
// There is no fallback deck any more. A player with nothing has nothing until
// they mint, and the screens say so — a free forty handed out here used to be
// the best deck in the game and the reason not to mint at all.

import { deckProblems } from "@/engine/deck";
import { ownedForRules } from "@/lib/collection";
import { signedIn } from "@/lib/session";
import { INDEX } from "@/lib/set";

/**
 * A deck belongs to a wallet, for the same reason a collection does.
 *
 * Without the address in the key, signing in with a second wallet would open
 * somebody else's deck — built from cards this wallet does not hold, so every
 * screen would then be arguing with it.
 */
function keyFor(wallet: string | null): string | null {
  return wallet === null ? null : `tcg.deck.v1:${wallet}`;
}

export interface LoadedDeck {
  cardIds: string[];
  /**
   * What this deck is called. Empty when it has never been named.
   *
   * It exists so the board can tell you which of your decks you are playing,
   * which matters more the moment you have several. The opponent never sees it —
   * a deck name is a note to yourself, not information about the match.
   */
  name: string;
  /** Why a stored deck was rejected, if there was one and it was broken. */
  rejected: string[];
}

/**
 * A stored deck, in either shape it has ever had.
 *
 * The old one was a bare array of ids. Rewriting the key would have thrown away
 * every deck anybody had saved — so an array still reads, as a deck with no
 * name, and gets a name the next time it is saved.
 */
function parseStored(parsed: unknown): { cardIds: string[]; name: string } | null {
  if (Array.isArray(parsed) && parsed.every((id) => typeof id === "string")) {
    return { cardIds: parsed as string[], name: "" };
  }
  if (
    typeof parsed === "object" &&
    parsed !== null &&
    "cardIds" in parsed &&
    Array.isArray((parsed as { cardIds: unknown }).cardIds)
  ) {
    const { cardIds, name } = parsed as { cardIds: unknown[]; name?: unknown };
    if (!cardIds.every((id) => typeof id === "string")) return null;
    return { cardIds: cardIds as string[], name: typeof name === "string" ? name : "" };
  }
  return null;
}

/**
 * The deck this player saved, or none.
 *
 * `cardIds` empty means exactly that: nothing to play with yet. It used to fall
 * back to a free starter pack, which meant no screen ever had to handle a player
 * with no deck — and then the starter went and every one of them did.
 */
export function loadDeck(): LoadedDeck {
  const none = (rejected: string[] = []): LoadedDeck => ({
    cardIds: [],
    name: "",
    rejected,
  });

  if (typeof window === "undefined") return none();

  const key = keyFor(signedIn());
  // Signed out is not "no deck saved". Nothing is loaded because there is nobody
  // to load it for, and the screens say that rather than offering a builder.
  if (key === null) return none();

  const raw = window.localStorage.getItem(key);
  if (!raw) return none();

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return none(["The saved deck could not be read."]);
  }

  const stored = parseStored(parsed);
  if (!stored) return none(["The saved deck was not a list of cards."]);

  // Ownership is checked here as well: a deck saved before this rule existed, or
  // built in another browser, can hold cards this player never opened.
  const problems = deckProblems(stored.cardIds, INDEX, ownedForRules());
  if (problems.length > 0) return none(problems);

  return { cardIds: stored.cardIds, name: stored.name, rejected: [] };
}

/**
 * Stores a deck. Refuses an illegal one rather than saving something unplayable —
 * including a deck holding cards this player does not own, which is a deck rule
 * now rather than a thing the screen merely declines to offer.
 */
export function saveDeck(cardIds: readonly string[], name = ""): string[] {
  const key = keyFor(signedIn());
  // A rule and not a screen. The deck builder does not offer this to a signed-out
  // visitor, but "the button was not there" has never been a rule — in Cards of
  // Cronos the card check was a UI filter and a direct call could play anything.
  if (key === null) return ["Sign in with a wallet before saving a deck."];

  const problems = deckProblems(cardIds, INDEX, ownedForRules());
  if (problems.length > 0) return problems;

  window.localStorage.setItem(key, JSON.stringify({ cardIds, name: name.trim().slice(0, 28) }));
  return [];
}

export function clearDeck(): void {
  const key = keyFor(signedIn());
  if (key !== null) window.localStorage.removeItem(key);
}
