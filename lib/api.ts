// The bits every route needs, and the one rule they all obey.
//
// That rule: the server checks the wallet signature itself. Until linking there
// was nothing at stake and the browser's own answer was good enough — it is
// written in lib/session.ts that this would have to change the moment there was.
// A referral system pays out, so this is that moment. A route that took the
// wallet at its word would let anyone attach their X account to somebody else's
// address, which is the only attack the whole design is arranged against.

import { getCloudflareContext } from "@opennextjs/cloudflare";

import type { Database } from "@/lib/store";
import { seePlayer } from "@/lib/store";
import { verifyProof, type WalletProof } from "@/lib/session";
import { normalise } from "@/lib/address";

export function env(): CloudflareEnv {
  return getCloudflareContext().env;
}

export function db(): Database {
  return env().DB as unknown as Database;
}

/**
 * Whose wallet is this, proved rather than claimed.
 *
 * Returns null for anything that does not check out, and says nothing about
 * which part failed. The caller turns that into one flat 401: telling an
 * attacker whether the address existed or the signature was wrong is telling
 * them which half to keep trying.
 */
export function walletFrom(body: unknown): string | null {
  const proof = (body as { proof?: WalletProof } | null)?.proof;
  if (!proof || typeof proof !== "object") return null;
  if (!verifyProof(proof, Date.now())) return null;
  // Normalised, not taken as written. An EVM address is the same wallet in any
  // case, so a proof signed with a checksummed address and one signed with a
  // lowercase one are the same person — and storing both spellings would make
  // them two players, two referral rows and two sets of points. This is the door
  // every wallet comes through, so this is where the spelling is settled.
  return normalise(proof.address);
}

/** Reads the proof out of a request and makes sure the player exists. */
export async function signedInWallet(request: Request): Promise<string | null> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return null;
  }

  const wallet = walletFrom(body);
  if (wallet === null) return null;

  await seePlayer(db(), wallet, Date.now());
  return wallet;
}

export const UNAUTHORISED = Response.json(
  { error: "Sign in with a wallet first." },
  { status: 401 },
);
