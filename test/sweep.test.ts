// Getting a mint's money to the splitter.
//
// `buy()` pays the collection and keeps the CRO there; `release()` on the
// collection forwards it to the splitter; `release()` on the splitter swaps it
// and divides it. Three steps, and for a while the daily job only knew about
// the last one — so the first ten cards sold put 150 CRO in the collection and
// the burn page went on showing nothing happening, correctly, because nothing
// was.
//
// What is checked here is the shape of the fix rather than the chain: that the
// sweep exists, that it runs BEFORE the release, and that neither step can be
// skipped by a caller that forgot about the other.

import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const splitter = readFileSync(new URL("../lib/splitter.ts", import.meta.url), "utf8");
const daily = readFileSync(new URL("../app/api/cron/daily/route.ts", import.meta.url), "utf8");
const worker = readFileSync(new URL("../worker/index.js", import.meta.url), "utf8");
const solidity = readFileSync(
  new URL("../contracts/CardsOfCronosSetOne.sol", import.meta.url),
  "utf8",
);

describe("where a mint's money goes", () => {
  it("is the collection, until somebody moves it", () => {
    // The fact the whole thing rests on. `buy` does not forward, and `release`
    // is what forwards — so a job that never calls it is a job that never sees
    // a penny of the mint.
    expect(solidity).toContain("function buy(uint256 amount) external payable");
    expect(solidity).toMatch(/function release\(\) external \{[\s\S]*?splitter\.call\{value: balance\}/);
    // And anybody may call it, which is why this does not need the owner key.
    const body = solidity.slice(solidity.indexOf("function release() external {"));
    expect(body.slice(0, 300)).not.toMatch(/onlyOwner/);
  });

  it("is swept before the splitter is asked what it holds", () => {
    // The other order releases whatever was there yesterday and leaves today's
    // mints for tomorrow — every day, forever, and never visibly wrong.
    const sweep = splitter.indexOf("const out = await sweepCollection(");
    const release = splitter.indexOf("const went = await releaseNow(");
    expect(sweep, "the sweep is gone").toBeGreaterThan(-1);
    expect(release, "the release is gone").toBeGreaterThan(-1);
    expect(sweep).toBeLessThan(release);
  });

  it("asks the balance before it sends, so an empty collection is not a fault", () => {
    // `release()` reverts on an empty contract. Attempting it anyway turns the
    // ordinary quiet day into a failed estimate and a line that reads like a
    // fault — which is how alerts get muted.
    const fn = splitter.slice(splitter.indexOf("async function sweepCollection("));
    expect(fn.slice(0, 900)).toContain('rpc<string>(rpcs, "eth_getBalance"');
    expect(fn.slice(0, 900)).toContain("waiting === 0n");
  });

  it("reports what it swept, rather than only what it released", () => {
    expect(splitter).toMatch(/swept: string \| null;/);
    expect(splitter).toContain("sweptWhy");
  });
});

describe("the daily job actually running", () => {
  it("can be asked softly, and declines if it has run today", () => {
    // The cron that used to run it stopped firing. The alarm asks every minute
    // and this is what keeps that from releasing sixty times an hour.
    expect(daily).toContain("body.soft === true");
    expect(daily).toContain("BETWEEN_RUNS");
    const gap = /const BETWEEN_RUNS = ([\d *]+);/.exec(daily);
    expect(gap, "the gap between runs is gone").not.toBeNull();
    // Under a day, so a run is not pushed to the day after by a few minutes of
    // drift; well over an hour, so it is not swapping dust.
    const ms = Function(`return ${gap![1]}`)() as number;
    expect(ms).toBeGreaterThan(60 * 60 * 1000);
    expect(ms).toBeLessThan(24 * 60 * 60 * 1000);
  });

  it("records that it ran only after it has run", () => {
    // Written before the work, a run that threw halfway would count as today's
    // and the money would wait a day.
    const work = daily.indexOf("const ran = { splitter, holders };");
    const wrote = daily.indexOf("await setCursor(db(), RAN");
    expect(work).toBeLessThan(wrote);
  });

  it("is reached from the alarm, which is the clock that works", () => {
    expect(worker).toContain("/api/cron/daily");
    expect(worker).toContain('JSON.stringify({ soft: true })');
  });
});
