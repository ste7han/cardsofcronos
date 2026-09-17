// The daily tick: release what the splitter is holding and record what burned.
//
// Same shape as the weekly tick next door and for the same reasons: reached only
// by worker/index.js, an ordinary route so the job runs inside Next with the D1
// binding and the helpers already wired, and gated on a secret out of the
// environment because there is nobody signed in at ten past midnight.
//
// The work is in lib/splitter.ts. This is the door.

import { db, env } from "@/lib/api";
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

  const ran = await runDaily(
    db(),
    { publisherKey: env().PUBLISHER_KEY, rpc: env().CRONOS_RPC },
    Date.now(),
  );

  // Always 200 with what happened, for the same reason the weekly one does. Most
  // days there is nothing to release, and a job that returns an error for the
  // ordinary case is a job whose alerts get muted.
  return Response.json(ran);
}
