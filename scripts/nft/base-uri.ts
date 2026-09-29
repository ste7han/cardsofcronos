// Pointing the collection at a new metadata folder.
//
//   npm run base-uri                              read the contract and stop
//   npm run base-uri -- ipfs://bafy…/              what it would change to
//   npm run base-uri -- ipfs://bafy…/ --broadcast  send it
//
// scripts/nft/reveal.ts writes a new folder and prints its CID. Until this has
// run, nothing has changed for anybody: the files are new and the address the
// contract hands out is not.
//
// ── THE CHECK THIS EXISTS FOR ────────────────────────────────────────────────
//
// A reveal is only fair while everything face up has already been sold. One
// token too many and somebody can look at what is coming and wait for the good
// ones, which is the whole mint's fairness gone — and nothing on chain would
// stop it or say so afterwards.
//
// So before sending, this fetches two files out of the new folder and reads
// them: the last token that has been minted, which must be face UP, and the
// first that has not, which must be face DOWN. That is the boundary, checked
// against `nextTokenId` asked of the contract rather than against a number
// somebody remembered.
//
// It is deliberately the slow way round — two gateway fetches before a
// transaction — because the failure it catches cannot be undone. A base URI can
// be set again, but what people saw in the meantime they have seen.
//
// ── WHAT ELSE IT REFUSES ─────────────────────────────────────────────────────
//
// A URI that is already set, which is a transaction worth not paying for. One
// that does not end in a slash, because the contract appends the token id
// straight onto it and `…cid1` is a file nobody has. And a key that is not the
// owner, which would revert anyway but after the gas.
//
// DEPLOY_KEY comes from .env.local through --env-file, never from an argument:
// argv is visible to anybody who can run ps.

import { hexToBytes, normalise } from "@/lib/address";
import { PUBLIC_RPCS, rpc as call } from "@/lib/cronos";
import { CONTRACTS } from "@/lib/revenue";
import { CRONOS_CHAIN_ID, addressOfKey, selector, signTransaction } from "@/lib/evm-tx";

const args = process.argv.slice(2);
const WANT = args.find((one) => one.startsWith("ipfs://")) ?? null;
const BROADCAST = args.includes("--broadcast");
const GATEWAY = "https://ipfs.filebase.io/ipfs/";

const rpcs = process.env.CRONOS_RPC ? [process.env.CRONOS_RPC, ...PUBLIC_RPCS] : PUBLIC_RPCS;
const rpc = <T = string>(method: string, params: unknown[]) => call<T>(rpcs, method, params);

/** A string out of an eth_call answer. */
function decodeString(hex: string): string {
  const body = hex.replace(/^0x/, "");
  if (body.length < 128) return "";
  const length = Number(BigInt("0x" + body.slice(64, 128)));
  return Buffer.from(body.slice(128, 128 + length * 2), "hex").toString("utf8");
}

/** Whether the metadata for one token in a folder says it is still face down. */
async function faceDown(uri: string, token: number): Promise<boolean> {
  const url = uri.replace("ipfs://", GATEWAY) + token;
  const answer = await fetch(url, { signal: AbortSignal.timeout(45_000) });
  if (!answer.ok) throw new Error(`${url} answered ${answer.status}.`);
  const meta = (await answer.json()) as {
    name?: string;
    attributes?: { trait_type?: string; value?: unknown }[];
  };
  const status = meta.attributes?.find((one) => one.trait_type === "Status")?.value;
  return status === "Face down";
}

