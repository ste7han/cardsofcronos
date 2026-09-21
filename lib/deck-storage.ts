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

// ─── SEVERAL DECKS ───────────────────────────────────────────────────────────
//
// Above this line is one deck per wallet, which is what there was while the
// builder offered four ready-made decks to start from. Those are gone: a player
// picks between decks they built, and one slot is not a choice.
//
// The single deck above is still what the game and the lobby load — it is the
// one you are playing with — and saving a deck by name both stores it in the
// list below and makes it the one you play. So "which deck am I on" has one
// answer and it is the answer every other screen already reads.

/** A deck somebody built and named. */
export interface SavedDeck {
  /** Stable across renames, so a rename does not read as a different deck. */
  id: string;
  name: string;
  cardIds: string[];
  /** When it was last saved, so the list can be newest first. */
  at: number;
}

function listKey(wallet: string | null): string | null {
  return wallet === null ? null : `tcg.decks.v2:${wallet}`;
}

/**
 * Every deck this wallet has saved, newest first.
 *
 * Unreadable entries are dropped rather than reported: this is a list, and one
 * bad row should cost that row instead of the rest of somebody's decks. A deck
 * that no longer validates is KEPT — cards can be sold, and a deck going
 * unplayable is something to see rather than something to silently lose.
 */
export function savedDecks(): SavedDeck[] {
  if (typeof window === "undefined") return [];
  const key = listKey(signedIn());
  if (key === null) return [];

  let parsed: unknown;
  try {
    parsed = JSON.parse(window.localStorage.getItem(key) ?? "[]");
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) return [];

  return parsed
    .map((row): SavedDeck | null => {
      if (typeof row !== "object" || row === null) return null;
      const { id, name, cardIds, at } = row as Record<string, unknown>;
      if (typeof id !== "string" || typeof name !== "string") return null;
      if (!Array.isArray(cardIds) || !cardIds.every((one) => typeof one === "string")) return null;
      return {
        id,
        name,
        cardIds: cardIds as string[],
        at: typeof at === "number" ? at : 0,
      };
    })
    .filter((deck): deck is SavedDeck => deck !== null)
    .sort((a, b) => b.at - a.at);
}

function writeList(decks: readonly SavedDeck[]): void {
  const key = listKey(signedIn());
  if (key === null) return;
  window.localStorage.setItem(key, JSON.stringify(decks));
}

/**
 * Saves a deck under a name, and makes it the one being played.
 *
 * Returns the problems, empty when it worked — the same shape as saveDeck,
 * because a caller that forgot to look would otherwise treat a refusal as a
 * save. A deck that is not legal is not stored at all; a name that is blank
 * gets one, because a list of decks called nothing is not a list you can pick
 * from.
 *
 * `id` replaces an existing deck rather than adding one, which is what saving
 * again after editing means.
 */
export function saveDeckAs(
  cardIds: readonly string[],
  name: string,
  id?: string,
): { problems: string[]; id?: string } {
  const wallet = signedIn();
  if (wallet === null) return { problems: ["Sign in with a wallet before saving a deck."] };

  const problems = deckProblems(cardIds, INDEX, ownedForRules());
  if (problems.length > 0) return { problems };

  const decks = savedDecks();
  const at = Date.now();
  const called = name.trim().slice(0, 28) || `Deck ${decks.length + 1}`;
  const deckId = id ?? `d${at.toString(36)}`;

  const without = decks.filter((deck) => deck.id !== deckId);
  writeList([{ id: deckId, name: called, cardIds: [...cardIds], at }, ...without]);

  // And it becomes the one you play. The lobby and the board read the single
  // deck above, so a save that did not do this would put a deck in the list
  // that nothing would ever deal.
  const failed = saveDeck(cardIds, called);
  if (failed.length > 0) return { problems: failed };

  return { problems: [], id: deckId };
}

/**
 * Throws one away, and stops playing it if that is what it was.
 *
 * The list and the deck you play are two records of the same thing, and deleting
 * only the first leaves a deck nobody can see still being dealt at the table —
 * found by deleting a deck and watching it stay. Anything else you have saved is
 * untouched: this clears the seat, it does not pick the next one.
 */
export function deleteSavedDeck(id: string): void {
  const going = savedDecks().find((deck) => deck.id === id);
  writeList(savedDecks().filter((deck) => deck.id !== id));

  if (going === undefined) return;
  const playing = loadDeck();
  const same =
    playing.cardIds.length === going.cardIds.length &&
    [...playing.cardIds].sort().join() === [...going.cardIds].sort().join();
  if (same) clearDeck();
}
