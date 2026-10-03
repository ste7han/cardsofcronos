// The count in the nav that says a match is waiting on you.
//
// A correspondence match gives each side a day, which is long enough to forget
// you are in one — and nothing on the site said so unless you went to /pvp. This
// is the smallest version of being told, and it only reaches somebody who is
// already here. What it is for is finding out whether being told is worth
// building push notifications for.

import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const hook = readFileSync(new URL("../lib/use-your-turn.ts", import.meta.url), "utf8");
const nav = readFileSync(new URL("../components/Nav.tsx", import.meta.url), "utf8");

describe("counting the matches waiting on you", () => {
  it("leaves finished matches out", () => {
    // A finished match keeps whatever yourTurn it had when it stopped, so
    // counting on that alone would leave a badge sitting there for ever over a
    // game nobody can play.
    expect(hook).toContain("one.yourTurn && !one.finished");
  });

  it("asks once however many places are showing it", () => {
    // The nav is on every page and the lobby is on one of them. Two independent
    // pollers would double the requests and could disagree about the number in
    // front of somebody's eyes.
    expect(hook).toContain("let inFlight");
    expect(hook).toContain("const listeners = new Set");
  });

  it("keeps the last count when a request fails", () => {
    // Dropping to zero on a flaky connection quietly tells somebody they have
    // nothing to do, which is the one wrong answer this can give.
    const fn = hook.slice(hook.indexOf("async function look"));
    const body = fn.slice(0, fn.indexOf("\n}\n"));
    expect(body).toContain("NotSignedIn");
    // Only the signed-out branch zeroes it.
    expect([...body.matchAll(/tell\(0\)/g)]).toHaveLength(1);
  });

  it("looks again when somebody comes back to the tab", () => {
    // Which is when the answer is most likely to have changed and most likely
    // to be read.
    expect(hook).toContain("visibilitychange");
  });
});

describe("the nav", () => {
  it("shows the count on the PVP link and nowhere else", () => {
    expect([...nav.matchAll(/link\.href === "\/pvp" && waiting > 0/g)].length).toBe(2);
  });

  it("says what the number means to a screen reader", () => {
    // "3" on its own is not a sentence.
    expect(nav).toMatch(/"match is" : "matches are"/);
    expect(nav).toContain("waiting on you");
  });

  it("calls every hook before the early return", () => {
    // useState and useEffect sat underneath it, so React saw a different number
    // of hooks on a /card/ route than anywhere else. It survived because that
    // route returns null every time — a client-side navigation onto one is all
    // it would have taken.
    const fn = nav.slice(nav.indexOf("export function Nav()"));
    const body = fn.slice(0, fn.indexOf("\n  return ("));
    const bail = body.indexOf('path?.startsWith("/card/")');
    for (const call of ["usePathname()", "useState(false)", "useYourTurn()", "useEffect("]) {
      expect(body.indexOf(call), `${call} must come before the early return`).toBeLessThan(bail);
    }
  });

  it("asks for the path once", () => {
    expect([...nav.matchAll(/usePathname\(\)/g)]).toHaveLength(1);
  });
});
