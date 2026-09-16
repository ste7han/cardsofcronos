// Encoding constructor arguments, for the four types this project deploys with.
//
// Not a general ABI encoder and deliberately not: `address`, `uint256`,
// `bytes32` and `string` is everything the constructors here take, and an
// encoder that claims to handle tuples and arrays it has never encoded is a
// claim nobody checked.
//
// The shape is head-and-tail. Every argument writes one word into the head; a
// static type writes its value there and a dynamic one writes the offset of its
// data, counted from the start of the whole block. Getting that offset wrong
// produces a deployment that succeeds and a contract whose name is garbage,
// which is the failure this file's tests exist for.

import { bytesToHex } from "@/lib/address";

export type AbiType = "address" | "uint256" | "bytes32" | "string";

const WORD = 32;

function pad(hex: string): string {
  const body = hex.replace(/^0x/, "").toLowerCase();
  if (body.length > WORD * 2) throw new Error(`That does not fit in a word: ${hex}`);
  return body.padStart(WORD * 2, "0");
}

/** Right-padded, which is how bytes and strings sit in their words. */
function padRight(body: string): string {
  const words = Math.ceil(body.length / (WORD * 2)) || 1;
  return body.padEnd(words * WORD * 2, "0");
}

function isDynamic(type: AbiType): boolean {
  return type === "string";
}

function staticWord(type: AbiType, value: string | bigint): string {
  switch (type) {
    case "address":
      return pad(String(value));
    case "uint256":
      return pad(BigInt(value).toString(16));
    case "bytes32":
      return pad(String(value));
    default:
      throw new Error(`${type} is not a static word.`);
  }
}

/**
 * The arguments, hex without a leading 0x, ready to append to bytecode.
 */
export function encodeParameters(
  types: readonly AbiType[],
  values: readonly (string | bigint)[],
): string {
  if (types.length !== values.length) {
    throw new Error(`${types.length} types and ${values.length} values.`);
  }

  // Offsets are counted from the start of the block, and the head is one word
  // per argument however long the tail turns out to be.
  let tailAt = types.length * WORD;
  const head: string[] = [];
  const tail: string[] = [];

  types.forEach((type, i) => {
    if (!isDynamic(type)) {
      head.push(staticWord(type, values[i]!));
      return;
    }
    const bytes = new TextEncoder().encode(String(values[i]));
    const body = pad(tailAt.toString(16)) ;
    head.push(body);
    const encoded = pad(bytes.length.toString(16)) + padRight(bytesToHex(bytes));
    tail.push(encoded);
    tailAt += encoded.length / 2;
  });

  return head.join("") + tail.join("");
}
