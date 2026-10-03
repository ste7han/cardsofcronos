// Looking in on a match you are not playing.
//
// Two things could go wrong here and only one of them is visible: the page could
// show a hand, or a bystander could move the match along. The first is checked in
// test/view.test.ts, against the view itself. This is about the second, and about
// the route staying the shape that makes the first impossible.

import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const route = readFileSync(new URL("../app/api/pvp/watch/route.ts", import.meta.url), "utf8");
const view = readFileSync(new URL("../components/Watch.tsx", import.meta.url), "utf8");
const page = readFileSync(
  new URL("../app/pvp/watch/[id]/page.tsx", import.meta.url),
  "utf8",
);

describe("the route a watcher reads", () => {
  it("hands back the watcher's view and never a player's", () => {
    expect(route).toContain("watchView(state, INDEX)");
    expect(route).not.toContain("viewFor(");
  });

  it("does not move the match along", () => {
    // /api/pvp/match catches a record up on the clock and settles a finished
    // one, because the player asking is who the deadline is about. A spectator
    // refreshing a page must not be able to time somebody out, and a stake must
    // not be settled by whoever happens to be watching.
    expect(route).not.toContain("catchUp");
    expect(route).not.toContain("settle(");
    expect(route).not.toContain("saveMoves");
  });

  it("reads rather than writes, and says so in its method", () => {
    expect(route).toContain("export async function GET(");
    expect(route).not.toContain("export async function POST(");
  });

  it("answers the same for a match that never existed as for one mistyped", () => {
    // Telling the two apart tells somebody which ids are real.
    expect(route).toContain('{ error: "No such match." }');
  });

  it("needs no sign-in, because a link nobody can open is a link nobody shares", () => {
    expect(route).not.toContain("signedInWallet");
    expect(route).not.toContain("UNAUTHORISED");
  });
});

describe("the page", () => {
  it("renders nothing a player could act on", () => {
    // No moves, no buttons: a watcher has no seat. The nearest thing to an
    // interaction is reading a card, which is what both players can already do.
    expect(view).not.toContain("<button");
    expect(view).not.toMatch(/\/api\/pvp\/(move|join|create)/);
  });

  it("only ever asks for the watch route", () => {
    const calls = [...view.matchAll(/\/api\/pvp\/[a-z]+/g)].map((one) => one[0]);
    expect(new Set(calls)).toEqual(new Set(["/api/pvp/watch"]));
  });

  it("keeps the last board when a request fails", () => {
    // A board that blanks on one bad request reads as a match that ended.
    const fn = view.slice(view.indexOf("const look = useCallback"));
    expect(fn.slice(0, 900)).toMatch(/Left as it was/);
  });

  it("says why there are no hands on it", () => {
    // The one thing somebody watching will wonder about within five seconds.
    expect(page).toMatch(/no hands/i);
  });
});

describe("finding a match to watch", () => {
  const live = readFileSync(new URL("../app/api/pvp/live/route.ts", import.meta.url), "utf8");
  const lobby = readFileSync(new URL("../components/Lobby.tsx", import.meta.url), "utf8");
  const store = readFileSync(new URL("../lib/store.ts", import.meta.url), "utf8");

  it("lists everybody's matches, not one player's", () => {
    const fn = store.slice(store.indexOf("export async function watchableMatches"));
    const body = fn.slice(0, fn.indexOf("\n}\n"));
    expect(body).not.toContain("seat_you = ?");
    expect(body).toContain("FROM matches");
  });

  it("puts the running ones first", () => {
    // A game still being played is the one worth opening; a finished one is
    // worth keeping around because it has just been decided.
    const fn = store.slice(store.indexOf("export async function watchableMatches"));
    expect(fn.slice(0, 700)).toContain("finished_at IS NOT NULL ASC");
  });

  it("sends no hand and no deck in the list", () => {
    // It never asks for one — the row carries the shape of a match and its
    // score, and reading the board is the other route's job.
    //
    // Comments stripped: this file explains at length what it does not send,
    // and that explanation is the reason the next person keeps it that way.
    const code = live
      .split("\n")
      .filter((line) => !/^\s*(\/\/|\*|\/\*)/.test(line))
      .join("\n");
    expect(code).not.toMatch(/\bhand\b/);
    expect(code).not.toMatch(/\bdecks?\b/);
    expect(code).not.toContain("viewFor(");
  });

  it("needs no wallet", () => {
    expect(live).not.toContain("signedInWallet");
  });

  it("is fetched without the session, so a signed-out visitor sees it", () => {
    // Hanging it off the signed-in refresh would have hidden the one part of
    // this page that works signed out from exactly the people it is for.
    const fn = lobby.slice(lobby.indexOf('fetch("/api/pvp/live")') - 800);
    expect(fn.slice(0, 1400)).toMatch(/useEffect\(\(\) => \{[\s\S]*?\}, \[\]\)/);
  });
});
