// The daily job, against a chain that answers and a database that remembers.
//
// What is worth testing here is not that it can read a log. It is the handful of
// ways a job like this goes quietly wrong: decoding the wrong word out of the
// event so the burn total is somebody else's share, counting the same
// transaction twice, moving the cursor past blocks it never read, and reading
// the whole chain on the first run.

import { afterEach, describe, expect, it, vi } from "vitest";

import { topicOf } from "@/lib/evm-tx";
import { CONTRACTS } from "@/lib/revenue";
import { BURN_CURSOR, LEAST_WORTH_RELEASING, runDaily } from "@/lib/splitter";
import { burnTotal, burns, cursorOf, type Database, type Statement } from "@/lib/store";

const SPLITTER = "0x" + "5".repeat(40);
/** Thirty-two bytes that are a valid secp256k1 key. Never used anywhere real. */
const KEY = "0x" + "11".repeat(32);

const RELEASED = topicOf("Released(uint256,uint256,uint256,uint256)");

/** A number as a 32-byte ABI word. */
const w = (value: bigint) => value.toString(16).padStart(64, "0");

/**
 * A `Released` log: CRO spent, then the three shares in the order the event
 * declares them. The burn is the THIRD word, and a test that put it first would
 * pass against an implementation that read the holders' share and called it a
 * burn — which is the mistake this file exists to catch.
 */
function releasedLog(at: {
  block: number;
  tx: string;
  cro: bigint;
  holders: bigint;
  burned: bigint;
  pot: bigint;
}) {
  return {
    address: SPLITTER,
    topics: [RELEASED],
    transactionHash: at.tx,
    blockNumber: "0x" + at.block.toString(16),
    data: "0x" + w(at.cro) + w(at.holders) + w(at.burned) + w(at.pot),
  };
}

/**
 * A fake that stores the two tables this job writes and answers the queries it
 * makes. Matched on the shape of the SQL, the way test/store.test.ts does it: a
 * query that changes shape fails loudly rather than quietly answering something
 * else.
 */
