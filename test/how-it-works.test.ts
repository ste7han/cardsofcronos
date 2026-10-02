// The page that explains where the money goes.
//
// It is the page most likely to be checked by somebody deciding whether to
// trust this, which makes a stale figure on it worse than a stale figure
// anywhere else. So nothing on it is typed: the split comes out of the data the
// splitter was deployed from, and every live number is read on each view.

import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { STREAMS } from "@/lib/revenue";

const page = readFileSync(new URL("../app/how-it-works/page.tsx", import.meta.url), "utf8");
const route = readFileSync(new URL("../app/api/stats/route.ts", import.meta.url), "utf8");
const stats = readFileSync(new URL("../components/Stats.tsx", import.meta.url), "utf8");

describe("the split on the page", () => {
  it("is read from the data rather than written into the prose", () => {
    // 50/30/20 typed into a paragraph is a paragraph that goes on saying it
    // after somebody deploys a new splitter. The numbers come from STREAMS.
    expect(page).toContain('shareTo("burn")');
    expect(page).toContain('shareTo("holders")');
    expect(page).toContain('shareTo("tournament")');
    // Checked inside the split block only. 30% also appears in the holder
    // ladder, where it means something else entirely.
    const split = page.slice(page.indexOf("BUYS $CROCARD"), page.indexOf("The destinations and the shares"));
    expect(split).not.toMatch(/\d\d%<\/p>/);
  });

  it("takes the holder ladder from its own data file", () => {
    // 10/20/30 off the mint is a promise people hold the token for. Typed into
    // this table it would go on being made after somebody moved it.
    expect(page).toContain("HOLDER_TIERS");
    expect(page).toContain("tier.off");
    expect(page).toContain("tier.cut");
  });

  it("takes the rules from the engine, not from memory", () => {
    for (const bit of ["RULES.turns", "RULES.deckSize", "RULES.portfolioSize", "MARKETING_COST"]) {
      expect(page, `${bit} should come from the engine`).toContain(bit);
    }
    expect(page).toContain("TURN_ACTION_COST");
  });

  it("describes a split that actually adds up to everything", () => {
    for (const stream of STREAMS) {
      const total = stream.shares.reduce((sum, one) => sum + one.percent, 0);
      expect(total, `${stream.id} divides ${total}%`).toBe(100);
    }
  });

  it("divides every stream the same way, which is what the page claims", () => {
    // The page shows one split for three sources. If they ever differ, that
    // sentence becomes a lie and this is where it shows up.
    const shape = (s: (typeof STREAMS)[number]) =>
      [...s.shares].sort((a, b) => a.to.localeCompare(b.to)).map((o) => `${o.to}:${o.percent}`).join(",");
    const first = shape(STREAMS[0]!);
    for (const stream of STREAMS) expect(shape(stream), stream.id).toBe(first);
  });
});

describe("the live figures", () => {
  it("reads each one in its own try, so one failure costs one number", () => {
    // A stats panel that goes blank because the prize pot was slow reads as a
    // project that has stopped.
    expect([...route.matchAll(/try \{/g)].length).toBeGreaterThanOrEqual(4);
  });

  it("sums wei in TypeScript rather than in SQL", () => {
    // Both columns are wei held as TEXT. SUM() over TEXT coerces to a double and
    // rounds, quietly, in whichever direction the floats fall.
    // Comments stripped: this file explains at length why SUM() is wrong here,
    // and that explanation is worth keeping.
    const code = route
      .split("\n")
      .filter((line) => !/^\s*(\/\/|\*|\/\*)/.test(line))
      .join("\n");
    // Case-sensitive: this file has a TypeScript helper called `sum`, and SQL
    // in this project is written in capitals.
    expect(code).not.toMatch(/SUM\(/);
    expect(code).toContain("BigInt(row.burned)");
  });

  it("shows a dash rather than a zero when a number could not be read", () => {
    // Blank or zero reads as a fact. Zero burned is a very different claim from
    // "the chain did not answer".
    expect(stats).toContain('value={stats.burned === null ? "—"');
    expect(stats).toMatch(/would not answer just now/);
  });

  it("says what is claimed and what is still waiting, not just the smaller half", () => {
    // Showing only what has been claimed makes a drop that is working look like
    // one nobody is using: most of what is allocated is simply still sitting in
    // the contract with somebody's name on it.
    expect(stats).toContain("WAITING TO BE CLAIMED");
    expect(stats).toContain("BigInt(stats.allocated) - BigInt(stats.claimed)");
  });
});

describe("finding the page", () => {
  it("is linked from the footer beside the contracts", () => {
    const footer = readFileSync(new URL("../components/Footer.tsx", import.meta.url), "utf8");
    expect(footer).toContain('href="/how-it-works"');
    expect(footer.indexOf('href="/how-it-works"')).toBeLessThan(footer.indexOf('href="/contracts"'));
  });
});
