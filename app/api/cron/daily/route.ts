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
import { cursorOf, setCursor } from "@/lib/store";
import type { Database } from "@/lib/store";

export const dynamic = "force-dynamic";

/**
 * How long a soft call waits before it will run the job again.
 *
 * Six hours, not twenty. Twenty was chosen to mean "about daily" and it puts
 * the wrong thing on a daily clock: a proposed tree goes live exactly 24 hours
 * after it is proposed, and the run that adopts it is whichever one happens
 * next — so a 20-hour window could leave people unable to claim for most of a
 * second day, for a tree the contract had already been willing to adopt.
 *
 * Releasing four times a day instead of once costs nothing that matters:
 * `LEAST_WORTH_RELEASING` in lib/splitter.ts already refuses to swap dust, and
 * a run with nothing to do is a handful of eth_calls.
 */
const BETWEEN_RUNS = 6 * 60 * 60 * 1000;

/** The name the last-run time is filed under. Not a block — see below. */
const RAN = "daily:ran";

/**
 * When this job last finished, or null when it never has.
 *
 * Kept in `cursors` because that table already has a timestamp on every row and
 * a second table for one number would be a second thing to migrate. The `block`
 * column holds the day it ran rather than a block height, which is a small lie
 * about the column name and a smaller one than a table nobody else uses.
 */
async function lastRunAt(db: Database): Promise<number | null> {
  const row = await db
    .prepare(`SELECT at FROM cursors WHERE name = ?`)
    .bind(RAN)
    .first<{ at: number }>();
  return row?.at ?? null;
}

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

  // Two things reach this: the cron, and the Durable Object alarm in
  // worker/index.js. The alarm fires every minute and says `soft`, which means
  // "only if it has not run today" — the cron stopped firing entirely on 21
  // September 2026 and the money from the first mint sat still because of it.
  // See docs/the-discord-feeds.md for what ruling that out took.
  const body = (await request.json().catch(() => ({}))) as { soft?: boolean };
  const now = Date.now();

  if (body.soft === true) {
    const last = await lastRunAt(db());
    if (last !== null && now - last < BETWEEN_RUNS) {
      return Response.json({ ok: true, tooSoon: true, lastRunAt: last });
    }
  }

  // Claimed BEFORE the work, and that is the opposite of what it said here at
  // first. "Written after, so a run that threw halfway does not count" sounds
  // careful and was wrong: the alarm asks every minute, so a run that threw
  // left the slot unclaimed and the next minute started another one. Six of
  // them ran on top of each other the night the mint opened, each adding a
  // round of entitlements nobody had asked for.
  //
  // A failed run now waits for the next window instead. That is the right way
  // round for a job that moves money: late is recoverable, six at once is not.
  await setCursor(db(), RAN, Math.floor(now / 86_400_000), now);

  const secrets = { publisherKey: env().PUBLISHER_KEY, rpc: env().CRONOS_RPC };

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
