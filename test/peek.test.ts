// The magnifier, and the card it is named after.
//
// Both tables let you read a card at a size you can actually read, and both do
// it from the same two components: PeekButton toggles, and the table draws. The
// PvP table did the first half. It tracked which card was being read, drew the
// button, moved the budget and the preview numbers with it — and never drew the
// card. Nothing failed, nothing was logged, and the control simply did nothing
// on the one screen where it is the only way to read a card at all.
//
// This is a source test, like test/announce.ts, and for the same reason: what
// went wrong is not a value any function returns. It is a control wired to a
// state nobody renders, which is the shape of silence this project keeps
// finding — the same shape as an action_type the old engine did not know.

import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

const pvp = read("components/pvp/MatchBoard.tsx");
const solo = read("components/game/Game.tsx");

describe("reading a card during a match", () => {
  it("is offered on both tables", () => {
    for (const [name, source] of [["PvP", pvp], ["solo", solo]] as const) {
      expect(source, name).toContain("<PeekButton");
    }
  });

  it("draws the card on both tables, and not only the button", () => {
    // The bug: `hovered` is set, so every number keyed off it moves, and the
    // card itself is never rendered. A table with the button and without this
    // has a magnifier that magnifies nothing.
    for (const [name, source] of [["PvP", pvp], ["solo", solo]] as const) {
      expect(source, `${name} has no lifted card`).toMatch(/const lifted\b/);
      const drawn = [...source.matchAll(/<CardView\s+card=\{liftedCard\}|card=\{cardById\(INDEX, lifted\)\}/g)];
      expect(drawn.length, `${name} never draws the lifted card`).toBeGreaterThan(0);
    }
  });

  it("draws it at both widths, so a phone is not left without one", () => {
    // Two variants on each table: one in the right margin where there is a
    // margin, one overlapping below 1440 where there is not. A table with only
    // the first leaves every phone and every narrow window with no preview,
    // and the hand row clamps its rules text to two lines — so there would be
    // no way to read the rest of a card.
    for (const [name, source] of [["PvP", pvp], ["solo", solo]] as const) {
      expect(source, `${name} is missing the wide variant`).toContain("min-[1440px]:block");
      expect(source, `${name} is missing the narrow variant`).toContain("max-[1439px]:block");
    }
  });

  it("agrees with the hand row about whether the play is free", () => {
    // Two drawings of one card. The big one saying a play is free while the
    // small one says it costs is the kind of disagreement nobody reports,
    // because both look right on their own.
    expect(pvp).toMatch(/const liftedFree =/);
    expect(pvp).toMatch(/view\.you\.freePlays > 0 && mine && withinFreeCap\(liftedCard\)/);
    expect(pvp).toMatch(/free=\{liftedFree\}/);
  });
});
