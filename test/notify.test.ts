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

import { readFileSync } from "node:fs";

import { afterEach, describe, expect, it, vi } from "vitest";

import { tellItIsTheirTurn, worthTelling } from "@/lib/notify";
import { newRecord, type MatchRecord } from "@/engine/record";
import type { Database, Statement } from "@/lib/store";

const ALICE = "0x" + "a".repeat(40);
const BOB = "0x" + "b".repeat(40);
const T0 = 1_700_000_000_000;
const TOKEN = "123:fake";
/** Telegram only, which is what most of these are about. */
const TG = { telegramBotToken: TOKEN };

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

type Attach = { accountId: string; dmProblem: string | null } | null;

/** Just enough database: a links row per network, and the once-only guard. */
function fakeDb(telegram: Attach, discord: Attach = null) {
  const said = new Set<string>();
  const asRow = (network: string, link: Attach) =>
    link === null
      ? null
      : {
          wallet: BOB, network, account_id: link.accountId,
          handle: "bob", linked_at: T0, dm_problem: link.dmProblem,
        };
  const row = asRow("telegram", telegram);
  const rows: Record<string, ReturnType<typeof asRow>> = {
    telegram: row,
    discord: asRow("discord", discord),
  };
  const writes: (string | null)[] = [];

  const statement = (sql: string, values: unknown[]): Statement => ({
    bind: (...next: unknown[]) => statement(sql, next),
    first: async <T>() => {
      if (sql.includes("FROM feed_posted")) {
        return (said.has(values[0] as string) ? { id: values[0] } : null) as T | null;
      }
      // linkFor binds (wallet, network), so the second value says which.
      if (sql.includes("FROM links")) return rows[values[1] as string] as T | null;
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
    // `ok` for lib/discord, which reads the status; `json` for Telegram.
    return { ok: answer.ok, status: 204, json: async () => answer } as unknown as Response;
  });
  return sent;
}

const RANKED = "https://discord.example/ranked";
const FRIENDLY = "https://discord.example/friendly";
/** Discord only, so a test about the tag is not also a test about Telegram. */
const DC = { pvpRanked: RANKED, pvpFriendly: FRIENDLY };

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
    await tellItIsTheirTurn(db, match("correspondence"), "opponent", 3, "your-turn", TG);

    expect(sent).toHaveLength(1);
    expect(sent[0]!.url).toContain("/sendMessage");
    expect(sent[0]!.body.chat_id).toBe("99887766");
  });

  it("names the match, so the message is a way in and not an announcement", async () => {
    const sent = catchSends();
    const { db } = fakeDb({ accountId: "1", dmProblem: null });
    await tellItIsTheirTurn(db, match("correspondence"), "opponent", 3, "your-turn", TG);
    expect(String(sent[0]!.body.text)).toContain("/pvp/m1");
  });

  it("sends nothing when nothing is linked", async () => {
    const sent = catchSends();
    const { db } = fakeDb(null);
    await tellItIsTheirTurn(db, match("correspondence"), "opponent", 3, "your-turn", TG);
    expect(sent).toEqual([]);
  });

  it("sends nothing, and writes nothing, when the bot is not configured", async () => {
    // A missing token is a fact about the Worker. Writing it onto a player's
    // row would tell them on their own profile that they had done something.
    const sent = catchSends();
    const { db, writes } = fakeDb({ accountId: "1", dmProblem: null });
    await tellItIsTheirTurn(db, match("correspondence"), "opponent", 3, "your-turn", {});
    expect(sent).toEqual([]);
    expect(writes).toEqual([]);
  });

  it("sends one message per turn however many times it is asked", async () => {
    // Two requests see the same turn change — the move that caused it and the
    // opponent's next poll.
    const sent = catchSends();
    const { db } = fakeDb({ accountId: "1", dmProblem: null });
    const record = match("correspondence");
    await tellItIsTheirTurn(db, record, "opponent", 3, "your-turn", TG);
    await tellItIsTheirTurn(db, record, "opponent", 3, "your-turn", TG);
    expect(sent).toHaveLength(1);
  });

  it("does not keep a working account's row being rewritten", async () => {
    const sent = catchSends();
    const { db, writes } = fakeDb({ accountId: "1", dmProblem: null });
    await tellItIsTheirTurn(db, match("correspondence"), "opponent", 3, "your-turn", TG);
    expect(sent).toHaveLength(1);
    expect(writes).toEqual([]);
  });
});

