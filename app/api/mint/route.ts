// What the collection will let this wallet do right now.
//
// One answer with two halves: the counters, which are the same for everybody,
// and this wallet's free mints, which are not. Both come off the chain or out of
// the file the chain's root was built from — nothing here is a number this
// server decided.
//
// PUBLIC AND NOT SIGNED IN, like /api/drop and for the same reason. A merkle
// proof is not a capability: `claim` mints to `msg.sender` and checks the proof
// against that address, so somebody else's proof will not mint them anything.
// Putting it behind a login would mean a holder who lost their session also lost
// their free mints.
//
// ── THE PRICE IS THE CHAIN'S, NOT THE FILE'S ─────────────────────────────────
//
// lib/revenue.ts holds the list price because the page has to print something
// before a wallet is connected. What this returns is `priceFor(wallet)`, which
// is what the contract will actually charge — the discount included. They are
// meant to agree and the mint page says so; if they ever do not, the chain is
// the one that takes the money.

import { normalise } from "@/lib/address";
import { env } from "@/lib/api";
import { claimedBy, mintState } from "@/lib/mint";

import allowlist from "@/data/allowlist.json";

export const dynamic = "force-dynamic";

/** This wallet's place on the allowlist, or null when it is not on it. */
function entryFor(wallet: string) {
  const found = allowlist.claims.find((claim) => normalise(claim.address) === wallet);
  return found ?? null;
}

export async function GET(request: Request) {
  const asked = new URL(request.url).searchParams.get("wallet");

  let wallet: string | null = null;
  if (asked !== null) {
    try {
      wallet = normalise(asked);
    } catch {
      // Said differently from "you have no free mints", because they are
      // different sentences and only one is about the caller's typing.
      return Response.json({ error: "That is not an address." }, { status: 400 });
    }
  }

  const secret = env().CRONOS_RPC;
  const state = await mintState(wallet, secret);

  if (wallet === null || state.contract === null) {
    return Response.json({ wallet, state, claim: null });
  }

  const entry = entryFor(wallet);
  if (entry === null) return Response.json({ wallet, state, claim: null });

  // What the contract says has already been taken, not what this server thinks.
  // A claim made from a block explorer counts exactly as much as one made here,
  // and a page that did not know it would offer a button that reverts.
  const taken = await claimedBy(wallet, secret);

  return Response.json({
    wallet,
    state,
    claim: {
      allowance: entry.quantity,
      taken,
      left: Math.max(0, entry.quantity - taken),
      proof: entry.proof,
    },
  });
}
