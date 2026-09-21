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

import { KEYS, NOT_OURS, OURS, RENOUNCED } from "@/lib/addresses";
import { BURN_ADDRESS, CONTRACTS, CROCARD, LION, POOL, PUBLISHER, ROUTER, WALLETS } from "@/lib/revenue";

const solidity = (name: string) =>
  readFileSync(new URL(`../contracts/${name}.sol`, import.meta.url), "utf8");

describe("the contracts page", () => {
  it("lists an address in the one form everything else compares against", () => {
    for (const one of [...OURS, ...RENOUNCED, ...NOT_OURS, ...KEYS]) {
      if (one.address === null) continue;
      expect(one.address, one.name).toMatch(/^0x[0-9a-f]{40}$/);
    }
  });

  it("names no address twice", () => {
    const seen = [...OURS, ...RENOUNCED, ...NOT_OURS, ...KEYS]
      .map((one) => one.address)
      .filter((address): address is string => address !== null);
    expect(new Set(seen).size).toBe(seen.length);
  });

  it("takes its addresses from the code rather than repeating them", () => {
    // The failure this prevents: a page that keeps showing the old splitter
    // after a redeploy, which is somebody sending money to a contract that has
    // been replaced.
    const find = (id: string) =>
      [...OURS, ...RENOUNCED, ...NOT_OURS, ...KEYS].find((one) => one.id === id)!;
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

  it("says of a renounced contract what nobody can do, rather than nothing", () => {
    // The category exists to make a strong claim, so an empty entry in it is
    // worse than no entry: it reads as "we have nothing to say about this".
    for (const one of RENOUNCED) {
      expect(one.powers.length, one.name).toBeGreaterThan(0);
      expect(one.theirs, `${one.name} should say how that was checked`).toMatch(/chain|checked/i);
    }
  });

  it("puts the first collection where its owner is, not where it is convenient", () => {
    // It was under "not ours" with a line saying the contract is left exactly as
    // it was. Its owner can still change the art over all 515 and withdraw what
    // it holds, which is a live power over something people hold — and the page
    // exists to name those rather than to be comfortable.
    const first = OURS.find((one) => one.id === "first");
    expect(first, "the first collection belongs among the ones with keys").toBeDefined();
    expect(first!.powers.join(" ")).toMatch(/art is served from/i);
    expect(first!.powers.join(" ")).toMatch(/withdraw/i);
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

  it("keeps the four switches scripts/nft/mint-control.ts drives, under those names", () => {
    // That script is what opens a mint, and it hand-encodes these four by
    // signature. A setter renamed in the Solidity would not fail anywhere: the
    // selector would simply be for a function that no longer exists, the call
    // would revert, and the first anybody would know is a mint that will not
    // open at the hour it was announced for.
    const source = solidity("CardsOfCronosSetOne");
    for (const signature of [
      "function setMintPrice(uint256 price) external onlyOwner",
      "function setClaimsOpen(bool open) external onlyOwner",
      "function setSaleOpen(bool open) external onlyOwner",
      "function setBaseURI(string calldata baseURI_) external",
    ]) {
      expect(source, signature).toContain(signature);
    }
  });

  it("is right that the price starts at the one the first collection charged", () => {
    // The collection was deployed with the first one's default, which is ten
    // times what this game sells at. It is corrected with setMintPrice after
    // deploying, and mint-control refuses to open either door while it still
    // stands — so this is the fact that refusal is built on.
    expect(solidity("CardsOfCronosSetOne")).toMatch(/uint256 public mintPrice = 150 ether;/);
  });
});
