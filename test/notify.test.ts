// Telling somebody, off the site, that a match is waiting for them.
//
// Three things here are each one line of code and each one of them is the whole
// feature if it is wrong: which occasions are worth a message (too many and the
// notifications get switched off for good), how Telegram's refusals are read
// (get this wrong and a blocked player is pestered forever, or a player who has
// never pressed Start never sees the button that fixes it), and whether one
// turn can send twice.
//
// Run against fetch rather than against sendDM, like test/challenge.test.ts:
// stubbing the network checks what would actually arrive at Telegram instead of
// checking that a line of code is still written the way it was.

import { afterEach, describe, expect, it, vi } from "vitest";

import { tellItIsTheirTurn, worthTelling } from "@/lib/notify";
import { newRecord, type MatchRecord } from "@/engine/record";
import type { Database, Statement } from "@/lib/store";

const ALICE = "0x" + "a".repeat(40);
const BOB = "0x" + "b".repeat(40);
const T0 = 1_700_000_000_000;
const TOKEN = "123:fake";

const match = (mode: "live" | "correspondence", over: Partial<MatchRecord> = {}): MatchRecord => ({
  ...newRecord({
    id: "m1",
    mode,
    stake: 0,
    seats: { you: ALICE, opponent: BOB },
    seed: 4242,
    decks: { you: ["a"], opponent: ["b"] },
    now: T0,
  }),
  ...over,
});

