import { readFileSync } from "node:fs";

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
    // The cron fires Monday 00:20 UTC, after the daily one has released the
    // week's last mint into the pot. The week that started twenty minutes ago
    // is not the one to pay out.
    const tick = utc("2026-09-21T00:20:00Z");
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

describe("paying the week out", () => {
  /**
   * What went wrong the first time a week was ever closed.
   *
   * `send` estimates gas before it signs, which is how "already closed" is found
   * out without paying for it. The cost is that a transaction depending on an
   * unmined one cannot be sent: closeWeek went out, claim was estimated against a
   * chain where the week was still open, it reverted with NoSuchWeek, and both
   * boards came back skipped. The prizes were allocated seconds later. Nobody
   * was paid, and both boards showed a winner with no payout beside them.
   */
  it("waits for the week to be mined before claiming anything", () => {
    const source = readFileSync(new URL("../lib/publisher.ts", import.meta.url), "utf8");
    const run = source.slice(source.indexOf("export async function runWeekly"));
    const body = run.slice(0, run.indexOf("\n}\n"));

    // The wait sits between sending the close and the loop that claims.
    expect(body.indexOf("await mined(")).toBeGreaterThan(body.indexOf("closeWeekData("));
    expect(body.indexOf("await mined(")).toBeLessThan(body.indexOf("await payOne("));
  });

  it("leaves the prizes allocated rather than failing when the wait runs out", () => {
    // A timeout is not a lost prize: closeWeek is on its way and the allocation
    // lands whenever it mines. The only wrong move is claiming before then, and
    // the only other wrong move is treating the week as done.
    const source = readFileSync(new URL("../lib/publisher.ts", import.meta.url), "utf8");
    const run = source.slice(source.indexOf("export async function runWeekly"));
    const wait = run.slice(run.indexOf("await mined("));
    expect(wait.slice(0, 700)).toContain("skipped:");
    expect(wait.slice(0, 700)).toMatch(/next run claims them/);
  });

  it("treats a receipt that is missing as not mined, and a failed one as not mined", () => {
    const source = readFileSync(new URL("../lib/cronos.ts", import.meta.url), "utf8");
    const fn = source.slice(source.indexOf("export async function mined"));
    const body = fn.slice(0, fn.indexOf("\n}\n"));
    // Null is a transaction still in the pool, which is a real answer and not a
    // broken endpoint. A receipt with status 0 is mined and reverted, which is
    // not something to claim against either.
    expect(body).toContain("receipt !== null");
    expect(body).toMatch(/status.*0x1?"?\) === 1n|=== 1n/);
  });
});

describe("when a week counts as done", () => {
  /**
   * The marker exists so the every-minute alarm does not close a week sixty
   * times an hour. It also has to not stop a week that was never paid.
   */
  it("needs every board paid, not merely a run that did not throw", () => {
    const source = readFileSync(new URL("../app/api/cron/weekly/route.ts", import.meta.url), "utf8");
    expect(source).toContain("const allPaid = ran.boards.every(");
    expect(source).toContain("ran.skipped === undefined && allPaid");
    // The weaker rule, which marked a week where both boards were skipped.
    expect(source).not.toMatch(/const settled =\s*\n?\s*ran\.skipped === undefined \|\|/);
  });

  it("still marks a week nobody played, so it is not asked for ever", () => {
    const source = readFileSync(new URL("../app/api/cron/weekly/route.ts", import.meta.url), "utf8");
    expect(source).toContain('ran.skipped === "nobody won any board that week"');
  });
});
