// The two doors: minting, and building a deck.
//
// Written to survive the switches being flipped. Nothing here asserts that the
// mint is currently shut — only what has to hold in either position, which is
// the only kind of test a switch can have.
//
// These run in node, where there is no window and so nobody is signed in. That
// is not a limitation of the test, it is the case being tested: signed out is
// the state every visitor arrives in.

import { describe, expect, it } from "vitest";

import { DECK_FROM_COLLECTION, MINT_OPEN, buyDeckMint, buyPack, collection, ownedForRules } from "@/lib/collection";
import { loadDeck, saveDeck } from "@/lib/deck-storage";

describe("the mint", () => {
  it("refuses to hand out cards when it is shut", () => {
    // A closed mint that only hides its buttons is not closed: anyone with a
    // console can call these, and what came out would be written to the same
    // collection as a real mint and be indistinguishable from it afterwards.
    if (MINT_OPEN) {
      expect(() => buyPack()).not.toThrow();
      expect(() => buyDeckMint()).not.toThrow();
      return;
    }
    expect(() => buyPack()).toThrow(/mint is closed/i);
    expect(() => buyDeckMint()).toThrow(/mint is closed/i);
  });
});

describe("a deck belongs to a wallet", () => {
  it("only ever holds cards you own", () => {
    // Settled by the maker and no longer derived from anything. Off, a pack is a
    // screensaver and renting cards out later would be renting nothing.
    expect(DECK_FROM_COLLECTION).toBe(true);
    expect(ownedForRules()).toBeInstanceOf(Set);
  });

  it("holds nothing at all while nobody is signed in", () => {
    // Not an empty collection — no collection. There is no browser-wide pile of
    // cards for a signed-out visitor to inherit.
    expect(collection()).toEqual([]);
    expect([...ownedForRules()!]).toEqual([]);
  });

  it("refuses to save a deck for nobody", () => {
    // A rule, not a screen. The builder does not offer this to a signed-out
    // visitor, but "the button was not there" has never been a rule here — in
    // Cards of Cronos the card check was a UI filter and a direct call could
    // play anything.
    const problems = saveDeck(["bonk-dog", "wif-hat"], "nice try");
    expect(problems.length).toBeGreaterThan(0);
    expect(problems.join(" ")).toMatch(/sign in/i);
  });

  it("loads no deck for nobody", () => {
    const loaded = loadDeck();
    expect(loaded.cardIds).toEqual([]);
    // Silent, not an error: signed out is a normal state to arrive in, and the
    // screens say so themselves rather than reporting a broken deck.
    expect(loaded.rejected).toEqual([]);
  });
});
