// The buy bot, which is the buys feed with a floor under it.
//
// There is no buy bot for Cronos on Telegram, so this one is becoming the
// project's. Two things decide whether it is worth having and neither of them
// is visible from the outside: the floor has to be in dollars, because a CRO
// floor halves in real terms every time CRO doubles and nobody notices until
// the channel is full of dust; and a missing price must not quietly mean "post
// nothing", because a buy bot that goes silent looks exactly like a buy bot
// that is broken.
//
// Discord is deliberately not filtered. Its buys channel has shown every buy
// since it was built and people read it that way.

import { readFileSync } from "node:fs";

import { afterEach, describe, expect, it, vi } from "vitest";

import {
  TELEGRAM_BUY_FLOOR_USD,
  TOO_MANY,
  bigEnoughToTell,
  sayBuysForTelegram,
  type Log,
} from "@/lib/feed";
import { asText } from "@/lib/telegram-feed";
import { REFRESH_AFTER, WCRO, croUsd, storedCroUsd } from "@/lib/cro-price";
import { selector } from "@/lib/evm-tx";
import type { Database, Statement } from "@/lib/store";

const T0 = 1_700_000_000_000;

/** A Swap with CRO in at word 0 and tokens out at word 3. */
function buyGot(cro: number, got: number): Log {
  const w = (n: bigint) => n.toString(16).padStart(64, "0");
  return {
    ...buyOf(cro),
    data: "0x" + w(BigInt(Math.round(cro * 1e18))) + w(0n) + w(0n) + w(BigInt(Math.round(got * 1e18))),
  };
}

/** A Swap log whose first word is the CRO that went in. */
function buyOf(cro: number): Log {
  const wei = BigInt(Math.round(cro * 1e18));
  return {
    address: "0x" + "1".repeat(40),
    topics: [],
    // Four words: the Swap shape sayBuys reads. Only the first matters here.
    data: "0x" + wei.toString(16).padStart(64, "0") + "0".repeat(64 * 3),
    blockNumber: "0x1",
    transactionHash: "0x" + "a".repeat(64),
    logIndex: "0x0",
  };
}

