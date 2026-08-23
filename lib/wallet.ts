"use client";

// Talking to a Solana wallet, without a wallet library.
//
// @solana/wallet-adapter is the right answer once players connect, because it
// handles the long tail of wallets and the UI that goes with picking one. Today
// exactly one person connects — the deployer — and pulling in a provider tree
// and a modal for one wallet is a lot of dependency for one signature. The
// injected provider is what the adapter talks to underneath anyway.
//
// Nothing here signs a transaction and nothing here can. signMessage takes plain
// bytes and returns a signature over them; a wallet will not turn that into a
// transfer, and the text it shows the signer says so.

import { challenge, newNonce, type WalletProof } from "@/lib/session";
import { base58Encode } from "@/lib/base58";

interface SolanaProvider {
  publicKey?: { toString(): string } | null;
  connect(): Promise<{ publicKey: { toString(): string } }>;
  disconnect?(): Promise<void>;
  signMessage(message: Uint8Array, encoding?: string): Promise<unknown>;
}

interface Injected {
  phantom?: { solana?: SolanaProvider };
  backpack?: SolanaProvider;
  solflare?: SolanaProvider;
  solana?: SolanaProvider;
}

/**
 * The wallet this browser has, if it has one.
 *
 * Named providers before the generic `window.solana`, because more than one
 * extension writes to that and the last one to load wins — asking for Phantom by
 * name gets Phantom rather than whatever installed itself most recently.
 */
export function provider(): SolanaProvider | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as Injected;
  return w.phantom?.solana ?? w.backpack ?? w.solflare ?? w.solana ?? null;
}

/** Different wallets hand back the signature differently. Both shapes are real. */
function signatureBytes(result: unknown): Uint8Array {
  if (result instanceof Uint8Array) return result;
  if (result && typeof result === "object" && "signature" in result) {
    const signature = (result as { signature: unknown }).signature;
    if (signature instanceof Uint8Array) return signature;
  }
  throw new Error("The wallet returned a signature in a shape this site cannot read.");
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
    throw new Error("No Solana wallet found in this browser. Phantom, Solflare and Backpack all work.");
  }

  const { publicKey } = await wallet.connect();
  const address = publicKey.toString();

  const unsigned = { address, issuedAt: Date.now(), nonce: newNonce() };
  const signature = signatureBytes(
    await wallet.signMessage(new TextEncoder().encode(challenge(unsigned)), "utf8"),
  );

  return { ...unsigned, signature: base58Encode(signature) };
}

/** What went wrong, in words a person can act on. */
export function reasonFor(error: unknown): string {
  const code = (error as { code?: number } | null)?.code;
  // 4001 is the EIP-1193 code every wallet borrowed for "the user said no".
  if (code === 4001) return "You turned down the signature. Nothing happened.";
  if (error instanceof Error && error.message) return error.message;
  return "The wallet did not answer.";
}
