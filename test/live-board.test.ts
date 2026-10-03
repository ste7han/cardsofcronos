// The live board, as a piece of React rather than as rules.
//
// Both things checked here were invisible at the type level and both of them
// made the screen worse in a way that reads as "the game is janky" rather than
// as a bug with a name. Neither can be caught by playing a match in a test —
// one is about component identity and the other is about a stylesheet — so they
// are checked against the source, the same way test/watch.test.ts guards the
// shape of the spectator route.

import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const board = readFileSync(new URL("../components/pvp/MatchBoard.tsx", import.meta.url), "utf8");
const solo = readFileSync(new URL("../components/game/PlayArea.tsx", import.meta.url), "utf8");

describe("a board that does not rebuild itself", () => {
  it("declares Side at module level and not inside the component", () => {
    // `const Side = (...) => ...` inside MatchBoard is a new function on every
    // render, so React saw a new component TYPE in that slot, threw the subtree
    // away and mounted a fresh one. Every CardPeek underneath lost its open
    // flag with it — and a live match re-renders once a second to tick the
    // clock, so a card held up to be read closed before it could be read.
    //
    // Column zero is the whole assertion. The markup is identical either way.
    expect(board).toMatch(/^function Side\(/m);
    expect(board).not.toMatch(/^\s+const Side = \(/m);
  });

  it("passes the shared table down rather than capturing it", () => {
    // The eleven values Side used to read off the enclosing scope. Named props
    // cannot be captured by accident, which is what made the bug above possible
    // to write without noticing.
    expect(board).toContain("shared: SideTable");
    expect(board).toContain("shared={shared}");
  });

  it("keeps the clock tick from being a remount", () => {
    // The tick is fine and has to stay — a countdown that shows seconds has to
    // re-render every second. What must not come back is a component boundary
    // underneath it that cannot survive one.
    expect(board).toContain("setNow(Date.now())");
  });
});

describe("the table on a phone", () => {
  it("opts out of the small-type floor, like the solo table", () => {
    // globals.css raises tiny type on narrow screens, which is right for a page
    // somebody reads and wrong for a screen somebody plays: every pixel the
    // labels grow comes off the budget that keeps the board and the hand on
    // screen together. The exemption was added for the solo table and stopped
    // there, so the same regression the maker reported for solo was still live
    // in PvP afterwards.
    expect(board).toContain('className="dense');
    expect(solo).toContain('className="dense"');
  });

  it("gives the hand the same card width as the solo table", () => {
    // A card sets its own type in cqw against its own width, so a card that is
    // narrower on a phone is a card with smaller letters on the smallest screen
    // — the thing b043e26 fixed for the solo hand and not for this one. Both
    // rows scroll sideways, so the only cost is how many you see at once.
    const game = readFileSync(new URL("../components/game/Game.tsx", import.meta.url), "utf8");
    expect(game).toContain("w-[160px]");
    expect(board).toContain("w-[160px]");
    expect(board).not.toContain("sm:w-[150px]");
  });

  it("still exempts the cards themselves, which is where legibility was wanted", () => {
    const css = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");
    expect(css).toContain(".card-frame *");
    expect(css).toContain(".dense *");
  });
});
