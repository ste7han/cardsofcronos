// Addresses, and the one thing about them that is silent.
//
// This replaces the base58 suite the Solana version of the project had. The
// decoder there could only be wrong in loud ways — a character outside the
// alphabet, a length that is not 32. An EVM address has a quieter failure: it is
// the same address in any case, so two spellings of one wallet both parse, both
// look right, and become two players. `normalise` is the only door in, so this
// is where that is nailed down.

import { secp256k1 } from "@noble/curves/secp256k1";
import { describe, expect, it } from "vitest";

import { addressOf, bytesToHex, checksum, hexToBytes, isAddress, normalise } from "@/lib/address";

/** The vectors from EIP-55 itself. */
const EIP55 = [
  "0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed",
  "0xfB6916095ca1df60bB79Ce92cE3Ea74c37c5d359",
  "0xdbF03B407c01E7cD3CBea99509d93f8DDDC8C6FB",
  "0xD1220A0cf47c7B9Be7A2E6BA89F429762e7b9aDb",
];

describe("the shape of an address", () => {
  it("accepts forty hex digits behind an 0x, in any case", () => {
    for (const address of EIP55) {
      expect(isAddress(address)).toBe(true);
      expect(isAddress(address.toLowerCase())).toBe(true);
    }
  });

  it("refuses everything that is nearly one", () => {
    for (const bad of [
      "",
      "0x",
      "5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed", // no 0x
      "0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAe", // thirty-nine
      "0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAedd", // forty-one
      "0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAeZ", // not hex
      "Dg93gmtVbL4vdqHbdoBVFRsUtnjk6XAQeXA5GD4GZ7kp", // a Solana address
    ]) {
      expect(isAddress(bad)).toBe(false);
      expect(() => normalise(bad)).toThrow();
    }
  });
});

describe("one spelling per wallet", () => {
  it("stores lowercase, whatever it was handed", () => {
    // The whole reason this function exists. Two spellings of one wallet is one
    // player counted twice, two referral rows, and two sets of points — and
    // nothing about it looks wrong until somebody counts.
    for (const address of EIP55) {
      expect(normalise(address)).toBe(address.toLowerCase());
      expect(normalise(address.toLowerCase())).toBe(address.toLowerCase());
      expect(normalise(address)).toBe(normalise(address.toLowerCase()));
    }
  });

  it("does not mind the whitespace a copy-paste brings with it", () => {
    expect(normalise(`  ${EIP55[0]}\n`)).toBe(EIP55[0]!.toLowerCase());
  });
});

describe("the checksum", () => {
  it("reproduces the EIP-55 vectors", () => {
    for (const address of EIP55) {
      expect(checksum(address.toLowerCase())).toBe(address);
      // Idempotent: checksumming an already-checksummed address changes nothing.
      expect(checksum(address)).toBe(address);
    }
  });

  it("catches a mixed-case address whose pattern is wrong", () => {
    // This is the one thing the checksum buys. Flipping the case of a single
    // letter is the deterministic way to prove it: the required case at that
    // position is whatever it was, so the opposite always disagrees.
    //
    // Changing a *character* instead would be the more realistic typo, but it
    // only fails the checksum about half the time — the new hash asks for a case
    // that the old string happens to have as often as not — so a test built on
    // one would pass or fail by luck.
    const address = EIP55[0]!;
    const at = [...address].findIndex((c, i) => i > 1 && /[a-z]/.test(c));
    const flipped =
      address.slice(0, at) + address[at]!.toUpperCase() + address.slice(at + 1);
    expect(flipped).not.toBe(address);
    expect(() => normalise(flipped)).toThrow(/checksum/);
  });

  it("cannot catch a typo in an address written all in one case", () => {
    // Worth writing down rather than leaving as a surprise. An all-lowercase
    // address carries no checksum, so a wrong character in one is accepted here
    // and caught by nothing. lib/revenue.ts is the place that matters, and the
    // answer there is that addresses are pasted from an explorer in the mixed
    // form, which does carry one.
    const typo = "0x" + "a".repeat(40);
    expect(() => normalise(typo)).not.toThrow();
  });

  it("accepts both all-lower and all-upper, which is how they are often written", () => {
    // Neither carries a checksum, so there is nothing to check — and refusing
    // them would turn away addresses that are perfectly fine.
    expect(() => normalise(EIP55[0]!.toLowerCase())).not.toThrow();
    expect(() => normalise("0x" + EIP55[0]!.slice(2).toUpperCase())).not.toThrow();
  });
});

describe("from a public key", () => {
  it("takes the key with or without its prefix and gets the same address", () => {
    // A real keypair rather than a hex string copied from somewhere. The
    // uncompressed form is 65 bytes with a 0x04 marker in front; both it and the
    // bare 64 coordinate bytes have to land on one address, because callers hand
    // over whichever their library gave them.
    const prefixed = secp256k1.getPublicKey(secp256k1.utils.randomPrivateKey(), false);
    expect(prefixed).toHaveLength(65);
    expect(prefixed[0]).toBe(4);

    const bare = prefixed.subarray(1);
    expect(addressOf(prefixed)).toBe(addressOf(bare));
    expect(isAddress(addressOf(bare))).toBe(true);
    // Lowercase, like everything else that is stored.
    expect(normalise(addressOf(bare))).toBe(addressOf(bare));
  });

  it("refuses anything that is not a key", () => {
    expect(() => addressOf(new Uint8Array(32))).toThrow(/64 bytes/);
    expect(() => addressOf(new Uint8Array(0))).toThrow();
  });
});

describe("hex, both ways", () => {
  it("round-trips", () => {
    const bytes = Uint8Array.from({ length: 40 }, (_, i) => (i * 37) % 256);
    expect(hexToBytes(bytesToHex(bytes))).toEqual(bytes);
    expect(hexToBytes("0x" + bytesToHex(bytes))).toEqual(bytes);
  });

  it("refuses half a byte and anything that is not hex", () => {
    expect(() => hexToBytes("abc")).toThrow(/odd/);
    expect(() => hexToBytes("zz")).toThrow(/not hex/);
  });
});
