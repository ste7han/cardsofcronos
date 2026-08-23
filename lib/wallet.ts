"use client";

// Talking to an EVM wallet, without a wallet library.
//
// The old dapp reached for Reown AppKit, and for what it was doing — minting,
// which is a real transaction — that was the right call. Nothing here sends a
// transaction. Signing in needs one method, `personal_sign`, and every wallet on
// Cronos injects an EIP-1193 provider that has it. A provider tree, a modal and
// a chain adapter for one signature is a lot of dependency for one signature,
// and AppKit talks to this same injected object underneath anyway.
//
// When the mint arrives and something actually has to be sent, that is the point
// where a wallet library earns its place. Not before.
//
// Nothing here signs a transaction and nothing here can. `personal_sign` takes
// plain bytes and returns a signature over them; a wallet will not turn that
// into a transfer, and the text it shows the signer says so.

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
