// A challenge posted to the lobby, and which channel hears about it.
//
// The whole point of announcing an offer is that somebody presses it, so the
// things worth testing are the ones that would leave a message nobody can act
// on: the wrong channel, the same seat twice, or a link that does not name the
// offer it was sent for.
//
// Run against fetch rather than against the source, unlike test/announce.ts.
// lib/discord.ts posts with fetch and nothing else, so stubbing it checks what
// would actually arrive in Discord — the URL it went to and the words in it —
// instead of checking that a line of code is still written the way it was.

import { afterEach, describe, expect, it, vi } from "vitest";

import { announceOffer } from "@/lib/challenge";
import type { Database, Statement } from "@/lib/store";

const FRIENDLY = "https://discord.example/friendly";
const RANKED = "https://discord.example/ranked";
const PLAYER = "0x" + "a".repeat(40);

/** Just enough database for the once-only guard. */
function fakeDb(): Database & { said: Set<string> } {
  const said = new Set<string>();
  const statement = (sql: string, values: unknown[]): Statement => ({
    bind: (...next: unknown[]) => statement(sql, next),
    first: async <T>() => {
      if (!sql.includes("SELECT id FROM feed_posted")) throw new Error(`onbekend: ${sql}`);
      return (said.has(values[0] as string) ? { id: values[0] } : null) as T | null;
    },
    all: async <T>() => ({ results: [] as T[] }),
    run: async () => {
      if (!sql.includes("INSERT OR IGNORE INTO feed_posted")) throw new Error(`onbekend: ${sql}`);
      said.add(values[0] as string);
      return {};
    },
  });
  return {
    said,
    prepare: (sql: string) => statement(sql, []),
    // Applied in order. The all-or-nothing part is D1's and not modelled here.
    async batch(statements: readonly Statement[]) {
      const out: unknown[] = [];
      for (const one of statements) out.push(await one.run());
      return out;
    },
  };
}

/** Captures what would have gone to Discord. */
function catchPosts(): { to: string; body: { embeds: Record<string, unknown>[] } }[] {
  const sent: { to: string; body: { embeds: Record<string, unknown>[] } }[] = [];
  vi.stubGlobal("fetch", async (url: string, init: { body: string }) => {
    sent.push({ to: url, body: JSON.parse(init.body) as { embeds: Record<string, unknown>[] } });
    return { ok: true, status: 204, json: async () => ({}) } as unknown as Response;
  });
  return sent;
}

const offer = (over: Partial<Parameters<typeof announceOffer>[1]> = {}) => ({
  id: "abc123",
  playerId: PLAYER,
  mode: "live" as const,
  stake: 0,
  rank: 12,
  expiresAt: Date.now() + 60 * 60 * 1000,
  ...over,
});

afterEach(() => vi.unstubAllGlobals());

describe("announcing an offer", () => {
  it("puts a friendly seat in the friendly channel", async () => {
    const sent = catchPosts();
    await announceOffer(fakeDb(), offer(), { pvpFriendly: FRIENDLY, pvpRanked: RANKED });
    expect(sent).toHaveLength(1);
    expect(sent[0]!.to).toBe(FRIENDLY);
  });

  it("puts a staked seat in the ranked channel", async () => {
    // The mistake this catches is one character wide and would put games with
    // nothing on them into a channel about money, or worse, the other way.
    const sent = catchPosts();
    await announceOffer(fakeDb(), offer({ stake: 100 }), {
      pvpFriendly: FRIENDLY, pvpRanked: RANKED,
    });
    expect(sent).toHaveLength(1);
    expect(sent[0]!.to).toBe(RANKED);
  });

  it("says nothing at all when that channel is not set up", async () => {
    // The feeds are configured one at a time, so absent is a real state and has
    // to be quiet rather than an error inside posting an offer.
    const sent = catchPosts();
    await announceOffer(fakeDb(), offer(), { pvpRanked: RANKED });
    expect(sent).toEqual([]);
  });

  it("announces one seat once, however often it is asked", async () => {
    // A retried request would otherwise put two identical links in the channel,
    // one of which stops working the moment the other is taken.
    const sent = catchPosts();
    const db = fakeDb();
    await announceOffer(db, offer(), { pvpFriendly: FRIENDLY });
    await announceOffer(db, offer(), { pvpFriendly: FRIENDLY });
    expect(sent).toHaveLength(1);
  });

  it("links to the offer and not merely to the lobby", async () => {
    // Arriving at a list of six rows with no idea which one the message meant
    // is the same as arriving at the lobby, which is what this replaced.
    const sent = catchPosts();
    await announceOffer(fakeDb(), offer({ id: "seat-7" }), { pvpFriendly: FRIENDLY });
    const embed = sent[0]!.body.embeds[0]!;
    expect(embed.url).toBe("https://cardsofcronos.com/pvp?offer=seat-7");
    expect(String(embed.description)).toContain("?offer=seat-7");
  });

  it("says the stake is still on its way, because the seat is not takeable yet", async () => {
    // Posting an offer and signing the deposit are two steps, and /api/pvp/join
    // refuses a seat whose stake has not landed. A challenge that did not say so
    // would send people at a button that turns them away.
    const sent = catchPosts();
    await announceOffer(fakeDb(), offer({ stake: 50 }), { pvpRanked: RANKED });
    expect(String(sent[0]!.body.embeds[0]!.description)).toMatch(/stake is being put up/i);
  });

  it("names the clock, because two minutes and a day are different games", async () => {
    const sent = catchPosts();
    const db = fakeDb();
    await announceOffer(db, offer({ id: "a", mode: "live" }), { pvpFriendly: FRIENDLY });
    await announceOffer(db, offer({ id: "b", mode: "correspondence" }), { pvpFriendly: FRIENDLY });
    expect(String(sent[0]!.body.embeds[0]!.description)).toMatch(/two minutes a turn/i);
    expect(String(sent[1]!.body.embeds[0]!.description)).toMatch(/a day a turn/i);
  });

  it("quotes the pot as both sides, not one", async () => {
    // "100 CRO" on a 100 CRO offer is half of what is being played for, and the
    // difference is the whole reason somebody presses it.
    const sent = catchPosts();
    await announceOffer(fakeDb(), offer({ stake: 100 }), { pvpRanked: RANKED });
    expect(String(sent[0]!.body.embeds[0]!.description)).toContain("the pot is 200");
  });
});
