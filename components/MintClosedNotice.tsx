"use client";

// The banner at the top of /mint.
//
// A client component for one reason: the admin sees working buttons further down
// the page, and a fixed "the mint is not open" above them would be the page
// contradicting itself. Everyone else gets the plain statement, which is the
// whole point of it — not sold out, not queued, not early access.

import { MINT_OPEN } from "@/lib/collection";
import { useSession } from "@/lib/use-session";

export function MintClosedNotice() {
  const { admin } = useSession();

  if (MINT_OPEN) return null;

  if (admin) {
    return (
      <p className="mt-4 max-w-xl border border-gold/40 bg-gold/5 px-4 py-3 text-[11px] leading-relaxed text-gold">
        The mint is shut to everyone but you. What you open is drawn against the real set with the
        real odds, and kept in this browser — there is still no token and no chain underneath it,
        so nothing here is a claim on the mint that comes later.
      </p>
    );
  }

  return (
    <p className="mt-4 max-w-xl border border-gold/40 bg-gold/5 px-4 py-3 text-[11px] leading-relaxed text-gold">
      The mint is not open. Not sold out, not queued, not early access — there is no token and no
      chain behind it yet, so there is nothing here that could be minted. This page is what it will
      be and what it will cost you to know beforehand. Everything below is real; only the button is
      missing.
    </p>
  );
}
