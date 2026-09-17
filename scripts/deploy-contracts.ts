// Deploying the four contracts, in the one order they can go in.
//
//   DEPLOY_KEY=0x… npx tsx scripts/deploy-contracts.ts --publisher 0x…
//   DEPLOY_KEY=0x… npx tsx scripts/deploy-contracts.ts --publisher 0x… --broadcast
//
// Without --broadcast it prints exactly what it would send and sends nothing.
// That is the default because these are immutable: a constructor argument typed
// wrong is not a thing you fix, it is a thing you redeploy and migrate away from.
//
// ── THE ORDER ────────────────────────────────────────────────────────────────
//
//   HolderDrop   needs the publisher
//   PrizePot     needs the publisher
//   Splitter     needs both of those, and the burn address
//   NFT          needs the splitter
//
// Each one needs the addresses of the ones before it, which is why this is a
// script and not four commands: four commands is three chances to paste the
// wrong address into an immutable constructor.
//
// ── THE KEY ──────────────────────────────────────────────────────────────────
//
// DEPLOY_KEY is read from the environment and never from an argument: argv is
// visible to anything that can run `ps`. It is also never written anywhere by
// this script.
//
// WHICHEVER KEY DEPLOYS BECOMES THE OWNER of all four, and the owner is the one
// that can reach the money through the rescue hatch. So this should be the cold
// wallet — the one that never touches a server — and never the publisher, which
// lives in a Worker. The script refuses if they are the same.

import { readFileSync, writeFileSync } from "node:fs";

import { normalise } from "@/lib/address";
import { encodeParameters, type AbiType } from "@/lib/abi";
import { PUBLIC_RPCS } from "@/lib/cronos";
import { BURN_ADDRESS, CONTRACTS } from "@/lib/revenue";
import { CRONOS_CHAIN_ID, addressOfKey, signTransaction } from "@/lib/evm-tx";
import { hexToBytes } from "@/lib/address";

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

function artefact(name: string): { bytecode: string; types: AbiType[] } {
  const json = JSON.parse(
    readFileSync(`contracts/out/${name}.sol/${name}.json`, "utf8"),
  ) as { bytecode: { object: string }; abi: { type: string; inputs?: { type: string }[] }[] };
  const ctor = json.abi.find((entry) => entry.type === "constructor");
  return {
    bytecode: json.bytecode.object,
    types: (ctor?.inputs ?? []).map((input) => input.type as AbiType),
  };
}

const flag = (name: string): string | null => {
  const at = process.argv.indexOf(`--${name}`);
  return at === -1 ? null : process.argv[at + 1] ?? null;
};

