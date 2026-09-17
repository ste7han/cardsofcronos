// The weekly high score: beat the bot, and the best verified score takes the pot.
//
// WHAT MAKES A SCORE COUNT. lib/history.ts says it about solo results already:
// they are computed in the player's own browser, so they are worth exactly as
// much as the player's honesty. That is fine for a profile and worthless once a
// prize hangs on it, because the first thing anybody tries is editing the number.
//
// So a score is not reported, it is replayed. The player hands over the seed, the
// deck and every move; the server rebuilds the bot's deck from the seed — it is
// derived from the seed and nothing else — replays the match through the same
// engine the browser used, and records what ITS OWN state says at the end.
// Nothing the caller claims about the outcome is read. That is the same
// machinery /api/ref/demo uses to check somebody met the game.
//
// It is not unbreakable and should not be described as if it were. The engine is
// public, so somebody could script a solver and submit the matches it played.
// What that costs is a program that beats the same bot everybody else is
// beating, which is the game rather than a way around it.
//
// WHAT IT CANNOT CHECK, while the mint is shut: that the deck is yours. A
// collection lives in the player's browser here, so there is nothing on chain to
// read it against. It does not matter yet and says so in the route — with
// nothing to mint there is nothing to own, and DECK_FROM_COLLECTION stands down
// with MINT_OPEN. The moment either changes, this is the check that has to
// arrive with it.

import type { Database } from "@/lib/store";

export interface Score {
  wallet: string;
  /** The market cap this wallet finished on. The score. */
  mc: number;
  /** What the bot finished on. Kept because beating it is the entry requirement. */
  opponentMC: number;
  seed: number;
  at: number;
}

/**
 * Which week a moment falls in, as "2026-W38".
 *
 * Weeks run Monday 00:00 UTC to Sunday midnight, so "every Sunday" means the
 * week that has just ended. UTC and not local time, because a prize that closes
 * at a different instant depending on where you are is one somebody can argue
 * about.
 */
export function weekOf(now: number): string {
  const day = new Date(now);
  // Thursday of this week decides the year, which is how ISO weeks avoid a
  // 1 January that belongs to the previous year.
  const thursday = new Date(Date.UTC(day.getUTCFullYear(), day.getUTCMonth(), day.getUTCDate()));
  const weekday = (thursday.getUTCDay() + 6) % 7;
  thursday.setUTCDate(thursday.getUTCDate() - weekday + 3);
  const firstThursday = new Date(Date.UTC(thursday.getUTCFullYear(), 0, 4));
  const firstWeekday = (firstThursday.getUTCDay() + 6) % 7;
  firstThursday.setUTCDate(firstThursday.getUTCDate() - firstWeekday + 3);
  const week = 1 + Math.round((thursday.getTime() - firstThursday.getTime()) / (7 * 86_400_000));
  return `${thursday.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

/** When the current week closes, in milliseconds. */
export function weekEnds(now: number): number {
  const day = new Date(now);
  const weekday = (day.getUTCDay() + 6) % 7;
  const monday = Date.UTC(day.getUTCFullYear(), day.getUTCMonth(), day.getUTCDate() - weekday);
  return monday + 7 * 86_400_000;
}

/**
 * Writes a score, keeping only a wallet's best in a week.
 *
 * Best and not latest. A board where your last match replaces your best one
 * punishes playing again, which is the opposite of what a weekly prize is for.
 *
 * Returns whether this became the wallet's score for the week.
 */
export async function record(db: Database, score: Score, week: string): Promise<boolean> {
  const written = await db
    .prepare(
      `INSERT INTO tournament (wallet, week, mc, opponent_mc, seed, at)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT (wallet, week) DO UPDATE SET
         mc = excluded.mc, opponent_mc = excluded.opponent_mc,
         seed = excluded.seed, at = excluded.at
       WHERE excluded.mc > tournament.mc
       RETURNING wallet`,
    )
    .bind(score.wallet, week, score.mc, score.opponentMC, score.seed, score.at)
    .first<{ wallet: string }>();
  return written !== null;
}

/** This week's table, best first. */
export async function standings(db: Database, week: string, limit = 25): Promise<Score[]> {
  const { results } = await db
    .prepare(
      `SELECT wallet, mc, opponent_mc AS opponentMC, seed, at
         FROM tournament WHERE week = ? ORDER BY mc DESC, at ASC LIMIT ?`,
    )
    .bind(week, limit)
    .all<Score>();
  return results;
}

/** A week that has closed, its winner, and what they were paid if anything. */
export interface PastWeek {
  week: string;
  wallet: string;
  mc: number;
  opponentMC: number;
  /** How many wallets beat the bot that week. */
  entries: number;
  /**
   * $CROCARD paid, in the token's smallest unit as TEXT, or null when the payout
   * is not recorded yet. Named wei because it is eighteen decimals and the
   * column is called that; it has not been CRO since the splitter started
   * buying the token before paying anything.
   */
  wei: string | null;
  txHash: string | null;
  paidAt: number | null;
}

/**
 * The closed weeks, most recent first, each with its winner and its payout.
 *
 * The winner is picked the same way the live board orders itself — highest
 * market cap, and on a tie whoever got there first. Any other rule here would
 * mean the board showed one name all week and the log showed another.
 *
 * A LEFT JOIN, so a week that has been won but not yet paid appears with a
 * missing payout rather than not appearing. Hiding it would turn an unpaid week
 * into an invisible one, which is the failure worth being loud about.
 */
export async function pastWeeks(db: Database, thisWeek: string, limit = 12): Promise<PastWeek[]> {
  const { results } = await db
    .prepare(
      `SELECT t.week        AS week,
              t.wallet      AS wallet,
              t.mc          AS mc,
              t.opponent_mc AS opponentMC,
              (SELECT COUNT(*) FROM tournament e WHERE e.week = t.week) AS entries,
              p.wei         AS wei,
              p.tx_hash     AS txHash,
              p.at          AS paidAt
         FROM tournament t
         LEFT JOIN tournament_paid p ON p.week = t.week
        WHERE t.week <> ?
          AND t.mc = (SELECT MAX(m.mc) FROM tournament m WHERE m.week = t.week)
          AND t.at = (SELECT MIN(m.at) FROM tournament m
                       WHERE m.week = t.week AND m.mc = t.mc)
        ORDER BY t.week DESC
        LIMIT ?`,
    )
    .bind(thisWeek, limit)
    .all<PastWeek>();
  return results;
}

/** Who won a closed week, by the same rule the board ranks by. */
export async function winnerOf(db: Database, week: string): Promise<Score | null> {
  const rows = await standings(db, week, 1);
  return rows[0] ?? null;
}

/**
 * Writes a payout. Throws on a week that already has one.
 *
 * The PRIMARY KEY does the work: a week paid twice is either a mistake or a
 * story, and both want a loud failure rather than a second row.
 */
export async function recordPayout(
  db: Database,
  paid: { week: string; wallet: string; wei: string; txHash: string; at: number },
): Promise<void> {
  await db
    .prepare(
      `INSERT INTO tournament_paid (week, wallet, wei, tx_hash, at) VALUES (?, ?, ?, ?, ?)`,
    )
    .bind(paid.week, paid.wallet, paid.wei, paid.txHash.toLowerCase(), paid.at)
    .run();
}
