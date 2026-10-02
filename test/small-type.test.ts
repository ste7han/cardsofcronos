// The floor under the small type on a phone.
//
// This interface is set tight — 487 places ask for between seven and eleven
// pixels — and none of them asked for anything different on a small screen. The
// floor is set once in globals.css rather than at those 487 call sites, because
// a twin at every call site is a twin the next person has no reason to add.

import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const css = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");
const cardView = readFileSync(new URL("../components/CardView.tsx", import.meta.url), "utf8");

describe("the floor under small text", () => {
  it("exists, and only on small screens", () => {
    const rule = css.slice(css.indexOf("THE SMALL TYPE, ON A PHONE"));
    expect(rule).toContain("@media (max-width: 639px)");
    expect(rule).toMatch(/font-size: 11px/);
    expect(rule).toMatch(/font-size: 12px/);
  });

  it("leaves the cards alone", () => {
    // A card's own type is sized in cqw against the card's width, and the fixed
    // sizes left on a full-size card are measured against a frame that does not
    // grow with the viewport. Bumping those overflows the frame — the one place
    // where bigger text makes something harder to read rather than easier.
    const rule = css.slice(css.indexOf("THE SMALL TYPE, ON A PHONE"));
    const selectors = [...rule.matchAll(/\.text-\\\[\d+px\\\]:not\(([^)]+)\)/g)].map((m) => m[1]);
    expect(selectors.length).toBeGreaterThanOrEqual(5);
    for (const not of selectors) expect(not).toBe(".card-frame *");
  });
});

describe("the class the exclusion hangs on", () => {
  it("is still on the card, which is what keeps the cards undistorted", () => {
    // The silent failure this catches: `card-frame` renamed in CardView, the
    // :not() in globals.css quietly matching nothing, and every full-size card
    // on a phone growing its type inside a frame that cannot grow with it.
    // Nothing errors; the cards just start overflowing.
    expect(cardView).toContain("card-frame");
  });
});
