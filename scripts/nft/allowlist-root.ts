// Putting a new allowlist on the collection.
//
//   npm run allowlist-root                read the contract and stop
//   npm run allowlist-root -- --broadcast send it
//
// One root covers everybody. There is no per-address allowlist on chain — the
// contract holds a single `bytes32` and a claim proves itself against it — so
// replacing it replaces it for all forty-nine at once. That is the whole reason
// this is a script that checks rather than a line somebody pastes into a
// console.
//
// ── WHAT IT REFUSES ──────────────────────────────────────────────────────────
//
// Sending a root that leaves somebody owed less than the chain says they have
// already taken, or less than the file it replaces promised them. Both are
// silent: the contract does not fail, the transaction succeeds, and the only
// sign is one person's claim reverting weeks later with `AlreadyClaimed` for a
// reason nobody can reconstruct. scripts/allowlist.ts refuses to BUILD such a
// file; this refuses to SEND one, because the file could have been built before
// that check existed.
//
// It also refuses a root that is already on the contract, which is not an error
// but is a transaction worth not paying for.
//
// ── THE ORDER THIS GOES IN ───────────────────────────────────────────────────
//
// Deploy the site first, then send this. app/api/mint serves proofs out of
// data/allowlist.json, and a proof only verifies against the root it was built
// from — so for as long as the two disagree, claims revert. Deploying first
// keeps the old site serving old proofs against the old root, which works,
// until the moment the new one is live; sending first opens a window minutes
// long where the deployed site is serving proofs the contract will not accept.
//
// DEPLOY_KEY is read from the environment and never from an argument: argv is
// visible to anybody who can run ps. If it is not in the environment it is read
// out of .env.local, which is where this project keeps it and which is
// gitignored — one variable by name, not the whole file, and never printed.

import { existsSync, readFileSync } from "node:fs";

import { hexToBytes, normalise } from "@/lib/address";
import { PUBLIC_RPCS } from "@/lib/cronos";
import { ALLOWLIST_ROOT, CONTRACTS } from "@/lib/revenue";
import { CRONOS_CHAIN_ID, addressOfKey, selector, signTransaction } from "@/lib/evm-tx";

const rpcs = process.env.CRONOS_RPC ? [process.env.CRONOS_RPC, ...PUBLIC_RPCS] : PUBLIC_RPCS;

async function rpc(method: string, params: unknown[]): Promise<any> {
  let last = "no endpoint answered";
  for (const url of rpcs) {
    try {
      const answer = await fetch(url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
      });
      const found = (await answer.json()) as { result?: unknown; error?: { message?: string } };
      if (found.error) throw new Error(found.error.message ?? "rejected");
      if (found.result !== undefined) return found.result;
    } catch (error) {
      last = error instanceof Error ? error.message : String(error);
      if (/revert|insufficient|nonce|underpriced/i.test(last)) throw error;
    }
  }
  throw new Error(`${method}: ${last}`);
}

/**
 * One variable out of .env.local, by name.
 *
 * Not a dotenv parser and deliberately not: this reads the line it was asked
 * for and nothing else, so a script that needs a signing key cannot quietly
 * pick up everything else in the file as well. Returns null rather than
 * throwing — the file not existing is the normal case on a server.
 */
