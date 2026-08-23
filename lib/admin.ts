// Who is allowed to do things nobody else can yet.
//
// A permission on top of an ordinary session (lib/session.ts), not a different
// kind of login. Anyone may sign in; this file only answers whether the wallet
// that did is one of the ones that run the place.
//
// Keeping those apart matters more than it looks. Sessions are how the site
// knows whose cards to show; admin is how it knows who may mint while the mint
// is shut. Tied together, the only account that could exist would be the
// maker's, and the day the mint opens there would be nothing for anyone else to
// log in to.
//
// A list rather than one address, because the wallet that deploys and the wallet
// the maker actually uses should be different keys. A wallet holding contract
// ownership should not be signing into websites, and admin here is a permission
// on this site rather than a power on the chain — so there is no reason for them
// to be the same key, and one good reason for them not to be.

import { normalise } from "@/lib/address";
import { signedIn } from "@/lib/session";

/**
 * The wallets that run this. Public by nature: these are addresses, never keys.
 *
 * ── EMPTY ON PURPOSE, AND NOT FINISHED ──────────────────────────────────────
 * The Solana version of this file had two addresses in it. They do not carry
 * over — a Solana address is not a Cronos one — and the Cronos addresses have
 * not been given yet.
 *
 * Guessing was the alternative and it is much worse than being empty. There are
 * plausible-looking candidates lying around the old dapp: the treasury the
 * weekly airdrop pays from, the account that owns the NFT contract. Both are
 * wrong. The treasury is a hot wallet whose key sits on a server, and contract
 * ownership is a power on the chain, which is exactly the thing this list is not
 * supposed to be. An address in here that turns out to belong to somebody else
 * hands them the mint.
 *
 * While it is empty, `isAdmin` is false for everybody and `mayMint()` in
 * lib/collection.ts falls back to MINT_OPEN, which is off. That is the safe
 * direction to fail in, and the matching test says so out loud.
 *
 * TODO: two Cronos addresses from the maker — the one that plays and collects,
 * and the one that deploys — then restore the assertion in test/session.test.ts.
 */
export const ADMIN_WALLETS: readonly string[] = [];

/**
 * The same addresses, normalised, checked at load.
 *
 * A mistyped address is the failure that matters here, and it is silent: it
 * would not throw, it would simply never match, and whoever it belonged to is
 * locked out of their own site with nothing to read. `normalise` throws on a
 * wrong length, a non-hex character, and — for an address written in mixed case,
 * which is how everybody copies them — on a failed EIP-55 checksum. Between them
 * that catches every typo which is not another real address.
 *
 * Lowercase, because that is the one form addresses are compared in everywhere
 * else. An admin list in checksummed case would never match a session.
 */
export const ADMIN_ADDRESSES: readonly string[] = ADMIN_WALLETS.map((wallet, i) => {
  try {
    return normalise(wallet);
  } catch (error) {
    throw new Error(`Admin wallet ${i + 1} is not usable: ${(error as Error).message}`);
  }
});

{
  const unique = new Set(ADMIN_ADDRESSES);
  if (unique.size !== ADMIN_ADDRESSES.length) {
    throw new Error("The same admin address is listed twice. One of the two is a typo.");
  }
}

export function isAdmin(address: string | null): boolean {
  if (address === null) return false;
  try {
    return ADMIN_ADDRESSES.includes(normalise(address));
  } catch {
    return false;
  }
}

/** Is an admin signed in at this browser right now? */
export function provenAdmin(now: number = Date.now()): boolean {
  return isAdmin(signedIn(now));
}
