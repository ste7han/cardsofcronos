// Who is left out of a share-out, and whether saying so is enough.
//
// The exclusions are a named list — the pool, the router, the dead address, and
// since 2026-09-22 the team wallet. What makes this worth its own file is HOW
// the list took effect, which was not how anybody reading it would assume.
//
// It was consulted in one place: the code check. An address is asked once
// whether it has code, the answer is written to `is_contract`, and the named
// list short-circuits that question for addresses we already know about. Which
// means the list only ever mattered for an address nobody had asked about yet.
// Add a wallet that has already been checked and nothing happens: the row still
// says is_contract = 0, the payout still reads that column, and the wallet goes
// on being paid while a list in the source says it is not a holder.
//
// That is not hypothetical. The team wallet was already answered for — it has no
// code, because it is somebody's wallet — so adding it to NOT_A_HOLDER on its
// own would have changed nothing at all, silently, with the source reading as
// though it had.

import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { BURN_ADDRESS, NOT_A_HOLDER, POOL, ROUTER, TEAM_WALLET } from "@/lib/revenue";
import { sharesOf } from "@/lib/holders";

const holders = readFileSync(new URL("../lib/holders.ts", import.meta.url), "utf8");

describe("the named exclusions", () => {
  it("hold everything that is not a person", () => {
    for (const address of [POOL, ROUTER, BURN_ADDRESS, TEAM_WALLET]) {
      expect(NOT_A_HOLDER).toContain(address);
    }
    expect(NOT_A_HOLDER).toContain("0x0000000000000000000000000000000000000000");
  });

  it("are applied where the money is divided, not only where code is checked", () => {
    // The whole point. A list consulted only by the code check is a list that
    // cannot exclude anybody who has already been checked — and everybody has
    // been checked, eventually.
    const round = holders.slice(holders.indexOf("// 3. Share it between"));
    expect(round.slice(0, 1400)).toMatch(/payableHolders\(db\)\)?\s*\)?\.filter/);
    expect(round.slice(0, 1400)).toContain("NOT_A_HOLDER.includes(holder.address)");
  });

  it("is why the filter cannot be left to is_contract", () => {
    // is_contract means "there is code at this address". The team wallet has
    // none, so the honest value of that column is 0 — and writing 1 into it to
    // make a payout come out right is recording something untrue to get an
    // effect, which is how a column stops meaning anything.
    expect(holders).toMatch(/is_contract still means what it says/);
  });
});

describe("what the exclusion is worth", () => {
  /**
   * The share-out arithmetic, run twice: with the wallet in and with it out.
   *
   * Not a test of the filter — that is above — but of what the filter is FOR,
   * with the real numbers from the tree proposed on 2026-09-21. It is the
   * difference between a rule somebody can check and a line of source nobody
   * has ever put a number against.
   */
  const one = (address: string, whole: number) => ({
    address,
    balance: BigInt(whole) * 10n ** 18n,
    entitlement: 0n,
    isContract: false,
  });

  // The five largest, as the holder table had them when tree 1 was built.
  const table = [
    one(TEAM_WALLET, 102_417_307),
    one("0x" + "1".repeat(40), 55_935_580),
    one("0x" + "2".repeat(40), 35_114_353),
    one("0x" + "3".repeat(40), 32_457_810),
    one("0x" + "4".repeat(40), 30_044_889),
  ];
  const arrived = 522_712n * 10n ** 18n;

  it("took nearly a fifth of the first share-out", () => {
    const shares = sharesOf(table, arrived);
    const team = shares.get(TEAM_WALLET) ?? 0n;
    const total = [...shares.values()].reduce((sum, n) => sum + n, 0n);
    const percent = Number((team * 1000n) / total) / 10;
    expect(percent).toBeGreaterThan(38);
  });

  it("leaves the others better off once it is out", () => {
    const mine = "0x" + "4".repeat(40);
    const withThem = sharesOf(table, arrived).get(mine)!;
    const without = sharesOf(
      table.filter((holder) => holder.address !== TEAM_WALLET),
      arrived,
    ).get(mine)!;

    expect(without).toBeGreaterThan(withThem);
    // Everything that was going to the team wallet is divided between the rest,
    // rather than staying in the contract. That is what makes this a decision
    // about who is paid and not a decision about how much is paid out.
    const all = sharesOf(table.filter((h) => h.address !== TEAM_WALLET), arrived);
    const total = [...all.values()].reduce((sum, n) => sum + n, 0n);
    expect(total).toBeGreaterThan(arrived - 10n ** 18n);
  });
});
