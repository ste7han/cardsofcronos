// The EbisusBay sales feed.
//
// Two of these are about holes this had while it was being written, and both
// are the kind that lose a message rather than repeat one — which for a feed is
// the expensive direction. The third is about not shouting the back catalogue
// into somebody's Discord the first time it runs.

import { afterEach, describe, expect, it, vi } from "vitest";

import { runSales } from "@/lib/sales";
import type { Database, Statement } from "@/lib/store";

const WEBHOOK = "https://discord.com/api/webhooks/1/x";

/** A sale as EbisusBay hands it over. */
const sale = (id: string, at: number, extra: Record<string, unknown> = {}) => ({
  listingId: id,
  nftId: "42",
  price: "120.0",
  currency: "0x0000000000000000000000000000000000000000",
  saleTime: String(at),
  seller: "0x" + "1".repeat(40),
  purchaser: "0x" + "2".repeat(40),
  transactionHash: "0x" + "3".repeat(64),
  state: 1,
  nft: { name: "Pampa" },
  ...extra,
});

/** Just enough database: one cursor and the posted ledger. */
function fakeDb(seed?: { cursor?: number; posted?: string[] }) {
  const cursors = new Map<string, number>(
    seed?.cursor === undefined ? [] : [["feed:sales", seed.cursor]],
  );
  const posted = new Set<string>(seed?.posted ?? []);

  const db: Database & { cursors: Map<string, number>; posted: Set<string> } = {
    cursors,
    posted,
    async batch(statements: readonly Statement[]) {
      const out: unknown[] = [];
      for (const one of statements) out.push(await one.run());
      return out;
    },
    prepare(sql: string): Statement {
      let bound: unknown[] = [];
      const self: Statement = {
        bind(...values: unknown[]) {
          bound = values;
          return self;
        },
        async first<T>() {
          if (sql.includes("FROM cursors")) {
            const at = cursors.get(bound[0] as string);
            return (at === undefined ? null : { block: at }) as T | null;
          }
          throw new Error(`The fake was not asked for this: ${sql}`);
        },
        async all<T>() {
          if (sql.includes("FROM feed_posted")) {
            return {
              results: (bound as string[]).filter((id) => posted.has(id)).map((id) => ({ id })) as T[],
            };
          }
          throw new Error(`The fake was not asked for this: ${sql}`);
        },
        async run() {
          if (sql.includes("INSERT INTO cursors")) {
            cursors.set(bound[0] as string, bound[1] as number);
            return null;
          }
          if (sql.includes("INTO feed_posted")) {
            posted.add(bound[0] as string);
            return null;
          }
          throw new Error(`The fake was not asked for this: ${sql}`);
        },
      };
      return self;
    },
  };
  return db;
}

/** EbisusBay and Discord, both answered from here. */
function fakeWorld(listings: unknown[]) {
  const posts: { body: string }[] = [];
  vi.stubGlobal("fetch", async (url: string | URL, init?: RequestInit) => {
    const where = String(url);
    if (where.includes("ebisusbay")) {
      return new Response(JSON.stringify({ listings }), { status: 200 });
    }
    if (where.includes("discord")) {
      posts.push({ body: String(init?.body ?? "") });
      // null, not "": 204 is a null-body status and a Response with a body
      // there throws — which made every post in these tests fail quietly.
      return new Response(null, { status: 204 });
    }
    throw new Error(`The fake world was not asked for this: ${where}`);
  });
  return posts;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("the first time it ever runs", () => {
  it("says nothing, so a Discord does not get the back catalogue", async () => {
    const db = fakeDb();
    const posts = fakeWorld([sale("a", 1_700_000_000), sale("b", 1_700_000_100)]);
    const ran = await runSales(db, WEBHOOK, 1_800_000_000_000);

    expect(posts).toHaveLength(0);
    expect(ran.posted).toBe(0);
    expect(ran.skipped).toMatch(/first run/i);
    // And it remembers where the present is, or it would do this again.
    expect(db.cursors.get("feed:sales")).toBe(1_700_000_100);
  });

  it("still notes the clock when there are no sales at all", async () => {
    // The hole this closes. With nothing sold yet there is no newest sale to
    // note, so writing nothing left it on its first run for ever — and the
    // first sale that ever happened would have been swallowed as "where we
    // are" instead of announced. Which is the one sale most worth announcing.
    const db = fakeDb();
    const posts = fakeWorld([]);
    const ran = await runSales(db, WEBHOOK, 1_800_000_000_000);

    expect(posts).toHaveLength(0);
    expect(db.cursors.get("feed:sales")).toBe(1_800_000_000);
    expect(ran.skipped).toMatch(/first run/i);
  });

  it("announces the very first sale after that", async () => {
    const db = fakeDb({ cursor: 1_800_000_000 });
    const posts = fakeWorld([sale("first", 1_800_000_060)]);
    const ran = await runSales(db, WEBHOOK, 1_800_000_100_000);

    expect(ran.posted).toBe(1);
    expect(posts).toHaveLength(1);
    expect(posts[0]!.body).toContain("Pampa");
  });
});

describe("saying a sale once", () => {
  it("does not repeat one it has already announced", async () => {
    const db = fakeDb({ cursor: 1_800_000_000, posted: ["sales:done"] });
    const posts = fakeWorld([sale("done", 1_800_000_050)]);
    const ran = await runSales(db, WEBHOOK, 1_800_000_100_000);

    expect(posts).toHaveLength(0);
    expect(ran.posted).toBe(0);
  });

  it("loses neither of two sales in the same second", async () => {
    // saleTime is whole seconds. Keyed on the clock alone, announcing one of a
    // pair would move the cursor past both and the second would never be said.
    // The ledger is what decides; the cursor only keeps this from re-reading.
    const db = fakeDb({ cursor: 1_800_000_000, posted: ["sales:one"] });
    const posts = fakeWorld([sale("one", 1_800_000_050), sale("two", 1_800_000_050)]);
    const ran = await runSales(db, WEBHOOK, 1_800_000_100_000);

    expect(ran.posted).toBe(1);
    expect(db.posted.has("sales:two")).toBe(true);
  });

  it("leaves the ledger and the cursor alone when Discord refuses", async () => {
    const db = fakeDb({ cursor: 1_800_000_000 });
    vi.stubGlobal("fetch", async (url: string | URL) => {
      if (String(url).includes("ebisusbay")) {
        return new Response(JSON.stringify({ listings: [sale("x", 1_800_000_050)] }), { status: 200 });
      }
      return new Response("nope", { status: 500 });
    });
    const ran = await runSales(db, WEBHOOK, 1_800_000_100_000);

    expect(ran.posted).toBe(0);
    expect(ran.wrong).toBeTruthy();
    // Both untouched, so the next run tries again.
    expect(db.cursors.get("feed:sales")).toBe(1_800_000_000);
    expect(db.posted.size).toBe(0);
  });
});

describe("when EbisusBay changes or breaks", () => {
  it("says so rather than moving on, if the answer is not the shape it expects", async () => {
    const db = fakeDb({ cursor: 1_800_000_000 });
    vi.stubGlobal("fetch", async () => new Response(JSON.stringify({ nope: true }), { status: 200 }));
    const ran = await runSales(db, WEBHOOK, 1_800_000_100_000);

    expect(ran.wrong).toMatch(/API/i);
    expect(db.cursors.get("feed:sales")).toBe(1_800_000_000);
  });

  it("does nothing at all without a webhook, and says which", async () => {
    const db = fakeDb();
    const ran = await runSales(db, undefined, 1_800_000_000_000);
    expect(ran.skipped).toMatch(/no webhook/i);
  });
});
