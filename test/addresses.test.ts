// The contracts page, checked against the contracts.
//
// A page that lists addresses and describes what can be done with them is only
// worth reading if the descriptions are true, and they are prose — nothing stops
// them drifting from the Solidity as it changes. A power added to a contract and
// not added to the page turns a disclosure into a reassurance, which is worse
// than not having the page.
//
// So the claims that can be checked are checked. Not the wording, which is
// writing, but the facts underneath it: that a rescue hatch exists where the page
// says one does, that the publisher cannot do what the page says it cannot, and
// that no address on the page is one this project does not recognise.

import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { KEYS, NOT_OURS, OURS } from "@/lib/addresses";
import { BURN_ADDRESS, CONTRACTS, CROCARD, LION, POOL, PUBLISHER, ROUTER, WALLETS } from "@/lib/revenue";

const solidity = (name: string) =>
  readFileSync(new URL(`../contracts/${name}.sol`, import.meta.url), "utf8");

describe("the contracts page", () => {
  it("lists an address in the one form everything else compares against", () => {
    for (const one of [...OURS, ...NOT_OURS, ...KEYS]) {
      if (one.address === null) continue;
      expect(one.address, one.name).toMatch(/^0x[0-9a-f]{40}$/);
    }
  });

  it("names no address twice", () => {
    const seen = [...OURS, ...NOT_OURS, ...KEYS]
      .map((one) => one.address)
      .filter((address): address is string => address !== null);
    expect(new Set(seen).size).toBe(seen.length);
  });

  it("takes its addresses from the code rather than repeating them", () => {
    // The failure this prevents: a page that keeps showing the old splitter
    // after a redeploy, which is somebody sending money to a contract that has
    // been replaced.
    const find = (id: string) => [...OURS, ...NOT_OURS, ...KEYS].find((one) => one.id === id)!;
    expect(find("splitter").address).toBe(CONTRACTS.splitter);
    expect(find("drop").address).toBe(CONTRACTS.drop);
    expect(find("pot").address).toBe(CONTRACTS.pot);
    expect(find("nft").address).toBe(CONTRACTS.nft);
    expect(find("crocard").address).toBe(CROCARD);
    expect(find("lion").address).toBe(LION);
    expect(find("burn").address).toBe(BURN_ADDRESS);
    expect(find("router").address).toBe(ROUTER);
    expect(find("pool").address).toBe(POOL);
    expect(find("owner").address).toBe(WALLETS.deployer.address);
    expect(find("publisher").address).toBe(PUBLISHER);
  });

  it("says every one of ours has a key on it", () => {
    // None of these is ownerless and the page must never imply otherwise.
    for (const one of OURS) expect(one.powers.length, one.name).toBeGreaterThan(0);
  });

  it("claims no powers over what is not ours", () => {
    for (const one of NOT_OURS) {
      expect(one.powers, one.name).toEqual([]);
      expect(one.theirs, `${one.name} should say whose it is`).toBeTruthy();
    }
  });
});

describe("what the page says a contract can do", () => {
  it("is right that every one of ours has a rescue hatch with notice", () => {
    // The page tells people the owner can empty these after two days. That is
    // the most alarming thing on it and the one most worth being true.
    for (const name of ["Splitter", "HolderDrop", "PrizePot"]) {
      expect(solidity(name), name).toMatch(/is Rescuable/);
    }
    expect(solidity("Rescuable")).toMatch(/RESCUE_DELAY\s*=\s*2 days/);
    expect(solidity("Rescuable")).toMatch(/function announceRescue\(address to\) external onlyOwner/);
  });

  it("is right that the splitter cannot be pointed somewhere else", () => {
    const source = solidity("Splitter");
    // Immutable destinations, and no setter for any of them.
    expect(source).toMatch(/address (public )?immutable (public )?holders/);
    expect(source).not.toMatch(/function set(Holders|Burner|Pot)/);
  });

  it("is right that anybody can set the splitter going", () => {
    const source = solidity("Splitter");
    expect(source).toMatch(/function release\(\) external \{/);
    // No owner check and no arguments: the two things that make it not a power.
    const body = source.slice(source.indexOf("function release() external {"));
    expect(body.slice(0, 400)).not.toMatch(/onlyOwner|msg\.sender != /);
  });

  it("is right that the publisher cannot withdraw from the pot", () => {
    const source = solidity("PrizePot");
    // Everything the publisher gates is one function, and it is the one that
    // names winners.
    const gated = [...source.matchAll(/msg\.sender != publisher/g)];
    expect(gated).toHaveLength(1);
    expect(source).toMatch(/function closeWeek\(/);
    // And what moves tokens out is claim, which pays the winner in the prize.
    expect(source).toMatch(/card\.transfer\(prize\.winner, amount\)/);
  });

  it("is right that a proposed drop waits a day and can be thrown away", () => {
    const source = solidity("HolderDrop");
    expect(source).toMatch(/PUBLISH_DELAY\s*=\s*24 hours/);
    expect(source).toMatch(/function dropPending\(\) external onlyOwner/);
    expect(source).toMatch(/function propose\(bytes32 newRoot, uint256 total\) external/);
  });

  it("is right that the collection's supply cannot be changed", () => {
    expect(solidity("CardsOfCronosSetOne")).toMatch(/uint256 public immutable maxSupply/);
  });

  it("is right that royalties go to the splitter", () => {
    expect(solidity("CardsOfCronosSetOne")).toMatch(/_setDefaultRoyalty\(splitter_/);
  });
});
