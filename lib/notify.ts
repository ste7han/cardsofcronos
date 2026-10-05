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
import { linkFor, noteDelivery, type Database } from "@/lib/store";
import { post } from "@/lib/discord";
import { sendMessage } from "@/lib/telegram-send";
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

/** Everywhere a player might be reachable. Absent means not configured. */
export interface Channels {
  telegramBotToken?: string;
  /** The friendly room, for a match with nothing on it. */
  pvpFriendly?: string;
  /** The ranked room, for a staked one. */
  pvpRanked?: string;
}

/**
 * A private message, when they have a Telegram account attached.
 *
 * Telegram will not let a bot open a conversation, so a linked account that has
 * never pressed Start is refused — recorded rather than thrown, so the profile
 * can offer the button that fixes it. See lib/telegram-send.ts.
 */
async function overTelegram(
  db: Database,
  wallet: string,
  text: string,
  token: string | undefined,
): Promise<void> {
  // Before anything is read or written: a Worker without the token is a fact
  // about the server, and writing it onto a player's row would tell them on
  // their own profile that they had done something wrong.
  if (!token) return;
  const link = await linkFor(db, wallet, "telegram");
  if (link === null) return;
  // Blocked is a decision they made. Asking again every turn is the thing
  // being blocked was meant to stop.
  if (link.dmProblem === "blocked") return;

  const delivery = await sendMessage(token, link.accountId, text);
  const problem = delivery.sent ? null : delivery.because;
  if (problem !== link.dmProblem) await noteDelivery(db, wallet, "telegram", problem);
}

/**
 * A tag in the room the match belongs to, when they have Discord attached.
 *
 * ── WHY A MENTION AND NOT A DM ───────────────────────────────────────────────
 *
 * A bot may only DM somebody who shares a server with it and has not switched
 * off messages from server members — which many people have, invisibly, so the
 * send is refused for reasons neither side can see. A mention needs no
 * permission and no Start: it reaches anybody who can read the channel, and it
 * is a real notification on a phone.
 *
 * What it costs is that it is in public. That is a decision taken knowingly
 * while there are a handful of players and one ranked match; it is the first
 * thing to revisit when there are more, and lib/discord.ts already narrows
 * allowed_mentions to the one id so this can never reach a role or @everyone.
 *
 * The room is chosen the same way lib/challenge.ts chooses it for an offer —
 * staked in the ranked room, friendly in the friendly one. Not the general
 * channel: that already carries every offer, and a tag per turn on top of it is
 * the version of this nobody would keep switched on.
 */
async function overDiscord(
  db: Database,
  wallet: string,
  record: MatchRecord,
  title: string,
  text: string,
  rooms: Channels,
): Promise<void> {
  const room = record.stake > 0 ? rooms.pvpRanked : rooms.pvpFriendly;
  if (!room) return;
  const link = await linkFor(db, wallet, "discord");
  if (link === null) return;

  await post(
    room,
    [
      {
        title,
        description: text,
        url: `${SITE}/pvp/${record.id}`,
        color: 0x9d4edd,
      },
    ],
    link.accountId,
  );
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
  channels: Channels,
): Promise<void> {
  try {
    if (!worthTelling(record, occasion)) return;

    const wallet = record.seats[toMove];
    // One key for the occasion and not one per channel: this guards "they have
    // been told about this turn", and a second pass that reached only the
    // channel the first one failed on is a duplicate in the other.
    if (await alreadySent(db, `dm:${record.id}:${record.moves.length}`)) return;

    const title =
      occasion === "match-started" ? "Your match has started" : `Turn ${turn} is yours`;

    // Settled rather than awaited in turn: one channel being down must not stop
    // the other from reaching them.
    await Promise.allSettled([
      overTelegram(db, wallet, words(record, occasion, turn), channels.telegramBotToken),
      overDiscord(db, wallet, record, title, words(record, occasion, turn), channels),
    ]);
  } catch {
    // A notification is not worth a move. See the header.
  }
}