describe("reading Telegram's refusals", () => {
  it("records a player who has never pressed Start, so the profile can say so", async () => {
    const { db, writes } = fakeDb({ accountId: "1", dmProblem: null });
    catchSends({ ok: false, description: "Forbidden: bot can't initiate conversation with a user" });
    await tellItIsTheirTurn(db, match("correspondence"), "opponent", 3, "your-turn", TG);
    expect(writes).toEqual(["not-started"]);
  });

  it("reads a chat it cannot find as the same thing", async () => {
    // Two wordings for one fact: nobody has opened this chat.
    const { db, writes } = fakeDb({ accountId: "1", dmProblem: null });
    catchSends({ ok: false, description: "Bad Request: chat not found" });
    await tellItIsTheirTurn(db, match("correspondence"), "opponent", 3, "your-turn", TG);
    expect(writes).toEqual(["not-started"]);
  });

  it("stops asking somebody who blocked the bot", async () => {
    // Being pestered every turn is the thing blocking was meant to stop.
    const sent = catchSends();
    const { db } = fakeDb({ accountId: "1", dmProblem: "blocked" });
    await tellItIsTheirTurn(db, match("correspondence"), "opponent", 3, "your-turn", TG);
    expect(sent).toEqual([]);
  });

  it("clears the problem once a message lands, which is the only evidence there is", async () => {
    // Pressing Start sends us nothing. A successful send is the only way we
    // ever find out it worked.
    const { db, writes } = fakeDb({ accountId: "1", dmProblem: "not-started" });
    catchSends({ ok: true });
    await tellItIsTheirTurn(db, match("correspondence"), "opponent", 3, "your-turn", TG);
    expect(writes).toEqual([null]);
  });

  it("does not turn an outage into a player's problem it cannot fix", async () => {
    // Telegram being down is not "press Start". It is recorded as itself.
    const { db, writes } = fakeDb({ accountId: "1", dmProblem: null });
    catchSends({ ok: false, description: "Internal Server Error" });
    await tellItIsTheirTurn(db, match("correspondence"), "opponent", 3, "your-turn", TG);
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
      tellItIsTheirTurn(db, match("correspondence"), "opponent", 3, "your-turn", TG),
    ).resolves.toBeUndefined();
  });
});

// ── THE ONE PRESS NOBODY COULD VERIFY ────────────────────────────────────────
//
// Telegram lets a bot send and not open, so a linked account needs a Start
// before it is reachable. Pressing Start sends the site nothing — there is no
// webhook — so the instruction had no outcome: the bot answered nothing, the
// profile said nothing, and the maker reasonably read that as broken. These
// guard the route that exists to produce the one piece of evidence there is.
describe("checking the bot can reach you", () => {
  const route = readFileSync(
    new URL("../app/api/link/telegram/test/route.ts", import.meta.url),
    "utf8",
  );

  it("can only ever send to the wallet that asked", () => {
    // Not aimable: no id, handle or wallet comes off the request body. A button
    // that could be pointed at somebody else is a way to message strangers.
    expect(route).toContain('linkFor(db(), wallet, "telegram")');
    expect(route).toContain("signedInWallet(request)");
    expect(route).not.toMatch(/body\s*\.\s*(wallet|accountId|chatId)/);
  });

  it("records the outcome the same way a real notification does", () => {
    // Otherwise the warning on the profile would survive a message that landed,
    // and the button would prove nothing.
    expect(route).toContain("noteDelivery");
  });

  it("turns each refusal into something the reader can act on", () => {
    // Telegram's own description is written for whoever runs the bot. All four
    // cases have to be answered, or one of them renders as undefined.
    for (const because of ["unconfigured", "not-started", "blocked", "unreachable"]) {
      expect(route, because).toContain(because);
    }
  });

  it("does not pass Telegram's own wording through to the player", () => {
    expect(route).not.toContain("delivery.detail");
  });
});

