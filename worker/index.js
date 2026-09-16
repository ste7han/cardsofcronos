// The worker, with a clock attached.
//
// OpenNext writes `.open-next/worker.js` on every build and it only knows how to
// answer requests. A Cloudflare cron does not send a request — it calls
// `scheduled()` — so this wraps that generated file rather than editing it,
// which would be undone by the next build.
//
// WHAT IT DOES NOT DO is any of the work. The scheduled handler turns a tick
// into an ordinary request to /api/cron/weekly and hands it to the same fetch
// handler everything else goes through. That keeps the job inside Next, where
// the D1 binding, the path aliases and every helper already work — the
// alternative is a second runtime with its own copy of half the app.
//
// The request carries a secret from the environment. Without it the route
// refuses, so the endpoint being reachable from the internet does not mean it
// can be triggered from there.
import handler from "../.open-next/worker.js";

export { DOQueueHandler, DOShardedTagCache, BucketCachePurge } from "../.open-next/worker.js";

export default {
  fetch: handler.fetch,

  async scheduled(event, env, ctx) {
    const request = new Request("https://cardsofcronos.com/api/cron/weekly", {
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
