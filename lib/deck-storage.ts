// Where your deck lives between sessions.
//
// ── ON THE SERVER, AND CACHED HERE ───────────────────────────────────────────
//
// A deck belongs to the wallet and lives in D1 — app/api/decks. This file is the
// browser's copy of that, and everything below reads the copy.
//
// It was the other way round until September 2026, and a deck was the property
// of a browser rather than of a player: somebody who built four decks on a
// laptop arrived at /play on their phone, was told they had none, and was
// offered the builder. What is stored here now is a cache, which is why every
// write goes to the server FIRST and only lands here if it was accepted. A save
// that wrote locally and then failed over the network would be a deck that
// exists on one device and nowhere else, which is the bug this replaced.
//
// The reads stay synchronous on purpose. The lobby and the table read a deck
// during render, and turning that into a promise would mean every screen
// learning to show a deck that has not arrived yet. Instead `syncDecks` fills
// the cache after mount and fires DECKS_EVENT, and the screens re-read.
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
import { chainHoldings, ownedForRules } from "@/lib/collection";
import { proofOf, signedIn } from "@/lib/session";
import { INDEX } from "@/lib/set";

/** Fired on this window whenever the cached decks change, from any cause. */
export const DECKS_EVENT = "coc:decks";

function announce(): void {
  if (typeof window !== "undefined") window.dispatchEvent(new Event(DECKS_EVENT));
}

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

// ─── THE SERVER, AND THIS CACHE ──────────────────────────────────────────────

interface Answer {
  decks: { id: string; name: string; cardIds: string[]; at: number }[];
  playing: string | null;
  problems?: string[];
}

/** One request to /api/decks, or null when it could not be made at all. */
async function ask(action: string, extra: Record<string, unknown> = {}): Promise<Answer | null> {
  const proof = proofOf();
  if (proof === null) return null;
  try {
    const response = await fetch("/api/decks", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ proof, action, ...extra }),
    });
    if (!response.ok) return null;
    return (await response.json()) as Answer;
  } catch {
    // Offline, or the route is down. The caller reports it rather than
    // pretending; what is cached here stays exactly as it was.
    return null;
  }
}

/**
 * Writes the server's answer into the cache, so the synchronous readers above
 * see it.
 *
 * Both halves, together. The list and the deck being dealt are one fact told
 * twice, and updating only the list is how a deleted deck kept being dealt at
 * the table.
 */
function cache(answer: Answer): void {
  const key = listKey(signedIn());
  if (key === null) return;

  window.localStorage.setItem(
    key,
    JSON.stringify(answer.decks.map((deck) => ({ ...deck, cardIds: [...deck.cardIds] }))),
  );

  const playing = answer.decks.find((deck) => deck.id === answer.playing);
  if (playing === undefined) clearDeck();
  else {
    const single = keyFor(signedIn());
    // Written straight through rather than via saveDeck, which re-validates
    // against what the browser thinks is owned. The server already checked when
    // it accepted this, and a chain read that has not landed yet would
    // otherwise throw away a deck that is perfectly legal.
    if (single !== null) {
      window.localStorage.setItem(
        single,
        JSON.stringify({ cardIds: playing.cardIds, name: playing.name }),
      );
    }
  }

  announce();
}

/**
 * Fetches this wallet's decks and fills the cache.
 *
 * Call it after mount and on every wallet change. It is also the migration: a
 * wallet whose decks are only in this browser — everybody, the first time —
 * gets them pushed up before the list is read back, so nothing anybody built is
 * lost by moving the store.
 *
 * Returns whether it managed to reach the server, because "you have no decks"
 * and "we could not ask" are different things and the screens say so.
 */
export async function syncDecks(): Promise<boolean> {
  const wallet = signedIn();
  if (typeof window === "undefined" || wallet === null) return false;

  // FIRST, and not as an afterthought. loadDeck checks a deck against what this
  // wallet owns, and what the browser knows it owns is another thing that lived
  // only in localStorage — so on a browser that had never asked, the answer is
  // "nothing", and a deck fetched from the server would be handed straight back
  // as forty cards you do not own. Moving the decks to the server without this
  // would have moved the bug rather than fixed it.
  //
  // A failure here is left alone: what was remembered before stays remembered,
  // which is the difference between a bad connection and a sold collection.
  await chainHoldings(wallet).catch(() => []);

  let answer = await ask("list");
  if (answer === null) return false;

  if (answer.decks.length === 0) {
    const local = savedDecks();
    if (local.length > 0) {
      // Oldest first, so the newest one ends up holding the seat — saving makes
      // a deck the one being dealt, and the list is newest first.
      for (const deck of [...local].reverse()) {
        const sent = await ask("save", { name: deck.name, cardIds: deck.cardIds });
        if (sent !== null && (sent.problems?.length ?? 0) === 0) answer = sent;
      }
      // Whatever the deck being played was, keep playing it.
      const playing = loadDeck();
      const same = answer.decks.find(
        (deck) => [...deck.cardIds].sort().join() === [...playing.cardIds].sort().join(),
      );
      if (playing.cardIds.length > 0 && same !== undefined) {
        answer = (await ask("play", { id: same.id })) ?? answer;
      }
    }
  }

  cache(answer);
  return true;
}

/**
 * Saves a deck under a name, and makes it the one being played.
 *
 * Returns the problems, empty when it worked — the same shape it always had,
 * because a caller that forgot to look would otherwise treat a refusal as a
 * save. A deck that is not legal is not stored at all; a name that is blank gets
 * one, because a list of decks called nothing is not a list you can pick from.
 *
 * `id` replaces an existing deck rather than adding one, which is what saving
 * again after editing means.
 *
 * The rules are checked here as well as on the server. Not as a safety net —
 * the server's answer is the one that counts — but so a deck that is short two
 * cards says so without a round trip.
 */
export async function saveDeckAs(
  cardIds: readonly string[],
  name: string,
  id?: string,
): Promise<{ problems: string[]; id?: string }> {
  if (signedIn() === null) return { problems: ["Sign in with a wallet before saving a deck."] };

  const problems = deckProblems(cardIds, INDEX, ownedForRules());
  if (problems.length > 0) return { problems };

  const answer = await ask("save", { name, cardIds: [...cardIds], id });
  if (answer === null) {
    return { problems: ["Could not reach the server, so the deck was not saved. Try again."] };
  }
  if ((answer.problems?.length ?? 0) > 0) return { problems: answer.problems! };

  cache(answer);
  return { problems: [], id: answer.playing ?? undefined };
}

/**
 * Throws one away, and stops playing it if that is what it was.
 *
 * Both of those follow from the server's answer rather than being done here:
 * the seat moves because the answer says which deck holds it now. Doing it by
 * hand is how a deleted deck stayed on the table, found by deleting one and
 * watching it keep being dealt.
 */
export async function deleteSavedDeck(id: string): Promise<boolean> {
  const answer = await ask("delete", { id });
  if (answer === null) return false;
  cache(answer);
  return true;
}

/** Picks which of your decks is dealt, without changing any of them. */
export async function playSavedDeck(id: string): Promise<boolean> {
  const answer = await ask("play", { id });
  if (answer === null) return false;
  cache(answer);
  return true;
}
