// Step two of linking X: X sends the player back here.
//
// A GET, because it is a redirect the browser follows. Everything it needs
// beyond the code is in the cookie set at the start, and every one of those
// pieces is checked rather than assumed:
//
//   state     the request that comes back must be the one that went out
//   proof     re-verified, so an edited cookie is a signature that does not fit
//   verifier  the other half of PKCE, which only the client that started this had
//
// It ends in a redirect to /profile either way. A JSON error would be shown to a
// person who arrived here by clicking a button on X and has no idea what a route
// is, so the outcome goes in the URL and the page says it in words.

import { db, env, signedInWallet, UNAUTHORISED } from "@/lib/api";
import { clearPending, LINK_COOKIE, readPending } from "@/lib/link-cookie";
import { completeTask, linkAccount } from "@/lib/store";
import { identify, redirectUriFor } from "@/lib/x-oauth";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const secure = url.protocol === "https:";

  const done = (params: Record<string, string>) => {
    const to = new URL("/profile", url.origin);
    for (const [key, value] of Object.entries(params)) to.searchParams.set(key, value);
    const response = Response.redirect(to.toString(), 303);
    // Response.redirect gives an immutable Response, so it is rebuilt to carry
    // the cookie that clears the pending link.
    const withCookie = new Response(null, { status: 303, headers: response.headers });
    withCookie.headers.set("set-cookie", clearPending(LINK_COOKIE, secure));
    return withCookie;
  };

  // The player said no on X's own screen. Not an error: a decision.
  const denied = url.searchParams.get("error");
  if (denied) return done({ link: "cancelled" });

  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const pending = readPending(request.headers.get("cookie"), LINK_COOKIE);

  if (!code || !state || !pending) return done({ link: "expired" });
  if (state !== pending.state) {
    // Somebody else's callback, or a stale tab. Either way it is not the request
    // that started here.
    return done({ link: "mismatch" });
  }

  const wallet = await signedInWallet(
    new Request(url.origin, { method: "POST", body: JSON.stringify({ proof: pending.proof }) }),
  );
  if (wallet === null) return done({ link: "signedout" });

  const clientId = env().X_CLIENT_ID;
  const clientSecret = env().X_CLIENT_SECRET;
  if (!clientId || !clientSecret) return done({ link: "unconfigured" });

  let identity;
  try {
    identity = await identify({
      code,
      verifier: pending.verifier,
      clientId,
      clientSecret,
      redirectUri: redirectUriFor(request.url),
    });
  } catch (error) {
    console.error("X link failed:", error);
    return done({ link: "failed" });
  }

  const heldBy = await linkAccount(db(), {
    wallet,
    network: "x",
    accountId: identity.id,
    handle: identity.username,
    linkedAt: Date.now(),
  });

  // One account, one wallet. Without this the referral system is farmed by
  // making wallets, and wallets are free.
  if (heldBy) return done({ link: "taken", handle: identity.username });

  // The point is paid at the moment it is verified. A later sweep over "who has
  // an X link" would work too and would be a second place where the rule lives.
  await completeTask(db(), wallet, "link_x", "verified", Date.now());

  return done({ link: "x", handle: identity.username });
}

export { UNAUTHORISED };
