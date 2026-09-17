// The one-off: who holds $CROCARD, from the token's first block.
//
//   npx tsx scripts/holder-drop.ts              writes the SQL and says what it found
//   npm run db:holders                          the same, then applies it to D1
//
// An ERC20 has no list of its holders. The balances are a mapping, a mapping
// cannot be read without its keys, and the keys exist only in the Transfer log —
// so the only honest way to answer "who holds this" is to replay every transfer
// and add up what moved. Asking an indexer would be faster and would make the
// answer depend on somebody else's uptime and somebody else's definition of a
// holder, for a number that decides who gets paid.
//
// ── WHY THIS IS A SCRIPT AND THE REST IS A CRON ──────────────────────────────
//
// The token was deployed at block 18,857,956 on 2 April 2025. That is 37,822
// eth_getLogs calls at the two thousand blocks Cronos will answer at a time.
// Measured against the one endpoint that serves them: about four and a half
// hours at four at a time. A scheduled job doing a hundred and fifty a day would
// take eight months. So the history is done once, here, and lib/holders.ts
// keeps it current from then on — one day of blocks is a hundred calls. Run this
// before the drop contract goes live and never again, unless the table is lost,
// in which case running it again is the whole recovery.
//
// ── ONE ENDPOINT, AND WHY IT IS SLOW ON PURPOSE ──────────────────────────────
//
// evm.cronos.org and nothing else. This ran against publicnode first, which is
// twenty times faster and answers historical log queries with an empty array —
// not an error, not a truncation, `[]` with a 200. The scan finished happily and
// reported 17 holders with 238 million of a billion, missing the liquidity pool
// and the burn address entirely.
//
// Which cannot be true, and an answer that cannot be true is a fact about the
// measurement. So the endpoint list is lib/cronos.ts's LOG_RPCS, and this file
// refuses to write anything it cannot prove — see the two checks below.
//
// ── IT WRITES SQL AND DOES NOT WRITE TO D1 ───────────────────────────────────
//
// Because it is one statement per holder and thousands of them, and because a
// script that can write to the production database is a script somebody runs by
// accident. The SQL goes to a file, you look at it, and wrangler applies it.
//
// Nothing here decides who is a person. Every address that has ever held any is
// written down with is_contract left NULL, and the daily job asks the chain
// about them and leaves the contracts out of the rounds. Doing it here would
// mean the answer was true on the day this ran.

import { existsSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";

import { normalise } from "@/lib/address";
import { LOG_RPCS } from "@/lib/cronos";
import { CROCARD } from "@/lib/revenue";

/** keccak of "Transfer(address,address,uint256)". */
const TRANSFER = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";

/** Blocks per eth_getLogs call. Cronos' public RPCs refuse much more. */
const CHUNK = 2_000;

/**
 * Chunks in flight.
 *
 * Four, measured rather than chosen. Against evm.cronos.org — the only endpoint
 * that serves this history — sixty chunks took 121 seconds one at a time, 41 at
 * two and 26 at four, with no refusals at two or four. Eight was tried first and
 * was refused on the eighth request of the first batch.
 */
const AT_ONCE = 4;

/**
 * Where the scan writes what it has so far.
 *
 * Four and a half hours is long enough that finishing is not the common case:
 * a laptop sleeps, a network drops, an endpoint has ten bad minutes in a row.
 * Without this, any of those costs the whole run and the next attempt starts
 * from April 2025 again.
 *
 * It holds the balances so far and the last block that was read. Resuming is
 * exact rather than approximate — the deltas already applied are in the file, so
 * continuing from the next block gives the same answer as never having stopped.
 */
const CHECKPOINT = "data/holders-progress.json";

/** How often it is written. Every hundred batches is about every four minutes. */
const SAVE_EVERY = 100;

/**
 * Where $CROCARD was deployed. Found by binary search on eth_getCode rather than
 * remembered, and written down here so this does not have to do it again.
 */
const FIRST_BLOCK = 18_857_956;

const rpcs = process.env.CRONOS_RPC ? [process.env.CRONOS_RPC, ...LOG_RPCS] : LOG_RPCS;

async function rpc<T>(method: string, params: unknown[]): Promise<T> {
  let last = "no endpoint answered";
  for (const url of rpcs) {
    try {
      const answer = await fetch(url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
      });
      if (!answer.ok) throw new Error(`answered ${answer.status}`);
      const found = (await answer.json()) as {
        result?: T;
        error?: { message?: string; code?: number };
      };
      // The message is often empty on this endpoint, so the code carries the
      // information. "eth_getLogs: " with nothing after it says nothing at all.
      if (found.error) {
        throw new Error(found.error.message || `rejected with code ${found.error.code ?? "?"}`);
      }
      if (found.result !== undefined) return found.result;
      last = "an endpoint answered with nothing";
    } catch (error) {
      last = error instanceof Error ? error.message : String(error);
    }
  }
  throw new Error(`${method}: ${last}`);
}

