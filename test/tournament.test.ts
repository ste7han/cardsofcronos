import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { marginOf, weekEnds, weekOf } from "@/lib/tournament";

/**
 * The week boundary decides who wins a prize, so it is worth more than a glance.
 * Weeks run Monday 00:00 UTC to Sunday midnight — UTC, because a week that ends
 * at a different instant depending on where you are is one somebody can argue
 * about, and a prize is exactly what somebody argues about.
 */
const utc = (iso: string) => Date.parse(iso);

describe("which week a moment falls in", () => {
  it("holds all week and turns over at Monday midnight UTC", () => {
    // 2026-09-14 is a Monday.
    const monday = utc("2026-09-14T00:00:00Z");
    expect(weekOf(monday)).toBe("2026-W38");
    expect(weekOf(utc("2026-09-20T23:59:59Z"))).toBe("2026-W38");
    expect(weekOf(utc("2026-09-21T00:00:00Z"))).toBe("2026-W39");
    // One millisecond before Monday is still last week.
    expect(weekOf(monday - 1)).toBe("2026-W37");
  });

  it("does not let a timezone move somebody between weeks", () => {
    // Sunday evening in New York is already Monday in UTC, and UTC is what
    // counts. This is the case the rule exists for.
    expect(weekOf(utc("2026-09-21T01:00:00Z"))).toBe("2026-W39");
  });

  it("puts a new year's day in the week that owns it", () => {
    // 2027-01-01 is a Friday, so it belongs to the last week of 2026 by the
    // ISO rule: the week's Thursday decides its year.
    expect(weekOf(utc("2027-01-01T12:00:00Z"))).toBe("2026-W53");
    expect(weekOf(utc("2027-01-04T12:00:00Z"))).toBe("2027-W01");
  });

  it("numbers weeks from one, always two digits", () => {
    expect(weekOf(utc("2026-01-05T00:00:00Z"))).toBe("2026-W02");
    expect(weekOf(utc("2026-01-05T00:00:00Z"))).toMatch(/^\d{4}-W\d{2}$/);
  });
});

describe("when the week closes", () => {
  it("is the next Monday at midnight UTC", () => {
    expect(weekEnds(utc("2026-09-14T00:00:00Z"))).toBe(utc("2026-09-21T00:00:00Z"));
    expect(weekEnds(utc("2026-09-17T13:45:00Z"))).toBe(utc("2026-09-21T00:00:00Z"));
    expect(weekEnds(utc("2026-09-20T23:59:59Z"))).toBe(utc("2026-09-21T00:00:00Z"));
  });

  it("is always ahead of the moment it is asked about, and never more than a week", () => {
    for (let i = 0; i < 400; i++) {
      const now = utc("2026-01-01T00:00:00Z") + i * 6 * 3_600_000;
      const ends = weekEnds(now);
      expect(ends).toBeGreaterThan(now);
      expect(ends - now).toBeLessThanOrEqual(7 * 86_400_000);
    }
  });

  it("agrees with weekOf: the instant a week closes is the next week", () => {
    const now = utc("2026-09-17T09:00:00Z");
    expect(weekOf(now)).toBe("2026-W38");
    expect(weekOf(weekEnds(now))).toBe("2026-W39");
  });
});

describe("what puts you top of the board", () => {
  /**
   * THE MARGIN, and not your own market cap.
   *
   * The table ranked on `mc` alone, which asks the wrong question: a player who
   * scraped a win with a big number beat one who took the opponent apart with a
   * smaller one. That rewards the matches where the bot happened to do badly —
   * the half of the result the player did not control — and it is the maker's
   * call that it should not.
   *
   * These are arithmetic rather than queries on purpose. The ordering lives in
   * SQL and the "is this your new best" test lives in an ON CONFLICT clause, and
   * both have to agree with this; a third answer here is what marginOf exists to
   * stop.
   */
  it("is the gap between the two figures", () => {
    expect(marginOf({ mc: 3_000_000, opponentMC: 500_000 })).toBe(2_500_000);
  });

  it("puts a bigger win above a bigger number", () => {
    // The whole point, in one comparison. Scraping past a strong bot with four
    // million used to win the week; dismantling a weak one with two million
    // now does.
    const scraped = { mc: 4_000_000, opponentMC: 3_800_000 };
    const dismantled = { mc: 2_000_000, opponentMC: 100_000 };
    expect(marginOf(dismantled)).toBeGreaterThan(marginOf(scraped));
    expect(dismantled.mc).toBeLessThan(scraped.mc);
  });

  it("is what the table is ordered by, and what a personal best is measured on", () => {
    // Two places in SQL, and they have to be the same rule. Ordering on the gap
    // while keeping the highest market cap would mean the row a wallet keeps is
    // not the row that would have won.
    const source = readFileSync(new URL("../lib/tournament.ts", import.meta.url), "utf8");
    expect(source).toContain("ORDER BY mc - opponent_mc DESC, at ASC");
    expect(source).toContain(
      "WHERE excluded.mc - excluded.opponent_mc > tournament.mc - tournament.opponent_mc",
    );
    expect(source).not.toContain("ORDER BY mc DESC");
    expect(source).not.toContain("WHERE excluded.mc > tournament.mc");
  });

  it("is the number the page shows, not a different one", () => {
    // It printed the player's own market cap in gold and ordered by the gap, so
    // the top row did not always carry the largest figure on screen.
    const page = readFileSync(new URL("../components/Tournament.tsx", import.meta.url), "utf8");
    expect(page).toContain("marginOf(one)");
  });
});
