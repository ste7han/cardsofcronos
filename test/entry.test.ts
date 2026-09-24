// Paying to play a board: what the fee buys, and what cannot be skipped.
//
// The contract's own tests are in contracts/test/BoardEntry.t.sol and they
// cover the money. These cover the half that lives here: that a board which
// charges is gated on the payment and not on a token, that a go is spent by a
// finished match rather than by starting one, and that a board with no deployed
// gate is free rather than broken.
//
// That last one is the state everything is in right now, and it is the one most
// worth a test: a fee with nowhere to pay it would be a board that looks paid
// for and takes nothing.

import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { BOARDS, boardOf } from "@/data/boards";
import { ENTERED, dealEntry, scoreEntry, sparEntries } from "@/lib/entries";
import { enterData, feeWei } from "@/lib/entry-pay";
import { CONTRACTS } from "@/lib/revenue";
import { topicOf } from "@/lib/evm-tx";
import { selector } from "@/lib/evm-tx";
import type { Database, Statement } from "@/lib/store";

const ALICE = "0x" + "a".repeat(40);
const BOB = "0x" + "b".repeat(40);

interface Row {
  id: string;
  player: string;
  board: string;
  at: number;
  used_at: number | null;
  seed: number | null;
  scored_at: number | null;
}

/** Enough of a database for the two questions this file asks. */
function fakeDb(): Database & { rows: Row[] } {
  const rows: Row[] = [];
  const statement = (sql: string, values: unknown[]): Statement => ({
    bind: (...next: unknown[]) => statement(sql, next),
    first: async <T>() => {
      if (sql.includes("SELECT count(*) AS n FROM board_entries")) {
        const [player, board] = values as [string, string];
        const n = rows.filter((r) => r.player === player && r.board === board && r.used_at === null).length;
        return { n } as T;
      }
      if (sql.includes("SELECT seed FROM board_entries")) {
        const [player, board] = values as [string, string];
        const open = rows
          .filter((r) => r.player === player && r.board === board && r.seed !== null && r.scored_at === null)
          .sort((a, b) => (a.used_at ?? 0) - (b.used_at ?? 0))[0];
        return (open === undefined ? null : { seed: open.seed }) as T | null;
      }
      if (sql.includes("UPDATE board_entries SET used_at = ?, seed = ?")) {
        const [now, seed, player, board] = values as [number, number, string, string];
        const spare = rows
          .filter((r) => r.player === player && r.board === board && r.used_at === null)
          .sort((a, b) => a.at - b.at)[0];
        if (spare === undefined) return null;
        spare.used_at = now;
        spare.seed = seed;
        return { seed } as T;
      }
      if (sql.includes("UPDATE board_entries SET scored_at")) {
        const [now, player, board, seed] = values as [number, string, string, number];
        const hit = rows.find(
          (r) => r.player === player && r.board === board && r.seed === seed && r.scored_at === null,
        );
        if (hit === undefined) return null;
        hit.scored_at = now;
        return { id: hit.id } as T;
      }
      throw new Error(`fake has no answer for: ${sql}`);
    },
    all: async <T>() => ({ results: [] as T[] }),
    run: async () => ({}),
  });
  return { rows, prepare: (sql: string) => statement(sql, []) };
}

const give = (db: { rows: Row[] }, player: string, board: string, at: number) =>
  db.rows.push({
    id: `e${db.rows.length}`,
    player,
    board,
    at,
    used_at: null,
    seed: null,
    scored_at: null,
  });

describe("the event this all hangs on", () => {
  it("is derived from the signature and not typed out", () => {
    // I typed one out first and it was wrong, which is a scan that finds
    // nothing for ever with no error anywhere. The signature is readable and a
    // mistake in it is loud; a hex string is neither.
    expect(ENTERED).toBe(topicOf("Entered(address,uint256,uint256,uint256)"));
    const source = readFileSync(new URL("../lib/entries.ts", import.meta.url), "utf8");
    expect(source).toContain('topicOf("Entered(address,uint256,uint256,uint256)")');
  });

  it("matches the event the contract actually declares", () => {
    // Two files, one signature. A parameter added to the event on one side is a
    // different topic and a scan that silently stops finding anything.
    const solidity = readFileSync(new URL("../contracts/BoardEntry.sol", import.meta.url), "utf8");
    expect(solidity).toContain(
      "event Entered(address indexed player, uint256 paid, uint256 toSplitter, uint256 bought);",
    );
  });
});

