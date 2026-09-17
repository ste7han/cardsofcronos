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
// Twelve at once against publicnode does it in about ten minutes; a scheduled
// job doing a hundred and fifty a day would take eight months.
//
// So the history is done once, here, and lib/holders.ts keeps it current from
// then on — one day of blocks is a hundred calls. Run this before the drop
// contract goes live and never again, unless the table is lost, in which case
// running it again is the whole recovery.
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

import { writeFileSync } from "node:fs";

import { normalise } from "@/lib/address";
import { CROCARD } from "@/lib/revenue";

/** keccak of "Transfer(address,address,uint256)". */
const TRANSFER = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";

/** Blocks per eth_getLogs call. Cronos' public RPCs refuse much more. */
const CHUNK = 2_000;

/**
 * Chunks in flight.
 *
 * Twelve was measured rather than chosen: publicnode answered twelve in 184ms
 * and evm.cronos.org took 2.5 seconds for the same twelve. More would be faster
 * until it is a 429, and this is a script that runs once.
 */
const AT_ONCE = 12;

/**
 * Where $CROCARD was deployed. Found by binary search on eth_getCode rather than
 * remembered, and written down here so this does not have to do it again.
 */
const FIRST_BLOCK = 18_857_956;

const rpcs = process.env.CRONOS_RPC
  ? [process.env.CRONOS_RPC]
  : ["https://cronos-evm-rpc.publicnode.com", "https://evm.cronos.org"];

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
      const found = (await answer.json()) as { result?: T; error?: { message?: string } };
      if (found.error) throw new Error(found.error.message ?? "rejected");
      if (found.result !== undefined) return found.result;
      last = "an endpoint answered with nothing";
    } catch (error) {
      last = error instanceof Error ? error.message : String(error);
    }
  }
  throw new Error(`${method}: ${last}`);
}

const topicToAddress = (topic: string) => normalise("0x" + topic.slice(26));

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

async function main(): Promise<void> {
  const head = Number(BigInt(await rpc<string>("eth_blockNumber", [])));
  const chunks: [number, number][] = [];
  for (let from = FIRST_BLOCK; from <= head; from += CHUNK) {
    chunks.push([from, Math.min(from + CHUNK - 1, head)]);
  }

  process.stderr.write(
    `Reading ${chunks.length.toLocaleString("en-US")} chunks, ${FIRST_BLOCK.toLocaleString("en-US")} to ${head.toLocaleString("en-US")}.\n`,
  );

  const held = new Map<string, bigint>();
  let transfers = 0;
  const started = Date.now();

  for (let i = 0; i < chunks.length; i += AT_ONCE) {
    const batch = chunks.slice(i, i + AT_ONCE);
    // Retried as a batch rather than given up on. One refused chunk in the
    // middle of a two-hour scan is a balance that is wrong for one address and
    // right-looking for every other, which is the shape of mistake this whole
    // file exists to avoid.
    let logs: Awaited<ReturnType<typeof chunkAt>>[] | null = null;
    for (let attempt = 0; attempt < 5 && logs === null; attempt++) {
      try {
        logs = await Promise.all(batch.map(([from, to]) => chunkAt(from, to)));
      } catch (error) {
        if (attempt === 4) throw error;
        await new Promise((wake) => setTimeout(wake, 1000 * (attempt + 1)));
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
    const left = ((Date.now() - started) / done) * (chunks.length - done);
    process.stderr.write(
      `  ${done}/${chunks.length}  ${held.size} addresses  ${Math.round(left / 1000)}s left   \r`,
    );
  }
  process.stderr.write("\n");

  // The zero address is the mint and the burn, not a holder, and it is the one
  // address whose balance is negative by construction.
  held.delete(normalise("0x0000000000000000000000000000000000000000"));

  const positive = [...held].filter(([, amount]) => amount > 0n).sort(([, a], [, b]) => (b > a ? 1 : -1));
  const supply = positive.reduce((sum, [, amount]) => sum + amount, 0n);
  const now = Date.now();

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