const topicToAddress = (topic: string) => normalise("0x" + topic.slice(26));

/**
 * One chunk, retried on its own.
 *
 * Per chunk and not per batch. evm.cronos.org returns an occasional empty-message
 * -32603 — roughly one request in sixty — and retrying the batch for it would
 * re-fetch three chunks that were already fine. Over 37,823 chunks that is an
 * hour of re-asking for answers already had.
 */
async function chunkOrRetry(from: number, to: number) {
  let last: unknown;
  for (let attempt = 0; attempt < 6; attempt++) {
    try {
      return await chunkAt(from, to);
    } catch (error) {
      last = error;
      await new Promise((wake) => setTimeout(wake, 500 * 2 ** attempt));
    }
  }
  throw new Error(
    `blocks ${from}-${to} would not be read: ${last instanceof Error ? last.message : String(last)}`,
  );
}

async function chunkAt(from: number, to: number) {
  return rpc<{ topics: string[]; data: string }[]>("eth_getLogs", [
    {
      address: CROCARD,
      topics: [TRANSFER],
      fromBlock: "0x" + from.toString(16),
      toBlock: "0x" + to.toString(16),
    },
  ]);
}

/**
 * Refuses an endpoint that does not serve this history.
 *
 * The token's own first blocks contain its mint and the transfers around it, so
 * an endpoint answering that range with nothing is not telling the truth about
 * any range. There is no way to detect this per call — an empty range is a real
 * and common answer — so it is asked once, about the one range that cannot be
 * empty, before two hours are spent believing everything else.
 */
async function checkItServesHistory(): Promise<void> {
  const found = await chunkAt(FIRST_BLOCK, FIRST_BLOCK + CHUNK - 1);
  if (found.length === 0) {
    throw new Error(
      `${rpcs[0]} answered the token's own first ${CHUNK} blocks with no transfers. ` +
        "That range contains its mint, so the endpoint is not serving this history " +
        "and every empty answer after this one would be a lie. Nothing was written.",
    );
  }
  process.stderr.write(`${rpcs[0]} serves the history: ${found.length} transfers in the first chunk.\n`);
}

/** What a half-finished run left behind, if anything. */
function resume(): { held: Map<string, bigint>; from: number; transfers: number } | null {
  if (!existsSync(CHECKPOINT)) return null;
  const saved = JSON.parse(readFileSync(CHECKPOINT, "utf8")) as {
    nextBlock: number;
    transfers: number;
    held: [string, string][];
  };
  return {
    held: new Map(saved.held.map(([address, amount]) => [address, BigInt(amount)])),
    from: saved.nextBlock,
    transfers: saved.transfers,
  };
}

function save(held: Map<string, bigint>, nextBlock: number, transfers: number): void {
  writeFileSync(
    CHECKPOINT,
    JSON.stringify({
      nextBlock,
      transfers,
      held: [...held].map(([address, amount]) => [address, amount.toString()]),
    }),
  );
}

