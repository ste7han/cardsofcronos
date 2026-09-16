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

import { db, env } from "@/lib/api";
import { runWeekly } from "@/lib/publisher";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const expected = env().CRON_SECRET;
  if (!expected) {
    return Response.json({ error: "No CRON_SECRET is set, so nothing runs." }, { status: 503 });
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
