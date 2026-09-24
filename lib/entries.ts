// Who has paid to play a board, and whether they have one left.
//
// A payment is a fact about Cronos — contracts/BoardEntry.sol emits `Entered`
// and this reads it. Nothing here believes a browser about having paid, for the
// reason engine/deck.ts gives about a different rule: in the first version of
// this game the card check was a UI filter, so a direct call could play
// anything. A paywall that only greys out a button is not a paywall.
//
// ── ONE ENTRY IS ONE MATCH ───────────────────────────────────────────────────
//
// Spent when a score is accepted, and not when a match starts. A disconnection
// then costs nothing, and the only way to spend one is to finish — which is the
// generous direction to be wrong in, and the one that cannot take somebody's
// money for a match the server never saw.

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

/**
 * Spends one, and says whether there was one to spend.
 *
 * The oldest first, which matters only for what the page shows afterwards, and
 * conditionally on `used_at IS NULL` — so two scores arriving at once cannot
 * both spend the same entry.
 */
export async function spendEntry(
  db: Database,
  wallet: string,
  board: string,
  now: number,
): Promise<boolean> {
  const spent = await db
    .prepare(
      `UPDATE board_entries SET used_at = ?
        WHERE id = (
          SELECT id FROM board_entries
           WHERE player = ? AND board = ? AND used_at IS NULL
           ORDER BY at ASC LIMIT 1
        )
          AND used_at IS NULL
      RETURNING id`,
    )
    .bind(now, wallet, board)
    .first<{ id: string }>();
  return spent !== null;
}
