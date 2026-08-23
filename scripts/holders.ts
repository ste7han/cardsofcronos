// Who holds the first collection, written down once.
//
//   npx tsx scripts/holders.ts [out.json]
//
// The free mints for the new line go to these people, so this is the file the
// allowlist is built from. Run it once and keep the answer: a snapshot that gets
// re-derived later is a snapshot of a different moment, and somebody who sold
// between the two runs is somebody who was promised a mint and did not get one.
//
// The old dapp asked this question the other way round — "which of these does
// THIS wallet own" — on every visit, and threw the answer away. Same four round
// trips, inverted.
//
// ── HOW ─────────────────────────────────────────────────────────────────────
// `ownerOf(1..1894)` over JSON-RPC batches, a few batches in flight at a time.
//
// The batch size is TEN. That is not a preference: evm.cronos.org answers a
// larger one with `-32600 request exceeded maximum batch size(10), got 500`.
// This script asked for five hundred first, and that is worth writing down
// because of how it failed rather than that it failed — see below.
//
// The old dapp used Multicall3 for this and that was the better call: it puts
// five hundred calls inside ONE eth_call, which is not a JSON-RPC batch and so
// is not subject to the limit. It costs a hand-encoded array of dynamic structs.
// Two hundred small requests, run a few at a time, is a fair trade for a script
// that runs once.
//
// ── A REVERT AND A REFUSAL ARE NOT THE SAME THING ───────────────────────────
// A burned token makes `ownerOf` revert, and that arrives as an error entry in
// the batch. So does a batch the endpoint would not accept. The first version of
// this script treated both as "nobody holds this" — and reported that all 1894
// tokens were burned and the collection had no holders at all.
//
// Which cannot be true, and an answer that cannot be true is a fact about the
// measurement. Only an execution revert means "no owner" now. Anything else
// fails the endpoint and moves to the next one, loudly.

import { writeFileSync } from "node:fs";

import { keccak_256 } from "@noble/hashes/sha3";

import { PUBLIC_RPCS } from "@/lib/cronos";
import { bytesToHex, checksum, normalise } from "@/lib/address";

/** The deployed collection. See docs/the-first-collection.md. */
const CONTRACT = "0x10B47dAbfEaCBd87dD2bAd5f6d489C5082181902";
const FIRST_TOKEN = 1;

/**
 * Where the collection stops is asked, not assumed.
 *
 * The old dapp had `COLLECTION_SIZE = 1894` written into it, and the token
 * mapping has 1894 rows, so this script began by scanning to 1894 — and
 * reported that 1379 tokens were burned. They were never minted. `totalSupply()`
 * is 515 and `nextTokenId()` is 516: the mint stopped at 515 and the other 1379
 * ids only ever existed in a spreadsheet.
 *
 * Reading it off the contract is the difference between "seventy-three percent
 * of this collection was burned" and "this collection is a quarter of the size
 * everyone wrote down".
 */
const BURN_ADDRESS = "0x42bcc1355808adf2344773c54e364257911ccc99";
// Ten, because evm.cronos.org refuses more. Four in flight keeps two hundred
// requests to about fifty rounds without looking like an attack.
const BATCH = 10;
const IN_FLIGHT = 4;

const OUT = process.argv[2] ?? "data/holders-snapshot.json";

/**
 * The selector, computed rather than pasted.
 *
 * `ownerOf(uint256)` hashes to 0x6352211e, and writing that constant down is a
 * bet that it was copied correctly — a wrong selector calls a different function
 * or none, and on a view call the failure is an empty answer rather than a
 * throw. Four lines of arithmetic removes the bet.
 */
const OWNER_OF = "0x" + bytesToHex(keccak_256(new TextEncoder().encode("ownerOf(uint256)"))).slice(0, 8);

/** `ownerOf(id)`, as call data. */
function callData(id: number): string {
  return OWNER_OF + id.toString(16).padStart(64, "0");
}

/** The address out of a 32-byte word, or null if this is not one. */
function addressFrom(result: unknown): string | null {
  if (typeof result !== "string") return null;
  const body = result.replace(/^0x/, "");
  if (body.length !== 64) return null;
  // Left-padded: the address is the last twenty bytes.
  const address = "0x" + body.slice(24);
  if (/^0x0{40}$/.test(address)) return null;
  try {
    return normalise(address);
  } catch {
    return null;
  }
}

interface RpcResponse {
  id?: unknown;
  result?: unknown;
  error?: { message?: string };
}

async function batchCall(rpc: string, ids: number[]): Promise<Map<number, string | null>> {
  const body = ids.map((id) => ({
    jsonrpc: "2.0",
    id,
    method: "eth_call",
    params: [{ to: CONTRACT, data: callData(id) }, "latest"],
  }));

  const response = await fetch(rpc, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!response.ok) throw new Error(`${rpc} answered ${response.status}`);

  const parsed: unknown = await response.json();
  if (!Array.isArray(parsed)) throw new Error(`${rpc} did not return a batch`);

  const owners = new Map<number, string | null>();
  for (const entry of parsed as RpcResponse[]) {
    if (typeof entry.id !== "number") continue;
    if (entry.error) {
      const message = entry.error.message ?? "";
      // A revert is the answer: this token has no owner. Anything else is the
      // endpoint declining to answer, and pretending that is a burned token is
      // how a broken run reports an empty collection.
      if (!/revert|invalid token|nonexistent/i.test(message)) {
        throw new Error(`${rpc} refused a call: ${message}`);
      }
      owners.set(entry.id, null);
      continue;
    }
    owners.set(entry.id, addressFrom(entry.result));
  }
  if (owners.size !== ids.length) {
    throw new Error(`${rpc} answered ${owners.size} of ${ids.length} calls`);
  }
  return owners;
}

