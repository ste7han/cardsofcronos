// The schedules, against the table that says what each one runs.
//
// They live in two files and are kept in step by hand: wrangler.jsonc declares
// the crons and worker/index.js maps each to a route. The failure that pairing
// has is quiet in one direction and loud in the other — a schedule in the config
// with no route logs "matches no route" and does nothing, which is visible only
// to whoever reads the logs at the hour it fires; a route in the table with no
// schedule simply never runs and says nothing at all.
//
// Both are jobs that fire once a day, once a week, or once a minute at hours
// nobody is watching, so neither gets noticed by being used.

import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const config = readFileSync(new URL("../wrangler.jsonc", import.meta.url), "utf8");
const worker = readFileSync(new URL("../worker/index.js", import.meta.url), "utf8");

/** The crons wrangler.jsonc declares. */
function declared(): string[] {
  const block = /"crons"\s*:\s*\[([^\]]*)\]/.exec(config);
  expect(block, "wrangler.jsonc no longer declares any crons").not.toBeNull();
  return [...block![1]!.matchAll(/"([^"]+)"/g)].map((m) => m[1]!);
}

/** The crons worker/index.js knows how to route, and where each goes. */
function routed(): Map<string, string> {
  const block = worker.slice(worker.indexOf("const ROUTES = {"));
  const body = block.slice(0, block.indexOf("};"));
  return new Map([...body.matchAll(/"([^"]+)"\s*:\s*"([^"]+)"/g)].map((m) => [m[1]!, m[2]!]));
}

describe("the crons", () => {
  it("all have a route, and every route has a cron", () => {
    expect([...declared()].sort()).toEqual([...routed().keys()].sort());
  });

  it("point at routes that exist", async () => {
    // A path typed one character off is a POST to a 404 every time it fires,
    // and the scheduled handler logs the status rather than failing on it.
    for (const [cron, route] of routed()) {
      const file = new URL(`../app${route}/route.ts`, import.meta.url);
      expect(() => readFileSync(file, "utf8"), `${cron} -> ${route}`).not.toThrow();
    }
  });

  it("gate every one of them on the secret", () => {
    // These are public URLs — they have to be, because the scheduled handler
    // reaches them the way a browser would. The only thing between them and
    // anybody who finds them is CRON_SECRET, and a route that forgot it is a
    // job a stranger can run.
    for (const [, route] of routed()) {
      const source = readFileSync(new URL(`../app${route}/route.ts`, import.meta.url), "utf8");
      expect(source, `${route} does not check CRON_SECRET`).toContain(
        'request.headers.get("x-cron-secret") !== expected',
      );
      // And refuse an unset one rather than treating "" as a match.
      expect(source, `${route} treats an empty secret as set`).toMatch(/if \(!expected\)/);
    }
  });

  it("keeps the feed on the minute, because an hour late is not a feed", () => {
    expect(routed().get("* * * * *")).toBe("/api/cron/feed");
  });

  it("stays inside what one Worker may declare", () => {
    // Three on the free plan. A fourth deploys without complaint and the
    // schedules that survive are not necessarily the ones you wanted.
    expect(declared().length).toBeLessThanOrEqual(3);
  });
});

/** Everything the alarm actually runs, read off the JOBS table. */
function jobs(): { name: string; route: string; soft: boolean }[] {
  const block = worker.slice(worker.indexOf("const JOBS = ["));
  const body = block.slice(0, block.indexOf("\n];"));
  return [...body.matchAll(/\{\s*name:\s*"([^"]+)",\s*route:\s*"([^"]+)"([^}]*)\}/g)].map(
    (m) => ({ name: m[1]!, route: m[2]!, soft: m[3]!.includes("soft: true") }),
  );
}

describe("the alarm, which is what actually runs them", () => {
  /**
   * The crons are a list Cloudflare stopped reading.
   *
   * It stopped invoking this Worker's scheduled handler on 21 September 2026 —
   * docs/the-discord-feeds.md has what ruling that out took — so the Durable
   * Object alarm was written to take its place. It was given the feed and the
   * daily job. The weekly one was missed, and a weekly job that never runs looks
   * like nothing for six days and like a quiet Monday on the seventh: no week
   * was closed for a month, nobody was paid, and both boards went on showing a
   * winner all week with nothing to say it would never be settled.
   *
   * So the ROUTES list above is not the thing that runs. JOBS is.
   */
  it("asks for every route the crons declare", () => {
    const asked = jobs().map((job) => job.route);
    for (const [cron, route] of routed()) {
      expect(asked, `${cron} -> ${route} is declared but the alarm never asks for it`)
        .toContain(route);
    }
  });

  it("may run more than the crons declare, and those are jobs too", () => {
    // Cloudflare allows three schedules on this plan and the clock needs a
    // fourth job, so JOBS is deliberately the longer list. Everything on it is
    // still a public URL behind the secret and still has to exist.
    expect(jobs().length).toBeGreaterThanOrEqual(routed().size);
    for (const job of jobs()) {
      const file = new URL(`../app${job.route}/route.ts`, import.meta.url);
      expect(() => readFileSync(file, "utf8"), `${job.name} -> ${job.route}`).not.toThrow();
    }
  });

  it("gates every job on the secret, declared as a cron or not", () => {
    // The reason /api/cron/clocks is checked here and not only above: it has no
    // cron of its own, so the loop over ROUTES would never have looked at it.
    for (const job of jobs()) {
      const source = readFileSync(new URL(`../app${job.route}/route.ts`, import.meta.url), "utf8");
      expect(source, `${job.route} does not check CRON_SECRET`).toContain(
        'request.headers.get("x-cron-secret") !== expected',
      );
      expect(source, `${job.route} treats an empty secret as set`).toMatch(/if \(!expected\)/);
    }
  });

  it("sends the secret with whatever it asks for", () => {
    // One call site now rather than one per job, which is the point of the
    // table — but it still has to carry the header, and a call without it is
    // refused in a way that looks exactly like a job that ran.
    const alarm = worker.slice(worker.indexOf("async alarm()"));
    const body = alarm.slice(0, alarm.indexOf("\n  }\n}"));
    expect(body).toContain('"x-cron-secret"');
    expect(body).toContain("for (const job of JOBS)");
  });

  it("lets the jobs that are not per-minute work decline for themselves", () => {
    // The alarm fires every minute and cannot know whether a weekly job is due.
    // Anything that is not per-minute carries `soft` and the route decides.
    const perMinute = [...routed()]
      .filter(([cron]) => cron === "* * * * *")
      .map(([, route]) => route);
    for (const job of jobs()) {
      if (perMinute.includes(job.route)) continue;
      // The clock runs every minute by design and has no cron of its own.
      if (job.route === "/api/cron/clocks") continue;
      expect(job.soft, `${job.name} should say soft`).toBe(true);
    }
  });

  it("re-arms before it works, so one failure does not stop the clock", () => {
    // An alarm that throws before booking the next one is never woken again.
    const alarm = worker.slice(worker.indexOf("async alarm()"));
    const body = alarm.slice(0, alarm.indexOf("\n  }\n}"));
    expect(body.indexOf("setAlarm")).toBeLessThan(body.indexOf("for (const job of JOBS)"));
  });
});
