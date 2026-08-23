// The shape of an allowlist leaf, checked rather than asserted.
//
// contracts/CardsOfCronosSetOne.sol computes a leaf like this:
//
//     keccak256(bytes.concat(keccak256(abi.encode(msg.sender, allowance))))
//
// and scripts/allowlist.ts produces proofs with @openzeppelin/merkle-tree. Those
// two have to agree exactly or every proof is rejected on mint day, and until
// there is a Solidity test runner here the contract's half of that is a line
// somebody wrote from memory.
//
// So this file builds the same leaf a third way — by hand, out of keccak and the
// ABI encoding rules — and checks all three agree. It does not prove the
// contract is right. It proves that the expression written in it and the
// expression the library implements are the same expression, which is the part
// that was a guess.
//
// What is still untested, and what would need Foundry: everything the contract
// does with a valid proof. There is a list at the bottom of the .sol file.

import { StandardMerkleTree } from "@openzeppelin/merkle-tree";
import { keccak_256 } from "@noble/hashes/sha3";
import { describe, expect, it } from "vitest";

import { bytesToHex, hexToBytes, normalise } from "@/lib/address";

/**
 * `abi.encode(address, uint256)`, by the rules rather than by a library.
 *
 * Both are static 32-byte words: an address is left-padded with twelve zero
 * bytes, a uint256 is its big-endian value. There is no length prefix and no
 * offset, because neither type is dynamic.
 */
function abiEncodeAddressUint(address: string, value: bigint): Uint8Array {
  const out = new Uint8Array(64);
  out.set(hexToBytes(normalise(address)), 12);
  let rest = value;
  for (let i = 63; i >= 32 && rest > 0n; i--) {
    out[i] = Number(rest & 0xffn);
    rest >>= 8n;
  }
  return out;
}

/** The leaf as the contract computes it. */
function leafByHand(address: string, value: bigint): string {
  return "0x" + bytesToHex(keccak_256(keccak_256(abiEncodeAddressUint(address, value))));
}

const A = "0x7E3e91b6912042f8FC446385299785Ac2F12C0d0";
const B = "0x1B95F8F67639BBc3153e6D277070518ff122c421";
const C = "0x4e487Dc9d4abc2fe56Bb1A2360A120D34B35dd5b";

function treeOf(entries: [string, string][]) {
  return StandardMerkleTree.of(entries, ["address", "uint256"]);
}

describe("the leaf the contract will hash", () => {
  it("is the same one the library builds", () => {
    // The whole point of this file. If these two ever disagree, every proof the
    // allowlist script has ever produced is worthless and the contract is the
    // thing that has to change.
    for (const [address, quantity] of [
      [A, 1n],
      [B, 63n],
      [C, 0n],
      [A, 2n ** 255n],
    ] as const) {
      const tree = treeOf([[address, String(quantity)]]);
      expect(tree.leafHash([address, String(quantity)])).toBe(leafByHand(address, quantity));
    }
  });

  it("does not care how the address was capitalised", () => {
    // A holder file is checksummed for people to read and lowercase everywhere
    // it is compared. Both have to land on one leaf, or half the allowlist is
    // unusable depending on which spelling somebody pasted.
    const tree = treeOf([[A, "5"]]);
    expect(leafByHand(A, 5n)).toBe(leafByHand(A.toLowerCase(), 5n));
    expect(tree.leafHash([A.toLowerCase(), "5"])).toBe(leafByHand(A, 5n));
  });

  it("changes when the quantity changes, which is what stops it being inflated", () => {
    // The contract takes the allowance from the caller and trusts the proof to
    // police it. That only works because one more card is a different leaf.
    expect(leafByHand(A, 1n)).not.toBe(leafByHand(A, 2n));
    expect(leafByHand(A, 1n)).not.toBe(leafByHand(B, 1n));
  });
});

describe("a proof against a root", () => {
  const entries: [string, string][] = [
    [A, "63"],
    [B, "53"],
    [C, "34"],
  ];

  it("verifies for every entry", () => {
    const tree = treeOf(entries);
    entries.forEach((entry, i) => {
      expect(StandardMerkleTree.verify(tree.root, ["address", "uint256"], entry, tree.getProof(i))).toBe(
        true,
      );
    });
  });

  it("fails for a quantity the tree never saw", () => {
    const tree = treeOf(entries);
    const proof = tree.getProof(0);
    expect(
      StandardMerkleTree.verify(tree.root, ["address", "uint256"], [A, "64"], proof),
    ).toBe(false);
  });

  it("fails for somebody else holding your proof", () => {
    const tree = treeOf(entries);
    const proof = tree.getProof(0);
    // The contract hashes msg.sender, not an address the caller supplies, so
    // this is the shape of attack it has to refuse.
    expect(
      StandardMerkleTree.verify(tree.root, ["address", "uint256"], [B, "63"], proof),
    ).toBe(false);
  });

  it("gives the same root twice for the same entries", () => {
    // scripts/allowlist.ts sorts by address before building, because a root that
    // moves between runs is a root nobody can check against the file it came
    // from.
    expect(treeOf(entries).root).toBe(treeOf([...entries]).root);
  });
});