/** One no-argument view call that returns a number. */
async function readNumber(rpc: string, signature: string): Promise<number> {
  const selector = "0x" + bytesToHex(keccak_256(new TextEncoder().encode(signature))).slice(0, 8);
  const response = await fetch(rpc, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "eth_call",
      params: [{ to: CONTRACT, data: selector }, "latest"],
    }),
  });
  const body = (await response.json()) as { result?: string; error?: { message?: string } };
  if (body.error || typeof body.result !== "string") {
    throw new Error(`${rpc} would not answer ${signature}: ${body.error?.message ?? "no result"}`);
  }
  return Number(BigInt(body.result));
}

/** The block everything below was read at, so the snapshot has a moment. */
async function blockNumber(rpc: string): Promise<number> {
  const response = await fetch(rpc, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "eth_blockNumber", params: [] }),
  });
  const body = (await response.json()) as { result?: string };
  if (typeof body.result !== "string") throw new Error(`${rpc} would not say the block number`);
  return Number(BigInt(body.result));
}

async function main(): Promise<void> {
  const secret = process.env.CRONOS_RPC;
  const endpoints = secret ? [secret, ...PUBLIC_RPCS] : PUBLIC_RPCS;

  let owners: Map<number, string | null> | null = null;
  let usedRpc = "";
  let atBlock = 0;
  let minted = 0;
  let supply = 0;
  let ids: number[] = [];

  for (const rpc of endpoints) {
    try {
      process.stdout.write(`  ${new URL(rpc).host} … `);
      const block = await blockNumber(rpc);
      minted = (await readNumber(rpc, "nextTokenId()")) - 1;
      supply = await readNumber(rpc, "totalSupply()");
      process.stdout.write(`${minted} minted, ${supply} live … `);
      ids = Array.from({ length: minted - FIRST_TOKEN + 1 }, (_, i) => i + FIRST_TOKEN);
      const batches: number[][] = [];
      for (let i = 0; i < ids.length; i += BATCH) batches.push(ids.slice(i, i + BATCH));

      const found = new Map<number, string | null>();
      for (let i = 0; i < batches.length; i += IN_FLIGHT) {
        const round = await Promise.all(
          batches.slice(i, i + IN_FLIGHT).map((slice) => batchCall(rpc, slice)),
        );
        for (const answered of round) for (const [id, owner] of answered) found.set(id, owner);
        if (found.size % 200 < BATCH * IN_FLIGHT) process.stdout.write(`${found.size} `);
      }
      owners = found;
      usedRpc = rpc;
      atBlock = block;
      process.stdout.write("ok\n");
      break;
    } catch (error) {
      process.stdout.write(`no (${(error as Error).message})\n`);
    }
  }

  if (owners === null) {
    console.error("\nNo Cronos endpoint would answer. Nothing written.");
    process.exit(1);
  }

  // address -> the tokens it holds, sorted, so the file is stable across runs
  // and a diff between two snapshots is readable.
  const byHolder = new Map<string, number[]>();
  let burned = 0;
  for (const id of ids) {
    const owner = owners.get(id) ?? null;
    if (owner === null) {
      burned++;
      continue;
    }
    byHolder.set(owner, [...(byHolder.get(owner) ?? []), id]);
  }

  const holders = [...byHolder.entries()]
    .map(([address, tokens]) => ({ address: checksum(address), tokens: [...tokens].sort((a, b) => a - b) }))
    .sort((a, b) => b.tokens.length - a.tokens.length || a.address.localeCompare(b.address));

  const atBurnAddress =
    byHolder.get(BURN_ADDRESS)?.length ?? 0;

  const snapshot = {
    contract: checksum(CONTRACT),
    chainId: 25,
    atBlock,
    readAt: new Date().toISOString(),
    rpc: new URL(usedRpc).host,
    /** The highest id ever minted. Not 1894 — see the note at the top. */
    minted,
    /** What the contract itself says is alive right now. */
    totalSupply: supply,
    held: ids.length - burned,
    burned,
    /**
     * Tokens sitting at the old dapp's burn address. They have an owner as far
     * as the contract is concerned, and no person behind it. Whoever builds the
     * allowlist has to decide about these before it is built, not after.
     */
    atBurnAddress,
    holders: holders.length,
    // Addresses are checksummed here because this file is read by people. Every
    // comparison against it goes through lib/address normalise() first.
    byHolder: holders,
  };

  // The check that would have caught the first version of this script. A
  // collection nobody holds is not a collection; it is a broken reader.
  if (snapshot.held === 0 || holders.length === 0) {
    console.error("\nEvery token read as unowned. That is a broken run, not an empty collection.");
    process.exit(1);
  }

  // The contract's own count against the one this script arrived at. They are
  // two different questions asked of the same chain, and if they disagree the
  // reader is wrong.
  if (snapshot.held !== supply) {
    console.error(
      `\ntotalSupply() says ${supply} and this run found ${snapshot.held}. ` +
        "One of the two is wrong and nothing is written until it is known which.",
    );
    process.exit(1);
  }

  writeFileSync(OUT, JSON.stringify(snapshot, null, 2) + "\n");

  console.log(`\n  block             ${atBlock}`);
  console.log(`  ever minted       ${minted}`);
  console.log(`  alive now         ${snapshot.held}   (totalSupply agrees)`);
  console.log(`  burned            ${burned}`);
  console.log(`  holders           ${holders.length}`);
  console.log(`  at burn address   ${atBurnAddress}  ← not a person`);
  console.log(`  largest           ${holders[0]?.tokens.length ?? 0} tokens`);
  console.log(`\n  ${OUT}`);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
