// The decoration, which is allowed to be pretty and is not allowed to be wrong.
//
// Every one of these draws a number somebody will read as a fact: how far the
// mint has got, how much of the supply has burned, how badly a match was lost.
// A bar that rounds the wrong way, or fills when it should be empty, is a lie
// told in a shape nobody thinks to check.

import { describe, expect, it } from "vitest";

import { bar, grouped, share, sizeOf, versus } from "@/lib/flair";

describe("a progress bar", () => {
  it("is empty at nothing and full at everything", () => {
    expect(bar(0, 100)).toBe("░".repeat(16));
    expect(bar(100, 100)).toBe("█".repeat(16));
  });

  it("is half full at half", () => {
    expect(bar(50, 100)).toBe("█".repeat(8) + "░".repeat(8));
  });

  it("is always the same width, whatever it is given", () => {
    for (const [done, total] of [[0, 0], [5, 0], [-3, 10], [1e9, 10], [NaN, 10], [3, NaN]]) {
      expect(bar(done!, total!), `${done}/${total}`).toHaveLength(16);
    }
  });

  it("never fills on nothing done, which is the one that would read as a lie", () => {
    // 304 of 5,603 is five per cent. A bar that rounded that to a block would
    // be fine; one that rounded zero to a block would say a mint had started.
    expect(bar(0, 5603)).toBe("░".repeat(16));
    expect(bar(1, 1_000_000)).toBe("░".repeat(16));
  });

  it("does not overflow its total", () => {
    expect(bar(200, 100)).toBe("█".repeat(16));
  });
});

describe("two figures against each other", () => {
  it("splits where they split", () => {
    expect(versus(50, 50)).toBe("█".repeat(8) + "▒".repeat(8));
    expect(versus(100, 0)).toBe("█".repeat(16));
    expect(versus(0, 100)).toBe("▒".repeat(16));
  });

  it("survives a match where nobody scored", () => {
    // Which happens: ten turns of ending the turn is a market cap of zero on
    // both sides, and a division by nothing would put NaN in a channel.
    expect(versus(0, 0)).toHaveLength(16);
    expect(versus(0, 0)).not.toContain("NaN");
  });

  it("shows a whitewash as a whitewash", () => {
    // $0 against $5.9M, which is a real match this feed has announced.
    expect(versus(0, 5_906_020)).toBe("▒".repeat(16));
  });
});

describe("how big a thing is", () => {
  it("climbs with the amount and never skips", () => {
    const seen = [0, 49, 50, 249, 250, 999, 1000, 100_000].map(sizeOf);
    expect(seen).toEqual(["🐟", "🐟", "🐬", "🐬", "🦈", "🦈", "🐳", "🐳"]);
  });
});

describe("a share", () => {
  it("keeps a second decimal where one would round it away", () => {
    // 0.2% shown as "0%" is a burn reported as nothing.
    expect(share(2, 1000)).toBe("0.20%");
    expect(share(90_350_420, 1_000_000_000)).toBe("9.0%");
  });

  it("says nothing rather than dividing by nothing", () => {
    expect(share(5, 0)).toBe("0%");
  });
});

describe("grouping", () => {
  it("puts the separators in", () => {
    expect(grouped(1_402_998)).toBe("1,402,998");
  });
});
