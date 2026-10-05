// The rank, and the only thing that moves it.
//
// ── IT DID NOT MOVE AT ALL ───────────────────────────────────────────────────
//
// `players.rank` is DEFAULT 1000 and nothing in this repo ever wrote to it, so
// every player sat on 1000 while the lobby printed that number beside their
// name as though it meant something. `players.staked` had the same problem from
// the other end: the profile shows "x / 10 staked matches" and x was never
// incremented, so it read 0 / 10 for ever.
//
// Both were designed — DESIGN.md has the paragraph, the schema has the column
// comment explaining why Elo must be stored rather than recomputed — and
// neither was built. A number on a screen that cannot change is worse than no
// number: it invites people to play for it.
//
// ── WHAT DESIGN.MD ALREADY SETTLED ───────────────────────────────────────────
//
//   · it starts at 1000
//   · it moves only on staked matches, never on friendly ones and never on solo
//   · a correspondence clock running out ends the TURN and not the match, so
//     there is no forfeit to special-case — a timed-out match still plays to ten
//     turns and ends on market cap like any other
//
// ── WHAT IS DECIDED HERE ─────────────────────────────────────────────────────
//
// **K is 32 until a rank rests on ten staked matches, then 16.** Ten is not a
// new number: it is the figure the players table already counts to and the
// profile already shows, so a rank becomes settled at exactly the point the
// game already called settled. A single K would be wrong at both ends — 16
// takes a dozen matches to place somebody who is plainly stronger, and 32 keeps
// a long-established rank swinging on one result.
//
// **A draw is half a win**, which is Elo's own answer and needs no opinion. It
// moves ranks even though a drawn staked match pays nobody: the pot and the
// ladder are different questions, and a draw against somebody far above you is
// a real result.
//
// **There is a floor.** Elo has no natural one, and a rank that can reach zero
// turns into an identity people keep rather than a position they climb out of.
// The ladder is for ordering, not for punishing.
//
// **The deltas are computed from the ranks as they were before the match** and
// applied as a change rather than a new value — see recordStaked in lib/store.
// Two matches settling at once then both count, instead of the later write
// overwriting the earlier one with a number computed before it.

/** Where everybody starts. Quoted in DESIGN.md and in db/schema.sql. */
export const START = 1000;

/**
 * Staked matches before a rank counts as settled.
 *
 * The same ten the players table counts and the profile shows. Exported so
 * there is one of it: this was written out again in components/Profile.tsx.
 */
export const SETTLED_AFTER = 10;

/** How far one result can move a rank, before and after it is settled. */
export const K_PLACING = 32;
export const K_SETTLED = 16;

/** No lower than this, however long a losing run goes on. */
export const FLOOR = 100;

export type Outcome = "win" | "loss" | "draw";

/** Elo's own expectation: the share of the result a rating should take. */
export function expected(mine: number, theirs: number): number {
  return 1 / (1 + 10 ** ((theirs - mine) / 400));
}

/** 32 while a rank is still being placed, 16 once it rests on enough matches. */
export function kFor(playedStaked: number): number {
  return playedStaked < SETTLED_AFTER ? K_PLACING : K_SETTLED;
}

/**
 * How much a rank moves, as a whole number.
 *
 * Rounded to the nearest, with a floor of one on the magnitude. Plain rounding
 * would turn a third of a point into nothing, so a heavy favourite beating a
 * much weaker player would change nothing at all — a result that visibly did
 * not count. Rounding away from zero instead would inflate every delta by up to
 * a point, which over a season is a ladder that drifts upward for no reason.
 */
export function move(args: {
  /** The rank before this match. */
  mine: number;
  /** The opponent's rank before this match. */
  theirs: number;
  /** How many staked matches this rank already rested on. */
  played: number;
  outcome: Outcome;
}): number {
  const score = args.outcome === "win" ? 1 : args.outcome === "draw" ? 0.5 : 0;
  const raw = kFor(args.played) * (score - expected(args.mine, args.theirs));
  // A draw between equals is genuinely nothing, and must stay nothing.
  if (raw === 0) return 0;
  const magnitude = Math.max(1, Math.round(Math.abs(raw)));
  return raw < 0 ? -magnitude : magnitude;
}

/** What a rank becomes, kept off the floor. Applied as a delta in the database. */
export function after(rank: number, delta: number): number {
  return Math.max(FLOOR, rank + delta);
}
