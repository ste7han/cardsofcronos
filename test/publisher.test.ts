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

describe("the marker the weekly job keeps", () => {
  /**
   * A marker is a way of not doing work twice. It is not evidence the work was
   * done — and week 2026-W39 is what the difference costs: the run did not
   * throw, so the marker was written; both boards had in fact been skipped and
   * both prizes sat allocated and unclaimed; and the marker then refused every
   * retry. Nobody would ever have been paid without deleting a row by hand.
   */
  it("is checked against the payouts rather than believed", () => {
    const source = readFileSync(new URL("../app/api/cron/weekly/route.ts", import.meta.url), "utf8");
    const fn = source.slice(source.indexOf("async function alreadyClosed"));
    const body = fn.slice(0, fn.indexOf("\n}\n"));

    // The marker is the fast no. It must never be the last word.
    expect(body).toContain("FROM tournament_paid WHERE week = ?");
    expect(body).toContain("EXCEPT");
    // A board with scores and no payout row leaves the week open.
    expect(body).toContain("SELECT DISTINCT board FROM tournament WHERE week = ?");
  });

  it("still answers no work to do when everything was paid", () => {
    const source = readFileSync(new URL("../app/api/cron/weekly/route.ts", import.meta.url), "utf8");
    const fn = source.slice(source.indexOf("async function alreadyClosed"));
    const body = fn.slice(0, fn.indexOf("\n}\n"));
    expect(body).toMatch(/open \?\? 0\) === 0/);
  });
});

describe("what the chain actually says when something reverts", () => {
  /**
   * The oldest failure in this project, written a new way.
   *
   * CLAUDE.md has it as "unknown names fail silently": the old engine matched a
   * name it did not recognise and fell through to doing nothing while the log
   * said it had worked. This is the same shape. `runWeekly` sent closeWeek and
   * decided what had happened by matching the error against
   * /WeekAlreadyClosed|already/ — but Cronos does not put a custom error's name
   * in the message. Every revert comes back as the two words "execution
   * reverted".
   *
   * So the branch that existed for "already closed" never ran. Week 2026-W39 was
   * closed, both prizes were allocated, and from then on every run treated the
   * normal state as a fatal error and returned before claiming anything. Once a
   * minute, for hours, with a log line each time that read like a real failure.
   */
  it("reads the contract instead of matching on a revert message", () => {
    const source = readFileSync(new URL("../lib/publisher.ts", import.meta.url), "utf8");
    // Comments stripped, because the file explains at length what it used to do
    // and that explanation is worth keeping. What must be gone is the code.
    const code = source
      .split("\n")
      .filter((line) => !/^\s*(\/\/|\*|\/\*)/.test(line))
      .join("\n");

    // None of the guesswork left anywhere in it. Named one by one rather than
    // banning every match on an error message: SQLite's errors DO carry a
    // readable reason, and the one place that reads one — telling a primary key
    // collision from a real write failure — is right to.
    expect(code).not.toMatch(/WeekAlreadyClosed/);
    expect(code).not.toMatch(/AlreadyPaid/);
    expect(code).not.toMatch(/NothingToWin/);
    expect(code).not.toMatch(/NoSuchWeek/);
    // Every remaining message match is about the database, not the chain.
    for (const [match] of code.matchAll(/\/[^/\n]+\/i?\.test\(said\)/g)) {
      expect(match, "an error message being matched for a chain answer").toMatch(
        /UNIQUE|constraint|PRIMARY/,
      );
    }

    // And the readings that replaced it.
    expect(source).toContain('selector("prizes(bytes32,bytes32)")');
    expect(source).toContain('selector("allocated()")');
  });

  it("only closes the boards the contract says are still open", () => {
    const source = readFileSync(new URL("../lib/publisher.ts", import.meta.url), "utf8");
    const run = source.slice(source.indexOf("export async function runWeekly"));
    const body = run.slice(0, run.indexOf("\n}\n"));
    // The winner word is zero for a board nobody has closed yet, and that is
    // what decides — not whether a transaction threw.
    expect(body).toContain("const openBoards = won.filter(");
    expect(body).toContain("if (openBoards.length > 0) {");
    // A week where every board is already closed sends nothing and goes on to
    // claim, which is the case that was broken.
    expect(body.indexOf("const openBoards")).toBeLessThan(body.indexOf("await payOne("));
  });

  it("does not claim a prize the contract says is already paid", () => {
    const source = readFileSync(new URL("../lib/publisher.ts", import.meta.url), "utf8");
    const fn = source.slice(source.indexOf("async function payOne"));
    const body = fn.slice(0, fn.indexOf("\n}\n"));
    // The third word of the prize is the paid flag, read from the same call that
    // reads the amount.
    expect(body).toContain("alreadyPaid");
    expect(body).toContain("slice(128, 192)");
    expect(body.indexOf("if (alreadyPaid)")).toBeLessThan(body.indexOf('selector("claim(bytes32,bytes32)")'));
    // And it is settled, not skipped: a prize already claimed is not a failure.
    const branch = body.slice(body.indexOf("if (alreadyPaid)"));
    expect(branch.slice(0, 300)).toContain("why:");
    expect(branch.slice(0, 300)).not.toContain("skipped:");
  });

  it("works out an empty pot from its balance rather than from a revert", () => {
    const source = readFileSync(new URL("../lib/publisher.ts", import.meta.url), "utf8");
    const loop = source.slice(source.indexOf("A BOARD WITH ITS OWN POT IS CLOSED TWICE"));
    const body = loop.slice(0, loop.indexOf("\n  return {"));
    expect(body).toContain("if (holds <= spoken)");
    // Empty is settled, so a quiet week does not hold the week open for ever.
    const empty = body.slice(body.indexOf("if (holds <= spoken)"));
    expect(empty.slice(0, 400)).toContain('amount: "0"');
    expect(empty.slice(0, 400)).not.toContain("skipped:");
  });
});

describe("a board with two pots", () => {
  it("is written down once per token, not once per board", () => {
    // tournament_paid was keyed on (week, board), on the reading that a week is
    // paid once per board. Loaded Lions is paid twice for one week, in two
    // tokens — and the insert that records a payout swallows a key collision on
    // purpose, so the $LION half would have been paid and never written down.
    const schema = readFileSync(new URL("../db/schema.sql", import.meta.url), "utf8");
    const table = schema.slice(schema.indexOf("CREATE TABLE IF NOT EXISTS tournament_paid"));
    const upTo = table.slice(0, table.indexOf(");"));
    expect(upTo).toContain("PRIMARY KEY (week, board, token)");
    expect(upTo).not.toContain("PRIMARY KEY (week, board)");
  });

  it("joins its history on the token, or a week comes back twice", () => {
    const source = readFileSync(new URL("../lib/tournament.ts", import.meta.url), "utf8");
    const history = source.slice(source.indexOf("export async function pastWeeks"));
    const query = history.slice(0, history.indexOf("\n}\n"));
    expect(query).toContain("AND p.token = ?");
    expect(query).toContain("AND q.token = ?");
    expect(query).toContain("alsoWei");
  });
});
