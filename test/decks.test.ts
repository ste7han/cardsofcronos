// Decks, now that they belong to a wallet instead of to a browser.
//
// The thing worth most here is the seat. "Which deck am I playing" is one fact
// and it is stored as a flag on a row, so two rows claiming it is a table that
// reads fine and deals whichever one came back first. The real database has a
// unique index that refuses it; the fake below enforces the same rule, so a
// putDeck that claimed the seat before clearing it fails here rather than in
// production at some later hour.
//
// The other half is scoping. Every write takes a wallet and puts it in the
// WHERE rather than checking it first, because a deck id is a string somebody
// can send — and a delete that trusted the id would let anybody throw away
// anybody's decks.

import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { MOST_DECKS, decksOf, dropDeck, playDeck, putDeck } from "@/lib/store";
import type { Database, Statement } from "@/lib/store";

const ALICE = "0x" + "a".repeat(40);
const BOB = "0x" + "b".repeat(40);

interface Row {
  id: string;
  wallet: string;
  name: string;
  cards: string;
  at: number;
  playing: number;
}

/**
 * Enough of a database to answer what lib/store.ts asks of the decks table.
 *
 * Matched on the shape of the SQL rather than parsed, the same as the fake in
 * store.test.ts: crude, and honest about it. A query that changes shape fails
 * loudly here instead of being quietly answered wrong.
 *
 * It enforces the one constraint the schema enforces, and that is the point of
 * writing it rather than mocking the calls.
 */
function fakeDb(): Database & { rows: Map<string, Row> } {
  const rows = new Map<string, Row>();

  /** What `CREATE UNIQUE INDEX decks_playing ON decks (wallet) WHERE playing = 1` does. */
  const check = () => {
    const seats = new Map<string, number>();
    for (const row of rows.values()) {
      if (row.playing !== 1) continue;
      const many = (seats.get(row.wallet) ?? 0) + 1;
      seats.set(row.wallet, many);
      if (many > 1) throw new Error(`UNIQUE constraint failed: two decks playing for ${row.wallet}`);
    }
  };

  const statement = (sql: string, values: unknown[]): Statement => ({
    bind: (...next: unknown[]) => statement(sql, next),

    first: async <T>() => {
      if (sql.includes("SELECT id FROM decks WHERE id = ? AND wallet = ?")) {
        const [id, wallet] = values as [string, string];
        const row = rows.get(id);
        return (row !== undefined && row.wallet === wallet ? { id } : null) as T | null;
      }
      throw new Error(`fake has no answer for: ${sql}`);
    },

    all: async <T>() => {
      if (sql.includes("SELECT id, name, cards, at, playing FROM decks")) {
        const [wallet] = values as [string];
        const mine = [...rows.values()]
          .filter((row) => row.wallet === wallet)
          .sort((a, b) => b.at - a.at);
        return { results: mine as unknown as T[] };
      }
      throw new Error(`fake has no answer for: ${sql}`);
    },

    run: async () => {
      if (sql.includes("UPDATE decks SET playing = 0 WHERE wallet = ?")) {
        const [wallet] = values as [string];
        for (const row of rows.values()) if (row.wallet === wallet) row.playing = 0;
      } else if (sql.includes("UPDATE decks SET playing = 1 WHERE id = ? AND wallet = ?")) {
        const [id, wallet] = values as [string, string];
        const row = rows.get(id);
        if (row !== undefined && row.wallet === wallet) row.playing = 1;
      } else if (sql.includes("INSERT INTO decks")) {
        const [id, wallet, name, cards, at] = values as [string, string, string, string, number];
        const existing = rows.get(id);
        // ON CONFLICT ... WHERE decks.wallet = excluded.wallet: a clash on
        // somebody else's id changes nothing.
        if (existing !== undefined && existing.wallet !== wallet) return {};
        rows.set(id, { id, wallet, name, cards, at, playing: 1 });
      } else if (sql.includes("DELETE FROM decks WHERE id = ? AND wallet = ?")) {
        const [id, wallet] = values as [string, string];
        const row = rows.get(id);
        if (row !== undefined && row.wallet === wallet) rows.delete(id);
      } else {
        throw new Error(`fake has no answer for: ${sql}`);
      }
      check();
      return {};
    },
  });

  return { rows, prepare: (sql: string) => statement(sql, []) };
}

const forty = (from: string) => Array.from({ length: 40 }, (_, i) => `${from}-${i}`);

describe("a wallet's decks", () => {
  it("come back newest first, with their cards", async () => {
    const db = fakeDb();
    await putDeck(db, ALICE, { id: "one", name: "First", cardIds: forty("a"), at: 1 });
    await putDeck(db, ALICE, { id: "two", name: "Second", cardIds: forty("b"), at: 2 });

    const decks = await decksOf(db, ALICE);
    expect(decks.map((deck) => deck.name)).toEqual(["Second", "First"]);
    expect(decks[0]!.cardIds).toHaveLength(40);
    expect(decks[0]!.cardIds[0]).toBe("b-0");
  });

  it("are one wallet's and not another's", async () => {
    const db = fakeDb();
    await putDeck(db, ALICE, { id: "hers", name: "Hers", cardIds: forty("a"), at: 1 });
    await putDeck(db, BOB, { id: "his", name: "His", cardIds: forty("b"), at: 2 });

    expect((await decksOf(db, ALICE)).map((deck) => deck.id)).toEqual(["hers"]);
    expect((await decksOf(db, BOB)).map((deck) => deck.id)).toEqual(["his"]);
  });

  it("drops a row whose cards will not parse instead of throwing", async () => {
    // One corrupt row should cost that row and not somebody's other decks.
    const db = fakeDb();
    await putDeck(db, ALICE, { id: "good", name: "Good", cardIds: forty("a"), at: 2 });
    db.rows.set("bad", {
      id: "bad", wallet: ALICE, name: "Bad", cards: "{not json", at: 1, playing: 0,
    });

    const decks = await decksOf(db, ALICE);
    expect(decks.map((deck) => deck.id)).toEqual(["good"]);
  });
});

