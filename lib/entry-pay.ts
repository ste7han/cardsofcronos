// Paying to play a board, from the browser.
//
// One call, one transaction, and everything it does with the money is decided
// by contracts/BoardEntry.sol before the wallet is even asked — see the note
// there. Nothing in this file chooses a destination or an amount beyond the fee
// the board itself names.

import { selector } from "@/lib/evm-tx";

/** The calldata for `enter()`. No arguments: there is nothing to get wrong. */
export function enterData(): string {
  return selector("enter()");
}

/** A whole number of CRO as wei. */
export function feeWei(cro: number): bigint {
  if (!Number.isInteger(cro) || cro <= 0) {
    throw new Error(`An entry fee is a whole number of CRO, not ${cro}.`);
  }
  return BigInt(cro) * 10n ** 18n;
}