describe("the profile says what the silence means", () => {
  const profile = readFileSync(new URL("../components/Profile.tsx", import.meta.url), "utf8");

  it("warns that the bot does not answer, which is what reads as failure", () => {
    expect(profile).toContain("will not reply");
  });

  it("offers a way to find out rather than only an instruction", () => {
    expect(profile).toContain("/api/link/telegram/test");
    expect(profile).toContain("SEND ME A TEST");
  });

  it("refreshes the row after a message lands, so the warning clears itself", () => {
    expect(profile).toContain("onChanged={load}");
  });
});

// ── THE CASE THE NOTIFICATIONS WERE BUILT FOR AND MISSED ─────────────────────
//
// A turn comes back to you one of two ways: the opponent moves, or the opponent
// lets the day lapse. /api/pvp/move covered the first. For a slow match the
// second is the more likely — somebody forgets — and it reached nobody, because
// catchUp only ran when a player opened the match.
describe("the clock that runs without anybody looking", () => {
  const route = readFileSync(
    new URL("../app/api/cron/clocks/route.ts", import.meta.url),
    "utf8",
  );

  it("uses the same clock a player's request uses", () => {
    // A second implementation of the clock is two sets of rules that drift, and
    // the one nobody watches is the one that drifts.
    expect(route).toContain("catchUp(record, now, CARDS, INDEX)");
    expect(route).toContain("saveMoves(");
  });

  it("settles a match the clock finished, rather than leaving it open", () => {
    // Ten turns can lapse in a row. The last one ends the match, and a staked
    // match that nobody settles is a pot nobody can collect.
    expect(route).toContain("settle(");
  });

  it("tells whoever it is now the turn of", () => {
    expect(route).toContain("tellItIsTheirTurn(");
    expect(route).toContain("state.toMove");
  });

  it("does not advance a match it did not have to touch", () => {
    // Otherwise every tick rewrites every overdue row and the once-only guard
    // in lib/notify is the only thing standing between that and a message a
    // minute.
    expect(route).toContain("caught.moves.length === record.moves.length");
  });
});

describe("the button that links an account", () => {
  const widget = readFileSync(
    new URL("../components/TelegramLink.tsx", import.meta.url),
    "utf8",
  );

  it("is in the same language as the page around it", () => {
    // Telegram's widget is an iframe and localises itself to the viewer unless
    // told not to, so this button spoke Dutch on a page that is English
    // everywhere else — and German to a German visitor.
    expect(widget).toContain('setAttribute("data-lang", "en")');
  });
});

