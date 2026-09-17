"use client";

// Talking to an EVM wallet, without a wallet library.
//
// The old dapp reached for Reown AppKit. Signing in needs one method,
// `personal_sign`, and every wallet on Cronos injects an EIP-1193 provider that
// has it — a provider tree, a modal and a chain adapter for one signature is a
// lot of dependency for one signature, and AppKit talks to this same injected
// object underneath anyway.
//
// ── IT SENDS ONE TRANSACTION NOW ─────────────────────────────────────────────
//
// This file used to say nothing here sends a transaction, and that when
// something did, that would be the point where a wallet library earns its place.
// Claiming from contracts/HolderDrop.sol is that something, and the library
// still does not earn it: one `eth_sendTransaction` with hand-encoded calldata,
// plus asking the wallet to be on the right chain first.
//
// What that changes about the risk is the part worth stating. `personal_sign`
// cannot move anything — a wallet will not turn a signature over plain bytes
// into a transfer. `eth_sendTransaction` can, so everything below that builds
// calldata does it from arguments this file was given, and there is exactly one
// function it knows how to call.

import { challenge, newNonce, type WalletProof } from "@/lib/session";
import { bytesToHex, normalise } from "@/lib/address";

interface Eip1193 {
  request(args: { method: string; params?: unknown[] }): Promise<unknown>;
  isMetaMask?: boolean;
  /** MetaMask's convention when more than one extension is installed. */
  providers?: Eip1193[];
}

interface Injected {
  ethereum?: Eip1193;
  /** Crypto.com's wallet, which is the one this game's players are likeliest to have. */
  deficonnectProvider?: Eip1193;
}

/**
 * The wallet this browser has, if it has one.
 *
 * `window.ethereum` is a single slot that every extension writes to, and the
 * last one to load wins. When several are installed MetaMask publishes the whole
 * list on `.providers`, so prefer that over whoever happened to load last.
 */
export function provider(): Eip1193 | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as Injected;
  const injected = w.ethereum;
  if (injected?.providers?.length) {
    return injected.providers[0] ?? injected;
  }
  return injected ?? w.deficonnectProvider ?? null;
}

/**
 * Connect, then ask the wallet to sign a challenge naming itself.
 *
 * Two steps and not one: connecting tells us which address is offering itself,
 * and signing is what makes that claim worth anything. The address alone is
 * public — see lib/session.ts for why that matters here more than usual.
 */
export async function connectAndProve(): Promise<WalletProof> {
  const wallet = provider();
  if (!wallet) {
    throw new Error(
      "No wallet found in this browser. MetaMask and the Crypto.com wallet both work.",
    );
  }

  const accounts = await wallet.request({ method: "eth_requestAccounts" });
  if (!Array.isArray(accounts) || typeof accounts[0] !== "string") {
    throw new Error("The wallet connected but named no account.");
  }
  // Normalised before it is signed, so the address inside the message and the
  // address the site stores are the same string. A wallet that hands back a
  // checksummed address and a database that keys on lowercase is two of one
  // player, and it looks like nothing until somebody counts.
  const address = normalise(accounts[0]);

  const unsigned = { address, issuedAt: Date.now(), nonce: newNonce() };
  const message = challenge(unsigned);

  // Hex rather than the plain string. Wallets accept both, but a message that
  // begins with 0x — or that a wallet decides looks like hex — is ambiguous, and
  // the ambiguity is resolved differently by different wallets.
  const hex = "0x" + bytesToHex(new TextEncoder().encode(message));
  const signature = await wallet.request({ method: "personal_sign", params: [hex, address] });

  if (typeof signature !== "string") {
    throw new Error("The wallet returned a signature in a shape this site cannot read.");
  }

  return { ...unsigned, signature };
}

