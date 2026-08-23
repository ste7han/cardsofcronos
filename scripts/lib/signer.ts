// A throwaway wallet that can sign for itself.
//
// The end-to-end drive scripts each need one, and each of them used to carry its
// own copy of the same six lines. Four copies of a signer is three chances for
// one of them to drift from what lib/session.ts actually verifies, and the
// failure would look like the site being broken rather than the script.
//
// These keys are generated, used once against a running site and thrown away.
// Nothing funds them and nothing is at stake on them; the only thing they prove
// is that a signature the server accepts can be produced without a browser.

import { secp256k1 } from "@noble/curves/secp256k1";

import { addressOf, bytesToHex } from "@/lib/address";
import { challenge, signingHash, type WalletProof } from "@/lib/session";

export interface FakeWallet {
  address: string;
  proof: WalletProof;
}

export function wallet(nonce: string): FakeWallet {
  const secret = secp256k1.utils.randomPrivateKey();
  // Uncompressed, because that is what an address is a hash of.
  const address = addressOf(secp256k1.getPublicKey(secret, false));

  const unsigned = { address, issuedAt: Date.now(), nonce };
  const signature = secp256k1.sign(signingHash(challenge(unsigned)), secret);

  // 65 bytes: r, s, and the recovery bit as v. The +27 is the convention every
  // wallet follows, and lib/session.ts accepts both that and a bare 0 or 1.
  const hex =
    "0x" +
    bytesToHex(signature.toCompactRawBytes()) +
    (signature.recovery + 27).toString(16).padStart(2, "0");

  return { address, proof: { ...unsigned, signature: hex } };
}
