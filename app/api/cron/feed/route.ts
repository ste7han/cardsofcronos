// The minute tick: what happened on chain, into Discord.
//
// Same shape as the daily and weekly ticks next door and for the same reasons:
// reached only by worker/index.js, an ordinary route so the job runs inside Next
// with the D1 binding already wired, and gated on a secret out of the
// environment because there is nobody signed in at any of the minutes it runs.
//
// It runs every minute, which is the only one of the three that does. A feed
// that reports a mint an hour later is not a feed.
//
// The work is in lib/feed.ts. This is the door.

import { db, env } from "@/lib/api";
import { runFeeds } from "@/lib/feed";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  // Falsy and not undefined, for the reason spelled out in the daily route:
  // `wrangler secret put` accepts an empty value and reports success.
  const expected = env().CRON_SECRET;
  if (!expected) {
    return Response.json(
      { error: "CRON_SECRET is missing or empty, so nothing runs." },
      { status: 503 },
    );
  }
  if (request.headers.get("x-cron-secret") !== expected) {
    return Response.json({ error: "No." }, { status: 401 });
  }

  const ran = await runFeeds(
    db(),
    {
      rpc: env().CRONOS_RPC,
      mints: env().DISCORD_MINTS,
      buys: env().DISCORD_BUYS,
      burns: env().DISCORD_BURNS,
    },
    Date.now(),
  );

  // Always 200 with what happened. Most minutes there is nothing to say, and a
  // job that returns an error for the ordinary case is a job whose alerts get
  // muted — which is how a feed stays broken for a fortnight.
  return Response.json({ ok: true, ...ran });
}
