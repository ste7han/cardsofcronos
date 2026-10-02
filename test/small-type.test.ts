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

  it("leaves the table alone, where height is the scarce thing", () => {
    // The floor made every page about ten per cent longer. On something you
    // read that is a good trade. On the table it is not: the board and your
    // hand have to be on screen together, and the maker said straight out that
    // gameplay had got worse for it.
    const rule = css.slice(css.indexOf("THE SMALL TYPE, ON A PHONE"));
    const selectors = [...rule.matchAll(/\.text-\\\[\d+px\\\](:not\([^)]+\))+/g)].map((m) => m[0]);
    expect(selectors.length).toBeGreaterThanOrEqual(5);
    for (const sel of selectors) expect(sel).toContain(":not(.dense *)");
  });

  it("marks the table with the class that opts it out", () => {
    const play = readFileSync(new URL("../components/game/PlayArea.tsx", import.meta.url), "utf8");
    expect(play).toMatch(/className="dense"/);
  });

  it("leaves the cards alone", () => {
    // A card's own type is sized in cqw against the card's width, and the fixed
    // sizes left on a full-size card are measured against a frame that does not
    // grow with the viewport. Bumping those overflows the frame — the one place
    // where bigger text makes something harder to read rather than easier.
    const rule = css.slice(css.indexOf("THE SMALL TYPE, ON A PHONE"));
    const selectors = [...rule.matchAll(/\.text-\\\[\d+px\\\](:not\([^)]+\))+/g)].map((m) => m[0]);
    expect(selectors.length).toBeGreaterThanOrEqual(5);
    for (const sel of selectors) expect(sel).toContain(":not(.card-frame *)");
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

describe("the magnifier", () => {
  it("uses the shape of the card it actually opens", () => {
    // It assumed WIDTH * 1.4 — the ratio of a card in your hand. The one it
    // opens is drawn at 5/7.8, which is 34px taller at this width, and all of
    // that difference came off the top of the screen: the popover was placed as
    // if it ended where it did not.
    const peek = readFileSync(new URL("../components/game/CardPeek.tsx", import.meta.url), "utf8");
    const view = readFileSync(new URL("../components/CardView.tsx", import.meta.url), "utf8");
    expect(peek).toContain("7.8 / 5");
    expect(peek).not.toMatch(/WIDTH \* 1\.4/);
    // And the number it copies is still the number the card is drawn at.
    expect(view).toContain("aspect-[5/7.8]");
  });

  it("cannot open off the edge of the screen, whatever the arithmetic says", () => {
    // The floor that holds when the ratio drifts again — and it will, because a
    // card's shape is a design decision and this is a copy of it.
    const peek = readFileSync(new URL("../components/game/CardPeek.tsx", import.meta.url), "utf8");
    expect(peek).toMatch(/Math\.max\(8, Math\.min\(wanted, window\.innerHeight - height - 8\)\)/);
  });
});

describe("the card you magnify from your hand", () => {
  const game = readFileSync(new URL("../components/game/Game.tsx", import.meta.url), "utf8");

  it("is pinned to the screen, not to the table", () => {
    // It was `absolute`, which measures from the top of the table rather than
    // the top of the screen. On a phone you are scrolled down to your own hand,
    // so the card you had just asked to see was drawn above the fold and you had
    // to scroll up to read it. Both previews are fixed now.
    const previews = [...game.matchAll(/className="pointer-events-none (absolute|fixed) top-\[4\.5rem\]/g)];
    expect(previews.length).toBe(2);
    for (const one of previews) expect(one[1]).toBe("fixed");
  });

  it("closes when you tap anywhere else", () => {
    // On a touchscreen the magnifier was a toggle that only untoggled itself,
    // which meant hitting a six-by-six button a second time — over a card now
    // covered by the very thing you want gone.
    const hand = game.slice(game.indexOf("function Hand({"));
    const body = hand.slice(0, hand.indexOf("\n}\n"));
    expect(body).toContain('document.addEventListener("pointerdown", away)');
    expect(body).toContain("handRow.current?.contains");
    expect(body).toContain("onHover(null)");
  });

  it("does not do that on a mouse, where the pointer already answers", () => {
    const hand = game.slice(game.indexOf("function Hand({"));
    const body = hand.slice(0, hand.indexOf("\n}\n"));
    expect(body).toMatch(/hovered === null \|\| !usesTouch\(\)/);
  });
});
