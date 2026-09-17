// The cumulative drop, on the TypeScript side.
//
// What is worth testing here is what would be wrong in a way nobody sees: a
// pool paid because nobody asked whether it was a pool, a total that goes down
// when somebody sells, a tree built over a table that was never filled in, and a
// proof that does not verify against the root published beside it.

import { readFileSync } from "node:fs";

import { afterEach, describe, expect, it, vi } from "vitest";

import { StandardMerkleTree } from "@openzeppelin/merkle-tree";

import { selector } from "@/lib/evm-tx";

import {
  DUST,
  HOLDER_CURSOR,
  LEAST_WORTH_SHARING,
  PUBLISH_DELAY,
  leavesOf,
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

interface Seeded {
  address: string;
  balance: bigint;
  entitlement?: bigint;
  isContract: boolean | null;
}

/** A fake holding the tables this touches, matched on the shape of the SQL. */
function fakeDb(seed?: {
  holders?: Seeded[];
  cursor?: number;
  /** A tree already live, so a run adopts nothing and proposes the next. */
  live?: { id: number; leaves: [string, string][] };
}): Database & { holders: Map<string, { balance: string; entitlement: string; code: number | null }>; trees: { root: string; promised: string }[]; leaves: Map<string, string> } {
  const holders = new Map(
    (seed?.holders ?? []).map((h) => [
      h.address,
      {
        balance: h.balance.toString(),
        entitlement: (h.entitlement ?? 0n).toString(),
        code: h.isContract === null ? null : h.isContract ? 1 : 0,
      },
    ]),
  );
  const cursors = new Map<string, number>(
    seed?.cursor === undefined ? [] : [[HOLDER_CURSOR, seed.cursor]],
  );
  const trees: { root: string; promised: string }[] = [];
  const leaves = new Map<string, string>();

  const db = {
    holders,
    trees,
    leaves,
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
          if (sql.includes("SELECT entitlement FROM holders")) {
            const row = holders.get(bound[0] as string);
            return (row ? { entitlement: row.entitlement } : null) as T | null;
          }
          if (sql.includes("INSERT INTO drop_trees")) {
            trees.push({ root: bound[0] as string, promised: bound[1] as string });
            return { id: trees.length } as T;
          }
          if (sql.includes("FROM drop_trees WHERE adopted_at IS NOT NULL")) {
            if (seed?.live === undefined) return null as T | null;
            return {
              id: seed.live.id,
              root: "0x" + "1".repeat(64),
              promised: "0",
              holders: seed.live.leaves.length,
              proposed_at: 0,
              live_at: 0,
              adopted_at: 1,
              tx_hash: "0x" + "2".repeat(64),
            } as T;
          }
          if (sql.includes("FROM drop_trees WHERE adopted_at IS NULL")) return null as T | null;
          throw new Error(`The fake was not asked for this: ${sql}`);
        },
        async all<T>() {
          if (sql.includes("is_contract = 0")) {
            return {
              results: [...holders]
                .filter(([, row]) => row.code === 0 && row.balance !== "0")
                .map(([address, row]) => ({
                  address,
                  balance: row.balance,
                  entitlement: row.entitlement,
                  is_contract: 0,
                })) as T[],
            };
          }
          if (sql.includes("entitlement <> '0'")) {
            return {
              results: [...holders]
                .filter(([, row]) => row.entitlement !== "0")
                .map(([address, row]) => ({
                  address,
                  balance: row.balance,
                  entitlement: row.entitlement,
                  is_contract: row.code,
                })) as T[],
            };
          }
          if (sql.includes("is_contract IS NULL")) {
            return {
              results: [...holders]
                .filter(([, row]) => row.code === null && row.balance !== "0")
                .slice(0, bound[0] as number)
                .map(([address]) => ({ address })) as T[],
            };
          }
          if (sql.includes("FROM drop_leaves")) {
            return {
              results: (seed?.live?.leaves ?? []).map(([address, amount]) => ({
                address,
                amount,
              })) as T[],
            };
          }
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
            holders.set(address, {
              balance,
              entitlement: had?.entitlement ?? "0",
              code: had?.code ?? null,
            });
            return null;
          }
          if (sql.includes("UPDATE holders SET entitlement")) {
            const [entitlement, , address] = bound as [string, number, string];
            const had = holders.get(address);
            if (had) holders.set(address, { ...had, entitlement });
            return null;
          }
          if (sql.includes("UPDATE holders SET is_contract")) {
            const [code, address] = bound as [number, string];
            const had = holders.get(address);
            if (had) holders.set(address, { ...had, code });
            return null;
          }
          if (sql.includes("INSERT INTO drop_leaves")) {
            leaves.set(bound[1] as string, bound[2] as string);
            return null;
          }
          if (sql.includes("UPDATE drop_trees SET adopted_at")) return null;
          throw new Error(`The fake was not asked for this: ${sql}`);
        },
      };
      return self;
    },
  };
  return db;
}

