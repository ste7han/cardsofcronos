// Saying who won the week.
//
// ── IT WAS SAID NOWHERE ──────────────────────────────────────────────────────
//
// The weekly job closed the week, read each board's winner and pushed the prize
// — and told nobody. The result was on /tournament for anybody who went looking,
// which is the same as saying that whoever won found out by checking. A prize
// nobody hears about is a prize that persuades nobody to play for the next one.
//
// ── THE SAME ROOM THE BOARD ALREADY POSTS IN ─────────────────────────────────
//
// Every board names its own Discord channel in data/boards.ts, and
// /api/solo/route.ts already posts results there. This reads the same field
// rather than inventing a destination: the week's winner belongs in the room
// that carries that board's results all week.
//
// Telegram gets the same message, rendered by lib/telegram-feed.ts, for the
// reason that file gives — one message built once.

import { BOARDS } from "@/data/boards";
import { post, type Embed } from "@/lib/discord";
import { mirror } from "@/lib/telegram-feed";
import { toTokens } from "@/lib/units";
import type { Ran } from "@/lib/publisher";
import type { Database } from "@/lib/store";

const SITE = "https://cardsofcronos.com";

/** A wallet, short enough to read in a sentence. */
const short = (wallet: string) => `${wallet.slice(0, 6)}…${wallet.slice(-4)}`;

/**
 * Once per board per week.
 *
 * The weekly job is asked every minute and declines unless it is due, but
 * "declines" is a decision made upstream and this must not depend on it. Keyed
 * by week and board, in the same table lib/challenge.ts guards offers with.
 */
async function alreadySaid(db: Database, key: string): Promise<boolean> {
  const id = `weekly:${key}`;
  const found = await db
    .prepare(`SELECT id FROM feed_posted WHERE id = ?`)
    .bind(id)
    .first<{ id: string }>();
  if (found !== null) return true;
  await db.prepare(`INSERT OR IGNORE INTO feed_posted (id, at) VALUES (?, ?)`).bind(id, Date.now()).run();
  return false;
}

/** What one board's result says. Exported because it is the part worth testing. */
export function boardEmbed(args: {
  week: string;
  boardId: string;
  boardName: string;
  winner: string;
  /** Base units of the board's own prize token, or null when nothing was read. */
  amount: string | null;
  symbol: string;
  paid: string | null;
}): Embed {
  const prize =
    args.amount === null
      ? null
      : `${Math.round(toTokens(args.amount)).toLocaleString("en-US")} ${args.symbol}`;

  return {
    title: `${args.boardName} — ${args.week}`,
    // The winner first, because that is the fact. The prize second, because a
    // prize with no name attached is an announcement about a contract.
    description:
      `**${short(args.winner)}** took the week` +
      (prize === null ? "." : ` and ${prize}.`) +
      (args.paid === null
        ? "\n\nThe prize is allocated and waiting to be claimed."
        : ""),
    url: `${SITE}/tournament`,
    color: 0xffd700,
    footer: { text: "A new week is already running. Highest market cap takes it." },
  };
}

/**
 * Tell both channels who won, for every board that somebody won.
 *
 * Never throws. This runs at the end of the job that moves the money, and a
 * failed announcement must not be reported as a failed payout — the week is
 * closed and the prize is pushed by the time this is reached.
 */
export async function announceWeek(
  db: Database,
  ran: Ran,
  secrets: {
    /** The Discord webhook per board channel name, as the env provides them. */
    rooms: Partial<Record<string, string>>;
    fallbackRoom?: string;
    telegramBotToken?: string;
    telegramChat?: string;
  },
): Promise<void> {
  try {
    for (const result of ran.boards) {
      // A board that was skipped has no winner to name.
      if (result.skipped !== undefined) continue;

      const board = BOARDS.find((one) => one.id === result.board);
      if (board === undefined) continue;

      if (await alreadySaid(db, `${ran.week}:${result.board}`)) continue;

      const embed = boardEmbed({
        week: ran.week,
        boardId: board.id,
        boardName: board.name,
        winner: result.winner,
        amount: result.amount,
        // The board's own token when it pays one, and CRO when it does not.
        symbol: board.alsoPays?.symbol ?? "CRO",
        paid: result.paid,
      });

      const room = secrets.rooms[board.channel] ?? secrets.fallbackRoom;
      // Settled, not awaited in turn: one channel being down must not keep the
      // other from hearing it.
      await Promise.allSettled([
        room ? post(room, [embed]) : Promise.resolve(),
        mirror(secrets.telegramBotToken, secrets.telegramChat, [embed]),
      ]);
    }
  } catch {
    // See the note above. The money has already moved.
  }
}
