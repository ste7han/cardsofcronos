// The owner's four switches on the card collection, and what they are now.
//
//   npm run mint-control                          read the contract and stop
//   npm run mint-control -- --price 15            what a card costs, in CRO
//   npm run mint-control -- --claims open         the free mints for the first collection
//   npm run mint-control -- --sale open           the paid mint
//   ... add --broadcast to any of them to send it
//
// Reading is free and always happens, whatever else is asked for. It prints
// before and after, because a switch is worth nothing if nobody can tell which
// way it is pointing — and three of these four decide whether strangers can
// spend money.
//
// ── WHY THIS IS A SCRIPT AND NOT A NOTE IN A README ──────────────────────────
//
// The collection is deployed with both doors shut. Opening a mint is two
// transactions at whatever hour somebody picks, against a contract where three
// of these four switches decide whether strangers can spend money. Written down
// as steps in a README, the step that gets skipped is the one that checks.
//
// ── WHAT IT REFUSES ──────────────────────────────────────────────────────────
//
// Opening a door while the price is nowhere near what the site quotes. An
// earlier version of this contract inherited the first collection's 150 CRO and
// had to be corrected after deploying; the default is 15 now, so the window is
// gone, but the refusal stays because the price has a setter and the mistake
// cannot be taken back — somebody buys at the wrong price in the seconds before
// it is noticed, and there is no refund in the contract. It also refuses a price
// of zero.
//
// It does NOT refuse to open a door because the provenance hash is unpublished
// or the site is not deployed. It cannot see either, and a check that pretends
// to know is worse than none.
//
// DEPLOY_KEY is read from the environment and never from an argument: argv is
// visible to anybody who can run ps.

import { hexToBytes, normalise } from "@/lib/address";
import { PUBLIC_RPCS } from "@/lib/cronos";
import { CONTRACTS, MINT_PRICE_CRO } from "@/lib/revenue";
import { CRONOS_CHAIN_ID, addressOfKey, selector, signTransaction, word } from "@/lib/evm-tx";

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

const flag = (name: string): string | null => {
  const at = process.argv.indexOf(`--${name}`);
  return at === -1 ? null : process.argv[at + 1] ?? null;
};

const ONE_CRO = 10n ** 18n;

interface State {
  price: bigint;
  claims: boolean;
  sale: boolean;
  next: number;
  max: number;
  owner: string;
  baseURI: string;
}

async function read(nft: string): Promise<State> {
  const get = async (signature: string): Promise<string> =>
    (await rpc("eth_call", [{ to: nft, data: selector(signature) }, "latest"])) as string;

  // tokenURI(1) is how the baseURI is read, because the contract keeps `_base`
  // private and there is no getter. Token 1 exists only once something is
  // minted, so before that this asks for it and accepts the revert.
  let baseURI = "(nothing minted yet, so tokenURI cannot be asked)";
  try {
    const answer = (await rpc("eth_call", [
      { to: nft, data: selector("tokenURI(uint256)") + word(1n) },
      "latest",
    ])) as string;
    const body = answer.slice(2);
    const length = Number(BigInt("0x" + body.slice(64, 128)));
    baseURI = Buffer.from(body.slice(128, 128 + length * 2), "hex").toString();
  } catch {
    // Left as it is. A revert here is the ordinary state before the first mint.
  }

  return {
    price: BigInt(await get("mintPrice()")),
    claims: BigInt(await get("claimsOpen()")) === 1n,
    sale: BigInt(await get("saleOpen()")) === 1n,
    next: Number(BigInt(await get("nextTokenId()"))),
    max: Number(BigInt(await get("maxSupply()"))),
    owner: "0x" + (await get("owner()")).slice(-40),
    baseURI,
  };
}

function show(title: string, state: State): void {
  const cro = Number(state.price) / Number(ONE_CRO);
  console.log(`\n${title}`);
  console.log(`  price        ${cro} CRO a card`);
  console.log(`  claims       ${state.claims ? "OPEN" : "shut"}`);
  console.log(`  sale         ${state.sale ? "OPEN" : "shut"}`);
  console.log(`  minted       ${state.next - 1} of ${state.max}`);
  console.log(`  owner        ${state.owner}`);
  console.log(`  art          ${state.baseURI}`);
}

