import { describe, expect, it } from "vitest";

import { weekEnds, weekOf } from "@/lib/tournament";

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