/** A chain that answers. */
function fakeChain(chain: { head: number; unpromised?: bigint; pendingAt?: number }) {
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
        return reply("0x");
      case "eth_call": {
        // Told apart by the selector, because this contract is asked two
        // different questions in one run and answering both with one number is
        // how a test passes while the job does the wrong thing.
        const data = (params[0] as { data: string }).data;
        if (data.startsWith(selector("pendingAt()"))) {
          return reply("0x" + (chain.pendingAt ?? 0).toString(16));
        }
        if (data.startsWith(selector("unpromised()"))) {
          return reply("0x" + (chain.unpromised ?? 0n).toString(16));
        }
        return reply("0x0");
      }
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

describe("sharing out what arrived", () => {
  it("gives each holder their share of the token, at this moment", () => {
    const shares = sharesOf(
      [
        { address: wallet(1), balance: tokens(750) },
        { address: wallet(2), balance: tokens(250) },
      ],
      tokens(100),
    );
    expect(shares.get(wallet(1))).toBe(tokens(75));
    expect(shares.get(wallet(2))).toBe(tokens(25));
  });

  it("divides by what the holders hold, not by the supply", () => {
    // The pool holds thirty-nine per cent of this token and is not a holder. If
    // the denominator were the supply, two fifths of every day would go
    // unshared forever — quietly, and looking exactly like a rounding.
    const shares = sharesOf([{ address: wallet(1), balance: tokens(1) }], tokens(100));
    expect(shares.get(wallet(1))).toBe(tokens(100));
  });

  it("never shares out more than arrived", () => {
    // Floored, so three thirds of ten comes to nine. The remainder stays
    // unpromised in the contract and goes into the next day.
    const holders = [1, 2, 3].map((n) => ({ address: wallet(n), balance: tokens(1) }));
    const shares = sharesOf(holders, 10n);
    const given = [...shares.values()].reduce((sum, share) => sum + share, 0n);
    expect(given).toBeLessThanOrEqual(10n);
  });

  it("gives nothing to nobody", () => {
    expect(sharesOf([], tokens(100)).size).toBe(0);
    expect(sharesOf([{ address: wallet(1), balance: tokens(1) }], 0n).size).toBe(0);
  });
});

describe("the tree", () => {
  it("holds everyone who has ever earned, whatever they hold now", () => {
    // Somebody who sold keeps what they earned while they held it. Dropping
    // them would take back money they were told was theirs — and would make the
    // cumulative total go down, which the contract refuses outright.
    const leaves = leavesOf([
      { address: wallet(1), entitlement: tokens(5) },
      { address: wallet(2), entitlement: tokens(3) },
    ]);
    expect(leaves).toHaveLength(2);
  });

  it("leaves out an entitlement too small to be worth the gas to claim", () => {
    // Left out of the tree, not dropped: the row keeps growing and the holder is
    // in the tree the day it crosses the line. Under the old per-round design a
    // small holder fell under the dust line every round and never accumulated.
    const leaves = leavesOf([
      { address: wallet(1), entitlement: tokens(5) },
      { address: wallet(2), entitlement: DUST - 1n },
    ]);
    expect(leaves.map(([address]) => address)).toEqual([wallet(1)]);
  });

  it("is the same tree for the same holders, whatever order they arrive in", () => {
    // The proof is rebuilt from rows later rather than stored, so the tree has
    // to be a function of the holders and not of the order a query returned.
    const holders = [3, 1, 2].map((n) => ({ address: wallet(n), entitlement: tokens(n) }));
    expect(treeOf(leavesOf(holders)).root).toBe(
      treeOf(leavesOf([...holders].reverse())).root,
    );
  });

  it("makes a proof that verifies against its own root", () => {
    // The whole mechanism in one assertion: the root goes on chain, the proof is
    // rebuilt from rows in a database, and the contract checks one against the
    // other. Verified with the same library the contract's MerkleProof matches.
    const tree = treeOf(
      leavesOf([1, 2, 3, 4, 5].map((n) => ({ address: wallet(n), entitlement: tokens(n * 100) }))),
    );

    for (const [i, leaf] of tree.entries()) {
      const proof = tree.getProof(i);
      expect(StandardMerkleTree.verify(tree.root, ["address", "uint256"], leaf, proof)).toBe(true);
      const other = i === 0 ? 1 : 0;
      expect(
        StandardMerkleTree.verify(tree.root, ["address", "uint256"], tree.at(other)!, proof),
      ).toBe(false);
    }
  });

  it("only ever grows, which is what the contract requires", () => {
    // A cumulative total that fell would be refused on chain with
    // PromisesLessThanBefore. It can only fall if an entitlement falls, and the
    // only thing that writes them adds.
    const before = leavesOf([{ address: wallet(1), entitlement: tokens(5) }]);
    const after = leavesOf([
      { address: wallet(1), entitlement: tokens(5) },
      { address: wallet(2), entitlement: tokens(2) },
    ]);
    const sum = (leaves: [string, string][]) =>
      leaves.reduce((total, [, amount]) => total + BigInt(amount), 0n);
    expect(sum(after)).toBeGreaterThan(sum(before));
  });
});

describe("the delay", () => {
  it("is the same here as in the contract", () => {
    // Two files holding one number. lib/holders.ts only uses it to say when a
    // tree is expected to go live; the chain is what enforces it, and a
    // disagreement would be a page promising a day that is not the day.
    const source = readFileSync(
      new URL("../contracts/HolderDrop.sol", import.meta.url),
      "utf8",
    );
    const found = source.match(/PUBLISH_DELAY\s*=\s*(\d+)\s*hours\s*;/);
    expect(found, "PUBLISH_DELAY is not in the contract").toBeTruthy();
    expect(Number(found![1]) * 60 * 60 * 1000).toBe(PUBLISH_DELAY);
  });
});

describe("before there is a snapshot", () => {
  it("refuses to publish rather than paying whoever moved some lately", async () => {
    // The trap this closes: starting the cursor at the head gives a table of
    // whoever has transacted since, which looks like a holder list and is not
    // one — and a tree built on it pays a handful of people everybody's share.
    await withDrop(async () => {
      const asked = fakeChain({ head: 1_000_000, unpromised: tokens(100_000) });
      const ran = await runHolders(fakeDb(), { publisherKey: KEY }, 0);

      expect(ran.proposed).toBeNull();
      expect(ran.why).toMatch(/no holder snapshot/i);
      expect(asked.filter((one) => one.method === "eth_sendRawTransaction")).toHaveLength(0);
    });
  });
});

describe("who a day is shared between", () => {
  it("leaves out anything with code on it, pool included", async () => {
    await withDrop(async () => {
      const db = fakeDb({
        cursor: 1_000_000,
        holders: [
          { address: wallet(1), balance: tokens(100), isContract: false },
          { address: POOL, balance: tokens(900), isContract: true },
        ],
      });
      fakeChain({ head: 1_000_000, unpromised: tokens(100_000) });
      const ran = await runHolders(db, { publisherKey: KEY }, 0);

      expect(ran.proposed).not.toBeNull();
      expect(ran.holders).toBe(1);
      // And the one holder earned the whole day rather than a tenth of it: the
      // pool is not in the denominator either.
      expect(BigInt(db.holders.get(wallet(1))!.entitlement)).toBe(tokens(100_000));
      expect(db.holders.get(POOL)!.entitlement).toBe("0");
    });
  });

  it("waits rather than spending gas on a tree over nothing", async () => {
    await withDrop(async () => {
      const db = fakeDb({
        cursor: 1_000_000,
        holders: [{ address: wallet(1), balance: tokens(100), isContract: false }],
      });
      const asked = fakeChain({ head: 1_000_000, unpromised: LEAST_WORTH_SHARING - 1n });
      const ran = await runHolders(db, { publisherKey: KEY }, 0);

      expect(ran.proposed).toBeNull();
      expect(ran.why).toMatch(/not worth a tree/i);
      expect(asked.filter((one) => one.method === "eth_sendRawTransaction")).toHaveLength(0);
    });
  });

  it("does not propose on top of a tree that is still waiting", async () => {
    // The contract takes one pending root at a time, so a second propose would
    // revert — and the entitlements would already have been written, which is
    // the half of the job that has no transaction to roll back.
    await withDrop(async () => {
      const db = fakeDb({
        cursor: 1_000_000,
        holders: [{ address: wallet(1), balance: tokens(100), isContract: false }],
      });
      const now = Date.parse("2026-09-18T00:10:00Z");
      const asked = fakeChain({
        head: 1_000_000,
        unpromised: tokens(100_000),
        pendingAt: Math.floor((now + 3_600_000) / 1000),
      });
      const ran = await runHolders(db, { publisherKey: KEY }, now);

      expect(ran.proposed).toBeNull();
      expect(ran.why).toMatch(/waiting until/i);
      expect(asked.filter((one) => one.method === "eth_sendRawTransaction")).toHaveLength(0);
      expect(db.holders.get(wallet(1))!.entitlement).toBe("0");
    });
  });

  it("adopts what has waited, then publishes what has accrued since", async () => {
    await withDrop(async () => {
      const db = fakeDb({
        cursor: 1_000_000,
        holders: [{ address: wallet(1), balance: tokens(100), isContract: false }],
      });
      const now = Date.parse("2026-09-18T00:10:00Z");
      const asked = fakeChain({
        head: 1_000_000,
        unpromised: tokens(100_000),
        pendingAt: Math.floor((now - 3_600_000) / 1000),
      });
      const ran = await runHolders(db, { publisherKey: KEY }, now);

      expect(ran.adopted).not.toBeNull();
      expect(ran.proposed).not.toBeNull();
      // Two transactions: the adopt and the propose, in that order.
      expect(asked.filter((one) => one.method === "eth_sendRawTransaction")).toHaveLength(2);
    });
  });
});

describe("what somebody has already earned", () => {
  it("is added to and never replaced", async () => {
    await withDrop(async () => {
      const db = fakeDb({
        cursor: 1_000_000,
        holders: [
          { address: wallet(1), balance: tokens(100), entitlement: tokens(7), isContract: false },
        ],
      });
      fakeChain({ head: 1_000_000, unpromised: tokens(1_000) });
      await runHolders(db, { publisherKey: KEY }, 0);

      expect(BigInt(db.holders.get(wallet(1))!.entitlement)).toBe(tokens(1_007));
    });
  });
});
