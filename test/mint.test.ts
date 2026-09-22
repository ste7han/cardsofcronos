// The two calls that mint, pulled apart.
//
// Both are hand-encoded and both are sent by somebody else's wallet, so a wrong
// byte is a transaction that reverts with nothing in it saying why — at whatever
// hour a mint opens, to somebody who is not going to try twice.
//
// The dangerous one is `claim`. Its middle argument is a dynamic array, so the
// head carries an OFFSET to where the array lives rather than the array, and the
// proof itself has to land exactly there. And underneath that sits the merkle
// tree: a proof built with a leaf encoding the verifier does not share produces
// a root that looks perfectly fine and proofs no Solidity will accept. That is
// the failure scripts/allowlist.ts pulled in a library to avoid, and this is
// where it is checked against the contract that has to accept it.

import { readFileSync } from "node:fs";

import { StandardMerkleTree } from "@openzeppelin/merkle-tree";
import { describe, expect, it } from "vitest";

import allowlist from "@/data/allowlist.json";
import { normalise } from "@/lib/address";
import { selector } from "@/lib/evm-tx";
import { buyData, claimData } from "@/lib/mint";
import { ALLOWLIST_ROOT } from "@/lib/revenue";

const solidity = readFileSync(
  new URL("../contracts/CardsOfCronosSetOne.sol", import.meta.url),
  "utf8",
);

const wordAt = (data: string, i: number) => data.slice(10 + i * 64, 10 + (i + 1) * 64);
const numberAt = (data: string, i: number) => Number(BigInt("0x" + wordAt(data, i)));

describe("buying", () => {
  it("calls the function the contract actually has", () => {
    expect(solidity).toContain("function buy(uint256 amount) external payable");
    expect(buyData(3).slice(0, 10)).toBe(selector("buy(uint256)"));
  });

  it("puts the amount in the one word it takes", () => {
    expect(numberAt(buyData(7), 0)).toBe(7);
    expect(buyData(7)).toHaveLength(10 + 64);
  });

  it("refuses an amount that is not one", () => {
    for (const bad of [0, -1, 2.5, Number.NaN]) {
      expect(() => buyData(bad), `${bad}`).toThrow(/not a number of cards/i);
    }
  });
});

describe("claiming a free mint", () => {
  const proof = ["0x" + "1".repeat(64), "0x" + "2".repeat(64), "0x" + "3".repeat(64)];

  it("calls the function the contract actually has, in that argument order", () => {
    // allowance, then the proof, then the amount. Reading them in any other
    // order encodes fine and reverts on chain.
    expect(solidity).toMatch(
      /function claim\(uint256 allowance, bytes32\[\] calldata proof, uint256 amount\)/,
    );
    expect(claimData(10, proof, 2).slice(0, 10)).toBe(
      selector("claim(uint256,bytes32[],uint256)"),
    );
  });

  it("puts the proof where the head says it is", () => {
    const data = claimData(53, proof, 4);
    expect(numberAt(data, 0)).toBe(53);
    // Three words of head come before the body, so the offset is 96 bytes.
    expect(numberAt(data, 1)).toBe(96);
    expect(numberAt(data, 2)).toBe(4);

    const at = numberAt(data, 1) / 32;
    expect(numberAt(data, at)).toBe(proof.length);
    for (const [i, step] of proof.entries()) {
      expect("0x" + wordAt(data, at + 1 + i)).toBe(step);
    }
  });

  it("keeps the head the same size however long the proof is", () => {
    // The offset is 96 for every proof length, because the head is three fixed
    // words. What must grow is the body — a constant body length would be the
    // same bug the other way round.
    for (const length of [1, 3, 8]) {
      const steps = Array.from({ length }, (_, i) => "0x" + String(i + 1).repeat(64));
      const data = claimData(10, steps, 1);
      expect(numberAt(data, 1)).toBe(96);
      expect((data.length - 10) / 64).toBe(3 + 1 + length);
    }
  });

  it("is a whole number of words, always", () => {
    for (const length of [0, 1, 6]) {
      const steps = Array.from({ length }, () => "0x" + "a".repeat(64));
      expect((claimData(5, steps, 1).length - 10) % 64).toBe(0);
    }
  });

  it("refuses to ask for more than the allowance", () => {
    // The contract refuses it too, and reverting is the right end state — but
    // finding out here costs nothing and finding out there costs gas.
    expect(() => claimData(3, proof, 4)).toThrow(/allowance/i);
    expect(() => claimData(3, proof, 0)).toThrow(/not a number of cards/i);
  });
});

describe("the allowlist the contract was deployed against", () => {
  it("is the root recorded as being on chain", () => {
    // This held a second copy of the root and a note saying it could never
    // move, because setAllowlistRoot would invalidate what had already been
    // claimed. It does not: `claimed[address]` is its own mapping, so raising
    // an allowance takes nothing from anybody — which is how a holder was given
    // thirty more mints on 22 September 2026, and how this test came to be
    // failing about a fact rather than a mistake.
    //
    // So it compares against lib/revenue.ts now. The file and the constant
    // moving together is what this catches; the chain is checked by
    // scripts/nft/allowlist-root.ts, which is the only thing that moves it.
    expect(allowlist.root).toBe(ALLOWLIST_ROOT);
  });

  it("proves every claim against that root with the leaf the contract builds", () => {
    // The whole reason this test exists. The contract hashes
    // `abi.encode(msg.sender, allowance)` twice, which is exactly what
    // StandardMerkleTree does for ["address","uint256"] — and "exactly" is a
    // claim worth executing rather than believing.
    const tree = StandardMerkleTree.load(
      JSON.parse(
        readFileSync(new URL("../data/allowlist-tree.json", import.meta.url), "utf8"),
      ) as Parameters<typeof StandardMerkleTree.load>[0],
    );
    expect(tree.root).toBe(allowlist.root);

    for (const claim of allowlist.claims) {
      const ok = StandardMerkleTree.verify(
        allowlist.root,
        ["address", "uint256"],
        [normalise(claim.address), String(claim.quantity)],
        claim.proof,
      );
      expect(ok, `${claim.address} for ${claim.quantity}`).toBe(true);
    }
  });

  it("owes nobody nothing, and adds up to what it says", () => {
    const total = allowlist.claims.reduce((sum, claim) => sum + claim.quantity, 0);
    expect(total).toBe(allowlist.mints);
    expect(allowlist.claims).toHaveLength(allowlist.addresses);
    for (const claim of allowlist.claims) {
      expect(claim.quantity, claim.address).toBeGreaterThan(0);
      expect(claim.proof.length, `${claim.address} has no proof`).toBeGreaterThan(0);
    }
  });

  it("leaves out the burn address, which owns tokens and is nobody", () => {
    const burn = "0x42bcc1355808adf2344773c54e364257911ccc99";
    expect(allowlist.claims.some((claim) => normalise(claim.address) === burn)).toBe(false);
    expect(allowlist.excluded.tokens).toBeGreaterThan(0);
  });

  it("fits inside what one transaction may mint, or says how it does not", () => {
    // The largest holder is owed 53 and a transaction caps at 50, so that one
    // takes two goes. The contract allows claiming in parts for exactly this,
    // and the page has to know it rather than offering a button that reverts.
    const cap = Number(/uint256 public constant MAX_MINT_PER_TX = (\d+);/.exec(solidity)![1]);
    const biggest = Math.max(...allowlist.claims.map((claim) => claim.quantity));
    expect(biggest).toBeGreaterThan(0);
    if (biggest > cap) {
      expect(solidity).toMatch(/Claiming in parts is allowed/);
    }
  });
});
