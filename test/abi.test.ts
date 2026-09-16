import { describe, expect, it } from "vitest";

import { encodeParameters } from "@/lib/abi";

/**
 * These arguments are appended to bytecode and deployed once, forever. An offset
 * that is one word out produces a contract that deploys happily and is named
 * something unreadable, so this is checked against the specification's own
 * example rather than against itself.
 */
describe("encoding constructor arguments", () => {
  it("writes static types straight into the head", () => {
    const encoded = encodeParameters(
      ["address", "uint256", "bytes32"],
      ["0x00000000000000000000000000000000000000a1", 2000n, "0x" + "ab".repeat(32)],
    );
    expect(encoded).toHaveLength(3 * 64);
    // An address is left-padded into its word: twelve zero bytes, then twenty.
    expect(encoded.slice(0, 24)).toBe("0".repeat(24));
    expect(encoded.slice(24, 64)).toBe("00000000000000000000000000000000000000a1");
    expect(BigInt("0x" + encoded.slice(64, 128))).toBe(2000n);
    expect(encoded.slice(128, 192)).toBe("ab".repeat(32));
  });

  it("matches the ABI specification's own string example", () => {
    // encode(["string"], ["dave"]): an offset of 0x20, then a length of 4, then
    // the bytes right-padded into one word.
    expect(encodeParameters(["string"], ["dave"])).toBe(
      "0".repeat(62) + "20" + "0".repeat(63) + "4" + "64617665" + "0".repeat(56),
    );
  });

  it("counts a dynamic offset from the start of the whole block", () => {
    // Two strings: the head is two words, so the first tail sits at 0x40 and the
    // second after it. Off by one word here is a contract with a garbled name.
    const encoded = encodeParameters(["string", "string"], ["ab", "cd"]);
    expect(BigInt("0x" + encoded.slice(0, 64))).toBe(64n);
    expect(BigInt("0x" + encoded.slice(64, 128))).toBe(64n + 64n);
  });

  it("puts a dynamic offset after every head word, not after the ones before it", () => {
    // A string with three static arguments behind it: the offset still counts
    // four head words, because the head is one word per argument regardless.
    const encoded = encodeParameters(
      ["string", "uint256", "uint256", "uint256"],
      ["x", 1n, 2n, 3n],
    );
    expect(BigInt("0x" + encoded.slice(0, 64))).toBe(128n);
  });

  it("refuses a count that does not line up", () => {
    expect(() => encodeParameters(["address", "uint256"], ["0x00"])).toThrow(/types and/);
  });

  it("refuses a value too big for its word", () => {
    expect(() => encodeParameters(["bytes32"], ["0x" + "ff".repeat(33)])).toThrow(/does not fit/i);
  });
});
