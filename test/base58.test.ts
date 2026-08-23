// Base58, against vectors that are not of our own making.
//
// A decoder tested only against its own encoder passes every test while being
// wrong in both directions at once. The addresses below are Solana's own — the
// System Program, the Token Program — and their bytes are known independently of
// anything in this repository.

import { describe, expect, it } from "vitest";

import { base58Decode, base58Encode } from "@/lib/base58";

describe("base58", () => {
  it("decodes the System Program to thirty-two zero bytes", () => {
    // Every character is '1', which is zero, and zero multiplied by 58 is still
    // zero — so this address is entirely leading zeroes and comes out right only
    // if they are counted rather than computed.
    const bytes = base58Decode("11111111111111111111111111111111");
    expect(bytes).toHaveLength(32);
    expect([...bytes].every((b) => b === 0)).toBe(true);
    expect(base58Encode(bytes)).toBe("11111111111111111111111111111111");
  });

  it("round-trips real addresses", () => {
    for (const address of [
      "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA",
      "So11111111111111111111111111111111111111112",
      "Dg93gmtVbL4vdqHbdoBVFRsUtnjk6XAQeXA5GD4GZ7kp",
    ]) {
      const bytes = base58Decode(address);
      expect(bytes).toHaveLength(32);
      expect(base58Encode(bytes)).toBe(address);
    }
  });

  it("throws on a character that is not in the alphabet", () => {
    // 0, O, I and l are left out of base58 precisely because they are the ones
    // people mistype. Accepting them quietly would decode a typo into a
    // different, entirely valid-looking key.
    for (const bad of ["0", "O", "I", "l"]) {
      expect(() => base58Decode(`${bad}1111`)).toThrow(/alphabet/);
    }
    expect(() => base58Decode("")).toThrow();
  });

  it("keeps every leading zero", () => {
    for (let zeroes = 0; zeroes < 5; zeroes++) {
      const bytes = Uint8Array.from([...new Array<number>(zeroes).fill(0), 1, 2, 3]);
      expect(base58Decode(base58Encode(bytes))).toEqual(bytes);
    }
  });
});
