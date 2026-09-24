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
import { ENTERED, sparEntries, spendEntry } from "@/lib/entries";
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
      if (sql.includes("UPDATE board_entries SET used_at")) {
        const [now, player, board] = values as [number, string, string];
        const spare = rows
          .filter((r) => r.player === player && r.board === board && r.used_at === null)
          .sort((a, b) => a.at - b.at)[0];
        if (spare === undefined) return null;
        spare.used_at = now;
        return { id: spare.id } as T;
      }
      throw new Error(`fake has no answer for: ${sql}`);
    },
    all: async <T>() => ({ results: [] as T[] }),
    run: async () => ({}),
  });
  return { rows, prepare: (sql: string) => statement(sql, []) };
}

const give = (db: { rows: Row[] }, player: string, board: string, at: number) =>
  db.rows.push({ id: `e${db.rows.length}`, player, board, at, used_at: null });

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
  it("is spent by a finished match and not by starting one", async () => {
    const db = fakeDb();
    give(db, ALICE, "lions", 1);
    expect(await sparEntries(db, ALICE, "lions")).toBe(1);
    expect(await spendEntry(db, ALICE, "lions", 9)).toBe(true);
    expect(await sparEntries(db, ALICE, "lions")).toBe(0);
  });

  it("cannot be spent twice", async () => {
    const db = fakeDb();
    give(db, ALICE, "lions", 1);
    expect(await spendEntry(db, ALICE, "lions", 9)).toBe(true);
    expect(await spendEntry(db, ALICE, "lions", 10)).toBe(false);
  });

  it("is not somebody else's", async () => {
    const db = fakeDb();
    give(db, ALICE, "lions", 1);
    expect(await sparEntries(db, BOB, "lions")).toBe(0);
    expect(await spendEntry(db, BOB, "lions", 9)).toBe(false);
  });

  it("is not for another board", async () => {
    const db = fakeDb();
    give(db, ALICE, "lions", 1);
    expect(await sparEntries(db, ALICE, "bot")).toBe(0);
  });

  it("goes oldest first", async () => {
    const db = fakeDb();
    give(db, ALICE, "lions", 5);
    give(db, ALICE, "lions", 1);
    await spendEntry(db, ALICE, "lions", 9);
    expect(db.rows.find((r) => r.at === 1)!.used_at).toBe(9);
    expect(db.rows.find((r) => r.at === 5)!.used_at).toBeNull();
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
