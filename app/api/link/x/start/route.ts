// Step one of linking X: hand back the URL to send the player to.
//
// A POST and not a redirect, because the request carries the wallet proof and a
// proof does not belong in a query string — it would be in the browser history,
// in any proxy log along the way, and in X's referrer.
//
// What is remembered between here and the callback goes in a cookie, and what
// goes in it is the proof itself. That is the point: an unsigned cookie holding
// a bare address could be edited to somebody else's, and X would then be linked
// to a wallet its owner never touched. A proof cannot be edited without the
// private key behind it, so the cookie is as trustworthy as the wallet is.

import { db, signedInWallet, UNAUTHORISED } from "@/lib/api";
import { env } from "@/lib/api";
import { LINK_COOKIE, sealPending } from "@/lib/link-cookie";
import { authorizeUrl, newState, pkce, redirectUriFor } from "@/lib/x-oauth";
import { linksOf } from "@/lib/store";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const clientId = env().X_CLIENT_ID;
  const clientSecret = env().X_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    // Loud, and specific about which half. This is a deployment mistake, not a
    // player mistake, and "linking is unavailable" would send somebody looking
    // in the wrong place for an afternoon.
    return Response.json(
      {
        error: !clientId
          ? "X_CLIENT_ID is not set on this Worker."
          : "X_CLIENT_SECRET is not set on this Worker. Set it with `wrangler secret put`.",
      },
      { status: 503 },
    );
  }

  const body = await request.json().catch(() => null);
  const proof = (body as { proof?: unknown } | null)?.proof;
  const wallet = await signedInWallet(
    new Request(request.url, { method: "POST", body: JSON.stringify({ proof }) }),
  );
  if (wallet === null) return UNAUTHORISED;

  // Already linked to something else is worth saying now rather than after the
  // player has been to X and back.
  const existing = await linksOf(db(), wallet);
  const already = existing.find((link) => link.network === "x");

  const { verifier, challenge } = await pkce();
  const state = newState();

  const url = authorizeUrl({
    clientId,
    redirectUri: redirectUriFor(request.url),
    state,
    challenge,
  });

  const response = Response.json({ url, replacing: already?.handle ?? null });
  response.headers.append(
    "set-cookie",
    sealPending(LINK_COOKIE, { proof, state, verifier }, new URL(request.url).protocol === "https:"),
  );
  return response;
}
