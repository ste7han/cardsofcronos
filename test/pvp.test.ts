// The lobby's rules.
//
// The routes are plumbing; this is what they enforce. Everything here is a
// refusal, because a lobby is defined by what it will not let you do — the
// accepting case is one line and the refusals are where matches get stolen,
// staked by accident, or started with a deck that cannot be played.

import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { MODES, MOST_AT_STAKE, STAKES, newId, whyNotSeated } from "@/lib/pvp";
import { buildDeckPreferring } from "@/engine/deck";
import { RULES } from "@/engine/types";
import { INDEX, SET } from "@/lib/set";
import { TURN_CLOCK } from "@/engine/record";
import { CONCURRENT } from "@/lib/store";

const legal = () => buildDeckPreferring(SET, 4242, () => true);

describe("sitting down", () => {
  it("takes a legal correspondence deck", () => {
    expect(whyNotSeated({ mode: "correspondence", stake: 0, deck: legal(), index: INDEX })).toBeNull();
  });

  it("takes a live one too, now that there is a clock somebody can read", () => {
    // This asserted the opposite. Live was refused with a note saying it needed
    // a connection that stays open, which was never the reason: the engine
    // brings the clock forward whenever anybody looks. What it actually needed
    // was a countdown that counts at two minutes and a poll that does not sleep
    // through one, and both are in components/pvp/MatchBoard.tsx now.
    expect(whyNotSeated({ mode: "live", stake: 0, deck: legal(), index: INDEX })).toBeNull();
    expect(MODES).toContain("live");
  });

  it("refuses a mode with no code behind it, by name", () => {
    // Refused rather than quietly treated as correspondence, which would put a
    // player on a twenty-four hour clock they never asked for — and now that
    // live exists, would just as happily do the reverse.
    expect(whyNotSeated({ mode: "blitz", stake: 0, deck: legal(), index: INDEX })).toBeTruthy();
    expect(whyNotSeated({ mode: undefined, stake: 0, deck: legal(), index: INDEX })).toBeTruthy();
    expect(whyNotSeated({ mode: "", stake: 0, deck: legal(), index: INDEX })).toBeTruthy();
  });

  it("gives the two modes different clocks, which is the whole difference", () => {
    // One constant, two entries. A mode added to MODES without a clock would
    // read as undefined and land a deadline of NaN on a real match.
    for (const mode of MODES) {
      expect(TURN_CLOCK[mode], mode).toBeGreaterThan(0);
      expect(CONCURRENT[mode], mode).toBeGreaterThan(0);
    }
    expect(TURN_CLOCK.live).toBe(2 * 60 * 1000);
    expect(TURN_CLOCK.correspondence).toBe(24 * 60 * 60 * 1000);
    // One live match at a time, several slow ones. A live match you are not at
    // is turns being lost, so having six of them is not a thing to allow.
    expect(CONCURRENT.live).toBe(1);
    expect(CONCURRENT.correspondence).toBeGreaterThan(CONCURRENT.live);
  });

  it("takes a stake now, and still refuses one dressed as nothing", () => {
    // Stakes were refused outright while there was nowhere to hold one. There
    // is now — contracts/MatchEscrow.sol — so an amount is allowed and it is
    // the amount that is checked. `!stake` would still let undefined and "" in
    // as if they were zero, and a match that thinks it is staked and is not is
    // worse than one that refuses.
    const seat = (stake: unknown) =>
      whyNotSeated({ mode: "correspondence", stake, deck: legal(), index: INDEX });

    expect(seat(0), "friendly").toBeNull();
    for (const good of STAKES) expect(seat(good), `${good} CRO`).toBeNull();

    expect(seat("0"), "a string is not an amount").toBeTruthy();
    expect(seat(undefined)).toBeTruthy();
    expect(seat(Number.NaN)).toBeTruthy();
    expect(seat(-10), "negative").toBeTruthy();
    expect(seat(10.5), "whole CRO only").toBeTruthy();
    expect(seat(MOST_AT_STAKE + 1), "over the cap").toBeTruthy();
  });

  it("allows an amount that is not on a button", () => {
    // The five are a convenience, not the rule. Somebody who wants to play for
    // 42 may; finding an opponent at 42 is their own problem.
    expect(whyNotSeated({ mode: "correspondence", stake: 42, deck: legal(), index: INDEX })).toBeNull();
  });

  it("refuses a deck that is not one", () => {
    for (const deck of [undefined, "forty cards", [1, 2, 3], {}]) {
      expect(whyNotSeated({ mode: "correspondence", stake: 0, deck, index: INDEX })).toBeTruthy();
    }
  });

  it("refuses an illegal deck with the engine's own reason", () => {
    // The deck rules live in the engine and are the ones the builder shows. A
    // second copy here would drift, and the player would be told two different
    // things about the same deck.
    const short = legal().slice(0, RULES.deckSize - 1);
    expect(whyNotSeated({ mode: "correspondence", stake: 0, deck: short, index: INDEX })).toBeTruthy();

    const duplicated = [...legal().slice(0, RULES.deckSize - 1), legal()[0]!];
    expect(whyNotSeated({ mode: "correspondence", stake: 0, deck: duplicated, index: INDEX })).toBeTruthy();

    const unknown = [...legal().slice(0, RULES.deckSize - 1), "no-such-card"];
    expect(whyNotSeated({ mode: "correspondence", stake: 0, deck: unknown, index: INDEX })).toBeTruthy();
  });
});

describe("match ids", () => {
  it("do not repeat", () => {
    // They are not secrets, but two matches sharing one would be two matches
    // sharing a row.
    const seen = new Set(Array.from({ length: 500 }, () => newId()));
    expect(seen.size).toBe(500);
  });
});

describe("a seat whose stake is already in", () => {
  const route = readFileSync(new URL("../app/api/pvp/lobby/route.ts", import.meta.url), "utf8");
  const lobby = readFileSync(new URL("../components/Lobby.tsx", import.meta.url), "utf8");

  /**
   * What this is about, because it cost somebody real gas.
   *
   * `funded` was computed as `state === "open"` and asked to answer two
   * questions: has the poster's deposit landed, and is the seat still free.
   * Those come apart the instant somebody joins — the state goes to `full` — and
   * the poster, whose money went in an hour earlier, was told their stake had
   * not arrived and shown a button to put it up again. That button calls open()
   * on a wager that exists, which the contract refuses with AlreadyExists.
   *
   * On 3 October 2026 a host pressed it and watched the transaction fail, which
   * from where they were sitting looks exactly like losing ten CRO.
   */
  it("counts the deposit as landed for every state but none", () => {
    expect(route).toContain('wager.state !== "none"');
    // The old rule, which is the bug.
    expect(route).not.toMatch(/funded:.*state === "open"/);
  });

  it("says separately that somebody has taken it", () => {
    expect(route).toContain('taken: mine && wager.state !== "open"');
    expect(route).toContain("taken: checked[i]?.taken ?? false");
  });

  it("does not offer a deposit to somebody who has made one", () => {
    expect(lobby).toContain("!listing.funded && !listing.taken && listing.stake > 0");
  });

  it("does not offer a taken seat to anybody else", () => {
    expect(lobby).toMatch(/!listing\.funded \|\| listing\.taken/);
  });

  it("asks the chain again before it signs anything", () => {
    // The screen can be minutes old. One request is cheaper than a refused
    // transaction, and a refused transaction reads like a lost deposit.
    const button = lobby.slice(lobby.indexOf("openData(listing.id)") - 2000);
    expect(button).toContain('ask<{ listings: LobbyListing[] }>("lobby")');
    expect(button).toMatch(/nothing is owed/i);
  });
});