async function main(): Promise<void> {
  const nft = CONTRACTS.nft;
  if (!nft) throw new Error("lib/revenue.ts names no collection, so there is nothing to control.");

  const broadcast = process.argv.includes("--broadcast");
  const price = flag("price");
  const claims = flag("claims");
  const sale = flag("sale");

  for (const [name, value] of [["claims", claims], ["sale", sale]] as const) {
    if (value !== null && value !== "open" && value !== "shut") {
      throw new Error(`--${name} takes "open" or "shut", not "${value}".`);
    }
  }

  const before = await read(nft);
  show(`the collection at ${nft}`, before);

  const wanted: { what: string; data: string }[] = [];

  if (price !== null) {
    const cro = Number(price);
    if (!Number.isInteger(cro) || cro <= 0) {
      throw new Error(`--price ${price} is not a price in whole CRO.`);
    }
    if (cro !== MINT_PRICE_CRO) {
      // Not a hard refusal: the price is the owner's to move, and DESIGN.md is
      // not the chain. Loud, though, because the page will go on quoting the
      // other number until somebody changes it, and a page that quotes a price
      // the chain does not charge is the complaint that follows.
      console.log(
        `\n  NOTE: lib/revenue.ts says a card is ${MINT_PRICE_CRO} CRO and this sets ${cro}.` +
          `\n  The mint page quotes the file, so change it there too or they disagree.`,
      );
    }
    wanted.push({
      what: `setMintPrice — ${Number(before.price) / Number(ONE_CRO)} to ${cro} CRO`,
      data: selector("setMintPrice(uint256)") + word(BigInt(cro) * ONE_CRO),
    });
  }

  const opening = claims === "open" || sale === "open";
  if (opening) {
    // The price first, always. Whether it is being set in this same run or was
    // set in an earlier one, what matters is what the chain will charge the
    // moment the door opens.
    const after = price !== null ? BigInt(Number(price)) * ONE_CRO : before.price;
    // Five times what the site quotes. Wide on purpose: this is a guard against
    // a wrong number, not a second opinion about the maker's pricing.
    if (after > BigInt(MINT_PRICE_CRO * 5) * ONE_CRO) {
      throw new Error(
        `The price is ${Number(after) / Number(ONE_CRO)} CRO a card and the site quotes ` +
          `${MINT_PRICE_CRO}. Set it before opening anything: there is no refund in the contract ` +
          `for somebody who buys at the wrong one.`,
      );
    }
    if (after === 0n) throw new Error("The price is zero. Nothing opens at zero.");
    if (before.baseURI.startsWith("(") || before.baseURI.trim() === "") {
      // Only reachable once something is minted, which is exactly when it would
      // matter. Before that the read cannot see the baseURI at all and says so.
      console.log("\n  NOTE: the art could not be read back, so it was not checked.");
    }
  }

  if (claims !== null) {
    wanted.push({
      what: `setClaimsOpen — ${before.claims ? "OPEN" : "shut"} to ${claims.toUpperCase()}`,
      data: selector("setClaimsOpen(bool)") + word(claims === "open" ? 1n : 0n),
    });
  }
  if (sale !== null) {
    wanted.push({
      what: `setSaleOpen — ${before.sale ? "OPEN" : "shut"} to ${sale.toUpperCase()}`,
      data: selector("setSaleOpen(bool)") + word(sale === "open" ? 1n : 0n),
    });
  }

  if (wanted.length === 0) {
    console.log("\nNothing asked for. Pass --price, --claims or --sale to change something.\n");
    return;
  }

  console.log("");
  for (const one of wanted) console.log(`  ${one.what}`);

  if (!broadcast) {
    console.log("\nNothing was sent. Add --broadcast to do it for real.\n");
    return;
  }

  const secret = process.env.DEPLOY_KEY;
  if (!secret) throw new Error("Set DEPLOY_KEY in the environment. Never as an argument.");
  const digits = secret.replace(/^0x/, "");
  if (digits.length !== 64) {
    throw new Error(`DEPLOY_KEY is ${digits.length} hex digits and a private key is 64.`);
  }
  const key = hexToBytes(secret);
  const from = addressOfKey(key);
  if (normalise(from) !== normalise(before.owner)) {
    throw new Error(
      `DEPLOY_KEY is ${from} and the owner is ${before.owner}. Every one of these is onlyOwner.`,
    );
  }

  let nonce = Number(BigInt(await rpc("eth_getTransactionCount", [from, "pending"])));
  const gasPrice = BigInt(await rpc("eth_gasPrice", []));

  for (const one of wanted) {
    console.log(`\n${one.what}`);
    const gas = BigInt(await rpc("eth_estimateGas", [{ from, to: nft, data: one.data }]));
    const raw = signTransaction(
      {
        nonce: BigInt(nonce++),
        gasPrice,
        gasLimit: (gas * 13n) / 10n,
        to: nft,
        value: 0n,
        data: one.data,
        chainId: CRONOS_CHAIN_ID,
      },
      key,
    );
    const hash = (await rpc("eth_sendRawTransaction", [raw])) as string;
    console.log(`  sent  ${hash}`);

    let done = false;
    for (let tries = 0; tries < 60 && !done; tries++) {
      const receipt = await rpc("eth_getTransactionReceipt", [hash]);
      if (receipt) {
        if (BigInt(receipt.status) !== 1n) throw new Error(`${one.what} reverted: ${hash}`);
        console.log("  done");
        done = true;
      } else {
        await new Promise((wake) => setTimeout(wake, 3_000));
      }
    }
    if (!done) throw new Error(`${one.what} was sent but never confirmed: ${hash}`);
  }

  // Read again rather than assuming. The receipt says the transaction did not
  // revert; this says what the contract now holds, which is the thing anybody
  // actually wanted to know.
  show("read back off the chain", await read(nft));
  console.log("");
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
