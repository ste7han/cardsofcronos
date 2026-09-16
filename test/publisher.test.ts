import { describe, expect, it } from "vitest";

import { lastWeek, weekWord } from "@/lib/publisher";
import { weekOf } from "@/lib/tournament";

/**
 * Two pure functions that between them decide who gets paid and for which week.
 * Both are one line and both are the kind of one line that is wrong by exactly
 * seven days or by one character, in a way nothing downstream would notice.
 */
const utc = (iso: string) => Date.parse(iso);

describe("which week the cron is closing", () => {
  it("is the week that just ended, not the one running", () => {
    // The cron fires Monday 00:10 UTC. The week that started ten minutes ago is
    // not the one to pay out.
    const tick = utc("2026-09-21T00:10:00Z");
    expect(weekOf(tick)).toBe("2026-W39");
    expect(lastWeek(tick)).toBe("2026-W38");
  });

  it("is still last week when the tick is late", () => {
    // A cron that fires hours late, or a hand-run on the Tuesday, must pay the
    // same week — otherwise being late means paying nobody.
    expect(lastWeek(utc("2026-09-21T06:00:00Z"))).toBe("2026-W38");
    expect(lastWeek(utc("2026-09-23T18:00:00Z"))).toBe("2026-W38");
  });

  it("crosses a year the way the board does", () => {
    // 2027-01-04 is the Monday that starts 2027-W01, so the week before it is
    // the ISO week 53 that holds 1 January.
    expect(lastWeek(utc("2027-01-04T00:10:00Z"))).toBe("2026-W53");
  });

  it("never names the week it is being run in", () => {
    for (let i = 0; i < 120; i++) {
      const tick = utc("2026-01-05T00:10:00Z") + i * 7 * 86_400_000;
      expect(lastWeek(tick)).not.toBe(weekOf(tick));
    }
  });
});

describe("the week as the contract keys it", () => {
  it("is the label's bytes, right-padded to a word", () => {
    const word = weekWord("2026-W38");
    expect(word).toHaveLength(64);
    // "2026-W38" in ASCII, then zeroes.
    expect(word).toBe("323032362d573338" + "0".repeat(48));
  });

  it("gives a different word for a different week", () => {
    expect(weekWord("2026-W38")).not.toBe(weekWord("2026-W39"));
  });

  it("refuses a label that would be silently truncated", () => {
    expect(() => weekWord("x".repeat(33))).toThrow(/fit in a word/i);
  });
});