/** Just enough database for one price row. */
function fakeDb(start: { microUsd: number; at: number } | null) {
  let row = start === null ? null : { micro_usd: start.microUsd, at: start.at };
  const writes: { microUsd: number; at: number }[] = [];

  const statement = (sql: string, values: unknown[]): Statement => ({
    bind: (...next: unknown[]) => statement(sql, next),
    first: async <T>() => {
      if (!sql.includes("FROM prices")) throw new Error(`unexpected read: ${sql}`);
      return row as T | null;
    },
    all: async <T>() => ({ results: [] as T[] }),
    run: async () => {
      if (!sql.includes("INSERT INTO prices")) throw new Error(`unexpected write: ${sql}`);
      const [microUsd, at] = values as [number, number];
      writes.push({ microUsd, at });
      row = { micro_usd: microUsd, at };
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
  return { db, writes };
}

/**
 * Answers the pair's two eth_calls, or refuses.
 *
 * Stubbing fetch rather than the rpc helper: these go out as JSON-RPC over the
 * same fetch everything else uses, so this checks what would actually be asked.
 */
function catchPrice(answer: {
  ok: boolean;
  /** Reserves as [token0, token1]. */
  reserves?: [bigint, bigint];
  /** Which address token0() reports. Defaults to WCRO. */
  token0?: string;
}) {
  const asked: string[] = [];
  vi.stubGlobal("fetch", async (_url: string, init: { body: string }) => {
    if (!answer.ok) throw new Error("the chain is gone");
    const call = JSON.parse(init.body) as { params: [{ data: string }] };
    const data = call.params[0].data;
    asked.push(data.slice(0, 10));
    const [r0, r1] = answer.reserves ?? [0n, 0n];
    // getReserves is three words; only the first two are read.
    const result = data.startsWith(selector("getReserves()"))
      ? "0x" + r0.toString(16).padStart(64, "0") + r1.toString(16).padStart(64, "0") + "0".repeat(64)
      : "0x" + (answer.token0 ?? WCRO).replace(/^0x/, "").padStart(64, "0");
    return { ok: true, json: async () => ({ jsonrpc: "2.0", id: 1, result }) } as unknown as Response;
  });
  return asked;
}

/** 46M WCRO against 3.19M USDC, which is 0.069 dollars a CRO. */
const REAL: [bigint, bigint] = [46_000_000n * 10n ** 18n, 3_174_000n * 10n ** 6n];

afterEach(() => vi.unstubAllGlobals());

describe("the floor", () => {
  const CRO = 0.1; // ten cents, so fifty CRO is five dollars.

  it("is set in dollars", () => {
    expect(TELEGRAM_BUY_FLOOR_USD).toBe(5);
  });

  it("lets a buy at the floor through", () => {
    // At, not above: a buy of exactly five dollars is a five dollar buy.
    expect(bigEnoughToTell(buyOf(50), CRO)).toBe(true);
  });

  it("holds back a buy under it", () => {
    expect(bigEnoughToTell(buyOf(49), CRO)).toBe(false);
    expect(bigEnoughToTell(buyOf(0.2), CRO)).toBe(false);
  });

  it("moves with the price, which is why it is in dollars", () => {
    // The same 60 CRO buy is six dollars at ten cents and sixty at a dollar —
    // and three dollars if CRO halves, which a CRO-denominated floor would
    // have gone on calling big enough for ever.
    expect(bigEnoughToTell(buyOf(60), 0.1)).toBe(true);
    expect(bigEnoughToTell(buyOf(60), 0.05)).toBe(false);
  });

  it("shows everything when there has never been a price", () => {
    // One window on one deployment. A silent buy bot reads as a broken one, and
    // lib/cro-price.ts has already said so in the log.
    expect(bigEnoughToTell(buyOf(0.01), null)).toBe(true);
  });
});

describe("what a CRO is worth", () => {
  it("uses the kept price while it is fresh, and asks nobody", async () => {
    const asked = catchPrice({ ok: true, reserves: REAL });
    const { db } = fakeDb({ microUsd: 90_000, at: T0 });
    const priced = await croUsd(db, T0 + REFRESH_AFTER - 1);
    expect(priced?.usd).toBe(0.09);
    expect(priced?.from).toBe("stored");
    expect(asked).toEqual([]);
  });

  it("reads the pair once the kept one is stale, and keeps the answer", async () => {
    const asked = catchPrice({ ok: true, reserves: REAL });
    const { db, writes } = fakeDb({ microUsd: 90_000, at: T0 });
    const priced = await croUsd(db, T0 + REFRESH_AFTER + 1);
    expect(priced?.from).toBe("chain");
    expect(priced?.usd).toBeCloseTo(0.069, 3);
    // Both calls: the reserves, and which side of the pair is CRO.
    expect(asked).toHaveLength(2);
    expect(writes).toHaveLength(1);
    expect(writes[0]!.microUsd).toBeCloseTo(69_000, -3);
  });

  it("does not care which side of the pair CRO is on", async () => {
    // token0() is read rather than assumed, and that is the difference between
    // a price and its reciprocal: the wrong way round turns 0.069 into 14.5,
    // which would let every dust buy through while looking like a number.
    catchPrice({ ok: true, reserves: [REAL[1], REAL[0]], token0: "0x" + "9".repeat(40) });
    const { db } = fakeDb(null);
    const priced = await croUsd(db, T0);
    expect(priced?.usd).toBeCloseTo(0.069, 3);
  });

  it("falls back to the kept price when the chain cannot be reached", async () => {
    // A floor against an hour-old CRO price answers "was that five dollars"
    // just as well. Having no floor at all does not.
    catchPrice({ ok: false });
    const { db } = fakeDb({ microUsd: 90_000, at: T0 });
    const priced = await croUsd(db, T0 + REFRESH_AFTER + 1);
    expect(priced?.usd).toBe(0.09);
    expect(priced?.from).toBe("stored");
  });

  it("returns null when there is nothing kept and nothing answering", async () => {
    catchPrice({ ok: false });
    const { db } = fakeDb(null);
    expect(await croUsd(db, T0)).toBeNull();
  });

  it("refuses a pair that holds nothing, rather than storing a zero", async () => {
    // Zero is not a price. Stored, it would be the floor applied against
    // nothing — every buy through, or none, depending on which way the
    // comparison fell.
    catchPrice({ ok: true, reserves: [0n, 0n] });
    const { db, writes } = fakeDb(null);
    expect(await croUsd(db, T0)).toBeNull();
    expect(writes).toEqual([]);
  });

  it("reads back whatever is kept, however old", async () => {
    const { db } = fakeDb({ microUsd: 85_000, at: T0 });
    expect(await storedCroUsd(db)).toEqual({ usd: 0.085, from: "stored", at: T0 });
  });
});

describe("which feeds the floor applies to", () => {
  const feed = readFileSync(new URL("../lib/feed.ts", import.meta.url), "utf8");

  it("puts it on buys and on nothing else", () => {
    // Burns are mirrored without one: supply going down is news at any size,
    // and there are four a day. Buys are the feed that needs a threshold.
    const buys = feed.slice(feed.indexOf('feed: "buys"'), feed.indexOf('feed: "burns"'));
    expect(buys).toContain("only: (log) => bigEnoughToTell(log, croPrice)");
    const burns = feed.slice(feed.indexOf('feed: "burns"'));
    expect(burns).not.toContain("only:");
  });

  it("leaves Discord showing every buy", () => {
    // The filter is on the logs handed to the mirror, never on the webhook
    // post. Its buys channel has shown every buy since it was built and people
    // read it that way; raising a floor under it quietly is a change nobody
    // asked for.
    const runOne = feed.slice(feed.indexOf("async function runOne"), feed.indexOf("async function runFeeds"));
    const post = runOne.indexOf("await post(webhook, embeds)");
    const filter = runOne.indexOf("fresh.filter(toTelegram.only)");
    expect(post).toBeGreaterThan(-1);
    expect(filter).toBeGreaterThan(post);
  });

  it("reads the price once for the run and not once per buy", () => {
    // Per buy would be a public API called as many times as there were swaps in
    // a minute, which is how a free endpoint starts refusing.
    expect(feed).toContain("const priced = await croUsd(db, now, secrets.rpc);");
    expect(feed.split("await croUsd(").length - 1).toBe(1);
  });
});

describe("a deploy that lands before its migration", () => {
  it("does not take the whole feed run down with it", async () => {
    // storedCroUsd is reached from the feed cron, which carries the burns and
    // the mints. A missing table has to read as "no price", not as a thrown run.
    const angry: Database = {
      prepare: () => {
        throw new Error("D1_ERROR: no such table: prices");
      },
      batch: async () => [],
    };
    const was = console.error;
    console.error = () => {};
    try {
      expect(await storedCroUsd(angry)).toBeNull();
    } finally {
      console.error = was;
    }
  });
});

// ── HOW IT READS ─────────────────────────────────────────────────────────────
//
// The first version put the Discord embed through asText and the maker's answer
// was that it was not much to look at. Right twice over: the bold was Discord's
// `**` and arrived as asterisks on the screen, and even fixed, an embed is a
// shape that is read while a buy bot is a shape that is scanned.
describe("what a buy looks like in Telegram", () => {
  const line = async (cro: number, got: number, price: number | null = 0.0688) => {
    const [one] = await sayBuysForTelegram([buyGot(cro, got)], [], price);
    return one!.html;
  };

  it("says what it cost in dollars, which the Discord embed cannot", () => {
    // Discord has shown buys in CRO since it was built and this project prices
    // nothing in dollars. But "500 CRO" is a number only somebody who follows
    // CRO can weigh, and a buy bot is read by people deciding whether to look.
    return line(500, 1_240_000).then((html) => {
      expect(html).toContain("500 CRO");
      expect(html).toContain("$34.40");
    });
  });

  it("writes money with its cents", async () => {
    // grouped() drops a trailing zero, and $34.4 is not a price.
    expect(await line(80, 198_000)).toContain("$5.50");
  });

  it("gives the market cap the buy was made at", async () => {
    // The figure a buy bot is actually read for: the CRO figure says what
    // somebody spent, this says what they thought the thing was worth. Worked
    // out from the price the buy itself paid, so it costs no call.
    expect(await line(500, 1_240_000)).toMatch(/\$27\.7K market cap/);
  });

  it("marks the size, so a whale is not read as a minnow", async () => {
    expect(await line(5_000, 12_400_000)).toContain("🐳");
    expect(await line(500, 1_240_000)).toContain("🦈");
    expect(await line(80, 198_000)).toContain("🐬");
  });

  it("leaves the dollars out rather than inventing them", async () => {
    // One window on one deployment: no price has ever been read. A line with
    // "$NaN" on it is worse than a line in CRO.
    const html = await line(500, 1_240_000, null);
    expect(html).toContain("500 CRO");
    // A dollar FIGURE, not the dollar in "$CROCARD" — which is why this is a
    // pattern and not a substring.
    expect(html).not.toMatch(/\$[\d.]/);
    expect(html).not.toContain("NaN");
    expect(html).not.toMatch(/market cap/);
  });

  it("is HTML, with no Discord bold left in it", async () => {
    const html = await line(500, 1_240_000);
    expect(html).toContain("<b>");
    expect(html).not.toContain("**");
  });

  it("becomes one message when a batch is large", async () => {
    // Seven notifications in a minute is a muted channel, which is the same as
    // not having a buy bot.
    const many = Array.from({ length: TOO_MANY + 1 }, () => buyGot(100, 250_000));
    const lines = await sayBuysForTelegram(many, [], 0.0688);
    expect(lines).toHaveLength(1);
    expect(lines[0]!.html).toContain(`${TOO_MANY + 1} $CROCARD buys`);
  });

  it("says nothing about a sell", async () => {
    // A Swap with nothing coming out is somebody going the other way.
    expect(await sayBuysForTelegram([buyGot(500, 0)], [], 0.0688)).toEqual([]);
  });
});

describe("the generic translation, for the feeds that use it", () => {
  it("turns Discord bold into Telegram bold", () => {
    // This is the bug the maker saw: asterisks on the screen.
    const html = asText({ title: "Bought", description: "**500 CRO** went in" });
    expect(html).toContain("<b>500 CRO</b> went in");
    expect(html).not.toContain("**");
  });

  it("escapes the three characters HTML mode cares about", () => {
    // A card called "Ape & Co <3" would otherwise be a parse error, and
    // Telegram answers a parse error by refusing the whole message.
    expect(asText({ title: "Ape & Co <3" })).toBe("<b>Ape &amp; Co &lt;3</b>");
  });

  it("names who is talking", () => {
    // Dropped in the first version, which is why those lines read as coming
    // from nobody.
    const html = asText({ title: "Burned", author: { name: "Cards of Cronos", icon_url: "" } });
    expect(html.split("\n")[0]).toBe("<b>Cards of Cronos</b>");
  });

  it("makes a linked title the way in", () => {
    expect(asText({ title: "Burned", url: "https://example.com/tx" })).toBe(
      '<a href="https://example.com/tx"><b>Burned</b></a>',
    );
  });
});