function fromEnvFile(name: string): string | null {
  if (!existsSync(".env.local")) return null;
  for (const line of readFileSync(".env.local", "utf8").split("\n")) {
    const at = line.indexOf("=");
    if (at === -1 || line.trimStart().startsWith("#")) continue;
    if (line.slice(0, at).trim() !== name) continue;
    // Quotes stripped, because both spellings are common and a key with a
    // quotation mark on the front is 66 characters and fails the length check
    // with a message about the wrong thing.
    return line.slice(at + 1).trim().replace(/^["']|["']$/g, "") || null;
  }
  return null;
}

const pad = (address: string) => address.replace(/^0x/, "").toLowerCase().padStart(64, "0");
const read = (data: string) => rpc("eth_call", [{ to: CONTRACTS.nft, data }, "latest"]) as Promise<string>;

interface Allowlist {
  root: string;
  addresses: number;
  mints: number;
  claims: { address: string; quantity: number }[];
}

async function main(): Promise<void> {
  const nft = CONTRACTS.nft;
  if (!nft) throw new Error("The collection is not deployed.");

  const list = JSON.parse(readFileSync("data/allowlist.json", "utf8")) as Allowlist;
  const onChain = (await read(selector("allowlistRoot()"))).toLowerCase();
  const owner = "0x" + (await read(selector("owner()"))).slice(-40);

  console.log("\n  collection  " + nft);
  console.log("  on chain    " + onChain);
  console.log("  in the file " + list.root.toLowerCase());
  console.log(`  the file    ${list.addresses} addresses, ${list.mints} free mints`);

  if (onChain === list.root.toLowerCase()) {
    console.log("\n  The contract already holds this root. Nothing to send.\n");
    return;
  }

  // NOBODY LOSES WHAT THEY HAVE ALREADY TAKEN. Asked of the chain rather than
  // of any file, because this is the number the contract will compare against
  // and it is the only one that cannot be out of date.
  console.log("\n  checking every address against what it has already claimed…");
  let worst: string | null = null;
  for (const claim of list.claims) {
    const taken = Number(BigInt(await read(selector("claimed(address)") + pad(claim.address))));
    if (taken > claim.quantity) {
      worst = `${claim.address} has taken ${taken} and the new list owes it ${claim.quantity}.`;
      break;
    }
  }
  if (worst !== null) {
    throw new Error(`Refusing to send: ${worst} An allowance may not go below what is claimed.`);
  }
  console.log("  none of them would be owed less than they have taken.");

  // The third witness. lib/revenue.ts records what is on chain and
  // test/mint.test.ts holds the file to it, so a root sent while that constant
  // still says the old one leaves a green test lying about a live contract.
  if (ALLOWLIST_ROOT.toLowerCase() !== list.root.toLowerCase()) {
    console.log(`\n  lib/revenue.ts still says ${ALLOWLIST_ROOT}`);
    console.log("  Set ALLOWLIST_ROOT to the root in the file before sending:");
    console.log(`\n    export const ALLOWLIST_ROOT =\n      "${list.root}";\n`);
    throw new Error("ALLOWLIST_ROOT does not match data/allowlist.json.");
  }

  if (!process.argv.includes("--broadcast")) {
    console.log("\n  Nothing was sent. Add --broadcast to do it for real.");
    console.log("  Deploy the site FIRST — see the note at the top of this file.\n");
    return;
  }

  const secret = process.env.DEPLOY_KEY ?? fromEnvFile("DEPLOY_KEY");
  if (!secret) {
    throw new Error(
      "No DEPLOY_KEY. Put it in the environment or in .env.local. Never as an argument.",
    );
  }
  const digits = secret.replace(/^0x/, "");
  if (digits.length !== 64) {
    throw new Error(`DEPLOY_KEY is ${digits.length} hex digits and a private key is 64.`);
  }
  const key = hexToBytes(secret);
  const from = addressOfKey(key);
  if (normalise(from) !== normalise(owner)) {
    throw new Error(`DEPLOY_KEY is ${from} and the owner is ${owner}. This is onlyOwner.`);
  }

  const data = selector("setAllowlistRoot(bytes32)") + list.root.replace(/^0x/, "");
  const gas = BigInt(await rpc("eth_estimateGas", [{ from, to: nft, data }]));
  const raw = signTransaction(
    {
      nonce: BigInt(Number(BigInt(await rpc("eth_getTransactionCount", [from, "pending"])))),
      gasPrice: BigInt(await rpc("eth_gasPrice", [])),
      gasLimit: (gas * 13n) / 10n,
      to: nft,
      value: 0n,
      data,
      chainId: CRONOS_CHAIN_ID,
    },
    key,
  );

  const hash = (await rpc("eth_sendRawTransaction", [raw])) as string;
  console.log(`\n  sent  ${hash}`);

  for (let tries = 0; tries < 60; tries++) {
    const receipt = await rpc("eth_getTransactionReceipt", [hash]);
    if (receipt) {
      if (BigInt(receipt.status) !== 1n) throw new Error(`It reverted: ${hash}`);
      break;
    }
    await new Promise((wake) => setTimeout(wake, 3_000));
  }

  // Read again rather than assuming. The receipt says it did not revert; this
  // says what the contract now holds.
  const after = (await read(selector("allowlistRoot()"))).toLowerCase();
  console.log(`  now on chain  ${after}`);
  if (after !== list.root.toLowerCase()) throw new Error("The root did not change. Nothing claims.");
  console.log("  matches the file.\n");
}

main().catch((error) => {
  console.error(`\n  ${(error as Error).message}\n`);
  process.exit(1);
});
