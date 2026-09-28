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

describe("the weeks already closed", () => {
  /**
   * Three places pick a winner and they were not all changed together.
   *
   * `standings` orders the live board, `winnerOf` reads the top of it and is
   * what the money follows, and `pastWeeks` writes the history. When the board
   * moved from market cap to margin the first two moved and the third did not,
   * so a closed week credited whoever posted the biggest number while the payout
   * went to whoever beat the opponent by the most. Both were displayed. Neither
   * said it was answering a different question.
   *
   * It applies to every board, so the Loaded Lions week was wrong the same way
   * the market week was.
   */
  it("credits the biggest margin, the way the board and the payout do", () => {
    const source = readFileSync(new URL("../lib/tournament.ts", import.meta.url), "utf8");
    const history = source.slice(source.indexOf("export async function pastWeeks"));
    const query = history.slice(0, history.indexOf("\n}\n"));

    expect(query).toContain("MAX(m.mc - m.opponent_mc)");
    // The tie-break has to be on the same figure, or a week with two equal
    // margins picks the earliest row of a different comparison.
    expect(query).toContain("m.mc - m.opponent_mc = t.mc - t.opponent_mc");
    // And none of the old rule left anywhere in it.
    expect(query).not.toContain("MAX(m.mc)");
    expect(query).not.toMatch(/AND m\.mc = t\.mc/);
  });

  it("is board-agnostic, so both boards get the same rule", () => {
    // One query with the board bound in, rather than a branch per board. The
    // lions board is not special here and must never become so: two rules would
    // mean two answers to "who won", which is the bug above with more places to
    // hide.
    const source = readFileSync(new URL("../lib/tournament.ts", import.meta.url), "utf8");
    for (const fn of ["standings", "pastWeeks", "winnerOf"]) {
      const body = source.slice(source.indexOf(`export async function ${fn}`));
      const upTo = body.slice(0, body.indexOf("\n}\n"));
      expect(upTo, `${fn} should take the board as an argument`).toMatch(/board: string/);
      expect(upTo, `${fn} should not name a board`).not.toMatch(/"lions"|'lions'/);
    }
  });
});

describe("a board that pays two tokens", () => {
  /**
   * Loaded Lions wins two prizes for one week: a share of the $CROCARD every
   * board plays for, and the $LION its entry fees bought. The history showed the
   * first and not the second, so the week read as smaller than it was with
   * nothing on the page saying a second payout existed.
   */
  it("shows both payouts in the history", () => {
    const page = readFileSync(new URL("../components/Tournament.tsx", import.meta.url), "utf8");
    expect(page).toContain("week.alsoWei");
    expect(page).toContain("week.alsoTxHash");
    // Named from the board rather than written in, so it cannot say $LION about
    // a board that pays something else.
    expect(page).toContain("board.alsoPays.symbol");
    expect(page).not.toMatch(/\+ \{[^}]+\} \$LION/);
  });

  it("carries the token's name from the data rather than the page", () => {
    const route = readFileSync(new URL("../app/api/tournament/route.ts", import.meta.url), "utf8");
    expect(route).toContain("alsoPays: board.alsoPays === null ? null");
    expect(route).toContain("symbol: board.alsoPays.symbol");
  });

  it("does not round a real payment down to nothing", () => {
    // The $CROCARD prizes are millions and whole tokens suit them. A pot that
    // fills from entry fees can hold a few hundred or a fraction, and "0 $LION"
    // beside a transaction that moved money reads as a failed payment.
    const page = readFileSync(new URL("../components/Tournament.tsx", import.meta.url), "utf8");
    const fn = page.slice(page.indexOf("const enough ="));
    expect(fn.slice(0, 400)).toContain("maximumFractionDigits: 2");
    expect(page).toContain("enough(week.alsoWei)");
  });

  it("says nothing at all when there was nothing to award", () => {
    // Absent rather than zero: a pot that was empty that week is settled with no
    // payout, and a line saying so would look like one that failed.
    const page = readFileSync(new URL("../components/Tournament.tsx", import.meta.url), "utf8");
    expect(page).toContain("board.alsoPays !== null && week.alsoWei !== null");
  });
});
