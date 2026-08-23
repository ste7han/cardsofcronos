// Ethereum addresses, and the one thing about them that bites.
//
// This replaces the base58 decoder the Solana version of this project used. The
// reasoning carries over unchanged: an address that parses into something
// plausible when it was mistyped is worse than one that refuses, because the
// failure is silent. An admin address that is wrong does not throw — it simply
// never matches, and whoever it belonged to is locked out with nothing to read.
//
// What is new here, and what base58 never had to deal with: **an EVM address is
// the same address in any case**. `0xABC…` and `0xabc…` are one wallet. Left
// alone that turns into two players, two referral rows and two sets of points
// for one person, and nothing about it looks wrong until someone counts. So
// there is exactly one stored form — lowercase — and `normalise` is the only
// door into it.

import { keccak_256 } from "@noble/hashes/sha3";

const SHAPE = /^0x[0-9a-fA-F]{40}$/;

/** Does this look like an address at all? Says nothing about the checksum. */
export function isAddress(text: string): boolean {
  return SHAPE.test(text);
}

/**
 * The one form an address is stored and compared in: lowercase, with the 0x.
 *
 * Throws rather than returning null. Every caller is checking an identity, and a
 * caller who forgets to check a null is a caller who has just accepted an empty
 * one.
 */
export function normalise(text: string): string {
  const trimmed = text.trim();
  if (!isAddress(trimmed)) {
    throw new Error(`"${text}" is not an Ethereum address: expected 0x and forty hex digits.`);
  }
  const lower = trimmed.toLowerCase();
  // A mixed-case address carries its own checksum, so if someone hands us one we
  // can catch a typo they could not. An all-lower or all-upper address carries
  // no checksum at all and there is nothing to check.
  const body = trimmed.slice(2);
  const mixed = body !== body.toLowerCase() && body !== body.toUpperCase();
  if (mixed && checksum(lower) !== trimmed) {
    throw new Error(`${trimmed} fails its EIP-55 checksum. One character of it is wrong.`);
  }
  return lower;
}

/**
 * The mixed-case form, for showing a person. EIP-55.
 *
 * Never store this. It exists so an address on screen can be checked by eye
 * against a block explorer, and so a copied one carries its own typo detection.
 */
export function checksum(text: string): string {
  const body = text.trim().replace(/^0x/, "").toLowerCase();
  if (body.length !== 40 || !/^[0-9a-f]{40}$/.test(body)) {
    throw new Error(`"${text}" is not an Ethereum address.`);
  }
  const hash = bytesToHex(keccak_256(new TextEncoder().encode(body)));
  let out = "0x";
  for (let i = 0; i < 40; i++) {
    out += parseInt(hash[i]!, 16) >= 8 ? body[i]!.toUpperCase() : body[i]!;
  }
  return out;
}

/**
 * The address a public key belongs to.
 *
 * Takes the uncompressed key, with or without its 0x04 prefix: the last twenty
 * bytes of the keccak of the sixty-four coordinate bytes.
 */
export function addressOf(publicKey: Uint8Array): string {
  const body = publicKey.length === 65 ? publicKey.subarray(1) : publicKey;
  if (body.length !== 64) {
    throw new Error(`A public key is 64 bytes, or 65 with its prefix. This one is ${publicKey.length}.`);
  }
  return "0x" + bytesToHex(keccak_256(body)).slice(-40);
}

/** Hex to bytes, with or without the 0x. Throws on anything that is not hex. */
export function hexToBytes(text: string): Uint8Array {
  const body = text.startsWith("0x") ? text.slice(2) : text;
  if (body.length % 2 !== 0) throw new Error("Hex with an odd number of digits.");
  if (body.length > 0 && !/^[0-9a-fA-F]+$/.test(body)) {
    throw new Error(`"${text}" is not hex.`);
  }
  const bytes = new Uint8Array(body.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(body.slice(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

/** The other direction. No 0x — callers that want one say so. */
export function bytesToHex(bytes: Uint8Array): string {
  let out = "";
  for (const byte of bytes) out += byte.toString(16).padStart(2, "0");
  return out;
}