async function main() {
  const nft = CONTRACTS.nft;
  if (nft === null) throw new Error("There is no collection deployed.");

  const minted =
    Number(BigInt(await rpc("eth_call", [{ to: nft, data: selector("nextTokenId()") }, "latest"]))) - 1;
  // tokenURI rather than a getter: the contract keeps the base private, and
  // tokenURI(1) is base + "1", so the base is that with the "1" taken off.
  const one = decodeString(
    await rpc("eth_call", [
      { to: nft, data: selector("tokenURI(uint256)") + (1).toString(16).padStart(64, "0") },
      "latest",
    ]),
  );
  const now = one.replace(/1$/, "");

  console.log(`\n  collection  ${nft}`);
  console.log(`  minted      ${minted}`);
  console.log(`  on chain    ${now}`);
  if (WANT === null) {
    console.log("\n  Give an ipfs:// folder to change it. Nothing was sent.\n");
    return;
  }
  console.log(`  would be    ${WANT}\n`);

  if (!WANT.endsWith("/")) {
    throw new Error("A base URI has to end in a slash: the contract appends the token id to it.");
  }
  if (WANT === now) {
    throw new Error("That is already the base URI. Nothing to do.");
  }

  // ── THE BOUNDARY ────────────────────────────────────────────────────────────
  console.log("  reading the new folder at the line the mint has reached…");
  const [lastSoldDown, firstUnsoldDown] = await Promise.all([
    faceDown(WANT, minted),
    faceDown(WANT, minted + 1),
  ]);

  if (!firstUnsoldDown) {
    throw new Error(
      `Token ${minted + 1} has not been sold and is face UP in that folder. ` +
        `Publishing it would let somebody read ahead. Nothing was sent.`,
    );
  }
  console.log(`  token ${minted + 1} is face down — nothing unsold is on show.`);
  if (lastSoldDown) {
    // Not fatal: a folder that reveals nothing is a folder that reveals nothing,
    // and there are reasons to publish one. But it is never what somebody
    // running a reveal meant to do.
    console.log(`  NOTE: token ${minted} is sold and still face down. This reveals nothing.`);
  } else {
    console.log(`  token ${minted} is face up — everything sold is on show.`);
  }

  if (!BROADCAST) {
    console.log("\n  Nothing was sent. Add --broadcast to do it for real.\n");
    return;
  }

  const secret = process.env.DEPLOY_KEY;
  if (!secret) throw new Error("No DEPLOY_KEY in the environment. Never pass it as an argument.");
  const digits = secret.replace(/^0x/, "");
  if (digits.length !== 64) {
    throw new Error(`DEPLOY_KEY is ${digits.length} hex digits and a private key is 64.`);
  }
  const key = hexToBytes(secret);
  const from = addressOfKey(key);

  const chainId = Number(BigInt(await rpc("eth_chainId", [])));
  if (chainId !== CRONOS_CHAIN_ID) {
    throw new Error(`That endpoint is chain ${chainId}, not Cronos (${CRONOS_CHAIN_ID}).`);
  }
  const owner = normalise(
    "0x" + (await rpc("eth_call", [{ to: nft, data: selector("owner()") }, "latest"])).slice(-40),
  );
  if (owner !== normalise(from)) {
    throw new Error(`${nft} is owned by ${owner} and DEPLOY_KEY is ${from}. setBaseURI is onlyOwner.`);
  }

  // The string, ABI-encoded by hand: offset, length, then the bytes padded out.
  const bytes = Buffer.from(WANT, "utf8").toString("hex");
  const padded = bytes.padEnd(Math.ceil(bytes.length / 64) * 64, "0");
  const data =
    selector("setBaseURI(string)") +
    (32).toString(16).padStart(64, "0") +
    (WANT.length).toString(16).padStart(64, "0") +
    padded;

  const nonce = BigInt(await rpc("eth_getTransactionCount", [from, "pending"]));
  const gasPrice = BigInt(await rpc("eth_gasPrice", []));
  const gas = BigInt(await rpc("eth_estimateGas", [{ from, to: nft, data }]));
  const raw = signTransaction(
    { nonce, gasPrice, gasLimit: (gas * 13n) / 10n, to: nft, value: 0n, data, chainId: CRONOS_CHAIN_ID },
    key,
  );
  const hash = await rpc("eth_sendRawTransaction", [raw]);
  console.log(`\n  sent  ${hash}`);

  // Read back, because a transaction that was accepted is not a transaction
  // that did what you meant.
  for (let i = 0; i < 20; i++) {
    await new Promise((wake) => setTimeout(wake, 3_000));
    const after = decodeString(
      await rpc("eth_call", [
        { to: nft, data: selector("tokenURI(uint256)") + (1).toString(16).padStart(64, "0") },
        "latest",
      ]),
    ).replace(/1$/, "");
    if (after === WANT) {
      console.log(`  now on chain  ${after}\n  matches.\n`);
      console.log("  Marketplaces cache metadata hard. Expect to ask them to refresh.\n");
      return;
    }
  }
  console.log("  The change has not appeared yet. Check the transaction.\n");
}

main().catch((error) => {
  console.error(`\n  ${(error as Error).message}\n`);
  process.exit(1);
});
