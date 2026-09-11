// Every family is classified, and a rename cannot quietly unclassify one.
//
// This exists because it already went wrong. CAW777 held the project key `caw`
// until a real project called CAW needed it, and the rename moved the cards
// without moving the entry in FAMILY_INTENT. The intent written for CAW777's
// momentum family then described a family with no effects at all, and
// effectIntentFor returned undefined for the family that actually had them.
//
// Nothing failed. Nothing said anything. That is the exact shape CLAUDE.md is
// written around, arriving in the layer that measures rather than the one that
// plays, which is the layer where a confident wrong answer does the most damage.

import { describe, expect, it } from "vitest";

import { CARDS } from "@/data/cards";
import {
  FAMILY_INTENT,
  INTENT_UNDECIDED,
  effectIntentFor,
  unclassifiedFamilies,
} from "@/scripts/intent";

const families = [...new Set(CARDS.flatMap((c) => (c.type === "project" ? [c.project] : [])))];

describe("every family is classified", () => {
  it("has an intent or is listed as undecided", () => {
    expect(unclassifiedFamilies(CARDS)).toEqual([]);
  });

  it("covers the set exactly once", () => {
    const named = [...Object.keys(FAMILY_INTENT), ...INTENT_UNDECIDED];
    expect(named.slice().sort()).toEqual(families.slice().sort());
    expect(new Set(named).size).toBe(named.length);
  });

  it("names a family that is not in the set", () => {
    const ghost = [{ ...CARDS.find((c) => c.type === "project")!, project: "ghost" }];
    expect(unclassifiedFamilies(ghost as typeof CARDS)).toContain("ghost");
  });
});

describe("effectIntentFor separates undecided from unknown", () => {
  it("returns the intent of a family that has one", () => {
    expect(effectIntentFor("caw777")).toBe("momentum");
  });

  // Written against "caw" while it was undecided, which broke the moment it was
  // classified. A test that names the one example it has is a test with a
  // shelf life; this one asks the question of whatever is on the list, and
  // passes vacuously once the list is empty — which is where it is meant to end.
  it("returns undefined for every family still undecided", () => {
    for (const family of INTENT_UNDECIDED) {
      expect(effectIntentFor(family)).toBeUndefined();
    }
  });

  it("has nothing left undecided", () => {
    expect([...INTENT_UNDECIDED]).toEqual([]);
  });

  it("throws for a family nobody has heard of", () => {
    expect(() => effectIntentFor("no-such-family")).toThrow(/No intent is recorded/);
  });

  it("reads locks families as money, because that is what they run on", () => {
    expect(FAMILY_INTENT.tectonic).toBe("locks");
    expect(effectIntentFor("tectonic")).toBe("money");
  });
});
