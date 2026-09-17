// The daily tick: release, record what burned, and pay the holders.
//
// Same shape as the weekly tick next door and for the same reasons: reached only
// by worker/index.js, an ordinary route so the job runs inside Next with the D1
// binding and the helpers already wired, and gated on a secret out of the
// environment because there is nobody signed in at ten past midnight.
//
// Three things, in this order and for a reason. The splitter releases first, so
// what it buys is in the drop before the drop is divided. The burns are recorded
// from the log that release wrote. Then the holder table is brought up to date
// and a round is opened over whatever is sitting there unclaimed.
//
// The work is in lib/splitter.ts and lib/holders.ts. This is the door.

import { db, env } from "@/lib/api";
import { runHolders } from "@/lib/holders";
import { runDaily } from "@/lib/splitter";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  // Falsy and not undefined. `wrangler secret put` accepts an empty value and
  // reports success, `wrangler secret list` then shows the name like any other,
  // and the binding arrives as a string of length zero — so "is it set" cannot
  // be answered by asking whether it exists. It was set to nothing here once and
  // every tick refused for a fortnight looking exactly like a tick that ran.
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

  const secrets = { publisherKey: env().PUBLISHER_KEY, rpc: env().CRONOS_RPC };
  const now = Date.now();

  // Sequential, not parallel. The round is opened over what the release just
  // bought, so running them at the same time would open today's round over
  // yesterday's money and leave today's for tomorrow.
  const splitter = await runDaily(db(), secrets, now);
  const holders = await runHolders(db(), secrets, now);
  const ran = { splitter, holders };

  // Always 200 with what happened, for the same reason the weekly one does. Most
  // days there is nothing to release, and a job that returns an error for the
  // ordinary case is a job whose alerts get muted.
  return Response.json(ran);
}