describe("the seat", () => {
  it("moves to whatever was saved last, and only that", async () => {
    const db = fakeDb();
    await putDeck(db, ALICE, { id: "one", name: "First", cardIds: forty("a"), at: 1 });
    await putDeck(db, ALICE, { id: "two", name: "Second", cardIds: forty("b"), at: 2 });

    const playing = (await decksOf(db, ALICE)).filter((deck) => deck.playing);
    expect(playing.map((deck) => deck.id)).toEqual(["two"]);
  });

  it("is cleared before it is claimed, which is what the unique index demands", async () => {
    // The fake throws on two rows playing. Doing these the other way round —
    // claim, then clear — would be refused by the real database, and the first
    // anybody would know is a save that failed for one player and not another.
    const db = fakeDb();
    for (let i = 0; i < 5; i++) {
      await putDeck(db, ALICE, { id: `d${i}`, name: `D${i}`, cardIds: forty("a"), at: i });
    }
    expect([...db.rows.values()].filter((row) => row.playing === 1)).toHaveLength(1);
  });

  it("does not move to a deck belonging to somebody else", async () => {
    const db = fakeDb();
    await putDeck(db, ALICE, { id: "hers", name: "Hers", cardIds: forty("a"), at: 1 });
    await putDeck(db, BOB, { id: "his", name: "His", cardIds: forty("b"), at: 2 });

    expect(await playDeck(db, ALICE, "his")).toBe(false);
    // And hers is still the one she is playing. A false that had already
    // cleared the seat would leave her with no deck at the table.
    const hers = await decksOf(db, ALICE);
    expect(hers.find((deck) => deck.playing)?.id).toBe("hers");
  });

  it("moves when she picks one of her own", async () => {
    const db = fakeDb();
    await putDeck(db, ALICE, { id: "one", name: "First", cardIds: forty("a"), at: 1 });
    await putDeck(db, ALICE, { id: "two", name: "Second", cardIds: forty("b"), at: 2 });

    expect(await playDeck(db, ALICE, "one")).toBe(true);
    expect((await decksOf(db, ALICE)).find((deck) => deck.playing)?.id).toBe("one");
  });
});

describe("throwing one away", () => {
  it("deletes it", async () => {
    const db = fakeDb();
    await putDeck(db, ALICE, { id: "one", name: "First", cardIds: forty("a"), at: 1 });
    await dropDeck(db, ALICE, "one");
    expect(await decksOf(db, ALICE)).toEqual([]);
  });

  it("cannot reach a deck that is not yours", async () => {
    // The id is a string that arrives in a request body. Scoping this to the
    // wallet in the WHERE is the only thing between that and deleting anybody's
    // decks by guessing.
    const db = fakeDb();
    await putDeck(db, BOB, { id: "his", name: "His", cardIds: forty("b"), at: 1 });
    await dropDeck(db, ALICE, "his");
    expect((await decksOf(db, BOB)).map((deck) => deck.id)).toEqual(["his"]);
  });

  it("cannot be overwritten through the id either", async () => {
    // Saving with somebody else's id must not rename their deck.
    const db = fakeDb();
    await putDeck(db, BOB, { id: "his", name: "His", cardIds: forty("b"), at: 1 });
    await putDeck(db, ALICE, { id: "his", name: "Stolen", cardIds: forty("a"), at: 2 });
    expect((await decksOf(db, BOB))[0]!.name).toBe("His");
  });
});

describe("the schema this is stored in", () => {
  const schema = readFileSync(new URL("../db/schema.sql", import.meta.url), "utf8");

  it("indexes only tables it also creates", () => {
    // This is not hypothetical. Three indexes were left behind pointing at
    // tables the old app took with it, so `wrangler d1 execute --file` stopped
    // at the first one — and every table below it was simply never created on a
    // fresh database. It went unseen because the live database already had the
    // leftovers, so the file only failed where nobody was looking.
    const tables = new Set(
      [...schema.matchAll(/CREATE TABLE (?:IF NOT EXISTS )?(\w+)/g)].map((m) => m[1]!),
    );
    const indexed = [...schema.matchAll(/CREATE (?:UNIQUE )?INDEX (?:IF NOT EXISTS )?\w+\s+ON (\w+)/g)]
      .map((m) => m[1]!);

    expect(indexed.length).toBeGreaterThan(0);
    for (const table of indexed) {
      expect(tables.has(table), `an index names "${table}", which this file does not create`).toBe(true);
    }
  });

  it("refuses two decks playing at once", () => {
    expect(schema).toMatch(
      /CREATE UNIQUE INDEX IF NOT EXISTS decks_playing ON decks \(wallet\) WHERE playing = 1;/,
    );
  });

  it("checks the wallet column the way every other table does", () => {
    const table = schema.slice(schema.indexOf("CREATE TABLE IF NOT EXISTS decks"));
    expect(table.slice(0, 600)).toMatch(/wallet\s+TEXT NOT NULL CHECK \(wallet = lower\(wallet\)/);
  });

  it("caps how many decks one wallet keeps", () => {
    // Not a schema rule — there is no way to write "twenty rows per wallet" in
    // SQLite without a trigger — so it is the route's, and this says the number
    // exists rather than being a magic literal in one branch of one handler.
    expect(MOST_DECKS).toBeGreaterThan(1);
    expect(MOST_DECKS).toBeLessThanOrEqual(100);
  });
});
