// Has the token launched?
//
// One question, one answer, read from one place. The banner that warns about
// copies, the contract-address panel and anything else that depends on it all
// ask here — because a warning that says "we are not live" and survives the
// launch is worse than no warning at all: it is the thing that makes the real
// site look like the fake one.
//
// For this project the answer is yes, and has been since the first version.
// $CROCARD is on Cronos, people hold it, and the old dapp already gave a mint
// discount for holding it. That is a different starting point from the one this
// code came from, where the file existed because there was nothing yet — so the
// copycat banner draws nothing and the address panel simply shows the address.
//
// The override stays because a testnet or a preview deploy is a real thing to
// want, and NEXT_PUBLIC_ because the browser needs it. A contract address is the
// most public fact about a token; there is no secret here.

import { CROCARD } from "@/lib/revenue";
import { TELEGRAM_CHANNEL, X_ACCOUNT, X_HANDLE } from "@/lib/links";

export const TOKEN = process.env.NEXT_PUBLIC_TOKEN ?? CROCARD;

export const LAUNCHED = TOKEN.length > 0;

/**
 * Where an official link actually comes from.
 *
 * The URLs are imported rather than repeated. This object had its own copy of
 * the Telegram address, which is one edit away from a banner naming a channel
 * that no longer exists while telling people it is the safe one.
 *
 * TODO: `site` is still the other project's domain, and so are the accounts in
 * lib/links.ts. Nothing renders them today — LAUNCHED is true, so the copycat
 * banner draws nothing — but the moment anything does, this sentence would be
 * pointing people at somebody else's Telegram while calling it the safe one.
 * They go together with the rest of the naming.
 */
export const OFFICIAL = {
  site: "trenches.cards",
  telegram: TELEGRAM_CHANNEL,
  x: X_ACCOUNT,
  xHandle: X_HANDLE,
} as const;