describe("a go", () => {
  it("is spent when the match is dealt, not when a score comes back", async () => {
    // The whole correction. It spent on submission, and the browser only ever
    // submits a win — so a loss cost nothing and one payment bought attempts
    // until one went well.
    const db = fakeDb();
    give(db, ALICE, "lions", 1);
    expect(await sparEntries(db, ALICE, "lions")).toBe(1);

    const seed = await dealEntry(db, ALICE, "lions", 9);
    expect(seed).not.toBeNull();
    expect(await sparEntries(db, ALICE, "lions")).toBe(0);
  });

  it("hands back the same seed when it is asked again", async () => {
    // The reconnection, and the reason a refresh does not cost ten CRO. A
    // second deal would be a second attempt off one payment.
    const db = fakeDb();
    give(db, ALICE, "lions", 1);
    const first = await dealEntry(db, ALICE, "lions", 9);
    const again = await dealEntry(db, ALICE, "lions", 10);
    expect(again).toBe(first);
  });

  it("deals nothing when nothing is paid for", async () => {
    const db = fakeDb();
    expect(await dealEntry(db, ALICE, "lions", 9)).toBeNull();
  });

  it("takes a score only against the seed it dealt", async () => {
    // A seed the server never dealt is a shuffle somebody found by replaying
    // locally until one won.
    const db = fakeDb();
    give(db, ALICE, "lions", 1);
    const seed = (await dealEntry(db, ALICE, "lions", 9))!;

    expect(await scoreEntry(db, ALICE, "lions", seed + 1, 11)).toBe(false);
    expect(await scoreEntry(db, ALICE, "lions", seed, 11)).toBe(true);
  });

  it("takes one score per deal, however often it is submitted", async () => {
    const db = fakeDb();
    give(db, ALICE, "lions", 1);
    const seed = (await dealEntry(db, ALICE, "lions", 9))!;
    expect(await scoreEntry(db, ALICE, "lions", seed, 11)).toBe(true);
    expect(await scoreEntry(db, ALICE, "lions", seed, 12)).toBe(false);
  });

  it("does not let one wallet score another's match", async () => {
    const db = fakeDb();
    give(db, ALICE, "lions", 1);
    const seed = (await dealEntry(db, ALICE, "lions", 9))!;
    expect(await scoreEntry(db, BOB, "lions", seed, 11)).toBe(false);
  });

  it("is not somebody else's and not another board's", async () => {
    const db = fakeDb();
    give(db, ALICE, "lions", 1);
    expect(await sparEntries(db, BOB, "lions")).toBe(0);
    expect(await sparEntries(db, ALICE, "bot")).toBe(0);
    expect(await dealEntry(db, BOB, "lions", 9)).toBeNull();
  });

  it("deals the oldest paid go first", async () => {
    const db = fakeDb();
    give(db, ALICE, "lions", 5);
    give(db, ALICE, "lions", 1);
    await dealEntry(db, ALICE, "lions", 9);
    expect(db.rows.find((r) => r.at === 1)!.used_at).toBe(9);
    expect(db.rows.find((r) => r.at === 5)!.used_at).toBeNull();
  });
});

describe("where the shuffle comes from", () => {
  it("is asked for before a match is dealt", () => {
    // The browser picked it and submitted only the matches it liked. Asking the
    // server first is what makes a paid go one attempt rather than attempts
    // until one wins.
    const game = readFileSync(new URL("../components/game/Game.tsx", import.meta.url), "utf8");
    expect(game).toContain('"/api/boards/deal"');
    const before = game.indexOf('"/api/boards/deal"');
    const deals = game.indexOf("start(false, dealt)");
    expect(before).toBeGreaterThan(-1);
    expect(deals).toBeGreaterThan(before);
  });

  it("is still the browser's on a free board", () => {
    // Nothing is spent there and nothing is bought, so there is nothing to
    // protect — and a round trip before every practice match would be a cost
    // with no rule behind it.
    const route = readFileSync(
      new URL("../app/api/boards/deal/route.ts", import.meta.url),
      "utf8",
    );
    expect(route).toContain("if (board.entry?.contract == null) return Response.json({ seed: null, free: true });");
  });

  it("is checked at the score, where it counts", () => {
    const route = readFileSync(
      new URL("../app/api/tournament/route.ts", import.meta.url),
      "utf8",
    );
    expect(route).toContain("scoreEntry(db(), wallet, board.id, seed as number, now)");
  });
});

describe("what the browser sends", () => {
  it("calls enter with no arguments, so there is nothing to get wrong", () => {
    expect(enterData()).toBe(selector("enter()"));
    expect(enterData()).toHaveLength(10);
  });

  it("sends whole CRO and refuses anything else", () => {
    expect(feeWei(10)).toBe(10n * 10n ** 18n);
    expect(() => feeWei(0)).toThrow(/whole number/i);
    expect(() => feeWei(1.5)).toThrow(/whole number/i);
  });
});

describe("the boards as they stand", () => {
  it("leaves the market free, and it stays free", () => {
    expect(boardOf("bot")!.entry).toBeNull();
    expect(boardOf("bot")!.alsoPays).toBeNull();
  });

  it("charges ten CRO on Loaded Lions, at a door that exists", () => {
    // This asserted the opposite until the contracts went up on 24 September:
    // a fee with a null door, which everything treats as free. Both halves were
    // worth a test, and this one is the half that can now take money — so it
    // checks there is somewhere for it to go rather than that there is not.
    const lions = boardOf("lions")!;
    expect(lions.entry?.cro).toBe(10);
    expect(lions.entry?.contract).toBe(CONTRACTS.lionEntry);
    expect(lions.entry?.contract).not.toBeNull();
    expect(lions.alsoPays?.symbol).toBe("$LION");
    expect(lions.alsoPays?.contract).toBe(CONTRACTS.lionPot);
  });

  it("pays a board's own pot out of a different contract from the shared one", () => {
    // Two PrizePots, and they must never be the same address: one holds
    // $CROCARD for every board and one holds $LION for this one. Closing a week
    // on the same contract twice is a prize paid out of the wrong token.
    expect(CONTRACTS.lionPot).not.toBe(CONTRACTS.pot);
  });

  it("keeps the $LION holding rule only while there is no gate", () => {
    // The two must never run at once: that would be asking somebody to hold a
    // token AND pay. lib/gate.ts reads the deployed contract rather than a
    // flag, so they cannot disagree.
    const gate = readFileSync(new URL("../lib/gate.ts", import.meta.url), "utf8");
    expect(gate).toContain("if (board.entry?.contract != null) return null;");
  });

  it("charges on a board that has somewhere for the money to go", () => {
    for (const board of BOARDS) {
      if (board.entry === null) continue;
      // A fee with no second pot would be a board charging to play for the same
      // prize as the free one.
      expect(board.alsoPays, `${board.id} charges but pays nothing extra`).not.toBeNull();
    }
  });
});
