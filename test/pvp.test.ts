// The lobby's rules.
//
// The routes are plumbing; this is what they enforce. Everything here is a
// refusal, because a lobby is defined by what it will not let you do — the
// accepting case is one line and the refusals are where matches get stolen,
// staked by accident, or started with a deck that cannot be played.

import { describe, expect, it } from "vitest";

import { MODES, MOST_AT_STAKE, STAKES, newId, whyNotSeated } from "@/lib/pvp";
import { buildDeckPreferring } from "@/engine/deck";
import { RULES } from "@/engine/types";
import { INDEX, SET } from "@/lib/set";

const legal = () => buildDeckPreferring(SET, 4242, () => true);

describe("sitting down", () => {
  it("takes a legal correspondence deck", () => {
    expect(whyNotSeated({ mode: "correspondence", stake: 0, deck: legal(), index: INDEX })).toBeNull();
  });

  it("refuses a mode that has no code behind it", () => {
    // Live needs a connection that stays open. Refused by name rather than
    // quietly treated as correspondence, which would put a player on a
    // twenty-four hour clock they never asked for.
    expect(whyNotSeated({ mode: "live", stake: 0, deck: legal(), index: INDEX })).toMatch(/live/i);
    expect(whyNotSeated({ mode: "blitz", stake: 0, deck: legal(), index: INDEX })).toBeTruthy();
    expect(whyNotSeated({ mode: undefined, stake: 0, deck: legal(), index: INDEX })).toBeTruthy();
    expect(MODES).not.toContain("live");
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
