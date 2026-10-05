// The public feeds and the weekly result, mirrored into Telegram.
//
// Two different things are worth testing here and they fail differently. The
// renderer loses information quietly — a burn with its numbers in fields comes
// out as a headline and nothing else, which reads as a working feed saying
// nothing. And the weekly announcement is money: it must name the winner, it
// must not say it twice, and it must never be able to fail the job that pays
// them.

import { afterEach, describe, expect, it, vi } from "vitest";

import { asText, mirror } from "@/lib/telegram-feed";
import { announceWeek, boardEmbed } from "@/lib/weekly-news";
import type { Database, Statement } from "@/lib/store";
import type { Ran } from "@/lib/publisher";

const WINNER = "0x" + "a".repeat(40);
const TOKEN = "1:fake";
const CHAT = "-1001234567890";

afterEach(() => vi.unstubAllGlobals());

/** Captures everything that would have left the Worker. */
function catchSends(answer: unknown = { ok: true }) {
  const sent: { url: string; body: Record<string, unknown> }[] = [];
  vi.stubGlobal("fetch", async (url: string, init: { body: string }) => {
    sent.push({ url, body: JSON.parse(init.body) as Record<string, unknown> });
    return { ok: true, status: 204, json: async () => answer } as unknown as Response;
  });
  return sent;
}

/** Just enough database for the once-only guard. */
function fakeDb() {
  const said = new Set<string>();
  const statement = (sql: string, values: unknown[]): Statement => ({
    bind: (...next: unknown[]) => statement(sql, next),
    first: async <T>() => {
      if (!sql.includes("FROM feed_posted")) throw new Error(`unexpected read: ${sql}`);
      return (said.has(values[0] as string) ? { id: values[0] } : null) as T | null;
    },
    all: async <T>() => ({ results: [] as T[] }),
    run: async () => {
      if (!sql.includes("INSERT OR IGNORE INTO feed_posted")) throw new Error(`unexpected: ${sql}`);
      said.add(values[0] as string);
      return {};
    },
  });
  const db: Database = {
    prepare: (sql: string) => statement(sql, []),
    async batch(statements: readonly Statement[]) {
      const out: unknown[] = [];
      for (const one of statements) out.push(await one.run());
      return out;
    },
  };
  return { db, said };
}

describe("an embed as Telegram text", () => {
  it("keeps the field names, because a number alone is not a fact", () => {
    // The feeds put their figures in fields. Dropping them leaves a headline
    // and no information, which reads as a feed that is working and saying
    // nothing — the quietest way for this to be broken.
    const text = asText({
      title: "Burned",
      description: "Somebody took supply off the table.",
      fields: [
        { name: "Burned", value: "4,812 $CROCARD" },
        { name: "Supply now", value: "961,188" },
      ],
    });
    expect(text).toContain("Burned: 4,812 $CROCARD");
    expect(text).toContain("Supply now: 961,188");
  });

  it("makes the title the way in when there is somewhere to go", () => {
    // HTML and not Markdown: these lines come from Discord embeds written with
    // `**bold**`, which Telegram's legacy Markdown reads as one asterisk — so
    // every number arrived wearing its asterisks. HTML needs three characters
    // escaped and nothing else. See lib/telegram-send.ts.
    const text = asText({ title: "Burned", url: "https://example.com/tx" });
    expect(text).toBe('<a href="https://example.com/tx"><b>Burned</b></a>');
  });

  it("leaves a title alone when there is no link", () => {
    expect(asText({ title: "Burned" })).toBe("<b>Burned</b>");
  });
});

describe("mirroring", () => {
  it("does nothing at all when there is no channel configured", async () => {
    // Unset is a real state: the Discord feeds carry on either way.
    const sent = catchSends();
    await mirror(TOKEN, undefined, [{ title: "Burned" }]);
    expect(sent).toEqual([]);
  });

  it("does nothing when there is no bot", async () => {
    const sent = catchSends();
    await mirror(undefined, CHAT, [{ title: "Burned" }]);
    expect(sent).toEqual([]);
  });

  it("sends one message per thing that happened", async () => {
    // A run that caught up on three burns is three events. A wall with three
    // in it is read as one.
    const sent = catchSends();
    await mirror(TOKEN, CHAT, [{ title: "One" }, { title: "Two" }, { title: "Three" }]);
    expect(sent).toHaveLength(3);
    expect(sent[0]!.body.chat_id).toBe(CHAT);
  });

  it("says so when a message is refused, rather than only not sending it", async () => {
    // It threw the Delivery away without looking at it, so a refused line was
    // not merely unreported but unloggable: the only symptom was a channel that
    // stayed empty while Discord filled up. Caught by sending one test line and
    // realising nothing could have said whether it arrived.
    const said: unknown[] = [];
    const was = console.error;
    console.error = (...args: unknown[]) => void said.push(args);
    try {
      vi.stubGlobal("fetch", async () => ({
        ok: false,
        status: 403,
        json: async () => ({ ok: false, description: "Forbidden: bot is not a member" }),
      } as unknown as Response));
      await mirror(TOKEN, CHAT, [{ title: "Burned" }]);
    } finally {
      console.error = was;
    }
    expect(said).toHaveLength(1);
    expect(JSON.stringify(said)).toContain("Burned");
  });

  it("does not let one bad message take the batch with it", async () => {
    const seen: string[] = [];
    vi.stubGlobal("fetch", async (_url: string, init: { body: string }) => {
      const body = JSON.parse(init.body) as { text: string };
      seen.push(body.text);
      if (body.text.includes("Two")) throw new Error("that one failed");
      return { ok: true, status: 204, json: async () => ({ ok: true }) } as unknown as Response;
    });
    await mirror(TOKEN, CHAT, [{ title: "One" }, { title: "Two" }, { title: "Three" }]);
    expect(seen).toHaveLength(3);
  });
});

