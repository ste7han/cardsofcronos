// Step one of linking Discord: hand back the URL to send the player to.
//
// A POST and not a redirect, for the reason the X start route spells out: the
// request carries the wallet proof, and a proof does not belong in a query
// string — it would be in the browser history, in any proxy log on the way, and
// in Discord's referrer.
//
// What has to survive until the callback goes in the same sealed cookie the
// other two flows use, and it holds the proof rather than the address: an
// unsigned cookie with a bare address could be edited to somebody else's, and
// the account would attach to a wallet its owner never touched.

import { db, env, signedInWallet, UNAUTHORISED } from "@/lib/api";
import { LINK_COOKIE, sealPending } from "@/lib/link-cookie";
import { authorizeUrl, newState, redirectUriFor } from "@/lib/discord-oauth";
import { linksOf } from "@/lib/store";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const clientId = env().DISCORD_CLIENT_ID;
  const clientSecret = env().DISCORD_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    // Specific about which half is missing. This is a deployment mistake and
    // not a player's, and "linking is unavailable" sends somebody looking in
    // the wrong place.
    return Response.json(
      {
        error: !clientId
          ? "DISCORD_CLIENT_ID is not set on this Worker."
          : "DISCORD_CLIENT_SECRET is not set on this Worker. Set it with `wrangler secret put`.",
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

  // Worth saying now rather than after a trip to Discord and back.
  const existing = await linksOf(db(), wallet);
  const already = existing.find((link) => link.network === "discord");

  const state = newState();
  const url = authorizeUrl({
    clientId,
    redirectUri: redirectUriFor(request.url),
    state,
  });

  const response = Response.json({ url, replacing: already?.handle ?? null });
  response.headers.append(
    "set-cookie",
    // No verifier: Discord is not asked for PKCE. Empty rather than absent, the
    // same way the Telegram flow does it, because the cookie's shape is shared.
    sealPending(
      LINK_COOKIE,
      { proof, state, verifier: "" },
      new URL(request.url).protocol === "https:",
    ),
  );
  return response;
}
