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
import { BURN_ADDRESS, CONTRACTS, CROCARD, LION, ROUTER } from "@/lib/revenue";
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

  // Replacing only the splitter is its own mode, because it is the one that has
  // to be replaced rather than adjusted: its three shares are constants with no
  // setter, so changing the split means new bytecode at a new address. The drop
  // and the pot it pays are reused exactly as they are — redeploying those would
  // throw away a pot balance and every board share set on it.
  // The same narrowing for the collection, which is deployed last and long after
  // the three that handle money: the art has to be rendered and on IPFS before
  // anybody knows the baseURI, so this run happens on its own day.
  const nftOnly = process.argv.includes("--nft-only");
  if (nftOnly) {
    if (CONTRACTS.nft !== null) {
      throw new Error(`lib/revenue.ts already names a collection (${CONTRACTS.nft}).`);
    }
    for (const needed of ["drop", "splitter", "pot"] as const) {
      if (CONTRACTS[needed] === null) {
        throw new Error(`--nft-only reuses the ${needed}, and it is not deployed.`);
      }
    }
  }
  // The escrow is last and on its own day, like the collection: it needs the
  // splitter to send its cut to, and it needs the game rules settled before
  // anybody stakes anything on them.
  const escrowOnly = process.argv.includes("--escrow-only");
  if (escrowOnly) {
    if (CONTRACTS.escrow !== null) {
      throw new Error(`lib/revenue.ts already names an escrow (${CONTRACTS.escrow}).`);
    }
    if (CONTRACTS.splitter === null) {
      throw new Error("--escrow-only pays its cut to the splitter, and there is not one.");
    }
  }

  // The Loaded Lions board: a second PrizePot holding $LION, and the door that
  // buys into it. Its own day like the escrow and the collection, and its own
  // flag, because it reuses the splitter and the router exactly as they are.
  const lionsOnly = process.argv.includes("--lions-only");
  if (lionsOnly) {
    if (CONTRACTS.lionPot !== null || CONTRACTS.lionEntry !== null) {
      throw new Error(
        `lib/revenue.ts already names the lions contracts ` +
          `(${CONTRACTS.lionPot}, ${CONTRACTS.lionEntry}). Deploying again makes a second pair ` +
          `nothing points at — and the first would keep taking entries.`,
      );
    }
    if (CONTRACTS.splitter === null) {
      throw new Error("--lions-only sends the game's half to the splitter, and there is not one.");
    }
  }

  const splitterOnly = process.argv.includes("--splitter-only");
  if (splitterOnly) {
    if (CONTRACTS.splitter !== null) {
      throw new Error(
        `lib/revenue.ts already names a splitter (${CONTRACTS.splitter}). ` +
          `Set it to null first, so the old address cannot be left behind in a half-done swap.`,
      );
    }
    if (CONTRACTS.drop === null || CONTRACTS.pot === null) {
      throw new Error("--splitter-only reuses the drop and the pot, and one of them is not deployed.");
    }
  } else if (!nftOnly && !escrowOnly && !lionsOnly) {
    const already = Object.entries(CONTRACTS).filter(([, address]) => address !== null);
    if (already.length > 0 && !process.argv.includes("--replace")) {
      throw new Error(
        `lib/revenue.ts already names ${already.map(([n]) => n).join(", ")}. ` +
          `Deploying again makes a second set nothing points at. Pass --replace if that is the intention.`,
      );
    }
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
  // Only when a collection is actually being deployed. Both of the narrow modes
  // leave it alone, and demanding a baseURI from a run that does not touch it
  // stops the run for a reason that does not apply to it.
  if (!baseURI && broadcast && !moneyOnly && !splitterOnly && !escrowOnly) {
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

  // Kept apart from `found`, which holds only what this run deployed and is what
  // gets written back. A reused address written back would look for `drop: null`
  // and there is nothing there to fill in.
  let dropAt: string;
  let potAt: string;
  if (lionsOnly) {
    dropAt = CONTRACTS.drop!;
    potAt = CONTRACTS.pot!;
    found.splitter = CONTRACTS.splitter!;
    console.log(`reusing splitter  ${found.splitter}`);
    console.log(`prize token       ${LION}  ($LION)`);

    // The pot first. The door is given its address and it is immutable there, so
    // the order is not a preference — it is the only order that can work.
    found.lionPot = await deploy("PrizePot", [LION, publisher]);
    found.lionEntry = await deploy("BoardEntry", [
      10n * 10n ** 18n, // ten CRO a go
      5_000n, // half of it buys $LION
      found.splitter,
      found.lionPot,
      LION,
      ROUTER,
    ]);

    console.log("\n--lions-only: a second prize pot holding $LION, and the door that buys into");
    console.log("it. Ten CRO a go: half to the splitter, half straight into the pot. Nothing");
    console.log("else was touched.");
    console.log("\nStill to do by hand, in this order:");
    console.log("  1. Put both addresses in lib/revenue.ts and deploy the site.");
    console.log("  2. setShare on the NEW pot: lions 10000 bps. It has one board and pays all of it.");
    console.log("  3. setShare on the OLD pot: lions 1000 bps, down from 2500.\n");
  } else if (escrowOnly) {
    dropAt = CONTRACTS.drop!;
    potAt = CONTRACTS.pot!;
    found.splitter = CONTRACTS.splitter!;
    console.log(`reusing splitter  ${found.splitter}`);
    found.escrow = await deploy("MatchEscrow", [found.splitter, publisher]);
    console.log("--escrow-only: only the match escrow was deployed, against the splitter that");
    console.log("was already there. Nothing else was touched.\n");
  } else if (nftOnly) {
    dropAt = CONTRACTS.drop!;
    potAt = CONTRACTS.pot!;
    found.splitter = CONTRACTS.splitter!;
    console.log(`reusing splitter  ${found.splitter}`);
  } else if (splitterOnly) {
    dropAt = CONTRACTS.drop!;
    potAt = CONTRACTS.pot!;
    console.log(`reusing drop  ${dropAt}`);
    console.log(`reusing pot   ${potAt}\n`);
  } else {
    dropAt = found.drop = await deploy("HolderDrop", [CROCARD, publisher]);
    potAt = found.pot = await deploy("PrizePot", [CROCARD, publisher]);
  }
  if (!nftOnly && !escrowOnly && !lionsOnly) {
    found.splitter = await deploy("Splitter", [
      ROUTER,
      CROCARD,
      dropAt,
      BURN_ADDRESS,
      potAt,
    ]);
  }
  if (lionsOnly || escrowOnly) {
    // Said above, next to the deploy.
  } else if (splitterOnly) {
    console.log("--splitter-only: only the splitter was deployed. The drop and the pot are the");
    console.log("ones that were already there, and the collection is untouched.\n");
  } else if (moneyOnly) {
    console.log("--money-only: the collection is not deployed. Run again without it once the");
    console.log("art is final and uploaded, and pass --base-uri.\n");
  } else {
    // Royalties are paid here and the address is immutable once set, so a
    // collection deployed against nothing pays its royalties to nothing.
    if (!found.splitter) throw new Error("No splitter to pay royalties to.");
    found.nft = await deploy("CardsOfCronosSetOne", [
      name,
      symbol,
      maxSupply,
      baseURI,
      allowlist.root,
      found.splitter,
    ]);
    if (nftOnly) {
      console.log("--nft-only: only the collection was deployed, against the splitter, drop and");
      console.log("pot that were already there.\n");
    }
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
  // Not in splitter-only mode: that pot is already deployed and already has its
  // shares, and the owner may have moved them since with setShare. Writing the
  // starting position back over a considered one would be a silent change to
  // where the prize money goes.
  // Nor in lions-only mode. That run deploys a pot with ONE board in it, which
  // wants all ten thousand rather than a quarter — and it must not write the
  // starting position back over the old pot, whose lions share is about to be
  // moved the other way. Both are printed as steps instead, because they are
  // two different numbers on two different contracts and getting them the wrong
  // way round is a prize paid out of the wrong pot.
  for (const [board, bps] of splitterOnly || nftOnly || escrowOnly || lionsOnly ? [] : SHARES) {
    await call(
      found.pot!,
      `setShare(${board}, ${bps} bps)`,
      selector("setShare(bytes32,uint256)") + asWord(board) + word(BigInt(bps)),
    );
  }
  if (!splitterOnly && !nftOnly && !escrowOnly && !lionsOnly) {
    console.log(
      `  boards: ${SHARES.map(([b, v]) => `${b} ${v / 100}%`).join(", ")}` +
        `, ${(10_000 - SHARES.reduce((sum, [, v]) => sum + v, 0)) / 100}% stays in the pot\n`,
    );
  }

  const cost = spent * gasPrice;
  console.log(
    `${nftOnly ? "the collection" : splitterOnly ? "the splitter" : escrowOnly ? "the escrow" : lionsOnly ? "the pot and the door" : moneyOnly ? "the three" : "all four"}: ${spent} gas, about ${cost / 10n ** 16n} / 100 CRO ` +
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
    // Reused rather than deployed in --nft-only, and the write-back looks for
    // `splitter: null` to fill in. It is not null, so it must not be offered.
    // Reused rather than deployed in --escrow-only too, for the same reason.
    ["splitter", nftOnly || escrowOnly ? undefined : found.splitter],
    ["pot", found.pot],
    ["nft", found.nft],
    ["escrow", found.escrow],
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
    `${nftOnly ? "The collection" : splitterOnly ? "The splitter" : moneyOnly ? "The three" : "All four"} written into ${file}.` +
      (moneyOnly ? " nft is left null until the collection is deployed." : ""),
  );
  console.log(`\nStill to do: set the wallets in ${file}, and the two Worker secrets.`);
}

void main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
