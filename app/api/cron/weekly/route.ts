// The weekly tick: close the week that just ended and pay whoever won it.
//
// Reached only by worker/index.js, which a Cloudflare cron calls on a schedule.
// It is an ordinary route so that the job runs inside Next, with the same D1
// binding and the same helpers as everything else — a scheduled handler doing
// this work itself would need its own copy of half of them.
//
// WHY A SECRET AND NOT AN ADMIN SESSION. There is nobody signed in at four in
// the morning. The scheduled handler carries a secret out of the environment and
// this compares it; an empty or missing secret is refused rather than matched,
// so a deployment that forgot to set one does nothing instead of doing this to
// anybody who finds the URL.
//
// EMPTY IS THE ONE THAT CATCHES PEOPLE. `wrangler secret put` takes an empty
// answer, says Success, and lists the name afterwards like any other secret —
// so the only way to tell a secret that is set from one that is set to nothing
// is that the route refuses. Which is why it says empty in the message.

import { db, env } from "@/lib/api";
import { runWeekly } from "@/lib/publisher";

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
  // Length-independent compare is not worth it here: the secret is compared
  // once a week against a header nobody can iterate on quickly. What matters is
  // that an absent secret never matches.
  if (request.headers.get("x-cron-secret") !== expected) {
    return Response.json({ error: "No." }, { status: 401 });
  }

  const ran = await runWeekly(
    db(),
    { publisherKey: env().PUBLISHER_KEY, rpc: env().CRONOS_RPC },
    Date.now(),
  );

  // Always 200 with what happened. A scheduled job that returns an error for
  // "nobody played last week" is a scheduled job whose alerts get muted, and a
  // muted alert is worse than no alert.
  return Response.json(ran);
}