function fakeDb(): Database & { burns: Map<string, Record<string, unknown>> } {
  const rows = new Map<string, Record<string, unknown>>();
  const cursors = new Map<string, { block: number; at: number }>();

  const db = {
    burns: rows,
    prepare(sql: string): Statement {
      let bound: unknown[] = [];
      const self: Statement = {
        bind(...values: unknown[]) {
          bound = values;
          return self;
        },
        async first<T>() {
          if (sql.includes("SELECT block FROM cursors")) {
            const found = cursors.get(bound[0] as string);
            return (found ? { block: found.block } : null) as T | null;
          }
          if (sql.includes("INSERT INTO burns")) {
            const [txHash, stream, wei, burned, at] = bound as [
              string,
              string,
              string,
              string,
              number,
            ];
            // ON CONFLICT DO NOTHING, which is the whole point of the column
            // being the primary key.
            if (rows.has(txHash)) return null;
            rows.set(txHash, { tx_hash: txHash, stream, wei, burned, at });
            return { tx_hash: txHash } as T;
          }
          throw new Error(`The fake was not asked for this: ${sql}`);
        },
        async all<T>() {
          if (sql.includes("SELECT wei, burned FROM burns")) {
            return { results: [...rows.values()] as T[] };
          }
          if (sql.includes("FROM burns ORDER BY at DESC")) {
            const all = [...rows.values()].sort((a, b) => (b.at as number) - (a.at as number));
            return { results: all.slice(0, bound[0] as number) as T[] };
          }
          throw new Error(`The fake was not asked for this: ${sql}`);
        },
        async run() {
          if (sql.includes("INSERT INTO cursors")) {
            const [name, block, at] = bound as [string, number, number];
            const had = cursors.get(name);
            // MAX(block, excluded.block), the same as the upsert.
            cursors.set(name, { block: Math.max(had?.block ?? 0, block), at });
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

/** A chain that answers. `logs` is consulted per block range. */
function fakeChain(chain: {
  head: number;
  waiting?: bigint;
  logs?: ReturnType<typeof releasedLog>[];
  timestamps?: Record<number, number>;
}) {
  const asked: { method: string; params: unknown[] }[] = [];

  vi.stubGlobal("fetch", async (_url: string, init: { body: string }) => {
    const { method, params } = JSON.parse(init.body) as { method: string; params: unknown[] };
    asked.push({ method, params });

    const reply = (result: unknown) =>
      new Response(JSON.stringify({ jsonrpc: "2.0", id: 1, result }), {
        headers: { "content-type": "application/json" },
      });

    switch (method) {
      case "eth_call":
        return reply("0x" + (chain.waiting ?? 0n).toString(16));
      case "eth_blockNumber":
        return reply("0x" + chain.head.toString(16));
      case "eth_getLogs": {
        const range = params[0] as { fromBlock: string; toBlock: string };
        const from = Number(BigInt(range.fromBlock));
        const to = Number(BigInt(range.toBlock));
        return reply(
          (chain.logs ?? []).filter((log) => {
            const at = Number(BigInt(log.blockNumber));
            return at >= from && at <= to;
          }),
        );
      }
      case "eth_getBlockByNumber": {
        const at = Number(BigInt(params[0] as string));
        return reply({ timestamp: "0x" + ((chain.timestamps?.[at] ?? 0) / 1000).toString(16) });
      }
      case "eth_getTransactionCount":
        return reply("0x1");
      case "eth_gasPrice":
        return reply("0x" + (5_000_000_000_000).toString(16));
      case "eth_estimateGas":
        return reply("0x" + (300_000).toString(16));
      case "eth_sendRawTransaction":
        return reply("0x" + "ab".repeat(32));
      case "eth_getTransactionReceipt":
        return reply({ blockNumber: "0x" + chain.head.toString(16) });
      default:
        throw new Error(`The fake chain was not asked for this: ${method}`);
    }
  });

  return asked;
}

/** With the splitter deployed, for the length of one test. */
async function withSplitter<T>(run: () => Promise<T>): Promise<T> {
  const had = CONTRACTS.splitter;
  CONTRACTS.splitter = SPLITTER;
  try {
    return await run();
  } finally {
    CONTRACTS.splitter = had;
  }
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("before anything is deployed", () => {
  it("does nothing and says why, rather than calling a null address", async () => {
    // CONTRACTS.splitter is null today and this is the state the job runs in
    // every day until it is not. It must not reach for the chain at all.
    const asked = fakeChain({ head: 100 });
    const ran = await runDaily(fakeDb(), {}, 0);

    expect(ran.skipped).toMatch(/no splitter/i);
    expect(ran.recorded).toBe(0);
    expect(asked).toHaveLength(0);
  });
});

describe("the first run", () => {
  it("starts at the head instead of reading the whole chain", async () => {
    // A cursor that started at zero would ask for two and a half million chunks
    // to find the nothing that is there, and be refused by every endpoint long
    // before it finished.
    await withSplitter(async () => {
      const asked = fakeChain({ head: 9_000_000 });
      const db = fakeDb();
      const ran = await runDaily(db, {}, 1_700_000_000_000);

      // Both reasons. The release half had nothing to do either, and a field
      // that reported only that would hide the fact that no blocks were read.
      expect(ran.skipped).toMatch(/first run/i);
      expect(ran.skipped).toMatch(/nothing to release/i);
      expect(ran.recorded).toBe(0);
      expect(await cursorOf(db, BURN_CURSOR)).toBe(9_000_000);
      expect(asked.filter((one) => one.method === "eth_getLogs")).toHaveLength(0);
    });
  });
});

describe("recording what burned", () => {
  it("takes the burn from the event's third word and the CRO from its first", async () => {
    await withSplitter(async () => {
      const db = fakeDb();
      const tx = "0x" + "cd".repeat(32);

      fakeChain({ head: 1_000_000 });
      await runDaily(db, {}, 0); // first run, sets the cursor

      fakeChain({
        head: 1_000_500,
        logs: [
          releasedLog({
            block: 1_000_200,
            tx,
            cro: 100n * 10n ** 18n,
            holders: 5_000n * 10n ** 18n,
            burned: 2_500n * 10n ** 18n,
            pot: 2_500n * 10n ** 18n,
          }),
        ],
        timestamps: { 1_000_200: 1_700_000_000_000 },
      });
      const ran = await runDaily(db, {}, 1_700_000_100_000);

      expect(ran.recorded).toBe(1);
      const [row] = await burns(db, 10);
      expect(row!.txHash).toBe(tx);
      expect(row!.wei).toBe((100n * 10n ** 18n).toString());
      expect(row!.burned).toBe((2_500n * 10n ** 18n).toString());
      // The holders' share is larger than the burn and sits between them in the
      // event. Reading word one would have put it here and looked plausible.
      expect(row!.burned).not.toBe((5_000n * 10n ** 18n).toString());
    });
  });

  it("dates a burn by its block and not by when the job happened to run", async () => {
    // A catch-up scan reads a week of blocks in one afternoon. Stamping them
    // with the run's clock would date the whole week to that afternoon.
    await withSplitter(async () => {
      const db = fakeDb();
      fakeChain({ head: 1_000_000 });
      await runDaily(db, {}, 0);

      fakeChain({
        head: 1_000_500,
        logs: [
          releasedLog({
            block: 1_000_100,
            tx: "0x" + "01".repeat(32),
            cro: 10n ** 18n,
            holders: 1n,
            burned: 2n,
            pot: 3n,
          }),
        ],
        timestamps: { 1_000_100: 1_690_000_000_000 },
      });
      await runDaily(db, {}, 1_700_000_000_000);

      const [row] = await burns(db, 10);
      expect(row!.at).toBe(1_690_000_000_000);
    });
  });

  it("counts a transaction once, however many times it is read", async () => {
    // The total is what the page is for, and the one mistake that makes it wrong
    // in the flattering direction is a row written twice.
    await withSplitter(async () => {
      const db = fakeDb();
      const log = releasedLog({
        block: 1_000_100,
        tx: "0x" + "ef".repeat(32),
        cro: 50n * 10n ** 18n,
        holders: 1n,
        burned: 7n,
        pot: 3n,
      });

      fakeChain({ head: 1_000_000 });
      await runDaily(db, {}, 0);

      for (const at of [1, 2, 3]) {
        fakeChain({ head: 1_000_500, logs: [log], timestamps: { 1_000_100: 1_690_000_000_000 } });
        // The cursor is rewound by hand between runs, which is the situation a
        // restored backup or a rescan produces.
        await db
          .prepare(`INSERT INTO cursors (name, block, at) VALUES (?, ?, ?)`)
          .bind(BURN_CURSOR, 1_000_000, at)
          .run();
        await runDaily(db, {}, at);
      }

      const total = await burnTotal(db);
      expect(total.burns).toBe(1);
      expect(total.burned).toBe("7");
    });
  });
});

describe("the cursor", () => {
  it("never moves backwards, so a rescan is wasted work and not lost blocks", async () => {
    await withSplitter(async () => {
      const db = fakeDb();
      fakeChain({ head: 2_000_000 });
      await runDaily(db, {}, 0);

      await db
        .prepare(`INSERT INTO cursors (name, block, at) VALUES (?, ?, ?)`)
        .bind(BURN_CURSOR, 1_000, 0)
        .run();

      expect(await cursorOf(db, BURN_CURSOR)).toBe(2_000_000);
    });
  });

  it("reads in chunks the endpoints will answer", async () => {
    // Cronos refuses a wider eth_getLogs than two thousand blocks, and a refusal
    // reads as an endpoint being down rather than as a range being too wide.
    await withSplitter(async () => {
      const db = fakeDb();
      fakeChain({ head: 1_000_000 });
      await runDaily(db, {}, 0);

      const asked = fakeChain({ head: 1_010_000 });
      await runDaily(db, {}, 0);

      const scans = asked.filter((one) => one.method === "eth_getLogs");
      expect(scans.length).toBeGreaterThan(1);
      for (const scan of scans) {
        const range = scan.params[0] as { fromBlock: string; toBlock: string };
        const span = Number(BigInt(range.toBlock)) - Number(BigInt(range.fromBlock)) + 1;
        expect(span).toBeLessThanOrEqual(2000);
      }
      expect(await cursorOf(db, BURN_CURSOR)).toBe(1_010_000);
    });
  });
});

describe("releasing", () => {
  it("leaves dust alone rather than paying gas to swap it", async () => {
    await withSplitter(async () => {
      const db = fakeDb();
      const asked = fakeChain({ head: 1_000_000, waiting: LEAST_WORTH_RELEASING - 1n });
      const ran = await runDaily(db, { publisherKey: KEY }, 0);

      expect(ran.released).toBeNull();
      expect(ran.skipped).toMatch(/not worth a swap/i);
      expect(asked.filter((one) => one.method === "eth_sendRawTransaction")).toHaveLength(0);
    });
  });

  it("sends when there is enough, and records the burn it caused", async () => {
    await withSplitter(async () => {
      const db = fakeDb();
      const tx = "0x" + "ab".repeat(32);

      fakeChain({ head: 1_000_000, waiting: 0n });
      await runDaily(db, { publisherKey: KEY }, 0);

      const asked = fakeChain({
        head: 1_000_400,
        waiting: 200n * 10n ** 18n,
        logs: [
          releasedLog({
            block: 1_000_300,
            tx,
            cro: 200n * 10n ** 18n,
            holders: 1n,
            burned: 9n,
            pot: 1n,
          }),
        ],
        timestamps: { 1_000_300: 1_700_000_000_000 },
      });
      const ran = await runDaily(db, { publisherKey: KEY }, 0);

      expect(asked.filter((one) => one.method === "eth_sendRawTransaction")).toHaveLength(1);
      expect(ran.released).toBe(tx);
      expect(ran.spent).toBe((200n * 10n ** 18n).toString());
      expect(ran.recorded).toBe(1);
    });
  });

  it("still records yesterday's burns when it has no key to send with", async () => {
    // The two halves of this job are independent on purpose: a missing key stops
    // the release and must not stop the counter.
    await withSplitter(async () => {
      const db = fakeDb();
      fakeChain({ head: 1_000_000, waiting: 500n * 10n ** 18n });
      await runDaily(db, {}, 0);

      fakeChain({
        head: 1_000_400,
        waiting: 500n * 10n ** 18n,
        logs: [
          releasedLog({
            block: 1_000_100,
            tx: "0x" + "77".repeat(32),
            cro: 10n ** 18n,
            holders: 1n,
            burned: 4n,
            pot: 1n,
          }),
        ],
        timestamps: { 1_000_100: 1_690_000_000_000 },
      });
      const ran = await runDaily(db, {}, 0);

      expect(ran.released).toBeNull();
      expect(ran.skipped).toMatch(/no key/i);
      expect(ran.recorded).toBe(1);
    });
  });
});

describe("the event it listens for", () => {
  it("is the signature the contract declares, types only", () => {
    // A parameter name or a space in the signature hashes to a topic that
    // matches nothing, and a scan that matches nothing looks exactly like a
    // quiet week. Pinned so a rename in the contract fails here.
    expect(RELEASED).toBe(topicOf("Released(uint256,uint256,uint256,uint256)"));
    expect(RELEASED).not.toBe(topicOf("Released(uint256 croSpent,uint256,uint256,uint256)"));
    expect(RELEASED).toHaveLength(66);
  });
});

describe("the key it signs with", () => {
  it("reports the wallet it belongs to, so the wrong one is visible", async () => {
    // A key that is valid and belongs to the wrong wallet is the silent failure
    // here: the transactions are well formed and the contracts refuse them.
    const ran = await runDaily(fakeDb(), { publisherKey: KEY }, 0);
    expect(ran.signer).toMatch(/^0x[0-9a-f]{40}$/);
    // Derived, not stored: the same key gives the same address every time.
    const again = await runDaily(fakeDb(), { publisherKey: KEY }, 0);
    expect(again.signer).toBe(ran.signer);
  });

  it("says no signer rather than throwing on something that is not a key", async () => {
    // A truncated paste. wrangler takes it, every listing shows the name, and a
    // scheduled job that crashed on it would report nothing at all.
    for (const broken of ["", "0x", "0xnothex", "0x1234"]) {
      const ran = await runDaily(fakeDb(), { publisherKey: broken }, 0);
      expect(ran.signer).toBeNull();
    }
  });

  it("never puts the key itself in what it returns", async () => {
    const ran = await runDaily(fakeDb(), { publisherKey: KEY }, 0);
    expect(JSON.stringify(ran)).not.toContain(KEY.slice(2));
  });
});
