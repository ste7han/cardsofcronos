// The round that pays the holders.
//
// What is worth testing here is what would be wrong in a way nobody sees: a tree
// that promises more than the round holds, a pool paid because nobody asked
// whether it was a pool, a proof that does not verify against the root it was
// built beside, and a round opened over a table that was never filled in.

import { afterEach, describe, expect, it, vi } from "vitest";

import { StandardMerkleTree } from "@openzeppelin/merkle-tree";

import {
  BETWEEN_ROUNDS,
  DUST,
  HOLDER_CURSOR,
  LEAST_WORTH_SHARING,
  roundFor,
  runHolders,
  sharesOf,
  treeOf,
} from "@/lib/holders";
import { CONTRACTS, POOL } from "@/lib/revenue";
import type { Database, Statement } from "@/lib/store";

const DROP = "0x" + "d".repeat(40);
const KEY = "0x" + "11".repeat(32);

const wallet = (n: number) => "0x" + n.toString(16).padStart(40, "0");
const tokens = (n: number) => BigInt(n) * 10n ** 18n;

/** A fake holding the two tables this touches, matched on the shape of the SQL. */
function fakeDb(seed?: {
  holders?: { address: string; balance: bigint; isContract: boolean | null }[];
  cursor?: number;
  rounds?: { round: number; openedAt: number }[];
}): Database & { entries: Map<string, string>; opened: number[] } {
  const holders = new Map(
    (seed?.holders ?? []).map((h) => [
      h.address,
      { balance: h.balance.toString(), is_contract: h.isContract === null ? null : h.isContract ? 1 : 0 },
    ]),
  );
  const cursors = new Map<string, number>(seed?.cursor === undefined ? [] : [[HOLDER_CURSOR, seed.cursor]]);
  const rounds = [...(seed?.rounds ?? [])];
  const entries = new Map<string, string>();
  const opened: number[] = [];

  const db = {
    entries,
    opened,
    prepare(sql: string): Statement {
      let bound: unknown[] = [];
      const self: Statement = {
        bind(...values: unknown[]) {
          bound = values;
          return self;
        },
        async first<T>() {
          if (sql.includes("SELECT block FROM cursors")) {
            const at = cursors.get(bound[0] as string);
            return (at === undefined ? null : { block: at }) as T | null;
          }
          if (sql.includes("SELECT balance FROM holders")) {
            const row = holders.get(bound[0] as string);
            return (row ? { balance: row.balance } : null) as T | null;
          }
          throw new Error(`The fake was not asked for this: ${sql}`);
        },
        async all<T>() {
          if (sql.includes("is_contract = 0")) {
            return {
              results: [...holders]
                .filter(([, row]) => row.is_contract === 0 && row.balance !== "0")
                .map(([address, row]) => ({ address, balance: row.balance, is_contract: 0 })) as T[],
            };
          }
          if (sql.includes("is_contract IS NULL")) {
            return {
              results: [...holders]
                .filter(([, row]) => row.is_contract === null && row.balance !== "0")
                .slice(0, bound[0] as number)
                .map(([address]) => ({ address })) as T[],
            };
          }
          if (sql.includes("FROM drop_rounds")) {
            return {
              results: [...rounds]
                .sort((a, b) => b.round - a.round)
                .slice(0, bound[0] as number)
                .map((r) => ({
                  round: r.round,
                  root: "0x" + "1".repeat(64),
                  promised: "0",
                  holders: 0,
                  tx_hash: "0x" + "2".repeat(64),
                  opened_at: r.openedAt,
                })) as T[],
            };
          }
          if (sql.includes("FROM drop_entries")) return { results: [] as T[] };
          throw new Error(`The fake was not asked for this: ${sql}`);
        },
        async run() {
          if (sql.includes("INSERT INTO cursors")) {
            const [name, block] = bound as [string, number];
            cursors.set(name, Math.max(cursors.get(name) ?? 0, block));
            return null;
          }
          if (sql.includes("INSERT INTO holders")) {
            const [address, balance] = bound as [string, string];
            const had = holders.get(address);
            holders.set(address, { balance, is_contract: had?.is_contract ?? null });
            return null;
          }
          if (sql.includes("UPDATE holders SET is_contract")) {
            const [isContract, address] = bound as [number, string];
            const had = holders.get(address);
            if (had) holders.set(address, { ...had, is_contract: isContract });
            return null;
          }
          if (sql.includes("INSERT INTO drop_entries")) {
            entries.set(`${bound[0]}:${bound[1]}`, bound[2] as string);
            return null;
          }
          if (sql.includes("INSERT INTO drop_rounds")) {
            opened.push(bound[0] as number);
            rounds.push({ round: bound[0] as number, openedAt: bound[5] as number });
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

/** A chain that answers. `free` is what the drop has unallocated. */
function fakeChain(chain: { head: number; free?: bigint; code?: Record<string, string> }) {
  const asked: { method: string; params: unknown[] }[] = [];

  vi.stubGlobal("fetch", async (_url: string, init: { body: string }) => {
    const { method, params } = JSON.parse(init.body) as { method: string; params: unknown[] };
    asked.push({ method, params });

    const reply = (result: unknown) =>
      new Response(JSON.stringify({ jsonrpc: "2.0", id: 1, result }), {
        headers: { "content-type": "application/json" },
      });

    switch (method) {
      case "eth_blockNumber":
        return reply("0x" + chain.head.toString(16));
      case "eth_getLogs":
        return reply([]);
      case "eth_getCode":
        return reply(chain.code?.[(params[0] as string).toLowerCase()] ?? "0x");
      case "eth_call":
        return reply("0x" + (chain.free ?? 0n).toString(16));
      case "eth_getTransactionCount":
        return reply("0x1");
      case "eth_gasPrice":
        return reply("0x" + (5_000_000_000_000).toString(16));
      case "eth_estimateGas":
        return reply("0x" + (300_000).toString(16));
      case "eth_sendRawTransaction":
        return reply("0x" + "ab".repeat(32));
      default:
        throw new Error(`The fake chain was not asked for this: ${method}`);
    }
  });

  return asked;
}

async function withDrop<T>(run: () => Promise<T>): Promise<T> {
  const had = CONTRACTS.drop;
  CONTRACTS.drop = DROP;
  try {
    return await run();
  } finally {
    CONTRACTS.drop = had;
  }
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("what each holder is owed", () => {
  it("is their share of the supply that is being paid", () => {
    const shares = sharesOf(
      [
        { address: wallet(1), balance: tokens(750) },
        { address: wallet(2), balance: tokens(250) },
      ],
      tokens(100),
    );
    expect(Object.fromEntries(shares)).toEqual({
      [wallet(1)]: tokens(75).toString(),
      [wallet(2)]: tokens(25).toString(),
    });
  });

  it("never promises more than the round holds", () => {
    // Floored, so the tree comes out a few wei under. Over is the one that
    // matters: the contract refuses a claim that would take more than the round
    // has, so an over-promising tree pays the first holders and fails the last.
    // Three thirds of ten is the smallest case where flooring has to happen.
    const holders = [1, 2, 3].map((n) => ({ address: wallet(n), balance: tokens(1) }));
    const total = 10n;
    const shares = sharesOf(holders, total);
    const promised = shares.reduce((sum, [, share]) => sum + BigInt(share), 0n);
    expect(promised).toBeLessThanOrEqual(total);
  });

  it("leaves out shares too small to be worth the gas to take", () => {
    // One holder with almost everything and one with a sliver. The sliver's
    // share is under the dust line: putting it in the tree hands somebody a
    // share that costs more to claim than it is worth.
    const shares = sharesOf(
      [
        { address: wallet(1), balance: tokens(1_000_000) },
        { address: wallet(2), balance: 1n },
      ],
      tokens(10),
    );
    expect(shares).toHaveLength(1);
    expect(shares[0]![0]).toBe(wallet(1));
    for (const [, share] of shares) expect(BigInt(share)).toBeGreaterThanOrEqual(DUST);
  });

  it("is the same tree for the same holders, whatever order they arrive in", () => {
    // The proof is rebuilt from rows later rather than stored, so the tree has
    // to be a function of the holders and not of the order a query returned.
    const holders = [3, 1, 2].map((n) => ({ address: wallet(n), balance: tokens(n) }));
    const forwards = treeOf(sharesOf(holders, tokens(100)));
    const backwards = treeOf(sharesOf([...holders].reverse(), tokens(100)));
    expect(forwards.root).toBe(backwards.root);
  });

  it("makes a proof that verifies against its own root", () => {
    // The whole mechanism in one assertion: the root goes on chain, the proof is
    // rebuilt from rows in a database, and the contract checks one against the
    // other. Verified with the same library the contract's MerkleProof matches.
    const shares = sharesOf(
      [1, 2, 3, 4, 5].map((n) => ({ address: wallet(n), balance: tokens(n * 100) })),
      tokens(1000),
    );
    const tree = treeOf(shares);

    for (const [i, leaf] of tree.entries()) {
      const proof = tree.getProof(i);
      expect(StandardMerkleTree.verify(tree.root, ["address", "uint256"], leaf, proof)).toBe(true);
      // And a proof for somebody else's leaf does not.
      const other = i === 0 ? 1 : 0;
      expect(
        StandardMerkleTree.verify(tree.root, ["address", "uint256"], tree.at(other)!, proof),
      ).toBe(false);
    }
  });
});

describe("which round it is", () => {
  it("reads as the date in UTC", () => {
    expect(roundFor(Date.parse("2026-09-18T00:10:00Z"))).toBe(20_260_918);
    expect(roundFor(Date.parse("2027-01-01T23:59:00Z"))).toBe(20_270_101);
  });

  it("is a different number on a different day", () => {
    const monday = Date.parse("2026-09-21T00:10:00Z");
    expect(roundFor(monday)).not.toBe(roundFor(monday + 86_400_000));
  });
});

describe("before there is a snapshot", () => {
  it("refuses to open a round rather than paying whoever moved some lately", () => {
    // The trap this closes: starting the cursor at the head gives a table of
    // whoever has transacted since, which looks like a holder list and is not
    // one — and a round built on it pays a handful of people everybody's share.
    return withDrop(async () => {
      const asked = fakeChain({ head: 1_000_000, free: tokens(100_000) });
      const ran = await runHolders(fakeDb(), { publisherKey: KEY }, 0);

      expect(ran.round).toBeNull();
      expect(ran.why).toMatch(/no holder snapshot/i);
      expect(asked.filter((one) => one.method === "eth_sendRawTransaction")).toHaveLength(0);
    });
  });
});

describe("who ends up in a round", () => {
  it("leaves out anything with code on it, pool included", async () => {
    await withDrop(async () => {
      const db = fakeDb({
        cursor: 1_000_000,
        holders: [
          { address: wallet(1), balance: tokens(100), isContract: false },
          { address: POOL, balance: tokens(900), isContract: true },
        ],
      });
      fakeChain({ head: 1_000_000, free: tokens(100_000) });
      const ran = await runHolders(db, { publisherKey: KEY }, 0);

      expect(ran.round).not.toBeNull();
      expect(ran.paid).toBe(1);
      // And the one holder took the whole round rather than a tenth of it: the
      // pool is not in the denominator either.
      const written = [...db.entries.values()];
      expect(written).toHaveLength(1);
      expect(BigInt(written[0]!)).toBeGreaterThan(tokens(99_000));
    });
  });

  it("leaves out anything nobody has asked about yet", async () => {
    // Unknown is not paid. Leaving somebody out costs them one round and they
    // are in the next; paying a pool cannot be undone.
    await withDrop(async () => {
      const db = fakeDb({
        cursor: 1_000_000,
        holders: [
          { address: wallet(1), balance: tokens(100), isContract: false },
          { address: wallet(2), balance: tokens(100), isContract: null },
        ],
      });
      // eth_getCode answers "0x" for wallet(2), so it becomes known this run —
      // but the round is built from what was known when it was built.
      fakeChain({ head: 1_000_000, free: tokens(100_000) });
      const ran = await runHolders(db, { publisherKey: KEY }, 0);
      expect(ran.checked).toBe(1);
      expect(ran.paid).toBe(2);
    });
  });
});

describe("how often a round opens", () => {
  it("is weekly, so a holder is not asked to claim ninety times", async () => {
    await withDrop(async () => {
      const now = Date.parse("2026-09-18T00:10:00Z");
      const db = fakeDb({
        cursor: 1_000_000,
        holders: [{ address: wallet(1), balance: tokens(100), isContract: false }],
        rounds: [{ round: 20_260_915, openedAt: now - 3 * 86_400_000 }],
      });
      const asked = fakeChain({ head: 1_000_000, free: tokens(100_000) });
      const ran = await runHolders(db, { publisherKey: KEY }, now);

      expect(ran.round).toBeNull();
      expect(ran.why).toMatch(/less than a week/i);
      expect(asked.filter((one) => one.method === "eth_sendRawTransaction")).toHaveLength(0);
    });
  });

  it("opens once the week is up", async () => {
    await withDrop(async () => {
      const now = Date.parse("2026-09-18T00:10:00Z");
      const db = fakeDb({
        cursor: 1_000_000,
        holders: [{ address: wallet(1), balance: tokens(100), isContract: false }],
        rounds: [{ round: 20_260_910, openedAt: now - BETWEEN_ROUNDS - 1 }],
      });
      fakeChain({ head: 1_000_000, free: tokens(100_000) });
      const ran = await runHolders(db, { publisherKey: KEY }, now);

      expect(ran.round).toBe(20_260_918);
      expect(db.opened).toEqual([20_260_918]);
    });
  });

  it("waits rather than spending gas on a round of dust", async () => {
    await withDrop(async () => {
      const db = fakeDb({
        cursor: 1_000_000,
        holders: [{ address: wallet(1), balance: tokens(100), isContract: false }],
      });
      const asked = fakeChain({ head: 1_000_000, free: LEAST_WORTH_SHARING - 1n });
      const ran = await runHolders(db, { publisherKey: KEY }, 0);

      expect(ran.round).toBeNull();
      expect(ran.why).toMatch(/not worth a round/i);
      expect(asked.filter((one) => one.method === "eth_sendRawTransaction")).toHaveLength(0);
    });
  });
});
