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
