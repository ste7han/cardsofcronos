// Has the token launched?
//
// One question, one answer, read from one place. The banner that warns about
// copies, the contract-address panel and anything else that depends on it all
// ask here — because a warning that says "we are not live" and survives the
// launch is worse than no warning at all: it is the thing that makes the real
// site look like the fake one.
//
// NEXT_PUBLIC_ because the browser needs it, and it is not a secret: a mint
// address is the most public thing about a token. Absent means not launched,
// which is the only sensible default — a missing variable must never read as
// "yes, this is live".

import { TELEGRAM_CHANNEL, X_ACCOUNT, X_HANDLE } from "@/lib/links";

export const TCG_MINT = process.env.NEXT_PUBLIC_TCG_MINT ?? "";

export const LAUNCHED = TCG_MINT.length > 0;

/**
 * Where an official link actually comes from.
 *
 * The URLs are imported rather than repeated. This object had its own copy of
 * the Telegram address, which is one edit away from the banner naming a channel
 * that no longer exists while telling people it is the safe one.
 */
export const OFFICIAL = {
  site: "trenches.cards",
  telegram: TELEGRAM_CHANNEL,
  x: X_ACCOUNT,
  xHandle: X_HANDLE,
} as const;
