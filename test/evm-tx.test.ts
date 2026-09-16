import { describe, expect, it } from "vitest";

import { hexToBytes, bytesToHex } from "@/lib/address";
import {
  addressOfKey,
  minimal,
  rlp,
  selector,
  signTransaction,
  word,
} from "@/lib/evm-tx";

/**
 * This file signs transactions that move money, and it was written rather than
 * installed. So it is checked against the specification's own vectors and not
 * against itself: a hand-rolled encoder that agrees with its own author is worth
 * nothing.
 */
const hex = (bytes: Uint8Array) => "0x" + bytesToHex(bytes);

describe("RLP", () => {
  it("matches the examples in the yellow paper", () => {
    const str = (s: string) => new TextEncoder().encode(s);
    expect(hex(rlp(str("dog")))).toBe("0x83646f67");
    expect(hex(rlp([str("cat"), str("dog")]))).toBe("0xc88363617483646f67");
    expect(hex(rlp(str("")))).toBe("0x80");
    expect(hex(rlp([]))).toBe("0xc0");
    expect(hex(rlp(Uint8Array.of(0x0f)))).toBe("0x0f");
    expect(hex(rlp(minimal(1024n)))).toBe("0x820400");
    // Fifty-six bytes is where the long form starts, and off-by-one here is a
    // transaction that encodes but does not verify.
    expect(hex(rlp(new Uint8Array(55)))).toMatch(/^0xb7/);
    expect(hex(rlp(new Uint8Array(56)))).toMatch(/^0xb838/);
  });

  it("writes zero as nothing, which is the whole of canonical form", () => {
    // Not 0x00. RLP has one encoding per value and a leading zero is a second
    // one — a signature over the wrong bytes verifies as somebody else.
    expect(minimal(0n)).toHaveLength(0);
    expect(hex(rlp(minimal(0n)))).toBe("0x80");
    expect(hex(minimal(1n))).toBe("0x01");
    expect(hex(minimal(255n))).toBe("0xff");
    expect(hex(minimal(256n))).toBe("0x0100");
  });

  it("refuses a negative field rather than encoding something else", () => {
    expect(() => minimal(-1n)).toThrow(/negative/i);
  });
});

describe("signing", () => {
  /**
   * The example transaction from EIP-155 itself, signed with the key the
   * specification uses. If this matches byte for byte then the encoding, the
   * digest, the recovery bit and the chain id are all right together — and any
   * one of them being wrong produces a different string.
   */
  it("reproduces the EIP-155 example exactly", () => {
    const key = hexToBytes(
      "0x4646464646464646464646464646464646464646464646464646464646464646",
    );
    const signed = signTransaction(
      {
        nonce: 9n,
        gasPrice: 20_000_000_000n,
        gasLimit: 21_000n,
        to: "0x3535353535353535353535353535353535353535",
        value: 1_000_000_000_000_000_000n,
        data: "0x",
        chainId: 1,
      },
      key,
    );

    expect(signed).toBe(
      "0xf86c098504a817c800825208943535353535353535353535353535353535353535880de0b6b3a7640000" +
        "8025a028ef61340bd939bc2195fe537567866003e1a15d3c71ff63e1590620aa636276" +
        "a067cbe9d8997f761aecb703304b3800ccf555c9f3dc64214b297fb1966a3b6d83",
    );
  });

  it("signs as the address that key owns", () => {
    const key = hexToBytes(
      "0x4646464646464646464646464646464646464646464646464646464646464646",
    );
    expect(addressOfKey(key)).toBe("0x9d8a62f656a8d1615c1294fd71e9cfb3e4855a4f");
  });

  /** A different chain id is a different transaction, which is the point of 155. */
  it("will not replay onto another chain", () => {
    const key = hexToBytes(
      "0x4646464646464646464646464646464646464646464646464646464646464646",
    );
    const base = {
      nonce: 9n,
      gasPrice: 20_000_000_000n,
      gasLimit: 21_000n,
      to: "0x3535353535353535353535353535353535353535",
      value: 1_000_000_000_000_000_000n,
      data: "0x",
    };
    expect(signTransaction({ ...base, chainId: 1 }, key)).not.toBe(
      signTransaction({ ...base, chainId: 25 }, key),
    );
  });
});

describe("calling a contract", () => {
  it("takes the first four bytes of the keccak of the signature", () => {
    // Known selectors, so a typo in the hashing shows up as a call to a
    // function that does not exist rather than as nothing at all.
    expect(selector("transfer(address,uint256)")).toBe("0xa9059cbb");
    expect(selector("balanceOf(address)")).toBe("0x70a08231");
    expect(selector("totalSupply()")).toBe("0x18160ddd");
  });

  it("pads a word to thirty-two bytes", () => {
    expect(word(1n)).toBe("0".repeat(63) + "1");
    expect(word("0xabc")).toBe("0".repeat(61) + "abc");
    expect(word(0n)).toHaveLength(64);
    expect(() => word("0x" + "f".repeat(65))).toThrow(/does not fit/i);
  });
});
