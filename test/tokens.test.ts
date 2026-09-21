// The line between a token that may be looked up and one that may not.
//
// /api/tokens says which card a token turned out to be. It must say that for a
// token that has been sold and must refuse for one that has not, and the whole
// value of publishing a hash instead of the order rests on it getting that
// right: an order anybody can read ahead of the mint is an order somebody can
// wait in front of.
//
// The route itself asks the chain, so it cannot be run here. What is checked is
// the arithmetic around the line, which is where an off-by-one would live, and
// that the route is written to ask rather than to assume.

import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import shuffle from "@/data/shuffle.json";
import { CARDS } from "@/data/cards";

const source = readFileSync(new URL("../app/api/tokens/route.ts", import.meta.url), "utf8");

describe("looking up what a token is", () => {
  it("numbers tokens from one, and the list from zero", () => {
    // The off-by-one that would hand everybody the card next to theirs.
    // `order[0]` is token 1, so the index is always one behind the number.
    expect(source).toContain("shuffle.order[id - 1]");
    expect(shuffle.order).toHaveLength(shuffle.tokens);
  });

  it("refuses a token at or above nextTokenId, not merely above it", () => {
    // `nextTokenId` is the NEXT one, so it has not been minted. `>= next` is
    // right and `> next` would reveal exactly one unsold token — the one about
    // to be bought, which is the single most useful one to know.
    expect(source).toContain("id >= next");
  });

  it("reads the line off the chain on every request", () => {
    // A cached answer here is a cached answer about what is safe to reveal.
    expect(source).toContain('selector("nextTokenId()")');
    expect(source).toMatch(/dynamic = "force-dynamic"/);
  });

  it("refuses rather than guessing when the chain cannot be asked", () => {
    // The one mistake that cannot be taken back: a card shown early is shown.
    const guard = source.slice(source.indexOf("} catch {"), source.indexOf("const tooEarly"));
    expect(guard).toContain("503");
    expect(guard).not.toMatch(/next = /);
  });

  it("refuses a number that is not a token in this set", () => {
    expect(source).toContain("id > shuffle.tokens");
    expect(source).toContain("id < 1");
  });

  it("will not be asked about more tokens than a transaction can mint", () => {
    const most = /const AT_MOST = (\d+);/.exec(source);
    expect(most, "the cap is gone").not.toBeNull();
    expect(Number(most![1])).toBeLessThanOrEqual(50);
  });

  it("only ever names cards that are in the set", () => {
    // A shuffle holding an id the game does not have would hand somebody a
    // token that renders as nothing at all.
    const inSet = new Set(CARDS.map((card) => card.id));
    const missing = [...new Set(shuffle.order)].filter((id) => !inSet.has(id));
    expect(missing).toEqual([]);
  });
});
