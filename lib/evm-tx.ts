// Signing and sending one transaction to Cronos.
//
// This exists because the weekly prize has to be awarded without anybody being
// awake, and awarding it is a transaction. There is no library here for it:
// adding ethers or viem to a Worker for two contract calls is megabytes of
// dependency for something that is an RLP encoder and a signature, both of which
// this repository already has the pieces for.
//
// ── WHAT IT IS ALLOWED TO DO ─────────────────────────────────────────────────
//
// The key this signs with is the PrizePot publisher. It may name the winner of a
// week that has not closed yet and nothing else — it cannot withdraw, cannot
// reopen a week, cannot reach the balance. That is the whole reason a key is
// allowed to live in a Worker at all. See contracts/PrizePot.sol.
//
// ── LEGACY TRANSACTIONS, ON PURPOSE ──────────────────────────────────────────
//
// Type 0 with EIP-155 replay protection, not EIP-1559. Cronos supports both and
// the legacy shape is four fields shorter, has one gas number to get right
// instead of two, and cannot fail by underpricing a tip. Nothing here is racing
// anybody for block space: it is one transaction a week and it can wait a block.

import { keccak_256 } from "@noble/hashes/sha3";
import { secp256k1 } from "@noble/curves/secp256k1";

import { addressOf, bytesToHex, hexToBytes } from "@/lib/address";

/** Cronos mainnet. Wrong here means a transaction that is valid on another chain. */
export const CRONOS_CHAIN_ID = 25;

type Rlp = Uint8Array | Rlp[];

/**
 * RLP, the encoding every Ethereum transaction is a list in.
 *
 * Two rules and one table. A single byte below 0x80 is itself; anything else is
 * a length prefix and then the bytes, with the prefix growing by nine when the
 * length itself needs more than one byte. Lists are the same table shifted up by
 * 0x40 over the concatenation of their items.
 */
export function rlp(input: Rlp): Uint8Array {
  if (input instanceof Uint8Array) {
    if (input.length === 1 && input[0]! < 0x80) return input;
    return concat(header(input.length, 0x80), input);
  }
  const body = concat(...input.map(rlp));
  return concat(header(body.length, 0xc0), body);
}

function header(length: number, offset: number): Uint8Array {
  if (length < 56) return Uint8Array.of(offset + length);
  const size = minimal(BigInt(length));
  return concat(Uint8Array.of(offset + 55 + size.length), size);
}

function concat(...parts: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let at = 0;
  for (const part of parts) {
    out.set(part, at);
    at += part.length;
  }
  return out;
}

/**
 * A number as the shortest big-endian bytes that hold it. Zero is empty.
 *
 * Empty and not `0x00`, which is the part that surprises people and the part
 * that makes a signature verify or not: RLP has one encoding per value, and a
 * leading zero is a different encoding of the same number.
 */
export function minimal(value: bigint): Uint8Array {
  if (value < 0n) throw new Error("A transaction field cannot be negative.");
  if (value === 0n) return new Uint8Array(0);
  let hex = value.toString(16);
  if (hex.length % 2 === 1) hex = "0" + hex;
  return hexToBytes("0x" + hex);
}

export interface Unsigned {
  nonce: bigint;
  gasPrice: bigint;
  gasLimit: bigint;
  /** Lowercase 0x address. */
  to: string;
  value: bigint;
  /** Call data, 0x-prefixed. */
  data: string;
  chainId: number;
}

/**
 * The raw signed transaction, ready for eth_sendRawTransaction.
 *
 * EIP-155: the unsigned list carries the chain id and two empty fields, so a
 * signature made for Cronos cannot be replayed on another chain that shares an
 * address. `v` then encodes the chain id alongside the recovery bit.
 */
export function signTransaction(tx: Unsigned, privateKey: Uint8Array): string {
  const fields: Rlp = [
    minimal(tx.nonce),
    minimal(tx.gasPrice),
    minimal(tx.gasLimit),
    hexToBytes(tx.to),
    minimal(tx.value),
    hexToBytes(tx.data),
    minimal(BigInt(tx.chainId)),
    new Uint8Array(0),
    new Uint8Array(0),
  ];

  const digest = keccak_256(rlp(fields));
  const signature = secp256k1.sign(digest, privateKey, { prehash: false });
  const v = BigInt(tx.chainId) * 2n + 35n + BigInt(signature.recovery);

  const signed: Rlp = [
    ...(fields.slice(0, 6) as Rlp[]),
    minimal(v),
    minimal(signature.r),
    minimal(signature.s),
  ];
  // bytesToHex here does not prefix, and eth_sendRawTransaction requires it.
  return "0x" + bytesToHex(rlp(signed));
}

/** The address a key signs as. */
export function addressOfKey(privateKey: Uint8Array): string {
  // Uncompressed, minus the 0x04 tag: addressOf hashes the sixty-four
  // coordinate bytes and takes the last twenty.
  const publicKey = secp256k1.getPublicKey(privateKey, false).slice(1);
  return addressOf(publicKey);
}

/** The four-byte selector for a function signature like "claim(bytes32)". */
export function selector(signature: string): string {
  // Four bytes is eight hex characters. Slicing ten off an unprefixed string
  // takes five bytes, which is a call to nothing — and it is exactly what this
  // did until the vectors below caught it.
  return "0x" + bytesToHex(keccak_256(new TextEncoder().encode(signature))).slice(0, 8);
}

/** A value left-padded to a thirty-two byte ABI word, without the 0x. */
export function word(value: bigint | string): string {
  const hex =
    typeof value === "bigint" ? value.toString(16) : value.replace(/^0x/, "").toLowerCase();
  if (hex.length > 64) throw new Error(`That does not fit in a word: ${hex}`);
  return hex.padStart(64, "0");
}
