// Telling somebody a match is waiting for them, away from the site.
//
// ── WHAT IS WORTH A PUSH AND WHAT IS NOISE ───────────────────────────────────
//
// Ten turns, two players: notifying every turn change is twenty messages per
// match. On a live match that is twenty pushes to somebody who is sitting in
// front of the board — the nav badge already tells them, and a phone buzzing
// through a five-minute turn is a reason to turn notifications off for good.
//
// So the policy is narrow, and it is here rather than spread over the routes
// that call it:
//
//   · a correspondence turn changing hands — a day per turn is exactly long
//     enough to forget you are in a match, which is the whole reason turns were
//     being lost to the clock.
//   · a match starting, either mode — the match begins when the SECOND player
//     sits down, which can be an hour after the first one offered the seat. The
//     opening grace in engine/record.ts stops them losing turns for being away;
//     this is what tells them to come back and use it.
//
// Not: every live turn, not a finished match (the result is on the site and
// nobody is waiting on it), not an offer being taken — Discord already carries
// that to a channel.
//
// ── IT MUST NEVER BREAK A MOVE ───────────────────────────────────────────────
//
// This runs on the path of /api/pvp/move. A move that has been applied to the
// record is a move that happened, and a failed notification afterwards must not
// turn it into a 500 the player reads as "my move was refused". So nothing in
// here throws: every outcome is recorded and swallowed.

import { clockLabel, type MatchRecord } from "@/engine/record";
import { noteDelivery, telegramFor, type Database } from "@/lib/store";
import { sendDM } from "@/lib/telegram-dm";
import type { Player } from "@/engine/types";

const SITE = "https://cardsofcronos.com";

export type Occasion = "your-turn" | "match-started";

/** Whether this occasion is worth reaching somebody off-site for. */
export function worthTelling(record: MatchRecord, occasion: Occasion): boolean {
  if (occasion === "match-started") return true;
  // A live turn reaches somebody who is already looking at it.
  return record.mode === "correspondence";
}

function words(record: MatchRecord, occasion: Occasion, turn: number): string {
  const where = `${SITE}/pvp/${record.id}`;
  const clock = clockLabel(record.mode);
  const stake = record.stake > 0 ? ` ${record.stake * 2} CRO is in the pot.` : "";

  if (occasion === "match-started") {
    return (
      `*Your match has started.* Somebody took your seat` +
      `${record.stake > 0 ? ` and their stake is in` : ""}.${stake}\n\n` +
      `You are to move — ${clock}.\n\n[Open the table](${where})`
    );
  }
  return (
    `*Your turn.* Turn ${turn} of your match is yours to play.${stake}\n\n` +
    `${clock}.\n\n[Open the table](${where})`
  );
}

/**
 * Once and only once per occasion.
 *
 * Keyed by the move count, so the two requests that can both see a turn change
 * — the move that caused it and the opponent's next poll — cannot both send.
 * Reuses feed_posted, which is what lib/challenge.ts guards offer posts with.
 */
async function alreadySent(db: Database, key: string): Promise<boolean> {
  const found = await db
    .prepare(`SELECT id FROM feed_posted WHERE id = ?`)
    .bind(key)
    .first<{ id: string }>();
  if (found !== null) return true;
  await db
    .prepare(`INSERT OR IGNORE INTO feed_posted (id, at) VALUES (?, ?)`)
    .bind(key, Date.now())
    .run();
  return false;
}

/**
 * Tell the player who is now to move, if there is anywhere to tell them.
 *
 * Silent and harmless when they have linked nothing, when the bot is not
 * configured, or when they have never pressed Start — all three are ordinary
 * states rather than faults. The last one is recorded so their profile can
 * offer the button that fixes it.
 */
export async function tellItIsTheirTurn(
  db: Database,
  record: MatchRecord,
  toMove: Player,
  turn: number,
  occasion: Occasion,
  botToken: string | undefined,
): Promise<void> {
  try {
    if (!worthTelling(record, occasion)) return;
    // Before anything is read or written. A Worker without the token is a fact
    // about the server, and writing it onto a player's row would tell them on
    // their own profile that they had done something wrong.
    if (!botToken) return;

    const wallet = record.seats[toMove];
    const link = await telegramFor(db, wallet);
    if (link === null) return;
    // Blocked is a decision they made. Asking again every turn is the thing
    // being blocked was meant to stop.
    if (link.dmProblem === "blocked") return;

    if (await alreadySent(db, `dm:${record.id}:${record.moves.length}`)) return;

    const delivery = await sendDM(botToken, link.accountId, words(record, occasion, turn));
    // Only ever touched when the answer changed, so an ordinary turn on a
    // working account writes nothing.
    const problem = delivery.sent ? null : delivery.because;
    if (problem !== link.dmProblem) await noteDelivery(db, wallet, "telegram", problem);
  } catch {
    // A notification is not worth a move. See the header.
  }
}