async function main(): Promise<void> {
  const broadcast = process.argv.includes("--broadcast");

  // A dry run needs an address and not a key. Everything before --broadcast is
  // arithmetic — what the arguments encode to, what the node says the gas is,
  // what that costs — and none of it is signed. Requiring a key to find that out
  // would mean handing one over to ask a question, which is the shape of a bad
  // habit rather than a safe one.
  const secret = process.env.DEPLOY_KEY;
  const from = flag("from");
  if (!secret && (broadcast || !from)) {
    throw new Error(
      broadcast
        ? "Set DEPLOY_KEY in the environment. Never as an argument."
        : "Pass --from 0x… for a dry run, or set DEPLOY_KEY to sign for real.",
    );
  }
  const key = secret ? hexToBytes(secret) : new Uint8Array(32);
  const deployer = secret ? addressOfKey(key) : normalise(from!);

  const publisher = normalise(flag("publisher") ?? "");
  if (publisher === deployer) {
    throw new Error(
      "The deployer becomes the owner and the owner can reach the money. " +
        "It must not be the publisher, which lives in a Worker.",
    );
  }

  const already = Object.entries(CONTRACTS).filter(([, address]) => address !== null);
  if (already.length > 0 && !process.argv.includes("--replace")) {
    throw new Error(
      `lib/revenue.ts already names ${already.map(([n]) => n).join(", ")}. ` +
        `Deploying again makes a second set nothing points at. Pass --replace if that is the intention.`,
    );
  }

  const chainId = Number(await rpc("eth_chainId", []));
  if (chainId !== CRONOS_CHAIN_ID) {
    throw new Error(`That endpoint is chain ${chainId}, not Cronos (${CRONOS_CHAIN_ID}).`);
  }

  const balance = BigInt(await rpc("eth_getBalance", [deployer, "latest"]));
  console.log(`deployer   ${deployer}`);
  console.log(`balance    ${balance / 10n ** 18n} CRO`);
  console.log(`publisher  ${publisher}`);
  console.log(`burn       ${BURN_ADDRESS}`);
  console.log(`chain      ${chainId}\n`);
  // Only when it matters. A dry run against an empty key is a perfectly good way
  // to check the encoding and the gas before funding anything.
  if (balance === 0n && broadcast) {
    throw new Error("The deployer holds nothing. Nothing can be sent.");
  }

  // The NFT's own arguments. The root is read off the allowlist rather than
  // retyped: it is the promise to the first collection's holders and a root that
  // does not match the file is a promise that cannot be taken.
  const allowlist = JSON.parse(readFileSync("data/allowlist.json", "utf8")) as { root: string };
  const name = flag("name") ?? "Cards of Cronos Set 01";
  const symbol = flag("symbol") ?? "COC1";
  const maxSupply = BigInt(flag("max-supply") ?? "2000");
  const baseURI = flag("base-uri") ?? "";
  if (!baseURI && broadcast) {
    throw new Error("Pass --base-uri. A collection deployed without one has no art.");
  }

  let nonce = Number(await rpc("eth_getTransactionCount", [deployer, "pending"]));
  const gasPrice = (BigInt(await rpc("eth_gasPrice", [])) * 12n) / 10n;
  const found: Record<string, string> = {};
  /** Counts the stand-ins a dry run hands out, so each is a different address. */
  let pretended = 0;
  /** Gas across all four, at the limit each would be sent with. */
  let spent = 0n;

  async function deploy(
    what: string,
    values: (string | bigint)[],
  ): Promise<string> {
    const { bytecode, types } = artefact(what);
    const data = bytecode + encodeParameters(types, values);

    const gas = BigInt(
      await rpc("eth_estimateGas", [{ from: deployer, data }]),
    );

    console.log(`${what}`);
    console.log(`  args  ${types.map((t, i) => `${t}=${values[i]}`).join(", ") || "none"}`);
    console.log(`  gas   ${gas}`);
    spent += (gas * 13n) / 10n;

    if (!broadcast) {
      // A stand-in so the constructors after this one can still be encoded and
      // estimated. Hex, obviously — the first version spelled the contract's
      // name into it and fell over on the letters that are not digits. Never
      // written anywhere.
      const pretend = normalise("0x" + String(++pretended).repeat(40).slice(0, 40));
      console.log(`  would deploy; using ${pretend} for the rest of this dry run\n`);
      return pretend;
    }

    const raw = signTransaction(
      {
        nonce: BigInt(nonce++),
        gasPrice,
        gasLimit: (gas * 13n) / 10n,
        to: "0x",
        value: 0n,
        data,
        chainId: CRONOS_CHAIN_ID,
      },
      key,
    );
    const hash = (await rpc("eth_sendRawTransaction", [raw])) as string;
    console.log(`  sent  ${hash}`);

    for (let tries = 0; tries < 60; tries++) {
      const receipt = await rpc("eth_getTransactionReceipt", [hash]);
      if (receipt) {
        if (BigInt(receipt.status) !== 1n) throw new Error(`${what} reverted: ${hash}`);
        console.log(`  at    ${normalise(receipt.contractAddress)}\n`);
        return normalise(receipt.contractAddress);
      }
      await new Promise((wake) => setTimeout(wake, 3_000));
    }
    throw new Error(`${what} was sent but no receipt came back: ${hash}`);
  }

  found.drop = await deploy("HolderDrop", [publisher]);
  found.pot = await deploy("PrizePot", [publisher]);
  found.splitter = await deploy("Splitter", [found.drop, BURN_ADDRESS, found.pot]);
  found.nft = await deploy("CardsOfCronosSetOne", [
    name,
    symbol,
    maxSupply,
    baseURI,
    allowlist.root,
    found.splitter,
  ]);

  const cost = spent * gasPrice;
  console.log(
    `all four: ${spent} gas, about ${cost / 10n ** 16n} / 100 CRO at ${gasPrice / 10n ** 9n} gwei`,
  );

  if (!broadcast) {
    if (balance < cost) {
      // A dry run is the moment to find this out, not the moment after the
      // third contract deployed and the fourth ran out.
      console.log(
        `\nThe deployer holds ${balance / 10n ** 16n} / 100 CRO, which is less than that.`,
      );
    }
    console.log("\nNothing was sent. Add --broadcast to deploy for real.");
    return;
  }
  if (balance < cost) {
    throw new Error(
      `The deployer holds ${balance / 10n ** 16n} / 100 CRO and this needs about ` +
        `${cost / 10n ** 16n} / 100. Deploying three of four and stopping is the worst outcome here.`,
    );
  }

  // Written back, so the addresses are in version control rather than in a
  // terminal somebody closed.
  const file = "lib/revenue.ts";
  let source = readFileSync(file, "utf8");
  for (const [key_, address] of [
    ["drop", found.drop],
    ["splitter", found.splitter],
    ["pot", found.pot],
    ["nft", found.nft],
  ] as const) {
    const was = new RegExp(`(${key_}: )null`);
    if (!was.test(source)) throw new Error(`Could not find ${key_} in ${file} to fill in.`);
    source = source.replace(was, `$1"${address}"`);
  }
  writeFileSync(file, source);

  console.log(`All four written into ${file}.`);
  console.log(`\nStill to do: set the wallets in ${file}, and the two Worker secrets.`);
}

void main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
