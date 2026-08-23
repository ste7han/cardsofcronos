// Signing in, and the one thing it has to refuse.
//
// Every signature here comes from a keypair these tests generate. That is the
// same code path a real wallet takes with different bytes in it, and it means
// nothing in this repository can produce a signature for an address it does not
// own — which is the property being tested.
//
// On EVM the check runs by recovery: the address is computed from the signature
// rather than looked up. So "a signature wearing somebody else's name" fails not
// because a list says so but because the arithmetic lands somewhere else.

import { secp256k1 } from "@noble/curves/secp256k1";
import { describe, expect, it } from "vitest";

import { ADMIN_ADDRESSES, ADMIN_WALLETS, isAdmin } from "@/lib/admin";
import { bytesToHex, checksum, addressOf } from "@/lib/address";
import {
  SESSION_LIFE,
  challenge,
  signingHash,
  verifyProof,
  type WalletProof,
} from "@/lib/session";

const T0 = 1_700_000_000_000;

/** A wallet these tests own, standing in for one they never will. */
function wallet() {
  const secret = secp256k1.utils.randomPrivateKey();
  const address = addressOf(secp256k1.getPublicKey(secret, false));

  const sign = (over: Partial<WalletProof> = {}): WalletProof => {
    const claim = { address, issuedAt: T0, nonce: "abc123", ...over };
    const signature = secp256k1.sign(signingHash(challenge(claim)), secret);
    const hex =
      "0x" +
      bytesToHex(signature.toCompactRawBytes()) +
      (signature.recovery + 27).toString(16).padStart(2, "0");
    return { ...claim, signature: hex, ...over };
  };

  return { address, secret, sign };
}

describe("the admin addresses", () => {
  // ── The list is empty on purpose, and this suite says so out loud. ────────
  // The Solana addresses that used to be here do not carry over, and the Cronos
  // ones have not been given yet. lib/admin.ts explains why guessing was the
  // worse option.
  //
  // The first test below FAILS the day an address is added. That is deliberate:
  // it is the only way the person adding one is made to come back here and put
  // the real assertion — that there is at least one admin, and that it is well
  // formed — back where it belongs.
  it("is empty for now, so nobody is admin", () => {
    expect(ADMIN_WALLETS).toHaveLength(0);
    expect(ADMIN_ADDRESSES).toHaveLength(0);
    expect(isAdmin(wallet().address)).toBe(false);
  });

  it("normalises and de-duplicates whatever ends up in it", () => {
    ADMIN_WALLETS.forEach((entry, i) => {
      expect(ADMIN_ADDRESSES[i]).toBe(entry.toLowerCase());
      // The same wallet in either spelling. This is the whole reason the list is
      // normalised: an admin who copied their address off Cronoscan in mixed
      // case must not be a different person from the same admin in lowercase.
      expect(isAdmin(entry)).toBe(true);
      expect(isAdmin(checksum(entry))).toBe(true);
      expect(isAdmin(entry.toLowerCase())).toBe(true);
    });
    expect(new Set(ADMIN_ADDRESSES).size).toBe(ADMIN_ADDRESSES.length);
  });

  it("is nobody when nobody is signed in", () => {
    expect(isAdmin(null)).toBe(false);
    expect(isAdmin("not an address")).toBe(false);
  });
});

describe("proving a wallet", () => {
  it("accepts a signature the wallet actually made", () => {
    expect(verifyProof(wallet().sign(), T0)).toBe(true);
  });

  it("accepts the same wallet however its address is spelled", () => {
    // A wallet hands back a checksummed address; the site stores lowercase. Both
    // have to verify, or half the players cannot sign in.
    const w = wallet();
    expect(verifyProof(w.sign({ address: checksum(w.address) }), T0)).toBe(true);
    expect(verifyProof(w.sign({ address: w.address.toLowerCase() }), T0)).toBe(true);
  });

  it("refuses a signature over a different message", () => {
    // Signed with one nonce and presented with another. This is why the
    // challenge is rebuilt from the stored fields instead of stored beside them:
    // there is no way to present a proof for a message it was not made for.
    const proof = wallet().sign();
    expect(verifyProof({ ...proof, nonce: "different" }, T0)).toBe(false);
  });

  it("refuses a signature attributed to another address", () => {
    const mine = wallet();
    const theirs = wallet();
    // A perfectly good signature wearing somebody else's name. Since every
    // address is public, this is the entire attack — and recovery is what stops
    // it: the key that comes back out is theirs, and it hashes to their address.
    expect(verifyProof(theirs.sign({ address: mine.address }), T0)).toBe(false);
  });

  it("refuses a proof that has run out, and one dated forward", () => {
    const w = wallet();
    expect(verifyProof(w.sign(), T0 + SESSION_LIFE - 1)).toBe(true);
    expect(verifyProof(w.sign(), T0 + SESSION_LIFE + 1)).toBe(false);
    // Dating a proof forward would otherwise buy an extra window out of one
    // signature.
    expect(verifyProof(w.sign({ issuedAt: T0 + 60_000 }), T0)).toBe(false);
  });

  it("takes v as 27 or 28, and as a bare 0 or 1", () => {
    // Both are in the wild. A wallet that hands back 0 rather than 27 is not
    // broken, and refusing it would look like the site refusing that wallet.
    const w = wallet();
    const proof = w.sign();
    const bytes = proof.signature.slice(2);
    const v = parseInt(bytes.slice(128), 16);
    const bare = "0x" + bytes.slice(0, 128) + (v - 27).toString(16).padStart(2, "0");
    expect(verifyProof({ ...proof, signature: bare }, T0)).toBe(true);
    // And a v that is neither is refused rather than guessed at.
    const nonsense = "0x" + bytes.slice(0, 128) + "07";
    expect(verifyProof({ ...proof, signature: nonsense }, T0)).toBe(false);
  });

  it("says no to rubbish rather than falling over", () => {
    const w = wallet();
    for (const signature of ["", "0x", "not hex at all!", "0x1234", "0x" + "aa".repeat(65)]) {
      expect(verifyProof({ ...w.sign(), signature }, T0)).toBe(false);
    }
    for (const address of ["", "0x", "abc", "0x" + "z".repeat(40)]) {
      expect(verifyProof({ ...w.sign(), address }, T0)).toBe(false);
    }
  });
});

describe("admin is a permission, not a login", () => {
  it("lets any wallet prove itself and calls none of them admin", () => {
    const w = wallet();
    const proof = w.sign();
    // Both halves matter. A stranger signing in is a real session — that is what
    // makes a collection theirs — and it is still not the admin.
    expect(verifyProof(proof, T0)).toBe(true);
    expect(isAdmin(proof.address)).toBe(false);
  });

  it("cannot be opened by knowing an address", () => {
    // Anyone can read an address off an explorer and put it in a proof. Only the
    // holder can sign for it, so the proof fails before admin is even asked.
    //
    // The generated address is here so this test means something while the admin
    // list is empty: a loop over nothing passes without checking anything, and
    // that is the shape of test this project has been bitten by before.
    const target = wallet();
    expect(verifyProof(wallet().sign({ address: target.address }), T0)).toBe(false);
    for (const admin of ADMIN_WALLETS) {
      expect(verifyProof(wallet().sign({ address: admin }), T0)).toBe(false);
    }
  });
});
