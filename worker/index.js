// The worker, with a clock attached.
//
// OpenNext writes `.open-next/worker.js` on every build and it only knows how to
// answer requests. A Cloudflare cron does not send a request — it calls
// `scheduled()` — so this wraps that generated file rather than editing it,
// which would be undone by the next build.
//
// WHAT IT DOES NOT DO is any of the work. The scheduled handler turns a tick
// into an ordinary request to a route and hands it to the same fetch handler
// everything else goes through. That keeps the job inside Next, where the D1
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

export default {
  fetch: handler.fetch,

  async scheduled(event, env, ctx) {
    const route = ROUTES[event.cron];
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
