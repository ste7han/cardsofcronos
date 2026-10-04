// Step two of linking Discord: Discord sends the player back here.
//
// A GET, because it is a redirect the browser follows. Both things it needs
// beyond the code are in the cookie set at the start and both are checked
// rather than assumed:
//
//   state   the request coming back must be the one that went out
//   proof   re-verified, so an edited cookie is a signature that does not fit
//
// It ends in a redirect to /profile either way. JSON would be shown to somebody
// who got here by pressing a button on Discord's own screen, so the outcome
// travels in the URL and the page says it in words.

import { db, env, signedInWallet } from "@/lib/api";
import { clearPending, LINK_COOKIE, readPending } from "@/lib/link-cookie";
import { linkAccount } from "@/lib/store";
import { identify, redirectUriFor } from "@/lib/discord-oauth";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const secure = url.protocol === "https:";

  const done = (params: Record<string, string>) => {
    const to = new URL("/profile", url.origin);
    for (const [key, value] of Object.entries(params)) to.searchParams.set(key, value);
    const response = new Response(null, { status: 303 });
    response.headers.set("location", to.toString());
    response.headers.set("set-cookie", clearPending(LINK_COOKIE, secure));
    return response;
  };

  // They said no on Discord's own screen. A decision, not an error.
  if (url.searchParams.get("error")) return done({ link: "cancelled" });

  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const pending = readPending(request.headers.get("cookie"), LINK_COOKIE);

  if (!code || !state || !pending) return done({ link: "expired" });
  // Somebody else's callback, or a stale tab. Either way not the request that
  // started here, and this is the whole CSRF defence of the flow.
  if (state !== pending.state) return done({ link: "mismatch" });

  const wallet = await signedInWallet(
    new Request(url.origin, { method: "POST", body: JSON.stringify({ proof: pending.proof }) }),
  );
  if (wallet === null) return done({ link: "signedout" });

  const clientId = env().DISCORD_CLIENT_ID;
  const clientSecret = env().DISCORD_CLIENT_SECRET;
  if (!clientId || !clientSecret) return done({ link: "unconfigured" });

  let identity;
  try {
    identity = await identify({
      code,
      clientId,
      clientSecret,
      redirectUri: redirectUriFor(request.url),
    });
  } catch (error) {
    // Logged with Discord's own words, which are for whoever runs this. The
    // player gets a sentence they can act on.
    console.error("Discord link failed:", error);
    return done({ link: "failed" });
  }

  const heldBy = await linkAccount(db(), {
    wallet,
    network: "discord",
    accountId: identity.id,
    handle: identity.username,
    linkedAt: Date.now(),
  });

  // One account, one wallet. Somebody who can attach one Discord account to ten
  // wallets is ten people as far as anything reading this table is concerned.
  if (heldBy) return done({ link: "taken", handle: identity.username });

  return done({ link: "discord", handle: identity.username });
}
