// Which wallet is at this browser.
//
// One idea, kept apart from what any particular wallet is allowed to do. A
// session says "whoever is here holds this address" and nothing more; the admin
// (lib/admin.ts) is one permission built on top of it, and owning cards is
// another. Folding the two together is how you end up with a site where the
// only person who can log in is the one person who does not need to.
//
// A signature and not an address. Every Solana address is public the moment its
// wallet does anything on-chain, so an address someone typed proves nothing at
// all — the only thing separating a holder from a reader is that a holder can
// sign. The wallet signs a line of text naming itself, the moment and a nonce,
// and that signature is re-checked on every read rather than swapped for a
// stored "yes".
//
// What this is not: security. Verification happens in a browser the visitor
// owns, so a determined person can patch the running app and claim any address
// they like. Today that gets them a deck builder full of cards nobody can play
// for money. The moment there is a stake, this same proof has to be checked on
// the server and the client's answer stops counting. There is a matching note in
// DESIGN.md so this cannot quietly become load-bearing.

import { ed25519 } from "@noble/curves/ed25519";

import { base58Decode } from "@/lib/base58";

/** How long a session lasts before the wallet has to sign again. */
export const SESSION_LIFE = 12 * 60 * 60 * 1000;

const KEY = "tcg.session.v1";

/** Fired on this window whenever the session appears, changes or goes. */
export const SESSION_EVENT = "tcg:session";

export interface WalletProof {
  address: string;
  issuedAt: number;
  nonce: string;
  /** The signature over `challenge()`, base58 as wallets hand it over. */
  signature: string;
}

/**
 * Exactly what the wallet is asked to sign.
 *
 * Built from the stored fields rather than kept beside them, so a proof can only
 * ever verify against the message it was actually made for. The last line is
 * there because nobody should be asked to sign something without being told what
 * it can do — this one moves nothing and approves nothing.
 */
export function challenge(proof: Pick<WalletProof, "address" | "issuedAt" | "nonce">): string {
  return [
    "Trenches Card Game — sign in",
    "",
    `Wallet: ${proof.address}`,
    `Issued: ${new Date(proof.issuedAt).toISOString()}`,
    `Nonce: ${proof.nonce}`,
    "",
    "Signing this proves you hold this wallet. It is not a transaction:",
    "it moves nothing, approves nothing and costs nothing.",
  ].join("\n");
}

/**
 * Does this proof show that someone holds the address it names?
 *
 * The key comes out of the address in the proof rather than from a list, because
 * that is the question being asked: not "is this the admin" — that is decided
 * afterwards, by comparing addresses — but "is this address anybody's to claim".
 */
export function verifyProof(proof: WalletProof, now: number): boolean {
  if (!Number.isFinite(proof.issuedAt)) return false;
  // Both directions. A clock that has run backwards and a proof dated forward to
  // outlive its window are the same kind of wrong.
  if (now < proof.issuedAt || now - proof.issuedAt > SESSION_LIFE) return false;

  try {
    const key = base58Decode(proof.address);
    if (key.length !== 32) return false;
    const signature = base58Decode(proof.signature);
    if (signature.length !== 64) return false;
    return ed25519.verify(signature, new TextEncoder().encode(challenge(proof)), key);
  } catch {
    // Malformed base58, a signature that is not a point on the curve — all of
    // these are "no", and none of them should take the page down.
    return false;
  }
}

function read(): WalletProof | null {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<WalletProof>;
    if (
      typeof parsed.address !== "string" ||
      typeof parsed.nonce !== "string" ||
      typeof parsed.signature !== "string" ||
      typeof parsed.issuedAt !== "number"
    ) {
      return null;
    }
    return parsed as WalletProof;
  } catch {
    return null;
  }
}

/**
 * The proof itself, for the one caller that needs to hand it to a server.
 *
 * Every other reader wants signedIn(). This exists because linking an account
 * has to be checked by the Worker rather than by this browser — see lib/api.ts —
 * and the only thing worth sending is the signature, never the bare address.
 */
export function proofOf(now: number = Date.now()): WalletProof | null {
  const proof = read();
  return proof !== null && verifyProof(proof, now) ? proof : null;
}

/**
 * The wallet signed in on this browser, or none.
 *
 * Re-verified on every call rather than trusting a stored flag. That is the
 * whole reason the signature is what gets kept: writing this key by hand gets
 * you nowhere without the private key that goes with the address.
 */
export function signedIn(now: number = Date.now()): string | null {
  const proof = read();
  if (proof === null || !verifyProof(proof, now)) return null;
  return proof.address;
}

/** Keeps a proof, if it is good. Returns the address it proves, or null. */
export function keepProof(proof: WalletProof, now: number = Date.now()): string | null {
  if (!verifyProof(proof, now)) return null;
  window.localStorage.setItem(KEY, JSON.stringify(proof));
  window.dispatchEvent(new Event(SESSION_EVENT));
  return proof.address;
}

export function signOut(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(KEY);
  window.dispatchEvent(new Event(SESSION_EVENT));
}

/** A fresh nonce. Uniqueness is all that is asked of it. */
export function newNonce(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
}
