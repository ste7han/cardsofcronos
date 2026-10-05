// Whether a won pot actually reaches the winner.
//
// Settling a match and paying it out are two calls in
// contracts/MatchEscrow.sol: `settle` names the winner, `claim` moves the money,
// and the cut is worked out at claim time so that holding more in between
// counts. For a month only the first was ever made. The first ranked match ever
// played ended `settled` with `paid: false` — twenty CRO in the escrow with a
// winner's name on it, nobody to press the button, and nothing anywhere saying
// so. Settling "succeeded", so every log read clean.
//
// So these are about the half that was missing, and about the sweep: one attempt
// at the moment of settling is not an attempt, because a bad RPC in that second
// puts it straight back where it was with nobody looking.

import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const escrow = readFileSync(new URL("../lib/escrow.ts", import.meta.url), "utf8");
const finish = readFileSync(new URL("../lib/finish.ts", import.meta.url), "utf8");
const clocks = readFileSync(
  new URL("../app/api/cron/clocks/route.ts", import.meta.url),
  "utf8",
);
const contract = readFileSync(new URL("../contracts/MatchEscrow.sol", import.meta.url), "utf8");

describe("the two halves of winning", () => {
  it("has a way to call the second one at all", () => {
    expect(escrow).toContain('selector("claim(bytes32)")');
  });

  it("claims as well as settles when a match ends", () => {
    expect(finish).toContain("await payOut(db, record, secrets)");
  });

  it("only claims after settling actually went through", () => {
    // Claiming a wager that is still Full reverts with NotSettledYet, which
    // would read in the logs as the claim being broken rather than the settle.
    const body = finish.slice(finish.indexOf("if (record.wager)"));
    const settled = body.indexOf("if (sent.tx === null)");
    const claimed = body.indexOf("await payOut");
    expect(settled).toBeLessThan(claimed);
  });

  it("asks the chain before it sends either one", () => {
    // A pot that is already paid, or never settled, would be a reverted
    // transaction and a log line that reads like a fault. Both read first.
    expect(escrow).toContain('why: `nothing to claim: the wager is ${wager.state}`');
    expect(escrow).toContain('if (wager.paid) return { tx: null, why: "already paid" };');
  });
});

describe("the sweep", () => {
  it("tries again every minute", () => {
    expect(clocks).toContain("potsToPay(db(), now, WALK_AWAY_AFTER)");
    expect(clocks).toContain("payOut(db()");
  });

  it("stops asking about a pot that has been paid", () => {
    // Otherwise every finished staked match is a chain read a minute for thirty
    // days. The marker is filed in the same table the announcements use.
    expect(finish).toContain("`claimed:${record.id}`");
    expect(finish).toContain("INSERT OR IGNORE INTO feed_posted");
  });

  it("treats somebody else having claimed it as done, not as a failure", () => {
    // Anybody may call claim and it always pays the winner, so a winner who
    // claimed it themselves is the system working.
    expect(finish).toContain('if (paid.why === "already paid")');
  });

  it("gives up where the contract does", () => {
    // Past ABANDON_AFTER either player can walk away with their own deposit,
    // and a claim is then asking the chain about something it cannot change.
    expect(clocks).toContain("const WALK_AWAY_AFTER = 30 * 86_400_000;");
    expect(contract).toContain("ABANDON_AFTER = 30 days");
  });

  it("does not let a failed claim mark itself done", () => {
    // The marker has to come after the transaction, or one bad minute buries a
    // pot for thirty days.
    const body = finish.slice(finish.indexOf("export async function payOut"));
    const failure = body.indexOf("was settled but its pot was not claimed");
    const mark = body.lastIndexOf("INSERT OR IGNORE INTO feed_posted");
    expect(failure).toBeLessThan(mark);
  });
});
