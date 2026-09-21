// The worker, with a clock attached.
//
// OpenNext writes `.open-next/worker.js` on every build and it only knows how to
// answer requests. A Cloudflare cron does not send a request — it calls
// `scheduled()` — so this wraps that generated file rather than editing it,
// which would be undone by the next build.
//
// WHAT IT DOES NOT DO is any of the work. The scheduled handler turns a tick
// into an ordinary request to a route and hands it to the same fetch handler
// everything else goes through. The fetch handler does the same thing for the
// Discord feeds after answering a page — see the note on fetch below for why a
// page view drives a job at all. That keeps the job inside Next, where the D1
// binding, the path aliases and every helper already work — the alternative is
// a second runtime with its own copy of half the app.
//
// TWO SCHEDULES, ONE HANDLER. Cloudflare calls this for every cron in
// wrangler.jsonc and says which one fired in `event.cron`, so the route is
// looked up from that rather than assumed. An unrecognised expression does
// nothing and says so: a schedule added to the config and not to the table
// below would otherwise silently run the wrong job.
//
// The request carries a secret from the environment. Without it the route
// refuses, so the endpoint being reachable from the internet does not mean it
// can be triggered from there.
import handler from "../.open-next/worker.js";

export { DOQueueHandler, DOShardedTagCache, BucketCachePurge } from "../.open-next/worker.js";

/**
 * A clock that is not a Cron Trigger.
 *
 * Cloudflare stopped invoking the scheduled handler on this Worker — see
 * docs/the-discord-feeds.md for what that took to establish — so the Discord
 * feeds run off page traffic instead. That works during a mint, when there is
 * traffic by definition, and not at four in the morning.
 *
 * A Durable Object alarm is a different subsystem from Cron Triggers, and this
 * is one object holding one alarm: it wakes, asks the feed route for a run, and
 * sets its next alarm. Nothing outside has to keep it going.
 *
 * ── IT RE-ARMS BEFORE IT WORKS, NOT AFTER ────────────────────────────────────
 *
 * If the fetch below throws and the alarm has not been set yet, the chain stops
 * and nothing ever wakes it again — a clock that dies the first time the network
 * hiccups. So the next alarm is booked first and the work happens after it.
 *
 * ── SOMETHING HAS TO WIND IT UP ──────────────────────────────────────────────
 *
 * An alarm that has never been set does not exist. `ensure` below is called from
 * fetch, rarely, and only sets one when there is none — so the first visitor
 * after a deploy starts it and then it keeps itself going with nobody visiting.
 */
export class FeedTicker {
  constructor(ctx, env) {
    this.ctx = ctx;
    this.env = env;
  }

  /** Books an alarm if there is not one already. Cheap and idempotent. */
  async fetch() {
    const already = await this.ctx.storage.getAlarm();
    if (already === null) {
      await this.ctx.storage.setAlarm(Date.now() + 60_000);
      return new Response("armed");
    }
    return new Response("already armed");
  }

  async alarm() {
    // First, always. See above.
    await this.ctx.storage.setAlarm(Date.now() + 60_000);

    try {
      const answer = await fetch("https://cardsofcronos.com/api/cron/feed", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-cron-secret": this.env.CRON_SECRET ?? "",
        },
        // Not soft: this is the clock, and a clock that asks permission is not
        // one. Traffic-driven calls are the ones that defer to it.
        body: JSON.stringify({ by: "alarm" }),
      });
      console.log(`[alarm] feed -> ${answer.status} ${await answer.text()}`);
    } catch (error) {
      console.error("[alarm] the feed could not be reached", error);
    }

    // And the daily job, which says `soft` — it declines unless it has not run
    // in twenty hours. It lives here for the same reason the feed does: the
    // cron that used to run it stopped, and the money from the first mint sat
    // in the collection because of it.
    try {
      const answer = await fetch("https://cardsofcronos.com/api/cron/daily", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-cron-secret": this.env.CRON_SECRET ?? "",
        },
        body: JSON.stringify({ soft: true }),
      });
      const said = await answer.text();
      // Quiet on the ordinary answer. It is declined fifty-nine minutes an
      // hour, every hour, and logging that would bury the one run that matters.
      if (!said.includes('"tooSoon":true')) {
        console.log(`[alarm] daily -> ${answer.status} ${said}`);
      }
    } catch (error) {
      console.error("[alarm] the daily job could not be reached", error);
    }
  }
}

