// Reading the collection's counters, and the calldata to mint against them.
//
// Shared by the route that answers /api/mint and by nothing else on the server.
// The calldata builders are here rather than in lib/wallet.ts because that file
// is the wallet, not this contract — it knows how to send a call and should not
// also know what this game sells.
//
// ── HAND-ENCODED, AND WHY THAT IS SAFE HERE ──────────────────────────────────
//
// Two calls, both small, both with a test that pulls the bytes apart. `buy` is
// one word. `claim` has a dynamic array in the middle, which is the one that
// goes wrong: the offset is counted in bytes from the start of the arguments,
// and a wrong offset is a transaction that reverts with nothing in it that says
// why. test/mint.test.ts checks the offset moves when the proof grows, which is
// the bug an offset written as a constant produces.
//
// ── THE PRICE IS READ, NEVER ASSUMED ─────────────────────────────────────────
//
// `priceFor(address)` takes the $CROCARD discount into account, and what the
// page shows has to be what the chain will charge — the contract refunds an
// overpayment but reverts an underpayment, so a page quoting too little is a
// wallet full of failed transactions. lib/revenue.ts holds the list price for
// the copy; this holds what is actually owed.

import { PUBLIC_RPCS } from "@/lib/cronos";
import { selector, topicOf, word } from "@/lib/evm-tx";
import { CONTRACTS } from "@/lib/revenue";

/**
 * The ERC721 (and ERC20) Transfer topic.
 *
 * It lives here rather than in lib/feed.ts because a browser needs it — reading
 * which tokens a mint produced out of the receipt — and lib/feed.ts pulls in the
 * database and the Discord client behind it. One definition either way: the feed
 * imports this one.
 */
export const TRANSFER = topicOf("Transfer(address,address,uint256)");

/** What the contract says about itself, as far as a buyer needs it. */
export interface MintState {
  /** The collection, or null when there is not one. */
  contract: string | null;
  /** May anybody buy right now? */
  saleOpen: boolean;
  /** May the first collection's holders take their free mints? */
  claimsOpen: boolean;
  /** What one card costs this wallet, in wei, discount included. */
  price: string;
  /** How many have been minted, and how many there will ever be. */
  minted: number;
  supply: number;
  /** Most the contract will mint in one transaction. */
  maxPerTx: number;
}

async function ask(rpcs: readonly string[], to: string, data: string): Promise<string> {
  let last = "no endpoint answered";
  for (const url of rpcs) {
    try {
      const answer = await fetch(url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          method: "eth_call",
          params: [{ to, data }, "latest"],
        }),
      });
      const found = (await answer.json()) as { result?: string; error?: { message?: string } };
      if (found.error) throw new Error(found.error.message ?? "rejected");
      if (found.result !== undefined) return found.result;
    } catch (error) {
      last = error instanceof Error ? error.message : String(error);
    }
  }
  throw new Error(`eth_call: ${last}`);
}

/**
 * The counters, for a wallet or for nobody.
 *
 * `wallet` only changes the price, through the discount. Everything else is the
 * same for everybody, which is why a signed-out visitor still gets a real answer
 * — at the list price, because a discount that could not be verified is a
 * discount nobody earned.
 */
export async function mintState(
  wallet: string | null,
  secretRpc?: string | null,
): Promise<MintState> {
  const contract = CONTRACTS.nft;
  if (contract === null) {
    return {
      contract: null,
      saleOpen: false,
      claimsOpen: false,
      price: "0",
      minted: 0,
      supply: 0,
      maxPerTx: 0,
    };
  }

  const rpcs = secretRpc ? [secretRpc, ...PUBLIC_RPCS] : PUBLIC_RPCS;
  const flag = async (signature: string): Promise<boolean> =>
    BigInt(await ask(rpcs, contract, selector(signature))) === 1n;
  const number = async (signature: string): Promise<number> =>
    Number(BigInt(await ask(rpcs, contract, selector(signature))));

  // priceFor(0x0) is the list price: the zero address holds no $CROCARD, so the
  // discount is zero. That is deliberately the same call as a real wallet's
  // rather than a second path, so a signed-out price cannot drift from a
  // signed-in one.
  const asked = wallet ?? "0x" + "0".repeat(40);
  const price = BigInt(
    await ask(rpcs, contract, selector("priceFor(address)") + word(asked)),
  ).toString();

  const [saleOpen, claimsOpen, next, supply, maxPerTx] = await Promise.all([
    flag("saleOpen()"),
    flag("claimsOpen()"),
    number("nextTokenId()"),
    number("maxSupply()"),
    number("MAX_MINT_PER_TX()"),
  ]);

  return { contract, saleOpen, claimsOpen, price, minted: next - 1, supply, maxPerTx };
}

/** How many free mints this wallet has already taken. */
export async function claimedBy(wallet: string, secretRpc?: string | null): Promise<number> {
  const contract = CONTRACTS.nft;
  if (contract === null) return 0;
  const rpcs = secretRpc ? [secretRpc, ...PUBLIC_RPCS] : PUBLIC_RPCS;
  return Number(BigInt(await ask(rpcs, contract, selector("claimed(address)") + word(wallet))));
}

/** The calldata for `buy(uint256)`. Payable — the CRO goes in the value. */
export function buyData(amount: number): string {
  if (!Number.isInteger(amount) || amount < 1) {
    throw new Error(`${amount} is not a number of cards.`);
  }
  return selector("buy(uint256)") + word(BigInt(amount));
}

/**
 * The calldata for `claim(uint256 allowance, bytes32[] proof, uint256 amount)`.
 *
 * Note the shape: `allowance` is what the merkle leaf says this wallet is owed
 * in total and cannot be inflated — change it and the proof stops matching —
 * while `amount` is how many to take now. They are different numbers on purpose,
 * so somebody owed sixty-three can take them in several goes.
 *
 * The proof is the second of three arguments, so its offset is 0x60: three words
 * of head come before the array's body. Written out rather than calculated,
 * because there is exactly one shape here and a formula would be harder to
 * check than the number it produces.
 */
export function claimData(allowance: number, proof: readonly string[], amount: number): string {
  if (!Number.isInteger(amount) || amount < 1) {
    throw new Error(`${amount} is not a number of cards.`);
  }
  if (amount > allowance) {
    throw new Error(`Asked for ${amount} of an allowance of ${allowance}.`);
  }
  return (
    selector("claim(uint256,bytes32[],uint256)") +
    word(BigInt(allowance)) +
    word(0x60n) +
    word(BigInt(amount)) +
    word(BigInt(proof.length)) +
    proof.map((step) => word(step)).join("")
  );
}
