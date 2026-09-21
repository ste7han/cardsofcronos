"use client";

// The banner at the top of /mint.
//
// A client component for one reason: the admin sees working buttons further down
// the page, and a fixed "the mint is not open" above them would be the page
// contradicting itself. Everyone else gets the plain statement, which is the
// whole point of it — not sold out, not queued, not early access.
//
// It names the reason it is shut, which means it goes stale every time that
// reason changes. It said the contract had not been deployed until the day it
// was. If this is edited again, check that what it claims is still true on
// chain rather than only in the repository.

import { MINT_OPEN } from "@/lib/collection";
import { CONTRACTS } from "@/lib/revenue";
import { useSession } from "@/lib/use-session";

export function MintClosedNotice() {
  const { admin } = useSession();

  if (MINT_OPEN) return null;

  if (admin) {
    return (
      <p className="mt-4 max-w-xl border border-gold/40 bg-gold/5 px-4 py-3 text-[11px] leading-relaxed text-gold">
        The mint is shut to everyone but you. What you open is drawn against the real set with the
        real odds, and kept in this browser — the contract is on chain now but this button does not
        touch it, so nothing here is a claim on the mint that comes later.
      </p>
    );
  }

  return (
    <p className="mt-4 max-w-xl border border-gold/40 bg-gold/5 px-4 py-3 text-[11px] leading-relaxed text-gold">
      The mint is not open. Not sold out, not queued, not early access — the contract is deployed
      and both its doors are shut, so there is nothing here that could be minted yet. You can go and
      read it: <span className="font-mono">{CONTRACTS.nft}</span> on Cronos, 5,603 of them and no
      way to make it more. This page is what it will be and what it will cost you to know
      beforehand. Everything below is real; only the button is missing.
    </p>
  );
}
