// Which wallet is at this browser.
//
// One idea, kept apart from what any particular wallet is allowed to do. A
// session says "whoever is here holds this address" and nothing more; the admin
// (lib/admin.ts) is one permission built on top of it, and owning cards is
// another. Folding the two together is how you end up with a site where the
// only person who can log in is the one person who does not need to.
//
// A signature and not an address. Every address is public the moment its wallet
// does anything on-chain, so an address someone typed proves nothing at all —
// the only thing separating a holder from a reader is that a holder can sign.
// The wallet signs a line of text naming itself, the moment and a nonce, and
// that signature is re-checked on every read rather than swapped for a stored
// "yes".
//
// On EVM the check runs the other way round from the Solana version this came
// from. There is no public key to fetch: the address *is* a hash of the key, so
// the key is recovered from the signature and hashed, and the result either is
// the address the proof claims or it is not. One fewer thing to look up, and no
// way to verify against a key the proof did not actually name.
//
// What this is not: security. Verification happens in a browser the visitor
// owns, so a determined person can patch the running app and claim any address
// they like. Today that gets them a deck builder full of cards nobody can play
// for money. The moment there is a stake, this same proof has to be checked on
// the server and the client's answer stops counting.

import { secp256k1 } from "@noble/curves/secp256k1";
import { keccak_256 } from "@noble/hashes/sha3";

import { addressOf, hexToBytes, normalise } from "@/lib/address";

/** How long a session lasts before the wallet has to sign again. */
export const SESSION_LIFE = 12 * 60 * 60 * 1000;

const KEY = "coc.session.v1";

/** Fired on this window whenever the session appears, changes or goes. */
export const SESSION_EVENT = "coc:session";

export interface WalletProof {
  address: string;
  issuedAt: number;
  nonce: string;
  /** The signature over `challenge()`, 65 bytes of hex as personal_sign returns it. */
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
    "Cards of Cronos — sign in",
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
 * What `personal_sign` actually hashes.
 *
 * EIP-191: a 0x19 byte, then the fixed string, then the message's own byte
 * length, then the message itself. The 0x19 is what stops a wallet being talked
 * into signing something that is also a valid transaction, so it is the whole
 * point of the prefix rather than decoration on it.
 *
 * The length is in bytes and not characters — a message with an accent in it
 * hashes to the wrong thing if you count the string instead, and it would fail
 * only for the people whose names have one.
 */
export function signingHash(message: string): Uint8Array {
  const body = new TextEncoder().encode(message);
  const prefix = new TextEncoder().encode(`\x19Ethereum Signed Message:\n${body.length}`);
  const both = new Uint8Array(prefix.length + body.length);
  both.set(prefix);
  both.set(body, prefix.length);
  return keccak_256(both);
}

/**
 * Does this proof show that someone holds the address it names?
 *
 * The address is recovered from the signature rather than compared against a
 * list, because that is the question being asked: not "is this the admin" — that
 * is decided afterwards, by comparing addresses — but "is this address anybody's
 * to claim".
 */
export function verifyProof(proof: WalletProof, now: number): boolean {
  if (!Number.isFinite(proof.issuedAt)) return false;
  // Both directions. A clock that has run backwards and a proof dated forward to
  // outlive its window are the same kind of wrong.
  if (now < proof.issuedAt || now - proof.issuedAt > SESSION_LIFE) return false;

  try {
    const claimed = normalise(proof.address);
    const bytes = hexToBytes(proof.signature);
    if (bytes.length !== 65) return false;

    // v is 27 or 28 by long convention, and 0 or 1 from wallets that never read
    // the convention. Both are real and both arrive here.
    const v = bytes[64]!;
    const recovery = v >= 27 ? v - 27 : v;
    if (recovery !== 0 && recovery !== 1) return false;

    const hash = signingHash(challenge(proof));
    const signature = secp256k1.Signature.fromCompact(bytes.subarray(0, 64)).addRecoveryBit(
      recovery,
    );
    const signer = addressOf(signature.recoverPublicKey(hash).toRawBytes(false));
    return signer === claimed;
  } catch {
    // A malformed address, hex that is not hex, a signature that is not a point
    // on the curve — all of these are "no", and none of them should take the
    // page down.
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
 *
 * Lowercase, always. This is the identity every other part of the site keys on,
 * and one wallet arriving under two spellings is one player counted twice.
 */
export function signedIn(now: number = Date.now()): string | null {
  const proof = read();
  if (proof === null || !verifyProof(proof, now)) return null;
  return normalise(proof.address);
}

/** Keeps a proof, if it is good. Returns the address it proves, or null. */
export function keepProof(proof: WalletProof, now: number = Date.now()): string | null {
  if (!verifyProof(proof, now)) return null;
  window.localStorage.setItem(KEY, JSON.stringify(proof));
  window.dispatchEvent(new Event(SESSION_EVENT));
  return normalise(proof.address);
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