/** Just enough database: one links row, and the once-only guard. */
function fakeDb(link: { accountId: string; dmProblem: string | null } | null) {
  const said = new Set<string>();
  const row = link === null
    ? null
    : {
        wallet: BOB, network: "telegram", account_id: link.accountId,
        handle: "bob", linked_at: T0, dm_problem: link.dmProblem,
      };
  const writes: (string | null)[] = [];

  const statement = (sql: string, values: unknown[]): Statement => ({
    bind: (...next: unknown[]) => statement(sql, next),
    first: async <T>() => {
      if (sql.includes("FROM feed_posted")) {
        return (said.has(values[0] as string) ? { id: values[0] } : null) as T | null;
      }
      if (sql.includes("FROM links")) return row as T | null;
      throw new Error(`unexpected read: ${sql}`);
    },
    all: async <T>() => ({ results: [] as T[] }),
    run: async () => {
      if (sql.includes("INSERT OR IGNORE INTO feed_posted")) {
        said.add(values[0] as string);
        return {};
      }
      if (sql.includes("UPDATE links SET dm_problem")) {
        writes.push(values[0] as string | null);
        if (row) row.dm_problem = values[0] as string | null;
        return {};
      }
      throw new Error(`unexpected write: ${sql}`);
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
  return { db, writes, said };
}

/** Captures what would have gone to Telegram, and answers how we tell it to. */
function catchSends(answer: { ok: boolean; description?: string } = { ok: true }) {
  const sent: { url: string; body: Record<string, unknown> }[] = [];
  vi.stubGlobal("fetch", async (url: string, init: { body: string }) => {
    sent.push({ url, body: JSON.parse(init.body) as Record<string, unknown> });
    return { json: async () => answer } as unknown as Response;
  });
  return sent;
}

afterEach(() => vi.unstubAllGlobals());

describe("what is worth a message", () => {
  it("tells somebody their correspondence turn came round", () => {
    // A day a turn is exactly long enough to forget you are in a match, which
    // is the whole reason turns were being lost to the clock.
    expect(worthTelling(match("correspondence"), "your-turn")).toBe(true);
  });

  it("says nothing about a live turn", () => {
    // Ten turns, two players: notifying every change is twenty pushes to
    // somebody sitting in front of the board. The nav badge already has this.
    expect(worthTelling(match("live"), "your-turn")).toBe(false);
  });

  it("tells somebody a match started, on either clock", () => {
    // The match begins when the SECOND player sits down, which can be an hour
    // after the first one offered the seat.
    expect(worthTelling(match("live"), "match-started")).toBe(true);
    expect(worthTelling(match("correspondence"), "match-started")).toBe(true);
  });
});

describe("delivering it", () => {
  it("sends to the chat id the link stores, and nowhere else", async () => {
    const sent = catchSends();
    const { db } = fakeDb({ accountId: "99887766", dmProblem: null });
    await tellItIsTheirTurn(db, match("correspondence"), "opponent", 3, "your-turn", TOKEN);

    expect(sent).toHaveLength(1);
    expect(sent[0]!.url).toContain("/sendMessage");
    expect(sent[0]!.body.chat_id).toBe("99887766");
  });

  it("names the match, so the message is a way in and not an announcement", async () => {
    const sent = catchSends();
    const { db } = fakeDb({ accountId: "1", dmProblem: null });
    await tellItIsTheirTurn(db, match("correspondence"), "opponent", 3, "your-turn", TOKEN);
    expect(String(sent[0]!.body.text)).toContain("/pvp/m1");
  });

  it("sends nothing when nothing is linked", async () => {
    const sent = catchSends();
    const { db } = fakeDb(null);
    await tellItIsTheirTurn(db, match("correspondence"), "opponent", 3, "your-turn", TOKEN);
    expect(sent).toEqual([]);
  });

  it("sends nothing, and writes nothing, when the bot is not configured", async () => {
    // A missing token is a fact about the Worker. Writing it onto a player's
    // row would tell them on their own profile that they had done something.
    const sent = catchSends();
    const { db, writes } = fakeDb({ accountId: "1", dmProblem: null });
    await tellItIsTheirTurn(db, match("correspondence"), "opponent", 3, "your-turn", undefined);
    expect(sent).toEqual([]);
    expect(writes).toEqual([]);
  });

  it("sends one message per turn however many times it is asked", async () => {
    // Two requests see the same turn change — the move that caused it and the
    // opponent's next poll.
    const sent = catchSends();
    const { db } = fakeDb({ accountId: "1", dmProblem: null });
    const record = match("correspondence");
    await tellItIsTheirTurn(db, record, "opponent", 3, "your-turn", TOKEN);
    await tellItIsTheirTurn(db, record, "opponent", 3, "your-turn", TOKEN);
    expect(sent).toHaveLength(1);
  });

  it("does not keep a working account's row being rewritten", async () => {
    const sent = catchSends();
    const { db, writes } = fakeDb({ accountId: "1", dmProblem: null });
    await tellItIsTheirTurn(db, match("correspondence"), "opponent", 3, "your-turn", TOKEN);
    expect(sent).toHaveLength(1);
    expect(writes).toEqual([]);
  });
});

describe("reading Telegram's refusals", () => {
  it("records a player who has never pressed Start, so the profile can say so", async () => {
    const { db, writes } = fakeDb({ accountId: "1", dmProblem: null });
    catchSends({ ok: false, description: "Forbidden: bot can't initiate conversation with a user" });
    await tellItIsTheirTurn(db, match("correspondence"), "opponent", 3, "your-turn", TOKEN);
    expect(writes).toEqual(["not-started"]);
  });

  it("reads a chat it cannot find as the same thing", async () => {
    // Two wordings for one fact: nobody has opened this chat.
    const { db, writes } = fakeDb({ accountId: "1", dmProblem: null });
    catchSends({ ok: false, description: "Bad Request: chat not found" });
    await tellItIsTheirTurn(db, match("correspondence"), "opponent", 3, "your-turn", TOKEN);
    expect(writes).toEqual(["not-started"]);
  });

  it("stops asking somebody who blocked the bot", async () => {
    // Being pestered every turn is the thing blocking was meant to stop.
    const sent = catchSends();
    const { db } = fakeDb({ accountId: "1", dmProblem: "blocked" });
    await tellItIsTheirTurn(db, match("correspondence"), "opponent", 3, "your-turn", TOKEN);
    expect(sent).toEqual([]);
  });

  it("clears the problem once a message lands, which is the only evidence there is", async () => {
    // Pressing Start sends us nothing. A successful send is the only way we
    // ever find out it worked.
    const { db, writes } = fakeDb({ accountId: "1", dmProblem: "not-started" });
    catchSends({ ok: true });
    await tellItIsTheirTurn(db, match("correspondence"), "opponent", 3, "your-turn", TOKEN);
    expect(writes).toEqual([null]);
  });

  it("does not turn an outage into a player's problem it cannot fix", async () => {
    // Telegram being down is not "press Start". It is recorded as itself.
    const { db, writes } = fakeDb({ accountId: "1", dmProblem: null });
    catchSends({ ok: false, description: "Internal Server Error" });
    await tellItIsTheirTurn(db, match("correspondence"), "opponent", 3, "your-turn", TOKEN);
    expect(writes).toEqual(["unreachable"]);
  });

  it("never lets a failed message break the move that caused it", async () => {
    // This runs on the path of /api/pvp/move. A move that has been applied is a
    // move that happened, and a 500 afterwards reads as "my move was refused".
    const { db } = fakeDb({ accountId: "1", dmProblem: null });
    vi.stubGlobal("fetch", async () => {
      throw new Error("the network is gone");
    });
    await expect(
      tellItIsTheirTurn(db, match("correspondence"), "opponent", 3, "your-turn", TOKEN),
    ).resolves.toBeUndefined();
  });
});
