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

describe("getting stuck CRO out, and nothing else", () => {
  it("does not give the escrow the hatch the other contracts have", () => {
    // Rescuable sweeps the whole balance after two days' notice. That is right
    // for a splitter holding CRO in transit and for a pot the project owns. It
    // is wrong here: the balance is other people's money in matches they are
    // still playing.
    expect(escrow).toMatch(/contract MatchEscrow is Ownable \{/);
    // The code, not the word: the note above the contract explains what it does
    // not inherit and why, and a test that failed on the explanation would be a
    // test that punishes writing one down.
    expect(escrow).not.toMatch(/^import \{Rescuable\}/m);
    expect(escrow).not.toMatch(/is Ownable, Rescuable/);
  });

  it("counts what is owed, and can only take the difference", () => {
    expect(escrow).toContain("uint256 public committed;");
    expect(escrow).toMatch(/return balance > committed \? balance - committed : 0;/);
    expect(escrow).toMatch(/uint256 amount = stuck\(\);/);
  });

  it("is the owner's and nobody else's", () => {
    expect(escrow).toMatch(/function sweepStuck\(address to\) external onlyOwner/);
    expect(escrow).toMatch(/function sweepToken\(IERC20 token, address to\) external onlyOwner/);
  });

  it("moves what is owed down on every way money leaves", () => {
    // Four ways out, and a counter that missed one would slowly turn players'
    // stakes into something the owner could sweep.
    for (const line of [
      "committed -= stake;",
      "committed -= pot;",
    ]) {
      expect(escrow, line).toContain(line);
    }
    // Two of them are `stake` — cancel and walkAway — so that line appears
    // twice and a single occurrence means one of the paths lost its bookkeeping.
    expect(escrow.split("committed -= stake;")).toHaveLength(3);
  });

  it("leaves the other contracts their hatch, with its notice", () => {
    // Two days. The delay is the feature there: it is the window in which
    // anybody watching can react, and it is why that power can be disclosed on
    // /contracts rather than hidden.
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