// ── THE TAG IN DISCORD ───────────────────────────────────────────────────────
//
// Chosen over a bot DM knowingly: a bot may only message somebody who shares a
// server with it and has not switched off messages from server members, which
// many people have and nobody can see. A mention needs no permission and no
// Start. What it costs is that it is in public, which was accepted while there
// are a handful of players and one ranked match — and is the first thing to
// revisit when there are more.
describe("tagging somebody in Discord", () => {
  const turn = (db: ReturnType<typeof fakeDb>["db"], over = {}) =>
    tellItIsTheirTurn(db, match("correspondence", over), "opponent", 3, "your-turn", DC);

  it("puts the mention in content, because an embed notifies nobody", () => {
    // This is the whole mechanism. A mention inside an embed renders as a name
    // and pings no one, which would be a feature that looks finished and does
    // nothing — the exact failure CLAUDE.md is about.
    const sent = catchSends();
    const { db } = fakeDb(null, { accountId: "4242", dmProblem: null });
    return turn(db).then(() => {
      expect(sent).toHaveLength(1);
      expect(sent[0]!.body.content).toBe("<@4242>");
    });
  });

  it("can only ever ping that one account", async () => {
    // parse: [] means no text in any embed can reach @everyone or a role. A
    // webhook that could is one mistake away from pinging a whole server.
    const sent = catchSends();
    const { db } = fakeDb(null, { accountId: "4242", dmProblem: null });
    await turn(db);
    expect(sent[0]!.body.allowed_mentions).toEqual({ parse: [], users: ["4242"] });
  });

  it("uses the room the match belongs to", async () => {
    // The same rule lib/challenge.ts uses for an offer, rather than a second
    // one that can disagree with it.
    const sent = catchSends();
    const { db } = fakeDb(null, { accountId: "1", dmProblem: null });
    await turn(db, { stake: 50 });
    expect(sent[0]!.url).toBe(RANKED);

    const quiet = catchSends();
    const { db: db2 } = fakeDb(null, { accountId: "1", dmProblem: null });
    await turn(db2);
    expect(quiet[0]!.url).toBe(FRIENDLY);
  });

  it("stays out of the general channel", async () => {
    // General already carries every offer. A tag per turn on top of that is the
    // version of this nobody would leave switched on.
    const sent = catchSends();
    const { db } = fakeDb(null, { accountId: "1", dmProblem: null });
    await tellItIsTheirTurn(db, match("correspondence"), "opponent", 3, "your-turn", {
      ...DC,
      // Deliberately offered and deliberately unused.
      ...({ pvpGeneral: "https://discord.example/general" } as object),
    });
    expect(sent.map((one) => one.url)).toEqual([FRIENDLY]);
  });

  it("says nothing when no Discord account is attached", async () => {
    const sent = catchSends();
    const { db } = fakeDb(null, null);
    await turn(db);
    expect(sent).toEqual([]);
  });

  it("obeys the same policy as everything else", async () => {
    // One worthTelling for every channel. A live match is not worth twenty tags
    // any more than it is worth twenty private messages.
    const sent = catchSends();
    const { db } = fakeDb(null, { accountId: "1", dmProblem: null });
    await tellItIsTheirTurn(db, match("live"), "opponent", 3, "your-turn", DC);
    expect(sent).toEqual([]);
  });

  it("reaches both channels when both are attached", async () => {
    const sent = catchSends();
    const { db } = fakeDb({ accountId: "tg", dmProblem: null }, { accountId: "dc", dmProblem: null });
    await tellItIsTheirTurn(db, match("correspondence"), "opponent", 3, "your-turn", {
      ...DC,
      telegramBotToken: TOKEN,
    });
    expect(sent).toHaveLength(2);
    expect(sent.some((one) => one.url.includes("telegram"))).toBe(true);
    expect(sent.some((one) => one.url === FRIENDLY)).toBe(true);
  });

  it("still sends one of them when the other is down", async () => {
    // Promise.allSettled and not a chain: one channel refusing must not keep
    // the other from reaching them.
    const sent: string[] = [];
    vi.stubGlobal("fetch", async (url: string) => {
      sent.push(url);
      if (url === FRIENDLY) throw new Error("that webhook is gone");
      return { ok: true, status: 204, json: async () => ({ ok: true }) } as unknown as Response;
    });
    const { db } = fakeDb({ accountId: "tg", dmProblem: null }, { accountId: "dc", dmProblem: null });
    await tellItIsTheirTurn(db, match("correspondence"), "opponent", 3, "your-turn", {
      ...DC,
      telegramBotToken: TOKEN,
    });
    expect(sent.some((url) => url.includes("telegram"))).toBe(true);
  });
});
