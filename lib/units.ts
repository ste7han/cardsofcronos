// Turning base units into something a person can read.
//
// Apart from lib/cronos.ts on purpose. That file talks to an RPC and has no
// business in a browser bundle; these three lines are needed by every component
// that shows an amount, and dragging a hundred and forty lines of JSON-RPC along
// with them is a lot of code to ship for a division.

/**
 * Base units as a whole-token number, for showing a person. Never for
 * arithmetic — this is where exactness stops and readability starts.
 *
 * Scaled before it is divided. Dividing a bigint by 1e18 first floors every
 * amount under one token to zero, which on a burn page reads as "nothing was
 * burned" and is the one wrong answer it must never give.
 */
export function toTokens(base: bigint | string, decimals = 18, places = 2): number {
  const value = typeof base === "string" ? BigInt(base) : base;
  const scale = 10n ** BigInt(places);
  return Number((value * scale) / 10n ** BigInt(decimals)) / Number(scale);
}

/** Wei as a number of CRO. Cronos' native token has eighteen decimals. */
export function toCro(wei: bigint | string): number {
  return toTokens(wei, 18, 4);
}

/** Where a person goes to check any of this. */
export const EXPLORER = "https://cronoscan.com";
