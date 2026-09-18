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
import { BOARDS } from "@/data/boards";
import { asWord } from "@/lib/publisher";
import { encodeParameters, type AbiType } from "@/lib/abi";
import { PUBLIC_RPCS } from "@/lib/cronos";
import { BURN_ADDRESS, CONTRACTS, CROCARD, ROUTER } from "@/lib/revenue";
import { CRONOS_CHAIN_ID, addressOfKey, selector, signTransaction, word } from "@/lib/evm-tx";
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
  /**
   * The three money contracts and not the collection.
   *
   * They are independent of the artwork: the drop, the pot and the splitter
   * never see a card. The collection is the one that takes a baseURI, and a
   * baseURI is a promise about images — changing it afterwards is the power the
   * mint page warns holders about, which is a fine thing to use before anybody
   * owns anything and a poor thing to lean on after.
   *
   * So the money can go first and start accruing while the art is still being
   * decided. The collection needs the splitter's address, which this run leaves
   * behind in lib/revenue.ts, so the second run has it.
   */
  const moneyOnly = process.argv.includes("--money-only");

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
  // Loud on a key of the wrong length. hexToBytes takes it with or without the
  // 0x and will happily turn anything even-numbered into bytes, so a truncated
  // paste becomes a valid-looking key for an address nobody has ever funded —
  // and the first sign of that is a deploy that fails for no money, from a
  // wallet you were sure had ten CRO in it.
  if (secret) {
    const digits = secret.replace(/^0x/, "");
    if (digits.length !== 64) {
      throw new Error(
        `DEPLOY_KEY is ${digits.length} hex digits and a private key is 64. ` +
          `Check nothing was cut off the paste.`,
      );
    }
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
  // Said out loud before anything is sent. If this is not the wallet you meant,
  // it is the last moment it costs nothing to find out.
  console.log(`deployer   ${deployer}`);
  console.log(`balance    ${balance / 10n ** 18n} CRO`);
  console.log(`publisher  ${publisher}`);
  console.log(`burn       ${BURN_ADDRESS}`);
  console.log(`token      ${CROCARD}`);
  console.log(`router     ${ROUTER}`);
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
  /**
   * How many there will ever be, read from the shuffle rather than defaulted.
   *
   * IT IS IMMUTABLE ON CHAIN. Set once in the constructor, and a collection
   * deployed with the wrong number cannot be corrected — the only fix is a new
   * contract, which throws away the provenance hash and anything already minted.
   *
   * This was `?? "2000"` while data/shuffle.json committed to 5555, so the
   * default would have made 3,555 tokens of a published sequence permanently
   * unmintable. Nothing would have complained: the deploy succeeds, the mint
   * works, and it stops at token 2000 months later.
   *
   * So the number comes from the file that decided it. An override is still
   * allowed, and refused if it disagrees with that file — see below.
   */
  const shuffled = JSON.parse(readFileSync("data/shuffle.json", "utf8")) as {
    tokens: number;
    hash: string;
  };
  const maxSupply = BigInt(flag("max-supply") ?? shuffled.tokens);
  if (maxSupply !== BigInt(shuffled.tokens)) {
    throw new Error(
      `--max-supply ${maxSupply} disagrees with data/shuffle.json, which commits to ` +
        `${shuffled.tokens} tokens under hash ${shuffled.hash}. One of the two is wrong, ` +
        `and the chain is where being wrong is permanent.`,
    );
  }

  const baseURI = flag("base-uri") ?? "";
  if (!baseURI && broadcast && !moneyOnly) {
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

  /**
   * One call to a contract that already exists, in the same run.
   *
   * Deploying leaves things to set, and a setting nobody made is a contract that
   * refuses at the moment it is needed rather than at the moment it was wrong.
   * So it happens here, with the deployer's key, which is also the owner's.
   *
   * On a dry run it prints and sends nothing, like everything else — but note
   * that the gas cannot be estimated against a contract that does not exist yet,
   * so a dry run does not price these. They are two storage writes each.
   */
  async function call(to: string, what: string, data: string): Promise<void> {
    console.log(`${what}`);
    if (!broadcast) {
      console.log(`  would call ${to}\n`);
      return;
    }

    const gas = BigInt(await rpc("eth_estimateGas", [{ from: deployer, to, data }]));
    spent += (gas * 13n) / 10n;

    const raw = signTransaction(
      {
        nonce: BigInt(nonce++),
        gasPrice,
        gasLimit: (gas * 13n) / 10n,
        to,
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
        console.log(`  done\n`);
        return;
      }
      await new Promise((wake) => setTimeout(wake, 3_000));
    }
    throw new Error(`${what} was sent but no receipt came back: ${hash}`);
  }

  found.drop = await deploy("HolderDrop", [CROCARD, publisher]);
  found.pot = await deploy("PrizePot", [CROCARD, publisher]);
  found.splitter = await deploy("Splitter", [
    ROUTER,
    CROCARD,
    found.drop,
    BURN_ADDRESS,
    found.pot,
  ]);
  if (moneyOnly) {
    console.log("--money-only: the collection is not deployed. Run again without it once the");
    console.log("art is final and uploaded, and pass --base-uri.\n");
  } else {
    found.nft = await deploy("CardsOfCronosSetOne", [
      name,
      symbol,
      maxSupply,
      baseURI,
      allowlist.root,
      found.splitter,
    ]);
  }

  // ── AND THE BOARDS GET THEIR SHARES ────────────────────────────────────────
  //
  // A pot with no shares set cannot close any week: closeWeek refuses a board
  // whose share is zero, which is every board until this runs. That failure is
  // once a week, in a cron, after everybody has played — so it happens here,
  // while somebody is watching, and in the same run as the deploy that caused it.
  //
  // Only the owner may do this, and the owner is whoever deployed, which is this
  // key. The publisher key on the server never can.
  //
  // A quarter each is the maker's starting position. The other half stays in the
  // pot and grows, and `setShare` moves any of it later without a redeploy.
  const SHARES: [string, number][] = BOARDS.map((board) => [board.id, 2_500]);
  for (const [board, bps] of SHARES) {
    await call(
      found.pot!,
      `setShare(${board}, ${bps} bps)`,
      selector("setShare(bytes32,uint256)") + asWord(board) + word(BigInt(bps)),
    );
  }
  console.log(
    `  boards: ${SHARES.map(([b, v]) => `${b} ${v / 100}%`).join(", ")}` +
      `, ${(10_000 - SHARES.reduce((sum, [, v]) => sum + v, 0)) / 100}% stays in the pot\n`,
  );

  const cost = spent * gasPrice;
  console.log(
    `${moneyOnly ? "the three" : "all four"}: ${spent} gas, about ${cost / 10n ** 16n} / 100 CRO ` +
      `at ${gasPrice / 10n ** 9n} gwei`,
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
    // Skipped rather than written as the string "undefined", which is what a
    // --money-only run produced: the file then held `nft: "undefined"` and
    // every import of it threw on load, because that is not an address.
    if (address === undefined) continue;
    const was = new RegExp(`(${key_}: )null`);
    if (!was.test(source)) throw new Error(`Could not find ${key_} in ${file} to fill in.`);
    source = source.replace(was, `$1"${address}"`);
  }
  writeFileSync(file, source);

  console.log(
    `${moneyOnly ? "The three" : "All four"} written into ${file}.` +
      (moneyOnly ? " nft is left null until the collection is deployed." : ""),
  );
  console.log(`\nStill to do: set the wallets in ${file}, and the two Worker secrets.`);
}

void main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
