// What this wallet has played.
//
// Every finished match against the market, kept per wallet, so a profile can say
// something true rather than something encouraging. Not the demo: a borrowed
// deck is nobody's record, and letting it count would make the first number a
// new player sees a number about a deck they never chose.
//
// A match is stored as its result and not as its moves. The replayable form
// lives in engine/record.ts and belongs to PvP, where a disputed match has to be
// re-run; nothing here is disputed by anybody, so this is a row of numbers.
//
// Solo results are not a rank and this file cannot make them one. They are
// computed in the player's own browser against a bot, so they are worth exactly
// as much as the player's honesty — which is fine for "how is this deck doing"
// and worthless as a ladder. DESIGN.md settles that rank comes from staked PvP;
// the profile shows these two things apart and says which is which.

import { fnv1a } from "@/lib/fnv";
import { signedIn } from "@/lib/session";

export interface MatchOutcome {
  /** When it finished. */
  at: number;
  /** Which deck played it — stable across renames, see deckKey. */
  deckKey: string;
  /** What it was called at the time. A rename does not rewrite history. */
  deckName: string;
  yourMC: number;
  theirMC: number;
  /** null is a draw, which the engine does produce. */
  won: boolean | null;
}

/**
 * How many matches are kept.
 *
 * A row is about a hundred bytes, so this is well under a tenth of what a
 * browser will hold. The cap is not about space — it is that a list which only
 * ever grows eventually turns a profile page into a slow one, and nobody is
 * reading their four-hundredth-most-recent match.
 */
export const KEPT = 500;

/**
 * Which deck this is, regardless of what it is called.
 *
 * The forty card ids, sorted, hashed. Sorted because the order a deck is stored
 * in is not a property of the deck, and two identical decks that happened to be
 * built in a different order are one deck's record, not two. Renaming a deck
 * keeps its history; changing a card starts a new one, which is the honest
 * answer — a deck with a different card is a different deck, and rolling its
 * results together would hide exactly the change you wanted to measure.
 */
export function deckKey(cardIds: readonly string[]): string {
  return fnv1a([...cardIds].sort().join(",")).toString(36);
}

function keyFor(wallet: string | null): string | null {
  return wallet === null ? null : `tcg.history.v1:${wallet}`;
}

export function history(): MatchOutcome[] {
  if (typeof window === "undefined") return [];
  const key = keyFor(signedIn());
  if (key === null) return [];

  const raw = window.localStorage.getItem(key);
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    // Filtered rather than trusted. A half-written row from a tab that died
    // mid-write would otherwise show up as NaN across every figure on the page.
    return parsed.filter(
      (row: unknown): row is MatchOutcome =>
        typeof row === "object" &&
        row !== null &&
        Number.isFinite((row as MatchOutcome).at) &&
        Number.isFinite((row as MatchOutcome).yourMC) &&
        Number.isFinite((row as MatchOutcome).theirMC) &&
        typeof (row as MatchOutcome).deckKey === "string",
    );
  } catch {
    return [];
  }
}

/** Adds one result. Silently does nothing when nobody is signed in. */
export function record(outcome: MatchOutcome): void {
  const key = keyFor(signedIn());
  // Quiet, unlike the mint. Nothing is lost that the player asked to keep: they
  // played a match while signed out, which the screens already told them is not
  // going on any record.
  if (key === null) return;

  const kept = [outcome, ...history()].slice(0, KEPT);
  window.localStorage.setItem(key, JSON.stringify(kept));
}

export interface Tally {
  played: number;
  won: number;
  lost: number;
  drawn: number;
  /** Wins over matches played. Zero matches is zero, not NaN. */
  winRate: number;
  /** The best market cap this wallet has finished on. */
  bestMC: number;
  /** Mean market cap, which says more about a deck than its best day does. */
  averageMC: number;
}

export function tally(outcomes: readonly MatchOutcome[]): Tally {
  const played = outcomes.length;
  const won = outcomes.filter((o) => o.won === true).length;
  const drawn = outcomes.filter((o) => o.won === null).length;

  return {
    played,
    won,
    lost: played - won - drawn,
    drawn,
    // A rate over no matches is not zero percent, but zero is the only number
    // that renders. The page shows "—" instead, using played to decide.
    winRate: played === 0 ? 0 : won / played,
    bestMC: outcomes.reduce((best, o) => Math.max(best, o.yourMC), 0),
    averageMC: played === 0 ? 0 : Math.round(outcomes.reduce((sum, o) => sum + o.yourMC, 0) / played),
  };
}

export interface DeckRow extends Tally {
  deckKey: string;
  /** The most recent name this deck went by. */
  name: string;
  lastPlayed: number;
}

/**
 * One row per deck, best win rate first.
 *
 * Ties broken by matches played, so a deck at 100% from one match does not sit
 * above a deck at 80% from thirty. It is still shown — a small sample is a fact
 * about the deck, and the page prints the count beside the rate so nobody has to
 * take the ordering as a verdict.
 */
export function byDeck(outcomes: readonly MatchOutcome[]): DeckRow[] {
  const groups = new Map<string, MatchOutcome[]>();
  for (const outcome of outcomes) {
    const group = groups.get(outcome.deckKey);
    if (group) group.push(outcome);
    else groups.set(outcome.deckKey, [outcome]);
  }

  return [...groups.entries()]
    .map(([key, group]) => {
      // Sorted by time so "the name it goes by now" is the most recent one and
      // not whichever happened to be first in storage.
      const byTime = [...group].sort((a, b) => b.at - a.at);
      return {
        deckKey: key,
        name: byTime[0]!.deckName,
        lastPlayed: byTime[0]!.at,
        ...tally(group),
      };
    })
    .sort((a, b) => b.winRate - a.winRate || b.played - a.played);
}
