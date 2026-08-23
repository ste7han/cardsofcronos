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
// A list rather than one address, because the deployer and the wallet the maker
// actually uses are deliberately different keys. A wallet holding token
// authority should not be signing into websites, and admin here is a permission
// on this site rather than a power on the chain — so there is no reason for them
// to be the same key, and one good reason for them not to be.

import { base58Decode } from "@/lib/base58";
import { signedIn } from "@/lib/session";

/**
 * The wallets that run this. Public by nature: these are addresses, never keys.
 *
 * Order is not meaning. Both entries have the same rights; they are two keys
 * belonging to one person, kept apart on purpose.
 */
export const ADMIN_WALLETS: readonly string[] = [
  // The deployer. Launches TCG on pump.fun and signs as little else as possible.
  "Dg93gmtVbL4vdqHbdoBVFRsUtnjk6XAQeXA5GD4GZ7kp",
  // The maker's own wallet, which is the one that plays and collects.
  "8kYc6QfaFM7633An2VPK15Tx85Lf47NtfKvBXzn6cNpr",
];

/**
 * The same addresses as bytes, checked at load.
 *
 * A mistyped address is the failure that matters here, and it is silent: it
 * would not throw, it would simply never match, and whoever it belonged to is
 * locked out of their own site with nothing to read. Base58 catches a wrong
 * character and this catches a wrong length, which between them catch every typo
 * that is not another valid address.
 */
export const ADMIN_KEYS: readonly Uint8Array[] = ADMIN_WALLETS.map((wallet) => {
  const bytes = base58Decode(wallet);
  if (bytes.length !== 32) {
    throw new Error(`${wallet} is ${bytes.length} bytes, not 32. That is not a Solana address.`);
  }
  return bytes;
});

export function isAdmin(address: string | null): boolean {
  return address !== null && ADMIN_WALLETS.includes(address);
}

/** Is an admin signed in at this browser right now? */
export function provenAdmin(now: number = Date.now()): boolean {
  return isAdmin(signedIn(now));
}