describe("what the week's result says", () => {
  it("names the winner and the prize", () => {
    const embed = boardEmbed({
      week: "2026-W40",
      boardId: "lions",
      boardName: "LOADED LIONS",
      winner: WINNER,
      amount: (1234n * 10n ** 18n).toString(),
      symbol: "$LION",
      paid: "0xdead",
    });
    expect(embed.title).toContain("LOADED LIONS");
    expect(embed.title).toContain("2026-W40");
    expect(String(embed.description)).toContain("0xaaaa");
    expect(String(embed.description)).toContain("1,234 $LION");
  });

  it("says a prize is waiting when it was not pushed", () => {
    // Allocated and unclaimed is a different thing from paid, and the winner is
    // the one person who needs to know which it is.
    const embed = boardEmbed({
      week: "2026-W40", boardId: "bot", boardName: "THE MARKET", winner: WINNER,
      amount: (5n * 10n ** 18n).toString(), symbol: "CRO", paid: null,
    });
    expect(String(embed.description)).toMatch(/waiting to be claimed/i);
  });

  it("still names a winner when the amount could not be read", () => {
    const embed = boardEmbed({
      week: "2026-W40", boardId: "bot", boardName: "THE MARKET", winner: WINNER,
      amount: null, symbol: "CRO", paid: "0xdead",
    });
    expect(String(embed.description)).toContain("took the week");
  });
});

describe("announcing the week", () => {
  const ran = (over: Partial<Ran> = {}): Ran => ({
    week: "2026-W40",
    boards: [{ board: "lions", winner: WINNER, paid: "0xdead", amount: (1n * 10n ** 18n).toString() }],
    ...over,
  });

  const rooms = {
    DISCORD_SOLO: "https://discord.example/solo",
    DISCORD_PVE_LIONS: "https://discord.example/lions",
  };

  it("posts in the room that board already uses all week", async () => {
    // data/boards.ts names it and /api/solo already posts there. Reading the
    // same field beats inventing a destination that can disagree with it.
    const sent = catchSends();
    const { db } = fakeDb();
    await announceWeek(db, ran(), { rooms });
    expect(sent.map((one) => one.url)).toEqual([rooms.DISCORD_PVE_LIONS]);
  });

  it("reaches Telegram as well, from the same embed", async () => {
    const sent = catchSends();
    const { db } = fakeDb();
    await announceWeek(db, ran(), { rooms, telegramBotToken: TOKEN, telegramChat: CHAT });
    expect(sent).toHaveLength(2);
    expect(sent.some((one) => one.url.includes("api.telegram.org"))).toBe(true);
  });

  it("says it once per board per week, however often the job runs", async () => {
    // The weekly job is asked every minute and declines unless it is due, but
    // that decision is upstream and this must not depend on it.
    const sent = catchSends();
    const { db } = fakeDb();
    await announceWeek(db, ran(), { rooms });
    await announceWeek(db, ran(), { rooms });
    expect(sent).toHaveLength(1);
  });

  it("says nothing about a board that was skipped", async () => {
    const sent = catchSends();
    const { db } = fakeDb();
    await announceWeek(
      db,
      ran({ boards: [{ board: "lions", winner: "", paid: null, amount: null, skipped: "no winner" }] }),
      { rooms },
    );
    expect(sent).toEqual([]);
  });

  it("says nothing when no board was won", async () => {
    const sent = catchSends();
    const { db } = fakeDb();
    await announceWeek(db, ran({ boards: [] }), { rooms });
    expect(sent).toEqual([]);
  });

  it("never fails the job that just moved the money", async () => {
    // This runs after the week is closed and the prizes are pushed. A thrown
    // announcement would be reported as a failed payout.
    const { db } = fakeDb();
    vi.stubGlobal("fetch", async () => {
      throw new Error("everything is down");
    });
    await expect(
      announceWeek(db, ran(), { rooms, telegramBotToken: TOKEN, telegramChat: CHAT }),
    ).resolves.toBeUndefined();
  });
});
