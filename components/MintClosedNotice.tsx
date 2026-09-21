"use client";

// Whether the mint is open, in the words somebody needs before they scroll.
//
// It used to read MINT_OPEN — the switch on the LOCAL rehearsal, the one that
// draws cards into a browser. That was the whole mint once. It stopped being it
// the moment the contract went up, and this banner went on saying "the mint is
// not open" for a day after both doors were opened on chain, with a working
// mint two screens further down. Somebody holding six of the first collection
// read it and believed it.
//
// So it asks the chain, through the same route the mint button does. One
// source, and when they disagree the chain is right.

import { useCallback, useEffect, useState } from "react";

import { useSession } from "@/lib/use-session";

interface State {
  contract: string | null;
  saleOpen: boolean;
  claimsOpen: boolean;
  minted: number;
  supply: number;
}

export function MintClosedNotice() {
  const { admin } = useSession();
  const [state, setState] = useState<State | null>(null);

  const look = useCallback(async () => {
    try {
      const answer = await fetch("/api/mint");
      if (answer.ok) setState(((await answer.json()) as { state: State }).state);
    } catch {
      // Left null, which draws nothing. A banner that guesses at whether a mint
      // is open is worse than no banner: both of its guesses are a lie to
      // somebody.
    }
  }, []);

  useEffect(() => {
    void look();
  }, [look]);

  if (state === null || state.contract === null) return null;

  const open = state.saleOpen || state.claimsOpen;

  if (open) {
    return (
      <p className="mt-4 max-w-xl border border-pump/40 bg-pump/5 px-4 py-3 text-[11px] leading-relaxed text-pump">
        The mint is open.{" "}
        {state.saleOpen && state.claimsOpen
          ? "Anybody can buy, and anybody holding the 2025 collection can take their free cards first."
          : state.claimsOpen
            ? "The free mints for holders of the 2025 collection are open; the paid mint follows."
            : "Cards can be bought below."}{" "}
        {state.minted.toLocaleString("en-US")} of {state.supply.toLocaleString("en-US")} minted so
        far.
      </p>
    );
  }

  if (admin) {
    return (
      <p className="mt-4 max-w-xl border border-gold/40 bg-gold/5 px-4 py-3 text-[11px] leading-relaxed text-gold">
        Both doors on the contract are shut, so nobody can mint. What you open further down is
        drawn against the real set with the real odds and kept in this browser — it is not a claim
        on the mint that comes later.
      </p>
    );
  }

  return (
    <p className="mt-4 max-w-xl border border-gold/40 bg-gold/5 px-4 py-3 text-[11px] leading-relaxed text-gold">
      The mint is not open. Not sold out, not queued, not early access — the contract is deployed
      and both its doors are shut, so there is nothing here that could be minted yet. This page is
      what it will be and what it will cost you to know beforehand.
    </p>
  );
}
