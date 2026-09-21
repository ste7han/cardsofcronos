// Which channel a result goes to, and how many times it goes there.
//
// Three things here are one-line mistakes that nobody would see for a while.
// A friendly result in the ranked channel is a channel about money carrying
// games with nothing on them. A result announced from each of the three routes
// that can notice a match has ended is the same match posted three times. And
// an announcement that can fail the settlement is a pot that stays in escrow
// because a webhook was down.

import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const finish = readFileSync(new URL("../lib/finish.ts", import.meta.url), "utf8");

describe("announcing a finished match", () => {
  it("picks the channel by what was at stake", () => {
    expect(finish).toContain("const staked = record.stake > 0;");
    expect(finish).toContain("const hook = staked ? secrets.pvpRanked : secrets.pvpFriendly;");
  });

  it("says nothing when that channel is not set up", () => {
    // Absent is a real state — the feeds are configured one at a time — and it
    // has to be a quiet one rather than a thrown error inside a settlement.
    expect(finish).toMatch(/if \(!hook\) return;/);
  });

  it("happens after the once-only guard, so a match is announced once", () => {
    // finishMatch's UPDATE ... WHERE finished_at IS NULL is what makes the rest
    // of this function run for exactly one caller. Announcing above it would
    // put the same result in the channel once per route that noticed.
    const guard = finish.indexOf("if (!(await finishMatch(");
    const said = finish.indexOf("await announce(record, state, secrets)");
    expect(guard).toBeGreaterThan(-1);
    expect(said).toBeGreaterThan(-1);
    expect(guard).toBeLessThan(said);
  });

  it("cannot fail the settlement it follows", () => {
    // The result is written, both records are updated and the pot is handled
    // before this runs. A channel being down must not undo any of that.
    const after = finish.slice(finish.indexOf("await announce(record, state, secrets)"));
    expect(after.slice(0, 200)).toContain(".catch(");
  });

  it("is reached from every route that can notice, with both channels", () => {
    // Three routes call settle and any of them can be the one that closes a
    // match: the move that ends it, the poll that reads it, and the list.
    for (const route of [
      "../app/api/pvp/move/route.ts",
      "../app/api/pvp/match/route.ts",
      "../app/api/pvp/matches/route.ts",
    ]) {
      const source = readFileSync(new URL(route, import.meta.url), "utf8");
      expect(source, route).toContain("pvpFriendly: env().DISCORD_PVP_FRIENDLY");
      expect(source, route).toContain("pvpRanked: env().DISCORD_PVP_RANKED");
    }
  });

  it("tells a draw on a staked match what happens to the money", () => {
    // The contract has no draw: `settle` takes a winner. Both sides get their
    // own deposit back through walkAway, and somebody watching a channel about
    // money should not have to work that out.
    expect(finish).toContain("A draw is not settled on chain");
  });
});
