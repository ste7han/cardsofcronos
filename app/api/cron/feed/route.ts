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
// ── AND IT IS ALSO REACHED FROM ORDINARY TRAFFIC ─────────────────────────────
//
// worker/index.js calls this after answering a page, with `soft: true`, and a
// soft call declines if the feeds have run in the last forty-five seconds. That
// is not belt and braces for its own sake: the cron stopped firing on the day
// this was written and no arrangement of schedules brought it back, while the
// job itself worked perfectly when the event was delivered by hand. A channel
// people watch should not be one scheduler away from silence — and a mint
// happens because somebody is on the mint page, so the busiest the site ever is
// is exactly when there is something to say.
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

  // Two things drive this: the cron, and ordinary page traffic. A tick says so
  // in the body and gets an unconditional run; traffic asks for one only if the
  // feeds have not run in the last three quarters of a minute, so a busy page
  // does not scan the chain once per visitor.
  const body = (await request.json().catch(() => ({}))) as { soft?: boolean };
  const ran = await runFeeds(
    db(),
    {
      rpc: env().CRONOS_RPC,
      mints: env().DISCORD_MINTS,
      buys: env().DISCORD_BUYS,
      burns: env().DISCORD_BURNS,
    },
    Date.now(),
    body.soft === true ? 45_000 : null,
  );

  // Always 200 with what happened. Most minutes there is nothing to say, and a
  // job that returns an error for the ordinary case is a job whose alerts get
  // muted — which is how a feed stays broken for a fortnight.
  return Response.json({ ok: true, ...ran });
}
