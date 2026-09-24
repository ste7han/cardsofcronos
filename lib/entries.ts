// Who has paid to play a board, and whether they have one left.
//
// A payment is a fact about Cronos — contracts/BoardEntry.sol emits `Entered`
// and this reads it. Nothing here believes a browser about having paid, for the
// reason engine/deck.ts gives about a different rule: in the first version of
// this game the card check was a UI filter, so a direct call could play
// anything. A paywall that only greys out a button is not a paywall.
//
// ── ONE ENTRY IS ONE MATCH, AND THE SERVER DEALS IT ──────────────────────────
//
// It spent on submission for a day, on the reasoning that a disconnection
// should cost nothing. It does not hold, and the maker found it in an hour:
// paid once, played once, lost, and still had a go left. The browser decides
// when to submit and it only ever submits a win, so a loss never reaches the
// server and never spends anything.
//
// The bookkeeping was the smaller half. The browser also chose the shuffle, so
// one payment bought as many attempts as it took to find a seed that won — play
// locally, lose, roll again, submit the one that went well. A fee that buys a
// win rather than a go is not a fee.
//
// So the seed comes from here. An entry is spent at the deal and carries the
// shuffle it was dealt; a score is only taken against a seed that was dealt to
// that wallet and has not been scored yet.
//
// A disconnection still costs nothing: asking again hands back THE SAME seed
// rather than a new one, so the match is still there to finish and there is
// still only one of it.

import { addressIn, logsBetween, wordAt, type Log } from "@/lib/feed";
import { topicOf } from "@/lib/evm-tx";
import { cursorOf, setCursor, type Database } from "@/lib/store";
import { BOARDS } from "@/data/boards";

/**
 * The topic for contracts/BoardEntry.sol's `Entered`.
 *
 * Derived from the signature rather than written down. A hash typed by hand is
 * a scan that finds nothing, for ever, without an error anywhere — I wrote the
 * wrong one first and it was only caught by printing the real one beside it.
 * The signature is readable and wrong is loud; a hex string is neither.
 */
export const ENTERED = topicOf("Entered(address,uint256,uint256,uint256)");

/** The most blocks one eth_getLogs may span, the same as every other scan. */
const CHUNK = 2000;

export interface RanEntries {
  from: number | null;
  to: number | null;
  recorded: number;
  why?: string;
}

/**
 * Reads new `Entered` logs and writes them down.
 *
 * Idempotent on the log id, so a range read twice records each entry once. The
 * cursor moves only over blocks that were actually read — a range that could
 * not be fetched is a range to try again, not one to skip past, and skipping it
 * would be somebody's ten CRO that never became a go.
 */
export async function recordEntries(
  db: Database,
  logRpcs: readonly string[],
  head: number,
  now: number,
): Promise<RanEntries[]> {
  const ran: RanEntries[] = [];

  for (const board of BOARDS) {
    const gate = board.entry?.contract ?? null;
    if (gate === null) continue;

    const name = `entries:${board.id}`;
    const seen = await cursorOf(db, name);
    // Never run: start one block back. Everything before this was a board that
    // could not be paid for, so there is nothing behind us to find.
    const from = seen === null ? Math.max(0, head - 1) : seen + 1;
    if (from > head) {
      ran.push({ from, to: head, recorded: 0 });
      continue;
    }
    const to = Math.min(head, from + CHUNK - 1);

    let logs: Log[];
    try {
      logs = await logsBetween(logRpcs, gate, [ENTERED], from, to);
    } catch (error) {
      ran.push({
        from,
        to,
        recorded: 0,
        why: error instanceof Error ? error.message : "getLogs failed",
      });
      continue;
    }

    for (const log of logs) {
      // player is indexed; paid, toSplitter and bought are the three data words.
      const player = addressIn(log.topics[1] ?? "").toLowerCase();
      if (player === "" || player === "0x") continue;
      await db
        .prepare(
          `INSERT OR IGNORE INTO board_entries (id, player, board, paid, bought, at, used_at)
           VALUES (?, ?, ?, ?, ?, ?, NULL)`,
        )
        .bind(
          `${log.transactionHash}:${log.logIndex}`,
          player,
          board.id,
          wordAt(log.data, 0).toString(),
          wordAt(log.data, 2).toString(),
          now,
        )
        .run();
    }

    await setCursor(db, name, to, now);
    ran.push({ from, to, recorded: logs.length });
  }

  return ran;
}

/**
 * The match this wallet is owed on this board, dealing one if it has paid.
 *
 * Returns the seed, or null when there is nothing paid for. Asking twice gives
 * the same seed back — the deal is the spend, and a second deal would be a
 * second attempt off one payment.
 */
export async function dealEntry(
  db: Database,
  wallet: string,
  board: string,
  now: number,
): Promise<number | null> {
  // Already dealt and not yet scored: hand back what they have. This is the
  // reconnection, and it is also what stops a refresh costing a go.
  const open = await db
    .prepare(
      `SELECT seed FROM board_entries
        WHERE player = ? AND board = ? AND seed IS NOT NULL AND scored_at IS NULL
        ORDER BY used_at ASC LIMIT 1`,
    )
    .bind(wallet, board)
    .first<{ seed: number }>();
  if (open !== null) return open.seed;

  // The same range the browser used to pick from, and now the only place it is
  // picked. Not the match id or anything derived from it: this has to be
  // unguessable before it is dealt, or somebody plays the shuffle first and
  // pays for it afterwards.
  const seed = Math.floor(Math.random() * 2_147_483_647);

  const dealt = await db
    .prepare(
      `UPDATE board_entries SET used_at = ?, seed = ?
        WHERE id = (
          SELECT id FROM board_entries
           WHERE player = ? AND board = ? AND used_at IS NULL
           ORDER BY at ASC LIMIT 1
        )
          AND used_at IS NULL
      RETURNING seed`,
    )
    .bind(now, seed, wallet, board)
    .first<{ seed: number }>();

  return dealt === null ? null : dealt.seed;
}

/**
 * Takes the score for a dealt match, and says whether there was one to take.
 *
 * Conditional on `scored_at IS NULL`, so one deal is one score however many
 * times a browser submits it — and matched on the seed, so a score can only be
 * filed against the shuffle it was actually dealt.
 */
export async function scoreEntry(
  db: Database,
  wallet: string,
  board: string,
  seed: number,
  now: number,
): Promise<boolean> {
  const taken = await db
    .prepare(
      `UPDATE board_entries SET scored_at = ?
        WHERE player = ? AND board = ? AND seed = ? AND scored_at IS NULL
      RETURNING id`,
    )
    .bind(now, wallet, board, seed)
    .first<{ id: string }>();
  return taken !== null;
}

/** How many goes this wallet has paid for and not yet used on this board. */
export async function sparEntries(
  db: Database,
  wallet: string,
  board: string,
): Promise<number> {
  const row = await db
    .prepare(
      `SELECT count(*) AS n FROM board_entries
        WHERE player = ? AND board = ? AND used_at IS NULL`,
    )
    .bind(wallet, board)
    .first<{ n: number }>();
  return row?.n ?? 0;
}
