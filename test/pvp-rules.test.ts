// The four rules a paid match rests on.
//
// Every one of these is a number somewhere that nothing else would notice
// changing. A clock that quietly went back to a minute, a limit that let
// somebody hold twelve matches open, a rescue hatch that could not reach CRO —
// none of them breaks a build and all of them are about somebody's money.

import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { TURN_CLOCK } from "@/engine/record";
import { CONCURRENT } from "@/lib/store";

const escrow = readFileSync(new URL("../contracts/MatchEscrow.sol", import.meta.url), "utf8");
const rescuable = readFileSync(new URL("../contracts/Rescuable.sol", import.meta.url), "utf8");

describe("the two clocks", () => {
  it("gives a live match two minutes a turn", () => {
    expect(TURN_CLOCK.live).toBe(2 * 60 * 1000);
  });

  it("gives a slow match a day", () => {
    expect(TURN_CLOCK.correspondence).toBe(24 * 60 * 60 * 1000);
  });

  it("keeps them far enough apart to be two different games", () => {
    // Not a style point. The whole reason for two modes is that one wants you
    // at the screen and the other does not, and clocks a few minutes apart
    // would be one mode with a wobble.
    expect(TURN_CLOCK.correspondence / TURN_CLOCK.live).toBeGreaterThan(100);
  });
});

describe("how many you may have open", () => {
  it("is one live match, because a live match wants you watching it", () => {
    expect(CONCURRENT.live).toBe(1);
  });

  it("is five slow ones", () => {
    expect(CONCURRENT.correspondence).toBe(5);
  });

  it("is six in total, which is the number that was asked for", () => {
    expect(CONCURRENT.live + CONCURRENT.correspondence).toBe(6);
  });
});

describe("getting the money out if something goes wrong", () => {
  it("gives the escrow the same rescue hatch as everything else", () => {
    expect(escrow).toMatch(/contract MatchEscrow is Ownable, Rescuable/);
  });

  it("can reach CRO and not only tokens", () => {
    // The escrow holds CRO, not $CROCARD. A hatch that could only sweep a
    // token balance would be a hatch that does nothing here.
    expect(rescuable).toMatch(/function rescue\(\) external onlyOwner/);
    expect(rescuable).toMatch(/uint256 amount = address\(this\)\.balance;/);
    expect(rescuable).toMatch(/payable\(to\)\.call\{value: amount\}/);
  });

  it("announces before it can be used, which is what makes it survivable", () => {
    // Two days. The delay is the feature: it is the window in which anybody
    // watching can get their stake out first, and it is why this can be
    // disclosed on /contracts rather than hidden.
    expect(rescuable).toMatch(/RESCUE_DELAY\s*=\s*2 days/);
    expect(rescuable).toMatch(/function announceRescue\(address to\) external onlyOwner/);
  });
});

describe("a match you can always get back into", () => {
  it("keeps no state, so there is nothing to lose by disconnecting", () => {
    // A match is a seed and a list of moves, replayed. That is what makes
    // coming back possible at all: there is no session to drop.
    const record = readFileSync(new URL("../engine/record.ts", import.meta.url), "utf8");
    expect(record).toContain("moves");
    expect(record).toMatch(/export function catchUp/);
  });

  it("is listed for whoever is in it, with a way back in", () => {
    const lobby = readFileSync(new URL("../components/Lobby.tsx", import.meta.url), "utf8");
    expect(lobby).toContain("`/pvp/${match.id}`");
    expect(lobby).toContain("YOUR TURN");
  });
});