/** What went wrong, in words a person can act on. */
export function reasonFor(error: unknown): string {
  const code = (error as { code?: number } | null)?.code;
  // 4001 is the EIP-1193 code for "the user said no".
  if (code === 4001) return "You turned down the signature. Nothing happened.";
  // -32002 is a request already sitting in the wallet, unanswered. Telling
  // somebody to look at their extension is more use than telling them it failed.
  if (code === -32002) return "The wallet is already asking. Open it and answer there.";
  if (error instanceof Error && error.message) return error.message;
  return "The wallet did not answer.";
}

/** Cronos mainnet, as a wallet wants to hear it. */
const CRONOS = "0x19";

/**
 * Cronos as a wallet that has never heard of it wants to hear it.
 *
 * Only used when `wallet_switchEthereumChain` comes back with 4902, which is a
 * wallet saying it does not know this chain. The RPC is a public one and the
 * explorer is the one every link on this site points at.
 */
const CRONOS_CHAIN = {
  chainId: CRONOS,
  chainName: "Cronos",
  nativeCurrency: { name: "Cronos", symbol: "CRO", decimals: 18 },
  rpcUrls: ["https://evm.cronos.org"],
  blockExplorerUrls: ["https://cronoscan.com"],
};

/**
 * Makes sure the wallet is on Cronos, asking to switch if it is not.
 *
 * Before sending and not after. A transaction sent on the wrong chain does not
 * fail — it goes somewhere, to an address that on that chain is either nothing
 * or somebody else's contract, and the wallet shows a perfectly ordinary
 * confirmation while it happens.
 */
export async function ensureCronos(): Promise<void> {
  const wallet = provider();
  if (wallet === null) throw new Error("No wallet in this browser.");

  const on = (await wallet.request({ method: "eth_chainId" })) as string;
  if (on?.toLowerCase() === CRONOS) return;

  try {
    await wallet.request({ method: "wallet_switchEthereumChain", params: [{ chainId: CRONOS }] });
  } catch (error) {
    // 4902 is "this wallet does not have that chain". Anything else — including
    // the person saying no — is theirs to have said, and is passed on.
    if ((error as { code?: number } | null)?.code !== 4902) throw error;
    await wallet.request({ method: "wallet_addEthereumChain", params: [CRONOS_CHAIN] });
  }
}

/** A value as a thirty-two byte ABI word, without the 0x. */
function word(value: bigint | string): string {
  const hex =
    typeof value === "bigint" ? value.toString(16) : value.replace(/^0x/, "").toLowerCase();
  if (hex.length > 64) throw new Error(`That does not fit in a word: ${hex}`);
  return hex.padStart(64, "0");
}

/**
 * The calldata for `claim(address,uint256,bytes32[])`.
 *
 * Hand-encoded, and the one thing this file knows how to call. The proof is a
 * dynamic array, so the third argument is an OFFSET to where the array lives
 * rather than the array — 0x60, because three arguments have gone before it —
 * and the array itself is its length followed by its elements.
 *
 * The selector is passed in rather than computed here. lib/evm-tx.ts already
 * knows how to hash a signature and it is the file the cron uses, so having a
 * second one would be two answers to what four bytes mean.
 */
export function claimData(
  selector: string,
  holder: string,
  earned: bigint,
  proof: readonly string[],
): string {
  return (
    selector +
    word(holder) +
    word(earned) +
    word(0x60n) +
    word(BigInt(proof.length)) +
    proof.map((step) => word(step)).join("")
  );
}

/**
 * Sends one call to a contract from the signed-in wallet. Returns the hash.
 *
 * No gas and no gas price: the wallet estimates both and shows them to the
 * person before they agree. Guessing here would mean a number in somebody\'s
 * confirmation screen that this project chose and they did not.
 */
export async function sendCall(from: string, to: string, data: string): Promise<string> {
  const wallet = provider();
  if (wallet === null) throw new Error("No wallet in this browser.");

  await ensureCronos();
  const hash = await wallet.request({
    method: "eth_sendTransaction",
    params: [{ from, to, data }],
  });
  if (typeof hash !== "string") throw new Error("The wallet did not return a transaction.");
  return hash;
}
