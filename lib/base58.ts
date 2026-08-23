// Base58, the alphabet Solana writes addresses in.
//
// Written out rather than pulled in. It is twenty lines, it is the only place
// the alphabet is spelled, and a decoder that returns something plausible for a
// mistyped address is worse than no decoder — an admin address that decodes to
// the wrong bytes locks the maker out of his own site with no error to read.

const ALPHABET = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";

const INDEX = new Map<string, number>();
for (let i = 0; i < ALPHABET.length; i++) INDEX.set(ALPHABET[i]!, i);

/**
 * Decodes base58, or throws.
 *
 * Throws rather than returning null: every caller here is checking an identity,
 * and a caller who forgets to check a null is a caller who has just accepted an
 * empty key. There is no reading of this that wants to carry on quietly.
 */
export function base58Decode(text: string): Uint8Array {
  if (text.length === 0) throw new Error("Base58: nothing to decode.");

  const bytes: number[] = [];
  for (const character of text) {
    const value = INDEX.get(character);
    if (value === undefined) {
      throw new Error(`Base58: "${character}" is not in the alphabet.`);
    }
    // Long multiplication, base 58 into base 256. Little-endian while we work,
    // reversed at the end.
    let carry = value;
    for (let i = 0; i < bytes.length; i++) {
      carry += bytes[i]! * 58;
      bytes[i] = carry & 0xff;
      carry >>= 8;
    }
    while (carry > 0) {
      bytes.push(carry & 0xff);
      carry >>= 8;
    }
  }

  // A leading '1' is a zero byte and multiplies away to nothing, so the leading
  // zeroes have to be counted rather than computed.
  let leadingZeroes = 0;
  while (leadingZeroes < text.length && text[leadingZeroes] === "1") leadingZeroes++;

  return Uint8Array.from([...new Array<number>(leadingZeroes).fill(0), ...bytes.reverse()]);
}

/** The other direction. Only used by tests and by anything that has to show bytes. */
export function base58Encode(bytes: Uint8Array): string {
  if (bytes.length === 0) return "";

  const digits: number[] = [];
  for (const byte of bytes) {
    let carry = byte;
    for (let i = 0; i < digits.length; i++) {
      carry += digits[i]! << 8;
      digits[i] = carry % 58;
      carry = (carry / 58) | 0;
    }
    while (carry > 0) {
      digits.push(carry % 58);
      carry = (carry / 58) | 0;
    }
  }

  let leadingZeroes = 0;
  while (leadingZeroes < bytes.length && bytes[leadingZeroes] === 0) leadingZeroes++;

  return "1".repeat(leadingZeroes) + digits.reverse().map((d) => ALPHABET[d]!).join("");
}
