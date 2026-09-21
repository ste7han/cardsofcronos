// The order the holder round does things in, which is the whole of this bug.
//
// The night the mint opened, the drop received 206,205 $CROCARD and nobody
// could claim any of it. The table said holders were owed 1,149,115 — five and
// a half times what existed — and `propose` refused every attempt with
// "execution reverted" and nothing else.
//
// Two orderings caused it, both of which read as careful:
//
//   1. The round stored the new entitlements and THEN proposed the tree. A
//      propose that failed left the entitlements behind, and the next run added
//      another round on top of them.
//   2. The daily job recorded that it had run AFTER the work, "so a run that
//      threw halfway does not count". The alarm asks every minute, so a run
//      that threw left the slot unclaimed and the next minute started another.
//      Six ran on top of each other.
//
// Neither is visible in a diff and neither shows up in a passing test suite.
// So the orderings are the test.

import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { DUST, leavesOf, sharesOf } from "@/lib/holders";

const holders = readFileSync(new URL("../lib/holders.ts", import.meta.url), "utf8");
const daily = readFileSync(new URL("../app/api/cron/daily/route.ts", import.meta.url), "utf8");

describe("the round writes nothing the chain has not accepted", () => {
  it("proposes before it stores", () => {
    const propose = holders.indexOf("selector(\"propose(bytes32,uint256)\")");
    const store = holders.indexOf("await addEntitlements(db,");
    expect(propose, "the propose is gone").toBeGreaterThan(-1);
    expect(store, "the store is gone").toBeGreaterThan(-1);
    expect(propose).toBeLessThan(store);
  });

  it("adds this round's shares in memory to build the tree", () => {
    // Reading the table back after writing to it is what made the two steps
    // look independent. The sum has to exist before either is written.
    expect(holders).toContain("const owed = new Map<string, bigint>();");
    expect(holders).toContain("owed.set(address, (owed.get(address) ?? 0n) + amount)");
  });

  it("refuses to promise more than the contract holds, before sending", () => {
    expect(holders).toContain("if (promised > available)");
    expect(holders).toContain('selector("paidOut()")');
  });
});

describe("the daily job claims its slot first", () => {
  it("records that it ran before doing the work, not after", () => {
    const claim = daily.indexOf("await setCursor(db(), RAN");
    const work = daily.indexOf("const splitter = await runDaily(");
    expect(claim, "the claim is gone").toBeGreaterThan(-1);
    expect(work, "the work is gone").toBeGreaterThan(-1);
    expect(claim).toBeLessThan(work);
  });

  it("records it exactly once", () => {
    // Twice would be harmless and would also mean somebody re-added the old
    // one at the end without removing this.
    expect(daily.split("await setCursor(db(), RAN")).toHaveLength(2);
  });
});

describe("the arithmetic underneath", () => {
  it("never shares out more than arrived", () => {
    // Integer division, so the remainder stays in the contract rather than
    // being promised to somebody. A version that rounded up would overpromise
    // by a wei per holder and revert for a reason nobody would guess.
    const holding = [
      { address: "0x" + "1".repeat(40), balance: 7n },
      { address: "0x" + "2".repeat(40), balance: 11n },
      { address: "0x" + "3".repeat(40), balance: 13n },
    ];
    for (const arrived of [1n, 1_000n, 206_205n * 10n ** 18n, 999_999_999n]) {
      const total = [...sharesOf(holding, arrived).values()].reduce((a, b) => a + b, 0n);
      expect(total, `arrived ${arrived}`).toBeLessThanOrEqual(arrived);
    }
  });

  it("leaves out dust, so a tree is not mostly rows worth nothing", () => {
    const some = [
      { address: "0x" + "a".repeat(40), entitlement: DUST - 1n },
      { address: "0x" + "b".repeat(40), entitlement: DUST },
    ];
    expect(leavesOf(some)).toHaveLength(1);
    expect(leavesOf(some)[0]![0]).toBe("0x" + "b".repeat(40));
  });
});
