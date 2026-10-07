// What the screen says when a position leaves a board.
//
// ── WHY THIS IS NOT "A POSITION DISAPPEARED" ─────────────────────────────────
//
// It was. The red wash over the whole screen fired whenever any position left
// any board — which includes taking profit and includes playing a bigger card
// over a smaller one. Both of those are things a player does on purpose and is
// pleased about, so the alarm went off for good news, which is how an alarm
// stops being read.
//
// The maker's complaint underneath all this was that destroying positions
// seemed to cost nobody anything. The engine was right — the clawback is exact,
// measured in scripts/clawback-audit.ts — but a few per cent off a number in
// the millions that is climbing at the same time is not something anybody sees.
// So the flash carries the figure now, and only fires when there is one.

import { describe, expect, it } from "vitest";

import { EMPTY_FLASH, makeFlash } from "@/components/game/diff";
import type { Snapshot } from "@/engine/snapshot";

const SOME = "a-card";
const OTHER = "another-card";

/** A board with the positions and market cap it is given, and nothing else. */
function snap(you: { mc: number; cards: { id: string; earned: number }[] }): Snapshot {
  const side = (one: typeof you) => ({
    mc: one.mc,
    projects: one.cards.map((c) => ({
      cardId: c.id,
      holders: 3,
      extraPump: 0,
      earned: c.earned,
      playedOnTurn: 1,
      pump: 0,
    })),
    support: [],
  });
  return {
    toMove: "you",
    log: [],
    players: { you: side(you), opponent: side({ mc: 0, cards: [] }) },
  } as unknown as Snapshot;
}

describe("a position leaving the board", () => {
  it("flashes, with the figure, when it was taken", () => {
    // A rug claws back `earned` — the launch plus every pump the position ever
    // paid out — so that is the number worth showing, not the move's net.
    const before = snap({ mc: 1_000_000, cards: [{ id: SOME, earned: 150_000 }] });
    const after = snap({ mc: 850_000, cards: [] });
    const flash = makeFlash(before, after);
    expect(flash.rug).toEqual({ player: "you", lost: 150_000 });
  });

  it("says nothing when it was banked", () => {
    // Taking profit closes a position and does not move the number: the
    // earnings were paid out as they were made. Flashing red here told somebody
    // they had been robbed at the moment they cashed out.
    const before = snap({ mc: 1_000_000, cards: [{ id: SOME, earned: 150_000 }] });
    const after = snap({ mc: 1_000_000, cards: [] });
    expect(makeFlash(before, after).rug).toBeNull();
  });

  it("says nothing when a bigger card took its place", () => {
    // An upgrade removes the old position and pays the new one's launch, so the
    // market cap goes UP. The old flash fired on this too.
    const before = snap({ mc: 1_000_000, cards: [{ id: SOME, earned: 150_000 }] });
    const after = snap({ mc: 1_080_000, cards: [{ id: OTHER, earned: 230_000 }] });
    expect(makeFlash(before, after).rug).toBeNull();
  });

  it("adds up a rug that took more than one", () => {
    const before = snap({
      mc: 1_000_000,
      cards: [
        { id: SOME, earned: 150_000 },
        { id: OTHER, earned: 90_000 },
      ],
    });
    const after = snap({ mc: 760_000, cards: [] });
    expect(makeFlash(before, after).rug?.lost).toBe(240_000);
  });

  it("names whose it was, because one of the two is good news", () => {
    const before = snap({ mc: 500_000, cards: [] });
    const withTheirs = structuredClone(before);
    withTheirs.players.opponent = {
      mc: 400_000,
      projects: [
        { cardId: SOME, holders: 3, extraPump: 0, earned: 80_000, playedOnTurn: 1, pump: 0 },
      ],
      support: [],
    } as unknown as Snapshot["players"]["opponent"];
    const after = structuredClone(before);
    after.players.opponent = {
      mc: 320_000,
      projects: [],
      support: [],
    } as unknown as Snapshot["players"]["opponent"];

    expect(makeFlash(withTheirs, after).rug).toEqual({ player: "opponent", lost: 80_000 });
  });

  it("stays quiet when nothing left at all", () => {
    const same = snap({ mc: 1_000_000, cards: [{ id: SOME, earned: 150_000 }] });
    expect(makeFlash(same, structuredClone(same)).rug).toBeNull();
  });

  it("has a resting state that is quiet too", () => {
    expect(EMPTY_FLASH.rug).toBeNull();
  });
});

describe("where the figure is shown", () => {
  it("is on both tables, from the same diff", async () => {
    const { readFileSync } = await import("node:fs");
    const solo = readFileSync(new URL("../components/game/Game.tsx", import.meta.url), "utf8");
    const pvp = readFileSync(
      new URL("../components/pvp/MatchBoard.tsx", import.meta.url),
      "utf8",
    );
    for (const [where, source] of [["solo", solo], ["pvp", pvp]] as const) {
      expect(source, where).toContain("flash.rug !== null");
      expect(source, where).toContain("−{formatMC(flash.rug.lost)}");
    }
  });
});
