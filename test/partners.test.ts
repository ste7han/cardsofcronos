// /partners: what a project is offered, and the form it applies with.
//
// The terms are money, so the page must not be able to say one thing while the
// data says another. These check the arithmetic, the form's rules, and that the
// page reads its numbers rather than typing them — the clockLabel lesson.

import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { CARDS_PER_SET, MINTS_PER_SET, PRICE_MULTIPLE, TO_PARTNER_PERCENT } from "@/data/partner-sets";
import { HOLDER_TIERS } from "@/data/holder-tiers";
import { GAME_SHARES, LIMITS, PARTNER_PRICE_CRO, partnerPrice, readApplication, toPartner } from "@/lib/partners";
import { MINT_PRICE_CRO } from "@/lib/revenue";

const read = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");
const page = read("../app/partners/page.tsx");
const schema = read("../db/schema.sql");
const migration = read("../db/migrate-partners.sql");

const good = {
  project: "Loaded Lions",
  website: "loadedlions.com",
  token: "",
  contact: "@lions",
  about: "A collection of lions on Cronos with a token and a big community.",
};

describe("the terms", () => {
  it("are what the maker decided", () => {
    expect(PRICE_MULTIPLE).toBe(2);
    expect(TO_PARTNER_PERCENT).toBe(50);
  });

  it("price a partner card off the Set 01 price", () => {
    expect(PARTNER_PRICE_CRO).toBe(MINT_PRICE_CRO * 2);
    expect(toPartner(PARTNER_PRICE_CRO)).toBe(MINT_PRICE_CRO);
  });

  it("take the discount off the same ladder", () => {
    for (const tier of HOLDER_TIERS) {
      expect(partnerPrice(tier.off)).toBeCloseTo(PARTNER_PRICE_CRO * (1 - tier.off / 100));
    }
  });

  it("send the game's half through the game's split", () => {
    expect(GAME_SHARES.reduce((sum, share) => sum + share.percent, 0)).toBe(100);
  });

  it("leave undecided numbers undecided rather than guessed", () => {
    // Remove this the day they are decided — and the page fills itself in.
    expect(CARDS_PER_SET).toBeNull();
    expect(MINTS_PER_SET).toBeNull();
  });
});

describe("the page", () => {
  it("types no price, share or count of its own", () => {
    // Every figure goes through cro(), orOpen() or a constant. A literal CRO
    // amount in the JSX is the copy that drifts away from the number.
    expect(page).not.toMatch(/\b\d+(\.\d+)? CRO\b/);
    expect(page).not.toMatch(/\b50%/);
    expect(page).toContain("orOpen(CARDS_PER_SET");
    expect(page).toContain("orOpen(MINTS_PER_SET");
  });

  it("is linked from the footer", () => {
    expect(read("../components/Footer.tsx")).toContain('href="/partners"');
  });

  it("declares its pieces at module level", () => {
    expect(page).toMatch(/^function Benefit\(/m);
    expect(page).toMatch(/^function Term\(/m);
  });
});

describe("an application", () => {
  it("is taken when it has what it needs", () => {
    const read = readApplication(good);
    expect(read.ok).toBe(true);
    if (read.ok) {
      expect(read.application.website).toBe("https://loadedlions.com");
      expect(read.application.token).toBeNull();
    }
  });

  it("names the field that is missing", () => {
    for (const field of ["project", "website", "contact", "about"] as const) {
      const read = readApplication({ ...good, [field]: "  " });
      expect(read.ok).toBe(false);
      if (!read.ok) expect(read.field).toBe(field);
    }
  });

  it("refuses a token that is not an address, or fails its checksum", () => {
    for (const token of ["lion", "0x123", "0x9D8c68F185A04314DDC8B8216732455e8dbb7E46"]) {
      const read = readApplication({ ...good, token });
      expect(read.ok).toBe(false);
      if (!read.ok) expect(read.field).toBe("token");
    }
  });

  it("stores a token lowercase, the way the schema insists", () => {
    const read = readApplication({ ...good, token: "0x9D8c68F185A04314DDC8B8216732455e8dbb7E45" });
    expect(read.ok && read.application.token).toBe("0x9d8c68f185a04314ddc8b8216732455e8dbb7e45");
  });

  it("refuses anything longer than the box allows", () => {
    const read = readApplication({ ...good, about: "x".repeat(LIMITS.about + 1) });
    expect(read.ok).toBe(false);
    if (!read.ok) expect(read.field).toBe("about");
  });

  it("refuses a website with no domain", () => {
    const read = readApplication({ ...good, website: "lions" });
    expect(read.ok).toBe(false);
  });

  it("has a table to land in, in the schema and in the migration", () => {
    for (const sql of [schema, migration]) {
      expect(sql).toContain("CREATE TABLE IF NOT EXISTS partner_applications");
      expect(sql).toContain("partner_applications_sender");
    }
  });
});
