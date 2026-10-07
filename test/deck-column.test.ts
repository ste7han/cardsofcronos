// The deck's own column, and reading a card while you build.
//
// The right-hand side of the builder held statistics ABOUT the deck — a count,
// an average, a curve, the saved decks — and never the deck. The forty cards
// were visible only as a ring around cards in the grid on the left, so knowing
// what you had built meant scrolling four hundred and forty-eight cards and
// remembering. A player asked for the obvious arrangement and this is it.
//
// Source guards, because the behaviour needs a signed-in wallet with a
// collection. What they hold is the part that would be wrong silently: a tap
// that both shows a card and deletes it.

import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const builder = readFileSync(new URL("../components/DeckBuilder.tsx", import.meta.url), "utf8");
const page = readFileSync(new URL("../app/deck/page.tsx", import.meta.url), "utf8");

/** Just the deck list, so these do not match the collection grid by accident. */
const list = builder.slice(
  builder.indexOf("const DeckList = memo"),
  builder.indexOf("const PickableCard = memo"),
);

describe("the deck has a column of its own", () => {
  it("lists the picked cards, rather than only counting them", () => {
    expect(builder).toContain("<DeckList picked={picked} onRemove={toggle} />");
  });

  it("groups them by type, because that is the rule a deck fails on", () => {
    // Not alphabetical and not by cost: a deck is refused for having too few
    // projects and for nothing else about its composition.
    expect(list).toContain("CARD_TYPES.filter");
    expect(list).toContain("TYPE_LABEL[type]");
  });

  it("makes the rest of the row the target", () => {
    // Not the whole row any more — the magnifier takes a slice at the left —
    // but everything after it. A small × would be the thing to aim at, and this
    // list exists to make swapping fast.
    expect(list).toContain("onClick={() => onRemove(card)}");
    expect(list).toContain("flex min-w-0 flex-1 items-center");
  });

  it("says what to do when it is empty", () => {
    expect(list).toMatch(/Nothing in here yet/);
  });
});

describe("reading a card while you build", () => {
  it("is a button somebody presses, not something that arrives", () => {
    // It was a hover over the whole row, and moving the cursor down forty rows
    // to find a card opened a full-size card over every row it passed. The
    // maker's answer was that it hurt the page, and it did.
    expect(list).toContain('on="press"');
    expect(list).not.toContain("disabled={touch}");
  });

  it("never lets one press mean both read and remove", () => {
    // Sharper here than anywhere this came up before: the row REMOVES the card,
    // so a peek opening on it would show a card that is no longer in the deck,
    // over the gap its row left. Looking gets its own target.
    const peek = list.indexOf("<CardPeek");
    const remove = list.indexOf("onClick={() => onRemove(card)}");
    expect(peek).toBeGreaterThan(-1);
    expect(remove).toBeGreaterThan(peek);
    // The remove button is not inside the peek's wrapper.
    expect(list.slice(peek, remove)).toContain("</CardPeek>");
  });

  it("is the same button on every device", () => {
    // No pointer test and no second arrangement for touch: one target, one
    // meaning, everywhere.
    expect(list).not.toContain("usesTouch");
  });
});

describe("what the page opens with", () => {
  it("puts the builder above the prose", () => {
    // Four paragraphs stood between the top of the page and the first control.
    // They are not cut — they are the only place the budget is explained in
    // words — but they are not what somebody came here for.
    expect(page.indexOf("<DeckBuilder />")).toBeLessThan(page.indexOf("HOW A DECK WORKS"));
  });

  it("starts denser than the browsing page does", () => {
    // Large fits two cards across, which is a carousel rather than a
    // collection. Only the first-time default: a stored choice still wins.
    expect(builder).toContain('useCardSize("medium")');
  });
});
