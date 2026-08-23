// Where the money goes.
//
// These are the numbers with the worst failure mode in the repository. A split
// that does not add up leaves a remainder sitting wherever it landed, and a
// mistyped address is a valid-looking string that money goes to and never comes
// back from. Neither shows up as an error anywhere — which is why they are
// checked at load and checked again here.

import { describe, expect, it } from "vitest";

import { isAddress, normalise } from "@/lib/address";
import { BURN_ADDRESS, CROCARD, STREAMS, WALLETS, nameOf, walletFor } from "@/lib/revenue";

describe("the wallets", () => {
  // ── All four are null for now, and that is a fact rather than a gap. ──────
  // The Solana addresses that were here do not carry over. A stand-in — the zero
  // address, a treasury borrowed from the old dapp — reads exactly like a real
  // one on the page, and this is the file where money goes somewhere. Unknown is
  // safe; a plausible wrong address is a loss.
  //
  // The test below FAILS the day an address is filled in, which is what brings
  // somebody back here to restore the assertion that all four are set.
  it("has no addresses yet", () => {
    for (const wallet of Object.values(WALLETS)) {
      expect(wallet.address).toBeNull();
    }
  });

  it("keeps whatever is filled in normalised, so it can be compared", () => {
    for (const wallet of Object.values(WALLETS)) {
      if (wallet.address === null) continue;
      expect(isAddress(wallet.address)).toBe(true);
      // Lowercase, like every other address in the project. A wallet list in
      // checksummed case would never match anything it is compared against.
      expect(normalise(wallet.address)).toBe(wallet.address);
    }
  });

  it("are all different wallets", () => {
    // Two of these being the same address would be a split that quietly pays one
    // party twice, and it would look completely normal on the page.
    const addresses = Object.values(WALLETS)
      .map((wallet) => wallet.address)
      .filter((address): address is string => address !== null);
    expect(new Set(addresses).size).toBe(addresses.length);
  });

  it("all say what they are for", () => {
    // The page prints this line next to an address. An empty one is a wallet
    // nobody can account for.
    for (const wallet of Object.values(WALLETS)) {
      expect(wallet.what.length).toBeGreaterThan(0);
    }
  });
});

describe("the token", () => {
  it("is the $CROCARD that already exists, and the burn address already used", () => {
    // Both are carried over from the old dapp on purpose. A second burn address
    // would mean a total nobody can add up from one explorer page, and a new
    // token would leave the people who held the first one holding nothing.
    expect(isAddress(CROCARD)).toBe(true);
    expect(normalise(CROCARD)).toBe(CROCARD);
    expect(isAddress(BURN_ADDRESS)).toBe(true);
    expect(normalise(BURN_ADDRESS)).toBe(BURN_ADDRESS);
    expect(CROCARD).not.toBe(BURN_ADDRESS);
  });
});

describe("the splits", () => {
  it("each add up to exactly a hundred", () => {
    // The remainder is the dangerous half. 99% leaves 1% with no destination,
    // which in practice means it stays where it landed.
    for (const stream of STREAMS) {
      const total = stream.shares.reduce((sum, share) => sum + share.percent, 0);
      expect(total).toBe(100);
    }
  });

  it("never names the same destination twice in one stream", () => {
    // Two shares to the same place is a split somebody edited and did not
    // finish, and it sums to a hundred all the same.
    for (const stream of STREAMS) {
      const seen = stream.shares.map((share) => share.to);
      expect(new Set(seen).size).toBe(seen.length);
    }
  });

  it("has no share of nothing, and none over a hundred", () => {
    for (const stream of STREAMS) {
      for (const share of stream.shares) {
        expect(share.percent).toBeGreaterThan(0);
        expect(share.percent).toBeLessThanOrEqual(100);
      }
    }
  });

  it("is the ladder the maker settled", () => {
    const by = (id: string) => STREAMS.find((stream) => stream.id === id)!;
    const share = (id: string, to: string) =>
      by(id).shares.find((s) => s.to === to)?.percent ?? 0;

    // The pump.fun creator fee is gone rather than renamed: there is no
    // pump.fun on Cronos, and a stream that cannot happen does not belong on a
    // page that says where the money goes.
    expect(STREAMS.find((stream) => stream.id === "creator-fee")).toBeUndefined();

    expect(share("mints", "burn")).toBe(75);
    expect(share("mints", "creator")).toBe(25);

    expect(share("royalties", "burn")).toBe(75);
    expect(share("royalties", "creator")).toBe(25);

    // The one stream players pay directly, and all of it goes into the token.
    expect(share("rake", "burn")).toBe(100);
    expect(by("rake").shares).toHaveLength(1);
  });
});

describe("burning", () => {
  it("always runs through the deployer", () => {
    // One wallet does every buy-and-burn, so all of it lands somewhere anybody
    // can watch. A second burning wallet would mean a total nobody can add up.
    expect(walletFor("burn").id).toBe("deployer");
    expect(walletFor("burn").address).toBe(WALLETS.deployer.address);
    for (const stream of STREAMS) {
      for (const share of stream.shares) {
        if (share.to !== "burn") continue;
        expect(walletFor(share.to).id).toBe("deployer");
      }
    }
  });

  it("is named as itself and not as a wallet", () => {
    expect(nameOf("burn")).toMatch(/burn/i);
  });
});

describe("what is still open", () => {
  it("says so on the stream it is open about, rather than nowhere", () => {
    // The rake percentage is undecided. A page that showed "100% burn" without
    // saying 100% of what would be answering a different question.
    const rake = STREAMS.find((stream) => stream.id === "rake")!;
    expect(rake.open).toBeTruthy();
    expect(rake.live).toBe(false);
  });

  it("does not claim anything is running that is not", () => {
    // Nothing mints, nothing is staked, and nothing buys the token yet.
    expect(STREAMS.every((stream) => !stream.live)).toBe(true);
  });

  it("cannot go live while it does not know where the money goes", () => {
    // The check that makes the null addresses safe rather than merely honest.
    // Flipping `live` is one word in a diff, and nobody reviewing it would think
    // to look at the wallets a hundred lines away — so lib/revenue.ts refuses at
    // load, and this is that rule written down where it can be read.
    for (const stream of STREAMS) {
      if (!stream.live) continue;
      for (const share of stream.shares) {
        expect(walletFor(share.to).address).not.toBeNull();
      }
    }
  });
});
