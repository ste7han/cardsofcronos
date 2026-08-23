// Signing in, and the one thing it has to refuse.
//
// The admin's private key is the maker's alone: nothing in this repository can
// produce a real admin signature, and anything that could would mean the key had
// leaked. So every signature here comes from a keypair these tests generate,
// which is the same code path with a different thirty-two bytes, and the admin's
// own address is only ever checked for the things that need no signature.

import { ed25519 } from "@noble/curves/ed25519";
import { describe, expect, it } from "vitest";

import { ADMIN_KEYS, ADMIN_WALLETS, isAdmin } from "@/lib/admin";
import { base58Decode, base58Encode } from "@/lib/base58";
import { SESSION_LIFE, challenge, verifyProof, type WalletProof } from "@/lib/session";

const T0 = 1_700_000_000_000;

/** A wallet these tests own, standing in for one they never will. */
function wallet() {
  const secret = ed25519.utils.randomPrivateKey();
  const address = base58Encode(ed25519.getPublicKey(secret));

  const sign = (over: Partial<WalletProof> = {}): WalletProof => {
    const claim = { address, issuedAt: T0, nonce: "abc123", ...over };
    const signature = ed25519.sign(new TextEncoder().encode(challenge(claim)), secret);
    return { ...claim, signature: base58Encode(signature), ...over };
  };

  return { address, sign };
}

describe("the admin addresses", () => {
  it("are Solana addresses and not things that merely look like one", () => {
    // The failure this guards is quiet: a mistyped address does not throw, it
    // just never matches, and whoever it belonged to is locked out of their own
    // site with nothing to read.
    expect(ADMIN_WALLETS.length).toBeGreaterThan(0);
    ADMIN_WALLETS.forEach((wallet, i) => {
      expect(base58Decode(wallet)).toHaveLength(32);
      expect(base58Encode(ADMIN_KEYS[i]!)).toBe(wallet);
    });
  });

  it("are addresses and never keys", () => {
    // A public key is 32 bytes; a private key would be 64. If this list ever
    // holds a long one, something has gone very wrong.
    for (const key of ADMIN_KEYS) expect(key).toHaveLength(32);
  });

  it("has no duplicates and no blanks", () => {
    // Two entries for one wallet is a list somebody edited twice, and the second
    // edit is the one nobody remembers making.
    expect(new Set(ADMIN_WALLETS).size).toBe(ADMIN_WALLETS.length);
    expect(ADMIN_WALLETS.every((wallet) => wallet.length > 0)).toBe(true);
  });

  it("lets each of them in, and nobody else", () => {
    for (const wallet of ADMIN_WALLETS) expect(isAdmin(wallet)).toBe(true);
    expect(isAdmin("Dg93gmtVbL4vdqHbdoBVFRsUtnjk6XAQeXA5GD4GZ7ka")).toBe(false);
  });
});

describe("proving a wallet", () => {
  it("accepts a signature the wallet actually made", () => {
    expect(verifyProof(wallet().sign(), T0)).toBe(true);
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
    // address is public, this is the entire attack.
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

  it("says no to rubbish rather than falling over", () => {
    const w = wallet();
    for (const signature of ["", "not base58 at all!", "111"]) {
      expect(verifyProof({ ...w.sign(), signature }, T0)).toBe(false);
    }
    for (const address of ["", "0OIl", "abc"]) {
      expect(verifyProof({ ...w.sign(), address }, T0)).toBe(false);
    }
  });
});

describe("admin is a permission, not a login", () => {
  it("lets any wallet prove itself and calls only one of them admin", () => {
    const w = wallet();
    const proof = w.sign();
    // Both halves matter. A stranger signing in is a real session — that is what
    // makes a collection theirs — and it is still not the admin.
    expect(verifyProof(proof, T0)).toBe(true);
    expect(isAdmin(proof.address)).toBe(false);
  });

  it("cannot be opened by knowing the admin address", () => {
    // Anyone can read these off an explorer and put one in a proof. Only the
    // holder can sign for it, so the proof fails before admin is even asked.
    for (const admin of ADMIN_WALLETS) {
      expect(verifyProof(wallet().sign({ address: admin }), T0)).toBe(false);
    }
  });

  it("is nobody when nobody is signed in", () => {
    expect(isAdmin(null)).toBe(false);
  });
});
