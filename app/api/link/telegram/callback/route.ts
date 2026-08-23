// Telegram's login widget sends the browser here.
//
// A GET with the account's fields in the query string and a `hash` over them.
// That hash is an HMAC keyed by SHA-256 of the bot token, so only Telegram and
// this Worker can produce it — which makes the check here the entire security of
// the link, and the reason none of these fields are trusted before it passes.
//
// Ends in a redirect to /profile either way, like the X callback: whoever lands
// here arrived by pressing a button and should be told what happened in a
// sentence, not handed JSON.

import { db, env, signedInWallet } from "@/lib/api";
import { clearPending, LINK_COOKIE, readPending } from "@/lib/link-cookie";
import { completeTask, linkAccount } from "@/lib/store";
import { authFrom, handleOf, verifyTelegram } from "@/lib/telegram";

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

  const token = env().TELEGRAM_BOT_TOKEN;
  if (!token) return done({ link: "unconfigured" });

  const auth = authFrom(url.searchParams);
  if (!auth) return done({ link: "cancelled" });

  const pending = readPending(request.headers.get("cookie"), LINK_COOKIE);
  if (!pending) return done({ link: "expired" });

  const wallet = await signedInWallet(
    new Request(url.origin, { method: "POST", body: JSON.stringify({ proof: pending.proof }) }),
  );
  if (wallet === null) return done({ link: "signedout" });

  if (!(await verifyTelegram(auth, token, Date.now()))) {
    // Either somebody wrote their own query string, or a real one was kept until
    // it went stale. Neither is worth telling apart on screen.
    return done({ link: "failed" });
  }

  const handle = handleOf(auth);
  const heldBy = await linkAccount(db(), {
    wallet,
    network: "telegram",
    accountId: auth.id,
    handle,
    linkedAt: Date.now(),
  });
  if (heldBy) return done({ link: "taken", handle });

  await completeTask(db(), wallet, "link_telegram", "verified", Date.now());

  return done({ link: "telegram", handle });
}
