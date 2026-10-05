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
import { PUBLIC_RPCS } from "@/lib/cronos";
import { lastWeek, runWeekly, stillOwed } from "@/lib/publisher";
import { announceWeek } from "@/lib/weekly-news";
import { setCursor } from "@/lib/store";
import type { Database } from "@/lib/store";

export const dynamic = "force-dynamic";

/**
 * The week this job last closed, filed the way the daily one files its day.
 *
 * ── WHY THERE IS A SOFT CALL AT ALL ──────────────────────────────────────────
 *
 * This ran off a Cloudflare cron and nothing else. Cloudflare stopped invoking
 * this Worker's scheduled handler on 21 September 2026; the Durable Object alarm
 * in worker/index.js was written to replace it and was given the feed and the
 * daily job — and not this one. So no week was closed for a month and nobody was
 * paid, while both boards kept showing a winner all week.
 *
 * The alarm fires every minute, so it says `soft`: close last week if last week
 * has not been closed. Once done, the marker says which week it was and the
 * other fifty-nine calls that hour cost one read each.
 */
const RAN = "weekly:ran";

async function alreadyClosed(
  db: Database,
  rpcs: readonly string[],
  week: string,
): Promise<boolean> {
  const row = await db
    .prepare(`SELECT block FROM cursors WHERE name = ?`)
    .bind(RAN)
    .first<{ block: number }>();
  // The week is stored as its own digits — 2026-W39 becomes 202639 — so "later
  // than" is a comparison a number can answer and a marker from an older week
  // never looks like this one.
  if (row === null || row.block < weekAsNumber(week)) return false;

  // ── AND THE MARKER IS CHECKED AGAINST WHAT ACTUALLY HAPPENED ───────────────
  //
  // A marker is a way of not doing work twice. It is not evidence that the work
  // was done, and treating it as evidence is how a week nobody was paid for
  // stays that way for ever: the first version of this wrote the marker whenever
  // the run had not thrown, week 2026-W39 came back with both boards skipped and
  // both prizes unclaimed, and the marker then refused every retry.
  //
  // So it is the fast answer and the payouts are the real one. Counted PER
  // TOKEN, and asked of the chain where the database cannot answer it: a board
  // with a pot of its own is paid twice for one week. Counting per board instead
  // called 2026-W39 finished with 848 $LION still allocated to nobody.
  return (await stillOwed(db, rpcs, week)).length === 0;
}

/** 2026-W39 → 202639. Sorts the way the weeks do, which is all it is for. */
export function weekAsNumber(week: string): number {
  const [year, number] = week.split("-W");
  return Number(year) * 100 + Number(number);
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
  // Length-independent compare is not worth it here: the secret is compared
  // once a week against a header nobody can iterate on quickly. What matters is
  // that an absent secret never matches.
  if (request.headers.get("x-cron-secret") !== expected) {
    return Response.json({ error: "No." }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as { soft?: boolean };
  const now = Date.now();
  const week = lastWeek(now);
  const ourRpc = env().CRONOS_RPC;
  const rpcs = ourRpc ? [ourRpc, ...PUBLIC_RPCS] : PUBLIC_RPCS;

  if (body.soft === true && (await alreadyClosed(db(), rpcs, week))) {
    return Response.json({ ok: true, tooSoon: true, week });
  }

  const ran = await runWeekly(
    db(),
    { publisherKey: env().PUBLISHER_KEY, rpc: env().CRONOS_RPC },
    now,
  );

  // Said out loud, before the marker. The week is closed and the prizes are
  // pushed by now, so an announcement is the last thing to happen and the one
  // thing that must not be able to fail the job — announceWeek never throws,
  // and keeps its own once-per-board-per-week guard so a retried run does not
  // say it twice.
  await announceWeek(db(), ran, {
    rooms: {
      DISCORD_SOLO: env().DISCORD_SOLO,
      DISCORD_PVE_LIONS: env().DISCORD_PVE_LIONS,
    },
    fallbackRoom: env().DISCORD_SOLO,
    telegramBotToken: env().TELEGRAM_BOT_TOKEN,
    telegramChat: env().TELEGRAM_FEED_CHAT,
  });

  // Marked after, and only when the week is actually settled.
  //
  // The daily job claims its slot BEFORE the work, because the alarm asks every
  // minute and six overlapping runs each added a round of entitlements. Here the
  // opposite is true: a week closes once, `closeWeek` reverts on a second
  // attempt, and the expensive mistake is a run that failed halfway and is never
  // tried again. So a failure leaves the marker alone and the next minute has
  // another go.
  //
  // A week nobody played is settled too, and is marked. Leaving it open would
  // have this ask both boards who won, every minute, for ever.
  //
  // ── AND EVERY BOARD HAS TO HAVE BEEN PAID ────────────────────────────────
  //
  // "The run did not fail" is not the same as "everybody got their money", and
  // the first version of this marked on the weaker one. The first week it ever
  // closed came back with no top-level failure and two boards that had both been
  // skipped — the prizes were allocated on chain and neither was claimed — and
  // the marker then stopped it ever trying again.
  //
  // A board is settled when it was paid, or when it had already been paid before
  // this run. Anything else leaves the week open and the next minute retries.
  const allPaid = ran.boards.every((one) => one.paid !== null || one.skipped === undefined);
  const settled =
    ran.skipped === "nobody won any board that week" ||
    (ran.skipped === undefined && allPaid);
  if (settled) await setCursor(db(), RAN, weekAsNumber(week), now);

  // Always 200 with what happened. A scheduled job that returns an error for
  // "nobody played last week" is a scheduled job whose alerts get muted, and a
  // muted alert is worse than no alert.
  return Response.json(ran);
}