async function main(): Promise<void> {
  await checkItServesHistory();
  const head = Number(BigInt(await rpc<string>("eth_blockNumber", [])));

  const earlier = resume();
  const startAt = earlier?.from ?? FIRST_BLOCK;
  const held = earlier?.held ?? new Map<string, bigint>();
  let transfers = earlier?.transfers ?? 0;

  if (earlier !== null) {
    process.stderr.write(
      `Resuming from block ${startAt.toLocaleString("en-US")} with ${held.size} addresses.\n`,
    );
  }

  const chunks: [number, number][] = [];
  for (let from = startAt; from <= head; from += CHUNK) {
    chunks.push([from, Math.min(from + CHUNK - 1, head)]);
  }

  process.stderr.write(
    `Reading ${chunks.length.toLocaleString("en-US")} chunks, ${startAt.toLocaleString("en-US")} to ${head.toLocaleString("en-US")}.\n`,
  );

  const started = Date.now();

  for (let i = 0; i < chunks.length; i += AT_ONCE) {
    const batch = chunks.slice(i, i + AT_ONCE);
    // Retried as a batch rather than given up on. One refused chunk in the
    // middle of a two-hour scan is a balance that is wrong for one address and
    // right-looking for every other, which is the shape of mistake this whole
    // file exists to avoid.
    let logs: Awaited<ReturnType<typeof chunkAt>>[] | null = null;
    for (let attempt = 0; attempt < 8 && logs === null; attempt++) {
      try {
        logs = await Promise.all(batch.map(([from, to]) => chunkOrRetry(from, to)));
      } catch (error) {
        if (attempt === 7) throw error;
        await new Promise((wake) => setTimeout(wake, 2000 * (attempt + 1)));
      }
    }

    for (const found of logs!) {
      for (const log of found) {
        // Transfer indexes from and to, so the amount is all that is in data.
        const value = BigInt(log.data);
        const sender = topicToAddress(log.topics[1]!);
        const recipient = topicToAddress(log.topics[2]!);
        held.set(sender, (held.get(sender) ?? 0n) - value);
        held.set(recipient, (held.get(recipient) ?? 0n) + value);
        transfers++;
      }
    }

    const done = Math.min(i + AT_ONCE, chunks.length);
    // Saved after the batch is applied, pointing at the first block NOT read.
    // Pointing at the last block read would re-apply that chunk's transfers on a
    // resume and hand somebody else's tokens to whoever was in it.
    if (done % (SAVE_EVERY * AT_ONCE) === 0) save(held, chunks[done - 1]![1] + 1, transfers);

    const left = ((Date.now() - started) / done) * (chunks.length - done);
    process.stderr.write(
      `  ${done}/${chunks.length}  ${held.size} addresses  ${Math.round(left / 60_000)}m left   \r`,
    );
  }
  process.stderr.write("\n");

  // The zero address is the mint and the burn, not a holder, and it is the one
  // address whose balance is negative by construction.
  held.delete(normalise("0x0000000000000000000000000000000000000000"));

  const positive = [...held].filter(([, amount]) => amount > 0n).sort(([, a], [, b]) => (b > a ? 1 : -1));
  const counted = positive.reduce((sum, [, amount]) => sum + amount, 0n);
  const now = Date.now();

  // THE CHECK THAT WOULD HAVE CAUGHT THE BAD SCAN IMMEDIATELY.
  //
  // Every token that exists was minted from the zero address and has been
  // somewhere ever since, so adding up every positive balance has to come to
  // exactly the supply. It came to 238 million of a billion last time and the
  // script said nothing, because nothing asked.
  //
  // Exact, not approximate. A missed transfer is a holder short by whatever it
  // moved, and "close enough" is how a snapshot that pays people goes out wrong.
  const supply = BigInt(
    await rpc<string>("eth_call", [{ to: CROCARD, data: "0x18160ddd" }, "latest"]),
  );
  if (counted !== supply) {
    const short = supply - counted;
    throw new Error(
      `The balances add up to ${counted}, and the supply is ${supply} — ` +
        `${short > 0n ? "short by" : "over by"} ${(short < 0n ? -short : short) / 10n ** 18n}. ` +
        "Every token was minted from the zero address and has been somewhere since, so " +
        "these have to match exactly. Some range came back empty that was not. Nothing was written.",
    );
  }
  process.stderr.write(`The balances add up to the supply exactly: ${supply / 10n ** 18n}.\n`);

  const sql = [
    "-- Written by scripts/holder-drop.ts. One row per address that holds any",
    "-- $CROCARD, with is_contract left for the daily job to answer.",
    `-- Read to block ${head}, ${transfers} transfers, ${positive.length} holders.`,
    "",
    ...positive.map(
      ([address, amount]) =>
        `INSERT INTO holders (address, balance, is_contract, at) VALUES ('${address}', '${amount}', NULL, ${now}) ON CONFLICT (address) DO UPDATE SET balance = excluded.balance, at = excluded.at;`,
    ),
    "",
    "-- And where the daily job carries on from.",
    `INSERT INTO cursors (name, block, at) VALUES ('holders', ${head}, ${now}) ON CONFLICT (name) DO UPDATE SET block = MAX(block, excluded.block), at = excluded.at;`,
    "",
  ].join("\n");

  writeFileSync("data/holders.sql", sql);
  // Deleted rather than marked done. Leaving it would make the next run resume
  // from the end of this one and write a file with nothing in it — and a
  // finished-flag inside it would be one more state for `resume` to get wrong.
  if (existsSync(CHECKPOINT)) unlinkSync(CHECKPOINT);

  const whole = (amount: bigint) => (amount / 10n ** 18n).toLocaleString("en-US");
  console.log(`\n${positive.length} holders, ${whole(supply)} $CROCARD between them.`);
  console.log("The ten largest, so the ones that are not people are visible here:");
  for (const [address, amount] of positive.slice(0, 10)) {
    const share = Number((amount * 10_000n) / supply) / 100;
    console.log(`  ${address}  ${whole(amount).padStart(14)}  ${share.toFixed(1)}%`);
  }
  console.log("\ndata/holders.sql written. Apply it with:");
  console.log("  npx wrangler d1 execute cards-of-cronos --remote --file=data/holders.sql");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