/**
 * Which cron runs which job. Kept in step with the triggers in wrangler.jsonc by
 * hand, which is why an expression that is not in here is loud rather than
 * quietly falling back to one of them.
 */
const ROUTES = {
  // Every minute: the Discord feeds. The only one of the three that is not
  // about money moving — it only reads and posts.
  "* * * * *": "/api/cron/feed",
  // Every day at 00:10 UTC: release what the splitter holds, record the burns.
  "10 0 * * *": "/api/cron/daily",
  // Mondays at 00:20 UTC: close the week and pay whoever won it. Ten minutes
  // after the daily one, so the week's last release is in the pot before the
  // pot is divided.
  "20 0 * * 1": "/api/cron/weekly",
};

/**
 * How recently this isolate asked for a feed run.
 *
 * A first guard only, and a weak one: isolates come and go and there are many
 * of them, so this cannot promise anything on its own. The promise is in the
 * route, which reads the cursors and declines a run that has just happened.
 * This is here so the common case — a visitor loading four pages — does not
 * become four requests into the Worker for the route to turn away.
 */
let askedAt = 0;

export default {
  /**
   * Answers the request, and then quietly asks the feeds whether anything has
   * happened on chain.
   *
   * AFTER the answer and inside waitUntil, so nobody waits on it: the visitor's
   * page is not held up by a Discord post, and a feed that is failing cannot
   * make the site slow. If the whole thing throws it is swallowed — a broken
   * feed must never turn into a broken page.
   *
   * This exists because the cron stopped firing. See app/api/cron/feed/route.ts.
   */
  async fetch(request, env, ctx) {
    const answer = await handler.fetch(request, env, ctx);

    const now = Date.now();
    // Documents only. Every page pulls in scripts, images and card art, and
    // running this for each of those would be dozens of asks per visit for the
    // route to decline.
    const wanted = request.headers.get("sec-fetch-dest");
    if (now - askedAt > 30_000 && (wanted === "document" || wanted === null)) {
      askedAt = now;
      // Wind up the clock, if it is not already going. One object, always the
      // same one, so "already armed" is the answer almost every time.
      ctx.waitUntil(
        env.FEED_TICKER
          ? env.FEED_TICKER.get(env.FEED_TICKER.idFromName("the-one")).fetch("https://ticker/")
              .catch(() => {})
          : Promise.resolve(),
      );
      ctx.waitUntil(
        handler
          .fetch(
            new Request("https://cardsofcronos.com/api/cron/feed", {
              method: "POST",
              headers: {
                "content-type": "application/json",
                "x-cron-secret": env.CRON_SECRET ?? "",
              },
              body: JSON.stringify({ soft: true }),
            }),
            env,
            ctx,
          )
          .catch(() => {
            // Swallowed on purpose. The visitor already has their page and
            // there is nobody here to tell.
          }),
      );
    }

    return answer;
  },

  async scheduled(event, env, ctx) {
    // Whitespace-normalised before it is given up on. An expression that does
    // not match the table does nothing, and doing nothing looks exactly like a
    // cron that never fired — which cost an evening to tell apart once.
    const route =
      ROUTES[event.cron] ?? ROUTES[String(event.cron).trim().replace(/\s+/g, " ")];
    if (route === undefined) {
      console.error(`[cron] ${event.cron} matches no route. Nothing ran.`);
      return;
    }

    const request = new Request(`https://cardsofcronos.com${route}`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        // Absent when nobody has set it, and the route refuses that rather than
        // treating a missing secret as a match.
        "x-cron-secret": env.CRON_SECRET ?? "",
      },
      body: JSON.stringify({ cron: event.cron, at: event.scheduledTime }),
    });

    // waitUntil, so the tick is not reported as finished before the work is.
    ctx.waitUntil(
      handler
        .fetch(request, env, ctx)
        .then(async (answer) => {
          console.log(`[cron] ${event.cron} -> ${answer.status} ${await answer.text()}`);
        })
        .catch((error) => {
          console.error(`[cron] ${event.cron} failed`, error);
        }),
    );
  },
};
